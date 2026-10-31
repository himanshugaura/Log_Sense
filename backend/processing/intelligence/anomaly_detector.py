import math
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict
from sqlalchemy import text
from sqlalchemy.orm import Session

from intelligence.template_normalizer import normalize_template

logger = logging.getLogger("logsense.anomaly")

MIN_SPIKE_COUNT = 3

def calculate_mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)

def calculate_sample_std_dev(values: List[float], mean: float) -> float:
    """Calculates sample standard deviation (n-1). Returns 0.0 if n < 2."""
    n = len(values)
    if n < 2:
        return 0.0
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    return math.sqrt(variance)

def calculate_spike_points(z_score: float) -> int:
    """
    Z-score | Points
    Below 2 | 0
    2-below 3 | 2
    3-below 4 | 3
    4 or higher | 5
    """
    if z_score < 2.0:
        return 0
    elif z_score < 3.0:
        return 2
    elif z_score < 4.0:
        return 3
    else:
        return 5

def calculate_severity_points(level: str) -> int:
    """
    Severity points:
    DEBUG: 0
    INFO: 0
    WARN: 1
    ERROR: 3
    FATAL: 5
    """
    lvl = (level or "INFO").upper()
    if lvl in ("FATAL", "CRITICAL"):
        return 5
    elif lvl in ("ERROR", "ERR"):
        return 3
    elif lvl in ("WARN", "WARNING"):
        return 1
    return 0

def calculate_occurrence_points(count: int) -> int:
    """
    Occurrences in first minute | Points
    1 | 0
    2-4 | 1
    5-9 | 2
    10-24 | 3
    25+ | 4
    """
    if count <= 1:
        return 0
    elif count <= 4:
        return 1
    elif count <= 9:
        return 2
    elif count <= 24:
        return 3
    else:
        return 4

def classify_score(total: int) -> str:
    """
    Score | Classification
    0-3   | Low
    4-7   | Moderate
    8-11  | High
    12-17 | Critical
    """
    if total <= 3:
        return "LOW"
    elif total <= 7:
        return "MEDIUM"
    elif total <= 11:
        return "HIGH"
    else:
        return "CRITICAL"

def detect_and_evaluate_anomalies(
    db: Session,
    project_id: str,
    target_cluster_ids: Optional[List[str]] = None,
    precomputed_buckets: Optional[List[tuple]] = None,
) -> List[dict]:
    """
    Implements Parts 2, 3, 4, and 5 of the LogSense Specification:
    1. Statistical Spike Detection using 5-minute historical baseline vs current 1-minute window
       (Mean, Sample Std Dev, Threshold = Mean + 2*StdDev, Z-Score).
    2. Overall dataset error-rate spike detection and individual cluster-level spike detection.
    3. New Pattern Detection for newly formed Drain3 clusters.
    4. Affected Cluster Analysis: checks other existing clusters in the surrounding window.
    5. Point-based heuristic scoring (0-17 points) with Low/Medium/High/Critical classification.
    """
    logger.info(f"Running statistical anomaly detection for project {project_id}")
    detected_anomalies = []
    anomalies_to_insert = []

    # 1. Fetch all clusters for the project
    cluster_rows = db.execute(
        text("""
            SELECT lc.id, lc."drainClusterId", lc.template, lc."occurrenceCount",
                   lc."firstSeenAt", lc."lastSeenAt"
            FROM log_clusters lc
            JOIN parser_states ps ON lc."parserStateId" = ps.id
            WHERE ps."projectId" = :project_id
        """),
        {"project_id": project_id}
    ).fetchall()

    clusters_by_id = {
        str(row[0]): {
            "id": str(row[0]),
            "drainClusterId": row[1],
            "template": str(row[2]),
            "occurrenceCount": row[3],
            "firstSeenAt": row[4],
            "lastSeenAt": row[5],
        }
        for row in cluster_rows
    }

    if not clusters_by_id:
        logger.info("No clusters found for anomaly detection.")
        return []

    # 2. Fetch or reuse 1-minute bucket time-series of log entries across the project
    # Grouped by (minute_bucket, cluster_id, level)
    if precomputed_buckets is not None:
        bucket_rows = precomputed_buckets
    else:
        bucket_rows = db.execute(
            text("""
                SELECT date_trunc('minute', timestamp) as minute_bucket,
                       "clusterId",
                       level,
                       COUNT(*) as cnt,
                       MIN(timestamp) as min_ts,
                       MAX("serviceName") as sample_service
                FROM log_entries
                WHERE "projectId" = :project_id AND "clusterId" IS NOT NULL
                GROUP BY minute_bucket, "clusterId", level
                ORDER BY minute_bucket ASC
            """),
            {"project_id": project_id}
        ).fetchall()

    if not bucket_rows:
        logger.info("No log entry time buckets found.")
        return []

    # Organize buckets into sorted timeline: minute -> cluster_id -> count
    # Also track overall ERROR/FATAL counts per minute
    minute_cluster_counts: Dict[datetime, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    minute_overall_errors: Dict[datetime, int] = defaultdict(int)
    cluster_minute_levels: Dict[Tuple[datetime, str], str] = {}
    cluster_first_timestamps: Dict[str, datetime] = {}
    cluster_sample_service: Dict[str, str] = {}

    for row in bucket_rows:
        m_dt: datetime = row[0]
        cid = str(row[1])
        lvl = str(row[2]).upper()
        cnt = int(row[3])
        first_ts = row[4]
        svc = row[5]

        minute_cluster_counts[m_dt][cid] += cnt
        cluster_minute_levels[(m_dt, cid)] = lvl

        if lvl in ("ERROR", "FATAL", "CRITICAL"):
            minute_overall_errors[m_dt] += cnt

        if cid not in cluster_first_timestamps or first_ts < cluster_first_timestamps[cid]:
            cluster_first_timestamps[cid] = first_ts
        if svc and cid not in cluster_sample_service:
            cluster_sample_service[cid] = svc

    all_minutes = sorted(minute_cluster_counts.keys())
    minute_indices = {m: i for i, m in enumerate(all_minutes)}

    # Helper: get previous 5 completed 1-minute window counts for a cluster
    def get_cluster_5min_baseline(target_cid: str, curr_idx: int) -> List[float]:
        # Baseline consists of up to 5 immediately preceding minutes
        start_idx = max(0, curr_idx - 5)
        counts = []
        for i in range(start_idx, curr_idx):
            m = all_minutes[i]
            counts.append(float(minute_cluster_counts[m].get(target_cid, 0)))
        # Pad with 0s if fewer than 5 windows exist prior
        while len(counts) < 5:
            counts.insert(0, 0.0)
        return counts

    # Helper: get overall error 5-minute baseline
    def get_overall_error_5min_baseline(curr_idx: int) -> List[float]:
        start_idx = max(0, curr_idx - 5)
        counts = []
        for i in range(start_idx, curr_idx):
            m = all_minutes[i]
            counts.append(float(minute_overall_errors.get(m, 0)))
        while len(counts) < 5:
            counts.insert(0, 0.0)
        return counts

    # Track anomalies created in this run to avoid duplicates
    existing_anomalies_rows = db.execute(
        text("SELECT \"clusterId\", \"anomalyType\", \"firstDetectedAt\" FROM anomalies WHERE \"projectId\" = :project_id"),
        {"project_id": project_id}
    ).fetchall()
    existing_set = {(str(r[0]) if r[0] else "", str(r[1]), r[2]) for r in existing_anomalies_rows}

    # 3. Detect Overall Error Rate Spikes (Section 2.6)
    for idx, curr_minute in enumerate(all_minutes):
        current_error_count = minute_overall_errors.get(curr_minute, 0)
        if current_error_count < MIN_SPIKE_COUNT:
            continue

        baseline_counts = get_overall_error_5min_baseline(idx)
        b_mean = calculate_mean(baseline_counts)
        b_std = calculate_sample_std_dev(baseline_counts, b_mean)

        spike_detected = False
        if b_mean == 0.0 and b_std == 0.0:
            spike_detected = current_error_count >= MIN_SPIKE_COUNT
            z_score = float(current_error_count)
            threshold = float(MIN_SPIKE_COUNT)
        else:
            threshold = b_mean + (2.0 * b_std)
            spike_detected = current_error_count > threshold
            z_score = (current_error_count - b_mean) / b_std if b_std > 0 else (current_error_count - b_mean)

        if spike_detected and z_score >= 2.0:
            spike_pts = calculate_spike_points(z_score)
            dedup_key = ("", "SPIKE", curr_minute)
            if dedup_key not in existing_set:
                anomaly_id = str(uuid.uuid4())
                title = f"Overall Error Surge ({current_error_count} errs/min, Z={z_score:.1f})"
                desc = (
                    f"Application experienced an overall error surge of {current_error_count} errors/min "
                    f"against a 5-minute baseline mean of {b_mean:.1f} (std dev: {b_std:.2f}, threshold: {threshold:.1f})."
                )
                evidence = {
                    "displayTitle": f"Overall Error Surge ({current_error_count} errs/min)",
                    "shortDescription": f"Application experienced an overall error surge of {current_error_count} errors/min against baseline.",
                    "baseline": {
                        "windowMinutes": 5,
                        "counts": baseline_counts,
                        "mean": round(b_mean, 2),
                        "standardDeviation": round(b_std, 2),
                    },
                    "currentWindow": {
                        "timestamp": curr_minute.isoformat(),
                        "count": current_error_count,
                    },
                    "detection": {
                        "zScore": round(z_score, 2),
                        "threshold": round(threshold, 2),
                        "isSpike": True,
                    },
                    "scoring": {
                        "spikePoints": spike_pts,
                    },
                }

                anomalies_to_insert.append({
                    "id": anomaly_id,
                    "project_id": project_id,
                    "cluster_id": None,
                    "service_name": "application",
                    "anomaly_type": "SPIKE",
                    "title": title,
                    "description": desc,
                    "severity": "CRITICAL",
                    "status": "ESCALATE",
                    "occ": current_error_count,
                    "first_seen": curr_minute,
                    "last_seen": curr_minute,
                    "evidence": json.dumps(evidence),
                })
                existing_set.add(dedup_key)
                detected_anomalies.append({
                    "id": anomaly_id,
                    "type": "SPIKE",
                    "title": title,
                    "severity": "CRITICAL",
                    "clusterId": None,
                })

    # 4. Individual Cluster Evaluation: Spikes, New Patterns, and Affected Clusters
    # Identify unique clusters present in dataset
    all_cluster_ids = list(clusters_by_id.keys())

    for cid in all_cluster_ids:
        cl_meta = clusters_by_id[cid]
        template = cl_meta["template"]
        first_seen_ts = cl_meta["firstSeenAt"]
        svc_name = cluster_sample_service.get(cid, "system")

        # Find the minute bucket in which this cluster first appeared
        first_minute = min([m for m in all_minutes if minute_cluster_counts[m].get(cid, 0) > 0], default=None)
        if not first_minute:
            continue

        first_idx = minute_indices[first_minute]
        first_min_count = minute_cluster_counts[first_minute].get(cid, 0)
        dominant_lvl = cluster_minute_levels.get((first_minute, cid), "INFO")

        # A: Check if this cluster is a Genuinely NEW PATTERN (Section 3)
        # Newly appearing cluster with non-trivial severity or count
        is_error = dominant_lvl in ("ERROR", "FATAL", "CRITICAL")
        is_warn = dominant_lvl in ("WARN", "WARNING")

        # Check subsequent windows for recurrence (Section 3 point 6)
        subsequent_recurrence = 0
        for next_i in range(first_idx + 1, min(len(all_minutes), first_idx + 4)):
            m_next = all_minutes[next_i]
            if minute_cluster_counts[m_next].get(cid, 0) > 0:
                subsequent_recurrence += 1

        recurrence_points = min(2, subsequent_recurrence)

        # B: Check Other Clusters for Impact around this event (Section 4)
        # Inspect [-5 mins, first_minute, +5 mins]
        affected_clusters = []
        for other_cid in all_cluster_ids:
            if other_cid == cid:
                continue
            other_meta = clusters_by_id[other_cid]
            other_template = other_meta["template"]

            # Calculate other cluster's baseline in the 5 minutes preceding this trigger
            other_baseline = get_cluster_5min_baseline(other_cid, first_idx)
            other_b_mean = calculate_mean(other_baseline)
            other_b_std = calculate_sample_std_dev(other_baseline, other_b_mean)

            # Check other cluster count in the same minute window
            other_curr_count = minute_cluster_counts[first_minute].get(other_cid, 0)

            # Determine whether other cluster experienced a spike
            other_spike = False
            if other_b_mean == 0.0 and other_b_std == 0.0:
                other_spike = other_curr_count >= MIN_SPIKE_COUNT
                other_z = float(other_curr_count)
                other_thresh = float(MIN_SPIKE_COUNT)
            else:
                other_thresh = other_b_mean + (2.0 * other_b_std)
                other_spike = other_curr_count > other_thresh
                other_z = (other_curr_count - other_b_mean) / other_b_std if other_b_std > 0 else (other_curr_count - other_b_mean)

            if other_spike and other_curr_count >= 2:
                other_first_seen = cluster_first_timestamps.get(other_cid, first_minute)
                affected_clusters.append({
                    "clusterId": other_cid,
                    "template": other_template[:80],
                    "baselineMean": round(other_b_mean, 2),
                    "baselineStd": round(other_b_std, 2),
                    "currentCount": other_curr_count,
                    "threshold": round(other_thresh, 2),
                    "zScore": round(other_z, 2),
                    "firstAbnormalAt": other_first_seen.isoformat(),
                })

        # Calculate affected clusters points (0-4)
        other_spiking_points = min(4, len(affected_clusters))

        # Temporal precedence points (0-2)
        # Did this trigger appear slightly earlier or clearly before affected clusters?
        temporal_precedence_points = 0
        if affected_clusters:
            earlier_count = sum(
                1 for aff in affected_clusters
                if cluster_first_timestamps.get(cid, first_minute) < datetime.fromisoformat(aff["firstAbnormalAt"])
            )
            if earlier_count == len(affected_clusters):
                temporal_precedence_points = 2
            elif earlier_count > 0:
                temporal_precedence_points = 1
            else:
                temporal_precedence_points = 0

        # Calculate Points according to PART 5
        sev_points = calculate_severity_points(dominant_lvl)
        occ_points = calculate_occurrence_points(first_min_count)
        total_pattern_points = (
            sev_points
            + occ_points
            + other_spiking_points
            + recurrence_points
            + temporal_precedence_points
        )
        total_pattern_points = min(17, total_pattern_points)
        classification = classify_score(total_pattern_points)

        # Flag NEW_PATTERN anomaly if points >= 4 or (is_error and first_min_count >= 2)
        if total_pattern_points >= 4 or (is_error and first_min_count >= 2) or (is_warn and first_min_count >= 5):
            dedup_key = (cid, "NEW_PATTERN", first_minute)
            if dedup_key not in existing_set:
                anomaly_id = str(uuid.uuid4())
                clean_template_snippet = template[:60]
                title = f"New Pattern: '{clean_template_snippet}' ({classification}, {total_pattern_points}/17 pts)"
                desc = (
                    f"New pattern discovered: '{template[:120]}'. "
                    f"Observed {first_min_count} time(s) in first minute. "
                    f"Severity pts: {sev_points}, Occurrences pts: {occ_points}, "
                    f"Affected clusters: {len(affected_clusters)} ({other_spiking_points} pts), "
                    f"Recurrence pts: {recurrence_points}, Precedence pts: {temporal_precedence_points}. "
                    f"Total Score: {total_pattern_points}/17."
                )

                norm = normalize_template(template)
                evidence = {
                    "clusterId": cid,
                    "template": template,
                    "displayTitle": norm["displayTitle"],
                    "shortDescription": norm["shortDescription"],
                    "firstMinute": first_minute.isoformat(),
                    "firstMinuteCount": first_min_count,
                    "dominantLevel": dominant_lvl,
                    "scoring": {
                        "severityPoints": sev_points,
                        "occurrencePoints": occ_points,
                        "otherClustersSpikingPoints": other_spiking_points,
                        "recurrencePoints": recurrence_points,
                        "temporalPrecedencePoints": temporal_precedence_points,
                        "totalPoints": total_pattern_points,
                        "maxPoints": 17,
                        "classification": classification,
                    },
                    "affectedClusters": affected_clusters,
                }

                status_val = "ESCALATE" if classification in ("CRITICAL", "HIGH") else "MONITOR"

                anomalies_to_insert.append({
                    "id": anomaly_id,
                    "project_id": project_id,
                    "cluster_id": cid,
                    "service_name": svc_name,
                    "anomaly_type": "NEW_PATTERN",
                    "title": title,
                    "description": desc,
                    "severity": classification,
                    "status": status_val,
                    "occ": first_min_count,
                    "first_seen": first_minute,
                    "last_seen": first_minute,
                    "evidence": json.dumps(evidence),
                })
                existing_set.add(dedup_key)
                detected_anomalies.append({
                    "id": anomaly_id,
                    "type": "NEW_PATTERN",
                    "title": title,
                    "severity": classification,
                    "clusterId": cid,
                    "points": total_pattern_points,
                })

        # C: Check Individual Cluster Frequency Spikes across all minutes (Section 2.6)
        for idx, m_time in enumerate(all_minutes):
            curr_count = minute_cluster_counts[m_time].get(cid, 0)
            if curr_count < MIN_SPIKE_COUNT:
                continue

            baseline_counts = get_cluster_5min_baseline(cid, idx)
            b_mean = calculate_mean(baseline_counts)
            b_std = calculate_sample_std_dev(baseline_counts, b_mean)

            spike_detected = False
            if b_mean == 0.0 and b_std == 0.0:
                spike_detected = curr_count >= MIN_SPIKE_COUNT
                z_score = float(curr_count)
                threshold = float(MIN_SPIKE_COUNT)
            else:
                threshold = b_mean + (2.0 * b_std)
                spike_detected = curr_count > threshold
                z_score = (curr_count - b_mean) / b_std if b_std > 0 else (curr_count - b_mean)

            if spike_detected and z_score >= 2.0:
                spike_pts = calculate_spike_points(z_score)
                dedup_key = (cid, "SPIKE", m_time)
                if dedup_key not in existing_set:
                    anomaly_id = str(uuid.uuid4())
                    title = f"Cluster Spike: '{template[:50]}' ({curr_count} logs/min, Z={z_score:.1f})"
                    desc = (
                        f"Cluster template '{template[:100]}' experienced a statistical spike "
                        f"of {curr_count} occurrences/min (baseline mean: {b_mean:.1f}, std dev: {b_std:.2f}, threshold: {threshold:.1f}, Z-score: {z_score:.2f})."
                    )

                    norm = normalize_template(template)
                    evidence = {
                        "clusterId": cid,
                        "template": template,
                        "displayTitle": norm["displayTitle"],
                        "shortDescription": norm["shortDescription"],
                        "baseline": {
                            "windowMinutes": 5,
                            "counts": baseline_counts,
                            "mean": round(b_mean, 2),
                            "standardDeviation": round(b_std, 2),
                        },
                        "currentWindow": {
                            "timestamp": m_time.isoformat(),
                            "count": curr_count,
                        },
                        "detection": {
                            "zScore": round(z_score, 2),
                            "threshold": round(threshold, 2),
                            "isSpike": True,
                        },
                        "scoring": {
                            "spikePoints": spike_pts,
                        },
                    }

                    sev_class = "CRITICAL" if z_score >= 5.0 or (is_error and z_score >= 3.0) else "HIGH" if z_score >= 3.0 else "MEDIUM"
                    status_class = "ESCALATE" if sev_class in ("CRITICAL", "HIGH") else "MONITOR"

                    anomalies_to_insert.append({
                        "id": anomaly_id,
                        "project_id": project_id,
                        "cluster_id": cid,
                        "service_name": svc_name,
                        "anomaly_type": "SPIKE",
                        "title": title,
                        "description": desc,
                        "severity": sev_class,
                        "status": status_class,
                        "occ": curr_count,
                        "first_seen": m_time,
                        "last_seen": m_time,
                        "evidence": json.dumps(evidence),
                    })
                    existing_set.add(dedup_key)
                    detected_anomalies.append({
                        "id": anomaly_id,
                        "type": "SPIKE",
                        "title": title,
                        "severity": sev_class,
                        "clusterId": cid,
                        "zScore": z_score,
                    })

    # Batch insert all flagged anomalies in a single database round-trip
    if anomalies_to_insert:
        db.execute(
            text("""
                INSERT INTO anomalies (
                    id, "projectId", "clusterId", "serviceName",
                    "anomalyType", title, description, severity, status,
                    "occurrenceCount", "firstDetectedAt", "lastDetectedAt", evidence
                ) VALUES (
                    :id, :project_id, :cluster_id, :service_name,
                    :anomaly_type, :title, :description, :severity, :status,
                    :occ, :first_seen, :last_seen, CAST(:evidence AS jsonb)
                )
            """),
            anomalies_to_insert
        )

    db.commit()
    logger.info(f"Anomaly detection completed. Flagged {len(detected_anomalies)} new anomalies.")
    return detected_anomalies
