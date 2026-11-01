import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Set, Any
from collections import defaultdict
from sqlalchemy import text
from sqlalchemy.orm import Session
from intelligence.template_normalizer import normalize_template

logger = logging.getLogger("logsense.correlation")

SEVERITY_ORDER = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}

CORRELATION_WINDOW_MINUTES = 5


def extract_failure_domains(text_val: str) -> Set[str]:
    """Extracts high-level failure infrastructure domains to enforce affinity during correlation."""
    tokens = set()
    t_lower = text_val.lower()
    if any(k in t_lower for k in ["postgres", "database", "deadlock", "lock", "table", "hikaripool", "connection pool", "sql", "psql"]):
        tokens.add("database")
    if any(k in t_lower for k in ["redis", "cache", "memcached"]):
        tokens.add("cache")
    if any(k in t_lower for k in ["ssl", "tls", "handshake", "certificate", "cipher"]):
        tokens.add("security")
    if any(k in t_lower for k in ["502", "503", "504", "gateway", "timeout", "timed out", "circuit breaker", "upstream"]):
        tokens.add("gateway")
    if any(k in t_lower for k in ["socket", "connection reset", "broken pipe", "connection refused", "network"]):
        tokens.add("network")
    if any(k in t_lower for k in ["oom", "out of memory", "heap", "memory limit", "allocation failed", "maxmemory"]):
        tokens.add("memory")
    return tokens


def correlate_incidents(db: Session, project_id: str) -> List[str]:
    """
    Implements Part 6 of the LogSense Specification:
    Groups related statistical anomalies into coherent incidents when there is
    evidence of a common disturbance:
    1. Same project / dataset analysis.
    2. Temporal proximity within a 5-minute correlation window.
    3. Shared affected clusters or cascade relationships.
    Avoids duplicate incidents by accumulating anomaly evidence into active incidents.
    Optimized for batch database execution (0 per-anomaly query roundtrips).
    """
    logger.info(f"Running incident correlation for project {project_id}")

    # 1. Fetch actionable anomalies for this project in 1 query
    anomalies = db.execute(
        text("""
            SELECT a.id, a."clusterId", a.severity, a.status, a."firstDetectedAt",
                   a.title, a.evidence, a."anomalyType", lc.template
            FROM anomalies a
            LEFT JOIN log_clusters lc ON a."clusterId" = lc.id
            WHERE a."projectId" = :project_id
            ORDER BY a."firstDetectedAt" ASC
        """),
        {"project_id": project_id}
    ).fetchall()

    if not anomalies:
        logger.info("No anomalies available for correlation.")
        return []

    # 2. Fetch existing OPEN incidents and their linked anomalies in 2 single batch queries
    open_incidents_rows = db.execute(
        text("""
            SELECT i.id, i.severity, i.status, i."startedAt", i.title
            FROM incidents i
            WHERE i."projectId" = :project_id AND i.status = 'OPEN'
            ORDER BY i."startedAt" ASC
        """),
        {"project_id": project_id}
    ).fetchall()

    linked_rows = db.execute(
        text("""
            SELECT ia."incidentId", a.id, a."clusterId", a."firstDetectedAt"
            FROM incident_anomalies ia
            JOIN anomalies a ON ia."anomalyId" = a.id
            JOIN incidents i ON ia."incidentId" = i.id
            WHERE i."projectId" = :project_id AND i.status = 'OPEN'
        """),
        {"project_id": project_id}
    ).fetchall()

    linked_by_incident: Dict[str, List[tuple]] = defaultdict(list)
    already_linked_anomaly_map: Dict[str, str] = {}
    for r in linked_rows:
        inc_id = str(r[0])
        a_id = str(r[1])
        linked_by_incident[inc_id].append(r)
        already_linked_anomaly_map[a_id] = inc_id

    active_incidents = []
    for inc in open_incidents_rows:
        inc_id = str(inc[0])
        linked = linked_by_incident.get(inc_id, [])

        cluster_ids = {str(l[2]) for l in linked if l[2]}
        earliest_time = inc[3]
        latest_time = inc[3]
        for l in linked:
            t = l[3]
            if t < earliest_time:
                earliest_time = t
            if t > latest_time:
                latest_time = t

        norm_inc = normalize_template(inc[4])
        active_incidents.append({
            "id": inc_id,
            "severity": inc[1],
            "title": inc[4],
            "startedAt": earliest_time,
            "lastEventAt": latest_time,
            "cluster_ids": cluster_ids,
            "affected_cluster_ids": set(),
            "anomaly_ids": {str(l[1]) for l in linked},
            "category": norm_inc.get("category", ""),
            "domains": extract_failure_domains(inc[4]),
        })

    affected_incident_ids: Set[str] = set()
    new_incidents_to_insert = []
    incident_anomalies_to_insert = []
    severity_updates = {}
    title_updates = {}

    for a in anomalies:
        a_id = str(a[0])
        a_cid = str(a[1]) if a[1] else None
        a_sev = str(a[2])
        a_time: datetime = a[4]
        a_title = str(a[5])
        a_ev = a[6] if isinstance(a[6], dict) else {}
        a_type = str(a[7])
        a_template = str(a[8]) if a[8] else a_title

        # Check if already linked via in-memory map
        if a_id in already_linked_anomaly_map:
            affected_incident_ids.add(already_linked_anomaly_map[a_id])
            continue

        # Extract affected cluster IDs from evidence
        a_affected_cids = set()
        if isinstance(a_ev, dict) and "affectedClusters" in a_ev:
            for aff in a_ev["affectedClusters"]:
                if isinstance(aff, dict) and "clusterId" in aff:
                    a_affected_cids.add(str(aff["clusterId"]))

        matched_incident = None

        # Correlate within 5-minute disturbance window WITH SIMILARITY REQUIREMENT
        a_norm = normalize_template(a_template or a_title)
        a_category = a_norm.get("category", "")
        a_domains = extract_failure_domains(f"{a_template} {a_title}")

        for inc in active_incidents:
            time_delta_to_start = abs((a_time - inc["startedAt"]).total_seconds()) / 60.0
            time_delta_to_latest = abs((a_time - inc["lastEventAt"]).total_seconds()) / 60.0

            # If the anomaly occurred more than CORRELATION_WINDOW_MINUTES after the incident's latest event,
            # this disturbance has cooled down. Do NOT merge!
            if time_delta_to_latest > CORRELATION_WINDOW_MINUTES:
                continue

            # Prevent unbounded rolling window: if time from startedAt exceeds 20 minutes,
            # only merge if there is explicit cluster overlap
            if time_delta_to_start > 20.0 and not (a_cid and a_cid in inc["cluster_ids"]):
                continue

            # Strict Similarity & Causal Affinity Checks:
            # 1. Direct Pattern Identity: same failure cluster re-spiking
            has_cluster_overlap = bool(a_cid and (a_cid in inc["cluster_ids"]))

            # 2. Cascading Causal Chain: anomaly cluster was identified as an affected cluster, or vice versa
            has_affected_overlap = bool(a_affected_cids & inc["cluster_ids"]) or bool(
                a_cid and (a_cid in inc.get("affected_cluster_ids", set()))
            )

            # 3. Domain & Category Similarity: both belong to same functional category
            inc_category = inc.get("category", "")
            has_category_overlap = bool(a_category and inc_category and a_category == inc_category)

            # 4. Infrastructure Domain Overlap (e.g. database, cache, security, gateway, network, memory)
            inc_domains = inc.get("domains", set())
            has_domain_overlap = bool(a_domains & inc_domains)

            # 5. Overall application error surge merges if contemporaneous with this active incident
            is_overall_surge = (a_type == "SPIKE" and not a_cid)

            is_similar = (
                has_cluster_overlap
                or has_affected_overlap
                or has_category_overlap
                or has_domain_overlap
                or is_overall_surge
            )

            # Merges ONLY if BOTH in the 5-min window AND similar/causally linked!
            if is_similar and time_delta_to_latest <= CORRELATION_WINDOW_MINUTES:
                matched_incident = inc
                break

        if matched_incident:
            inc_id = matched_incident["id"]
            incident_anomalies_to_insert.append({
                "id": str(uuid.uuid4()),
                "inc_id": inc_id,
                "anomaly_id": a_id,
            })
            already_linked_anomaly_map[a_id] = inc_id

            curr_rank = SEVERITY_ORDER.get(matched_incident["severity"], 1)
            new_rank = SEVERITY_ORDER.get(a_sev, 1)
            if new_rank > curr_rank:
                matched_incident["severity"] = a_sev
                severity_updates[inc_id] = a_sev

            if a_cid:
                matched_incident["cluster_ids"].add(a_cid)
            matched_incident["cluster_ids"].update(a_affected_cids)
            matched_incident.setdefault("affected_cluster_ids", set()).update(a_affected_cids)
            matched_incident.setdefault("domains", set()).update(a_domains)
            matched_incident["anomaly_ids"].add(a_id)

            if a_time > matched_incident["lastEventAt"]:
                matched_incident["lastEventAt"] = a_time

            # If the incident title is generic and this anomaly has a specific structural failure template, upgrade title
            if (matched_incident["title"].startswith("Overall Error Surge") or matched_incident["title"].startswith("System Anomaly")) and a_cid and a_template:
                norm_m = normalize_template(a_template)
                if norm_m["isMatched"]:
                    matched_incident["title"] = norm_m["displayTitle"]
                    title_updates[inc_id] = (norm_m["displayTitle"], norm_m["shortDescription"])

            affected_incident_ids.add(inc_id)

        else:
            new_inc_id = str(uuid.uuid4())
            norm_meta = normalize_template(a_template)
            inc_title = norm_meta["displayTitle"]
            inc_desc = norm_meta["shortDescription"]
            new_domains = extract_failure_domains(f"{a_template} {a_title}")

            new_incidents_to_insert.append({
                "id": new_inc_id,
                "project_id": project_id,
                "title": inc_title,
                "description": inc_desc,
                "severity": a_sev,
                "started_at": a_time,
            })

            incident_anomalies_to_insert.append({
                "id": str(uuid.uuid4()),
                "inc_id": new_inc_id,
                "anomaly_id": a_id,
            })
            already_linked_anomaly_map[a_id] = new_inc_id

            active_incidents.append({
                "id": new_inc_id,
                "severity": a_sev,
                "title": inc_title,
                "startedAt": a_time,
                "lastEventAt": a_time,
                "cluster_ids": {a_cid} if a_cid else set(),
                "affected_cluster_ids": a_affected_cids.copy(),
                "anomaly_ids": {a_id},
                "category": norm_meta.get("category", ""),
                "domains": new_domains,
            })

            affected_incident_ids.add(new_inc_id)

    # 3. Batch commit all changes in 3 bulk queries
    if new_incidents_to_insert:
        db.execute(
            text("""
                INSERT INTO incidents (id, "projectId", title, description, severity, status, "startedAt")
                VALUES (:id, :project_id, :title, :description, :severity, 'OPEN', :started_at)
            """),
            new_incidents_to_insert
        )

    if incident_anomalies_to_insert:
        db.execute(
            text("""
                INSERT INTO incident_anomalies (id, "incidentId", "anomalyId", "createdAt")
                VALUES (:id, :inc_id, :anomaly_id, NOW())
                ON CONFLICT ("incidentId", "anomalyId") DO NOTHING
            """),
            incident_anomalies_to_insert
        )

    for inc_id, sev in severity_updates.items():
        db.execute(
            text("UPDATE incidents SET severity = :sev WHERE id = :id"),
            {"sev": sev, "id": inc_id}
        )

    for inc_id, (t, d) in title_updates.items():
        db.execute(
            text("UPDATE incidents SET title = :t, description = :d WHERE id = :id"),
            {"t": t, "d": d, "id": inc_id}
        )

    db.commit()
    logger.info(f"Incident correlation completed. Total {len(affected_incident_ids)} incidents active/updated.")
    return list(affected_incident_ids)
