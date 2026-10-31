import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("logsense.anomaly")

def detect_and_evaluate_anomalies(
    db: Session,
    project_id: str,
    target_cluster_ids: Optional[List[str]] = None
) -> List[dict]:
    """
    Analyzes log clusters and entries for a project to detect:
    1. Frequency Spikes: Clusters experiencing abnormal occurrence rate surges.
    2. New Patterns: Newly discovered log templates, especially with ERROR/WARN severity.
    Evaluates severity (CRITICAL, HIGH, MEDIUM, LOW) and status (RECORD, MONITOR, ESCALATE).
    """
    logger.info(f"Running anomaly detection for project {project_id}")
    detected_anomalies = []

    # 1. Fetch clusters and their associated services
    cluster_query = """
        SELECT lc.id, lc."drainClusterId", lc.template, lc."occurrenceCount",
               lc."firstSeenAt", lc."lastSeenAt", ps."serviceId", s.name as service_name
        FROM log_clusters lc
        JOIN parser_states ps ON lc."parserStateId" = ps.id
        LEFT JOIN services s ON ps."serviceId" = s.id
        WHERE ps."projectId" = :project_id
    """
    params: dict = {"project_id": project_id}
    if target_cluster_ids:
        cluster_query += " AND lc.id = ANY(:cluster_ids)"
        params["cluster_ids"] = target_cluster_ids

    clusters = db.execute(text(cluster_query), params).fetchall()

    for row in clusters:
        cluster_id = str(row[0])
        drain_cid = row[1]
        template = str(row[2])
        occurrence_count = row[3]
        first_seen = row[4]
        last_seen = row[5]
        service_id = str(row[6]) if row[6] else None
        service_name = str(row[7]) if row[7] else "unassigned"

        # Check dominant log level and sample traces for this cluster
        entry_meta = db.execute(
            text("""
                SELECT level, "rawMessage", "traceId"
                FROM log_entries
                WHERE "clusterId" = :cluster_id
                ORDER BY timestamp DESC
                LIMIT 10
            """),
            {"cluster_id": cluster_id}
        ).fetchall()

        if not entry_meta:
            continue

        dominant_level = entry_meta[0][0].upper()
        sample_raw = entry_meta[0][1]
        sample_traces = list({str(e[2]) for e in entry_meta if e[2]})

        is_error = dominant_level in ("ERROR", "FATAL", "CRITICAL")
        is_warn = dominant_level in ("WARN", "WARNING")

        # ----------------------------------------------------
        # Detection A: Frequency Spike Detection
        # ----------------------------------------------------
        # Query 1-minute bucket counts for this cluster
        bucket_rows = db.execute(
            text("""
                SELECT date_trunc('minute', timestamp) as bucket, COUNT(*) as cnt
                FROM log_entries
                WHERE "clusterId" = :cluster_id
                GROUP BY bucket
                ORDER BY bucket ASC
            """),
            {"cluster_id": cluster_id}
        ).fetchall()

        if len(bucket_rows) >= 2:
            counts = [b[1] for b in bucket_rows]
            peak_count = max(counts)
            # Baseline is calculated across other buckets (excluding peak)
            non_peak = [c for c in counts if c < peak_count]
            baseline_avg = sum(non_peak) / len(non_peak) if non_peak else float(counts[0])

            # Spike threshold: current peak > max(5, baseline * 3)
            spike_threshold = max(5, baseline_avg * 3.0)
            if peak_count >= spike_threshold and peak_count >= 5:
                # Evaluate severity and impact
                if is_error:
                    severity = "CRITICAL"
                    status = "ESCALATE"
                elif is_warn:
                    severity = "HIGH"
                    status = "MONITOR"
                else:
                    severity = "MEDIUM"
                    status = "MONITOR"

                title = f"Frequency spike ({peak_count} logs/min) in '{service_name}'"
                description = (
                    f"Cluster '{template[:80]}' in {service_name} experienced an abnormal spike "
                    f"of {peak_count} occurrences per minute (baseline average: {baseline_avg:.1f})."
                )

                evidence = {
                    "clusterId": cluster_id,
                    "drainClusterId": drain_cid,
                    "template": template,
                    "peakCount": peak_count,
                    "baselineAverage": round(baseline_avg, 2),
                    "dominantLevel": dominant_level,
                    "sampleMessage": sample_raw,
                    "traceIds": sample_traces[:5],
                }

                anomaly_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO anomalies (
                            id, "projectId", "serviceId", "clusterId",
                            "anomalyType", title, description, severity, status,
                            "occurrenceCount", "firstDetectedAt", "lastDetectedAt", evidence
                        ) VALUES (
                            :id, :project_id, :service_id, :cluster_id,
                            'SPIKE', :title, :description, :severity, :status,
                            :occ, :first_seen, :last_seen, CAST(:evidence AS jsonb)
                        )
                    """),
                    {
                        "id": anomaly_id,
                        "project_id": project_id,
                        "service_id": service_id,
                        "cluster_id": cluster_id,
                        "title": title,
                        "description": description,
                        "severity": severity,
                        "status": status,
                        "occ": peak_count,
                        "first_seen": first_seen,
                        "last_seen": last_seen,
                        "evidence": json.dumps(evidence),
                    }
                )
                detected_anomalies.append({
                    "id": anomaly_id,
                    "type": "SPIKE",
                    "title": title,
                    "severity": severity,
                    "serviceId": service_id,
                    "serviceName": service_name,
                })

        # ----------------------------------------------------
        # Detection B: New Pattern Detection
        # ----------------------------------------------------
        # If this is a newly discovered pattern with ERROR or WARN severity
        if is_error or is_warn:
            # Check if already flagged recently
            existing = db.execute(
                text("""
                    SELECT id FROM anomalies
                    WHERE "clusterId" = :cluster_id AND "anomalyType" = 'NEW_PATTERN'
                    LIMIT 1
                """),
                {"cluster_id": cluster_id}
            ).fetchone()

            if not existing:
                if is_error:
                    severity = "CRITICAL" if occurrence_count > 10 else "HIGH"
                    status = "ESCALATE" if occurrence_count > 15 else "MONITOR"
                else:
                    severity = "MEDIUM"
                    status = "MONITOR"

                title = f"New error pattern in '{service_name}': {template[:60]}"
                description = (
                    f"Drain3 mined a new structural error pattern in service '{service_name}'. "
                    f"Observed {occurrence_count} time(s). Template: {template}"
                )

                evidence = {
                    "clusterId": cluster_id,
                    "drainClusterId": drain_cid,
                    "template": template,
                    "occurrenceCount": occurrence_count,
                    "dominantLevel": dominant_level,
                    "sampleMessage": sample_raw,
                    "traceIds": sample_traces[:5],
                }

                anomaly_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO anomalies (
                            id, "projectId", "serviceId", "clusterId",
                            "anomalyType", title, description, severity, status,
                            "occurrenceCount", "firstDetectedAt", "lastDetectedAt", evidence
                        ) VALUES (
                            :id, :project_id, :service_id, :cluster_id,
                            'NEW_PATTERN', :title, :description, :severity, :status,
                            :occ, :first_seen, :last_seen, CAST(:evidence AS jsonb)
                        )
                    """),
                    {
                        "id": anomaly_id,
                        "project_id": project_id,
                        "service_id": service_id,
                        "cluster_id": cluster_id,
                        "title": title,
                        "description": description,
                        "severity": severity,
                        "status": status,
                        "occ": occurrence_count,
                        "first_seen": first_seen,
                        "last_seen": last_seen,
                        "evidence": json.dumps(evidence),
                    }
                )
                detected_anomalies.append({
                    "id": anomaly_id,
                    "type": "NEW_PATTERN",
                    "title": title,
                    "severity": severity,
                    "serviceId": service_id,
                    "serviceName": service_name,
                })

    db.commit()
    logger.info(f"Anomaly detection complete. Found {len(detected_anomalies)} anomalies.")
    return detected_anomalies
