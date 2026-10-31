import logging
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("logsense.rca")

# Direct Root Cause Signatures (originating resource/system failure, assigning 3 classification points)
DIRECT_ROOT_CAUSE_KEYWORDS = [
    "connection broken", "connection refused", "broken pipe", "closed socket",
    "socket closed", "pool exhausted", "connection pool", "deadlock",
    "out of memory", "oom", "disk full", "ioexception", "fatal exception",
    "panic", "segmentation fault", "table lock", "cannot open channel",
    "unexpected exception causing shutdown", "server not running", "not running",
]

# Secondary / Propagated Symptom Keywords (assigning 2 classification points)
SECONDARY_SYMPTOM_KEYWORDS = [
    "interrupted while waiting", "interrupted", "leaving thread", "interrupting sendworker",
    "timeout", "timed out", "notification time out", "circuit breaker",
    "failed due to", "502", "503", "504", "queue full", "retry",
    "request failed", "session termination", "expiring session", "goodbye",
]

class RcaEngine:
    """
    Implements Part 7 of the LogSense Specification:
    Deterministic, point-based Root Cause Analysis ranking candidate log clusters (max 15 points):
    1. Temporal precedence (max 4 points)
    2. Frequency increase (max 4 points)
    3. Error classification (max 3 points)
    4. Relationship with affected clusters (max 4 points)
    Ranks candidate clusters from highest to lowest.
    """
    def __init__(self, db: Session):
        self.db = db

    def analyze_incident(self, incident_id: str) -> Optional[dict]:
        logger.info(f"Running point-based log pattern RCA for incident {incident_id}")

        # 1. Fetch incident and linked anomalies
        incident = self.db.execute(
            text("SELECT id, \"projectId\", title, severity, \"startedAt\" FROM incidents WHERE id = :id"),
            {"id": incident_id}
        ).fetchone()

        if not incident:
            logger.warn(f"Incident {incident_id} not found.")
            return None

        project_id = str(incident[1])

        anomalies = self.db.execute(
            text("""
                SELECT a.id, a."clusterId", a.severity, a."firstDetectedAt",
                       a.title, a.evidence, a."anomalyType", a."occurrenceCount",
                       lc.template
                FROM incident_anomalies ia
                JOIN anomalies a ON ia."anomalyId" = a.id
                LEFT JOIN log_clusters lc ON a."clusterId" = lc.id
                WHERE ia."incidentId" = :inc_id
                ORDER BY a."firstDetectedAt" ASC
            """),
            {"inc_id": incident_id}
        ).fetchall()

        if not anomalies:
            logger.warn(f"No linked anomalies found for incident {incident_id}")
            return None

        # 2. Extract candidate clusters from anomalies
        candidate_clusters: Dict[str, dict] = {}
        affected_clusters_pool: Set[str] = set()

        for a in anomalies:
            cid = str(a[1]) if a[1] else None
            t_first = a[3]
            ev = a[5] if isinstance(a[5], dict) else {}
            a_type = a[6]
            occ_count = a[7] or 1
            template = str(a[8]) if a[8] else str(a[4])

            # Track affected clusters referenced in evidence
            if isinstance(ev, dict) and "affectedClusters" in ev:
                for aff in ev["affectedClusters"]:
                    if isinstance(aff, dict) and "clusterId" in aff:
                        affected_clusters_pool.add(str(aff["clusterId"]))

            if not cid:
                continue

            if cid not in candidate_clusters:
                candidate_clusters[cid] = {
                    "clusterId": cid,
                    "template": template,
                    "earliestTime": t_first,
                    "anomalyTypes": {a_type},
                    "maxOccurrence": occ_count,
                    "maxZScore": 0.0,
                    "evidenceList": [],
                }
            else:
                if t_first < candidate_clusters[cid]["earliestTime"]:
                    candidate_clusters[cid]["earliestTime"] = t_first
                candidate_clusters[cid]["anomalyTypes"].add(a_type)
                candidate_clusters[cid]["maxOccurrence"] = max(candidate_clusters[cid]["maxOccurrence"], occ_count)

            if isinstance(ev, dict):
                detection = ev.get("detection", {})
                if "zScore" in detection:
                    candidate_clusters[cid]["maxZScore"] = max(
                        candidate_clusters[cid]["maxZScore"],
                        float(detection["zScore"])
                    )
                candidate_clusters[cid]["evidenceList"].append(ev)

        if not candidate_clusters:
            logger.info(f"No candidate clusters to evaluate for incident {incident_id}")
            return None

        # Determine earliest timestamp across all candidates
        overall_earliest = min(c["earliestTime"] for c in candidate_clusters.values())

        scored_candidates = []

        for cid, cand in candidate_clusters.items():
            template_lower = cand["template"].lower()
            t_time = cand["earliestTime"]
            z_score = cand["maxZScore"]
            max_occ = cand["maxOccurrence"]

            # --- Signal 1: Temporal Precedence (max 4 points) ---
            # 4: Clearly abnormal before other affected patterns (>= 60s earlier)
            # 3: Slightly earlier (10-59s earlier)
            # 2: Approximately simultaneous (within 10s of earliest)
            # 1: Appeared after other patterns
            # 0: Insufficient temporal evidence
            delta_seconds = (t_time - overall_earliest).total_seconds()
            if delta_seconds == 0.0:
                # Appeared at the earliest recorded time
                other_times = [c["earliestTime"] for c_id, c in candidate_clusters.items() if c_id != cid]
                if other_times and min(other_times) > t_time:
                    lead_seconds = (min(other_times) - t_time).total_seconds()
                    temporal_points = 4.0 if lead_seconds >= 60 else 3.0
                else:
                    temporal_points = 2.0
            elif delta_seconds <= 15.0:
                temporal_points = 2.0
            else:
                temporal_points = 1.0

            # --- Signal 2: Frequency Increase (max 4 points) ---
            # 4: Extreme (Z >= 8 or count >= 100)
            # 3: Significant (Z >= 5 or count >= 25)
            # 2: Moderate (Z >= 3 or count >= 10)
            # 1: Small (Z >= 2 or count >= 3)
            # 0: None
            if z_score >= 8.0 or max_occ >= 100:
                frequency_points = 4.0
            elif z_score >= 5.0 or max_occ >= 25:
                frequency_points = 3.0
            elif z_score >= 3.0 or max_occ >= 10:
                frequency_points = 2.0
            elif z_score >= 2.0 or max_occ >= 3:
                frequency_points = 1.0
            else:
                frequency_points = 0.0

            # --- Signal 3: Error Classification (max 3 points) ---
            # Assign 0-3 points depending on how specific and explanatory the failure signal is
            if any(k in template_lower for k in DIRECT_ROOT_CAUSE_KEYWORDS):
                classification_points = 3.0
                class_desc = "Direct root-cause structural failure signature (connection/resource/crash)"
            elif any(k in template_lower for k in SECONDARY_SYMPTOM_KEYWORDS):
                classification_points = 2.0
                class_desc = "Secondary operational degradation symptom (interruption/timeout/termination)"
            elif "error" in template_lower or "exception" in template_lower:
                classification_points = 1.0
                class_desc = "General application exception"
            else:
                classification_points = 0.0
                class_desc = "Informational/warning event"

            # --- Signal 4: Relationship with Affected Clusters (max 4 points) ---
            # Does this pattern explain other affected patterns?
            # 4: Strongly explains several affected patterns
            # 3: Plausibly explains multiple patterns
            # 2: Related to some patterns
            # 1: Weak relationship
            # 0: No evidence
            rel_score = 0.0
            # If this is a direct root cause (e.g. connection broken) and other clusters had queue timeouts/interrupted threads
            if classification_points >= 2.0 and len(candidate_clusters) > 1:
                rel_score += 2.0
            if cid in affected_clusters_pool or any(cid in str(c.get("evidenceList")) for c in candidate_clusters.values()):
                rel_score += 1.0
            if len(candidate_clusters) >= 3 and classification_points == 3.0:
                rel_score += 1.0
            relationship_points = min(4.0, rel_score)

            # Total RCA Score = Temporal + Frequency + Classification + Relationship (max 15)
            total_rca_score = (
                temporal_points
                + frequency_points
                + classification_points
                + relationship_points
            )

            explanation = (
                f"Pattern '{cand['template'][:70]}' scored {total_rca_score:.1f}/15 pts: "
                f"Temporal={temporal_points:.0f}/4, Frequency={frequency_points:.0f}/4 (Z={z_score:.1f}, count={max_occ}), "
                f"Classification={classification_points:.0f}/3 ({class_desc}), "
                f"Relationship={relationship_points:.0f}/4."
            )

            scored_candidates.append({
                "clusterId": cid,
                "template": cand["template"],
                "totalScore": round(total_rca_score, 1),
                "temporalPoints": temporal_points,
                "frequencyPoints": frequency_points,
                "classificationPoints": classification_points,
                "relationshipPoints": relationship_points,
                "explanation": explanation,
                "maxOccurrence": max_occ,
                "maxZScore": z_score,
                "evidence": {
                    "earliestTime": t_time.isoformat(),
                    "maxOccurrence": max_occ,
                    "maxZScore": round(z_score, 2),
                    "scoring": {
                        "temporalPoints": temporal_points,
                        "frequencyPoints": frequency_points,
                        "classificationPoints": classification_points,
                        "relationshipPoints": relationship_points,
                        "totalScore": round(total_rca_score, 1),
                        "maxPossible": 15,
                    },
                },
            })

        # Rank candidates from highest to lowest score
        scored_candidates.sort(key=lambda x: x["totalScore"], reverse=True)

        for rank_idx, c in enumerate(scored_candidates):
            c["rank"] = rank_idx + 1

        top_candidate = scored_candidates[0]
        confidence = min(0.95, round(top_candidate["totalScore"] / 15.0, 2))

        # Check if top candidates are too close or inconclusive
        conclusion = top_candidate["template"]
        if len(scored_candidates) > 1:
            diff = top_candidate["totalScore"] - scored_candidates[1]["totalScore"]
            if diff < 1.0 and top_candidate["totalScore"] < 7.0:
                conclusion = f"INCONCLUSIVE: Close scores between '{top_candidate['template'][:40]}' ({top_candidate['totalScore']}) and '{scored_candidates[1]['template'][:40]}' ({scored_candidates[1]['totalScore']})"

        # Persist RCA Analysis and Candidates
        analysis_id = str(uuid.uuid4())

        # Clean existing RCA records for this incident
        self.db.execute(
            text("DELETE FROM rca_analyses WHERE \"incidentId\" = :inc_id"),
            {"inc_id": incident_id}
        )

        self.db.execute(
            text("""
                INSERT INTO rca_analyses (id, "incidentId", conclusion, confidence, "analysisData", "createdAt")
                VALUES (:id, :inc_id, :conclusion, :confidence, CAST(:data AS jsonb), NOW())
            """),
            {
                "id": analysis_id,
                "inc_id": incident_id,
                "conclusion": conclusion,
                "confidence": confidence,
                "data": json.dumps({"candidatesCount": len(scored_candidates)}),
            }
        )

        if scored_candidates:
            candidates_to_insert = [
                {
                    "id": str(uuid.uuid4()),
                    "analysis_id": analysis_id,
                    "cluster_id": cand["clusterId"],
                    "template": cand["template"],
                    "total_score": cand["totalScore"],
                    "temporal_pts": cand["temporalPoints"],
                    "frequency_pts": cand["frequencyPoints"],
                    "class_pts": cand["classificationPoints"],
                    "rel_pts": cand["relationshipPoints"],
                    "explanation": cand["explanation"],
                    "rank": cand["rank"],
                    "evidence": json.dumps(cand["evidence"]),
                }
                for cand in scored_candidates
            ]
            self.db.execute(
                text("""
                    INSERT INTO root_cause_candidates (
                        id, "analysisId", "clusterId", template,
                        "totalScore", "temporalPoints", "frequencyPoints",
                        "classificationPoints", "relationshipPoints",
                        explanation, rank, evidence
                    ) VALUES (
                        :id, :analysis_id, :cluster_id, :template,
                        :total_score, :temporal_pts, :frequency_pts,
                        :class_pts, :rel_pts,
                        :explanation, :rank, CAST(:evidence AS jsonb)
                    )
                """),
                candidates_to_insert
            )

        self.db.commit()

        return {
            "analysisId": analysis_id,
            "incidentId": incident_id,
            "confidence": confidence,
            "topCandidate": top_candidate,
            "candidates": scored_candidates,
            "conclusion": conclusion,
        }
