import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Set
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("logsense.correlation")

# Priority ranking for severity escalation
SEVERITY_ORDER = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}

def correlate_incidents(db: Session, project_id: str) -> List[str]:
    """
    Groups correlated anomalies into actionable incidents using:
    1. Temporal Proximity (within 15 minutes).
    2. Directed Service Dependencies (source/target topology).
    3. Shared Trace IDs.
    Returns list of incident IDs created or updated.
    """
    logger.info(f"Running incident correlation for project {project_id}")

    # 1. Fetch project service dependencies
    dep_rows = db.execute(
        text("""
            SELECT "sourceServiceId", "targetServiceId", "isRequired"
            FROM service_dependencies
            WHERE "sourceServiceId" IN (SELECT id FROM services WHERE "projectId" = :project_id)
        """),
        {"project_id": project_id}
    ).fetchall()

    direct_deps: Dict[str, Set[str]] = {}
    for r in dep_rows:
        src, tgt = str(r[0]), str(r[1])
        direct_deps.setdefault(src, set()).add(tgt)
        direct_deps.setdefault(tgt, set()).add(src)

    # 2. Fetch unlinked or recent actionable anomalies (ESCALATE, MONITOR)
    anomalies = db.execute(
        text("""
            SELECT a.id, a."serviceId", a.severity, a.status, a."firstDetectedAt",
                   a.title, a.evidence, s.name as service_name
            FROM anomalies a
            LEFT JOIN services s ON a."serviceId" = s.id
            WHERE a."projectId" = :project_id
              AND a.status IN ('ESCALATE', 'MONITOR')
            ORDER BY a."firstDetectedAt" ASC
        """),
        {"project_id": project_id}
    ).fetchall()

    if not anomalies:
        logger.info("No actionable anomalies to correlate.")
        return []

    # 3. Fetch existing OPEN incidents for this project
    open_incidents = db.execute(
        text("""
            SELECT i.id, i.severity, i.status, i."startedAt"
            FROM incidents i
            WHERE i."projectId" = :project_id AND i.status = 'OPEN'
            ORDER BY i."startedAt" DESC
        """),
        {"project_id": project_id}
    ).fetchall()

    active_incidents = []
    for inc in open_incidents:
        inc_id = str(inc[0])
        # Fetch associated anomaly services and traces
        linked = db.execute(
            text("""
                SELECT a."serviceId", a.evidence
                FROM incident_anomalies ia
                JOIN anomalies a ON ia."anomalyId" = a.id
                WHERE ia."incidentId" = :inc_id
            """),
            {"inc_id": inc_id}
        ).fetchall()

        service_ids = {str(l[0]) for l in linked if l[0]}
        traces = set()
        for l in linked:
            ev = l[1] if isinstance(l[1], dict) else {}
            if isinstance(ev, dict) and "traceIds" in ev:
                traces.update(ev["traceIds"])

        active_incidents.append({
            "id": inc_id,
            "severity": inc[1],
            "startedAt": inc[3],
            "service_ids": service_ids,
            "traces": traces,
        })

    affected_incident_ids: Set[str] = set()

    # 4. Correlate each anomaly
    for a in anomalies:
        a_id = str(a[0])
        a_svc = str(a[1]) if a[1] else None
        a_sev = str(a[2])
        a_time = a[4]
        a_title = str(a[5])
        a_ev = a[6] if isinstance(a[6], dict) else {}
        a_traces = set(a_ev.get("traceIds", [])) if isinstance(a_ev, dict) else set()
        a_svc_name = str(a[7]) if a[7] else "Microservices"

        # Check if anomaly is already linked to an incident
        already_linked = db.execute(
            text("SELECT \"incidentId\" FROM incident_anomalies WHERE \"anomalyId\" = :a_id LIMIT 1"),
            {"a_id": a_id}
        ).fetchone()

        if already_linked:
            affected_incident_ids.add(str(already_linked[0]))
            continue

        matched_incident = None

        # Try to match with existing active incident
        for inc in active_incidents:
            # Temporal proximity check (within 15 minutes)
            time_diff = abs((a_time - inc["startedAt"]).total_seconds())
            if time_diff > 15 * 60:
                continue

            # Check shared trace IDs
            if a_traces and inc["traces"] and (a_traces & inc["traces"]):
                matched_incident = inc
                break

            # Check shared service
            if a_svc and a_svc in inc["service_ids"]:
                matched_incident = inc
                break

            # Check dependency connection
            if a_svc:
                connected = direct_deps.get(a_svc, set())
                if connected & inc["service_ids"]:
                    matched_incident = inc
                    break

        if matched_incident:
            # Link to existing incident
            inc_id = matched_incident["id"]
            db.execute(
                text("""
                    INSERT INTO incident_anomalies (id, "incidentId", "anomalyId", "createdAt")
                    VALUES (:id, :inc_id, :anomaly_id, NOW())
                    ON CONFLICT ("incidentId", "anomalyId") DO NOTHING
                """),
                {"id": str(uuid.uuid4()), "inc_id": inc_id, "anomaly_id": a_id}
            )

            # Escalate severity if anomaly is more severe
            curr_rank = SEVERITY_ORDER.get(matched_incident["severity"], 1)
            new_rank = SEVERITY_ORDER.get(a_sev, 1)
            if new_rank > curr_rank:
                db.execute(
                    text("UPDATE incidents SET severity = :sev WHERE id = :id"),
                    {"sev": a_sev, "id": inc_id}
                )
                matched_incident["severity"] = a_sev

            if a_svc:
                matched_incident["service_ids"].add(a_svc)
            matched_incident["traces"].update(a_traces)
            affected_incident_ids.add(inc_id)

        else:
            # Create a new Incident
            new_inc_id = str(uuid.uuid4())
            inc_title = f"Incident: {a_sev} issue detected in {a_svc_name}"
            inc_desc = f"Correlated incident triggered by {a_title} at {a_time.strftime('%Y-%m-%d %H:%M:%S UTC')}."

            db.execute(
                text("""
                    INSERT INTO incidents (
                        id, "projectId", title, description, severity, status, "startedAt"
                    ) VALUES (
                        :id, :project_id, :title, :description, :severity, 'OPEN', :started_at
                    )
                """),
                {
                    "id": new_inc_id,
                    "project_id": project_id,
                    "title": inc_title,
                    "description": inc_desc,
                    "severity": a_sev,
                    "started_at": a_time,
                }
            )

            db.execute(
                text("""
                    INSERT INTO incident_anomalies (id, "incidentId", "anomalyId", "createdAt")
                    VALUES (:id, :inc_id, :anomaly_id, NOW())
                """),
                {"id": str(uuid.uuid4()), "inc_id": new_inc_id, "anomaly_id": a_id}
            )

            active_incidents.append({
                "id": new_inc_id,
                "severity": a_sev,
                "startedAt": a_time,
                "service_ids": {a_svc} if a_svc else set(),
                "traces": a_traces,
            })
            affected_incident_ids.add(new_inc_id)

    db.commit()
    logger.info(f"Incident correlation complete. Touched {len(affected_incident_ids)} incidents.")
    return list(affected_incident_ids)
