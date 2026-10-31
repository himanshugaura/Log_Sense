import math
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("logsense.rca")

# Configurable Scoring Factor Weights (Section 14: 30%, 25%, 25%, 20%)
DEFAULT_WEIGHTS = {
    "temporal": 0.30,
    "dependency": 0.25,
    "error_type": 0.25,
    "trace": 0.20,
}

# Direct Root Cause Signatures (originating resource/system failure)
ROOT_CAUSE_PATTERNS = [
    "pool exhausted", "connection pool", "connection refused",
    "deadlock", "out of memory", "oom", "disk full", "ioexception",
    "fatal exception", "panic", "segmentation fault", "table lock"
]

# Propagated Downstream Symptoms (failures caused by a dependency)
SYMPTOM_PATTERNS = [
    "timeout connecting", "circuit breaker", "downstream", "failed due to",
    "gateway timeout", "502", "503", "504", "transaction aborted",
    "request failed", "operation cancelled", "latency high"
]

class RcaEngine:
    """
    Deterministic evidence-based Root Cause Analysis (RCA) engine.
    Ranks candidate microservices using independent signals:
    1. Temporal score (decay over delta seconds)
    2. Transitive dependency topology score (depth and callers count in DAG)
    3. Error type score (root-cause vs. symptom classification)
    4. Distributed trace score (deepest failing span/sink)
    """
    def __init__(self, db: Session, weights: Optional[Dict[str, float]] = None):
        self.db = db
        self.weights = weights or DEFAULT_WEIGHTS

    def analyze_incident(self, incident_id: str) -> Optional[dict]:
        logger.info(f"Running RCA for incident {incident_id}")

        # 1. Fetch incident details and linked anomalies
        incident = self.db.execute(
            text("""
                SELECT id, "projectId", title, severity, "startedAt"
                FROM incidents
                WHERE id = :id
            """),
            {"id": incident_id}
        ).fetchone()

        if not incident:
            logger.warn(f"Incident {incident_id} not found.")
            return None

        project_id = str(incident[1])

        # Fetch anomalies linked to this incident
        anomalies = self.db.execute(
            text("""
                SELECT a.id, a."serviceId", a.severity, a."firstDetectedAt",
                       a.title, a.evidence, s.name as service_name
                FROM incident_anomalies ia
                JOIN anomalies a ON ia."anomalyId" = a.id
                LEFT JOIN services s ON a."serviceId" = s.id
                WHERE ia."incidentId" = :inc_id
                ORDER BY a."firstDetectedAt" ASC
            """),
            {"inc_id": incident_id}
        ).fetchall()

        if not anomalies:
            logger.warn(f"No linked anomalies found for incident {incident_id}")
            return None

        # 2. Identify candidate services
        candidate_services: Dict[str, dict] = {}
        for a in anomalies:
            sid = str(a[1]) if a[1] else "unassigned"
            sname = str(a[6]) if a[6] else "unassigned"
            t_first = a[3]
            ev = a[5] if isinstance(a[5], dict) else {}

            if sid not in candidate_services:
                candidate_services[sid] = {
                    "serviceId": sid if sid != "unassigned" else None,
                    "serviceName": sname,
                    "earliestTime": t_first,
                    "anomalies": [],
                    "evidenceList": [],
                    "traces": set(),
                }

            if t_first < candidate_services[sid]["earliestTime"]:
                candidate_services[sid]["earliestTime"] = t_first

            candidate_services[sid]["anomalies"].append(a)
            if isinstance(ev, dict):
                candidate_services[sid]["evidenceList"].append(ev)
                if "traceIds" in ev:
                    candidate_services[sid]["traces"].update(ev["traceIds"])

        if not candidate_services:
            return None

        # 3. Load dependency topology for this project and compute transitive dependents
        dep_rows = self.db.execute(
            text("""
                SELECT "sourceServiceId", "targetServiceId", "isRequired"
                FROM service_dependencies
                WHERE "sourceServiceId" IN (SELECT id FROM services WHERE "projectId" = :project_id)
            """),
            {"project_id": project_id}
        ).fetchall()

        # dependents_of[target] = direct caller sources
        direct_dependents_of: Dict[str, Set[str]] = {}
        for r in dep_rows:
            src, tgt = str(r[0]), str(r[1])
            direct_dependents_of.setdefault(tgt, set()).add(src)

        # Transitive closure: all services that directly or indirectly depend on `tgt`
        transitive_dependents_of: Dict[str, Set[str]] = {}
        all_sids = list(candidate_services.keys()) + list(direct_dependents_of.keys())
        for s in all_sids:
            visited: Set[str] = set()
            queue = list(direct_dependents_of.get(s, set()))
            while queue:
                curr = queue.pop(0)
                if curr not in visited:
                    visited.add(curr)
                    queue.extend(direct_dependents_of.get(curr, set()))
            transitive_dependents_of[s] = visited

        # 4. Calculate factor scores for each candidate
        global_min_time = min(cand["earliestTime"] for cand in candidate_services.values())

        candidate_scores = []
        for sid, cand in candidate_services.items():
            # A. Temporal score: 100 * exp(-delta / 120s)
            delta_sec = max(0.0, (cand["earliestTime"] - global_min_time).total_seconds())
            temporal_score = 100.0 * math.exp(-delta_sec / 120.0)

            # B. Transitive Dependency Score:
            # Services with more downstream dependents (e.g., database) get higher root cause weight
            num_transitive_deps = len(transitive_dependents_of.get(sid, set()))
            if num_transitive_deps >= 2:
                dependency_score = 100.0
            elif num_transitive_deps == 1:
                dependency_score = 75.0
            else:
                dependency_score = 30.0

            # C. Error Type Score: Originating resource failure vs. downstream symptom
            matched_root = []
            matched_symptom = []

            for ev in cand["evidenceList"]:
                text_content = f"{ev.get('sampleMessage', '')} {ev.get('template', '')}".lower()
                for rkw in ROOT_CAUSE_PATTERNS:
                    if rkw in text_content:
                        matched_root.append(rkw)
                for skw in SYMPTOM_PATTERNS:
                    if skw in text_content:
                        matched_symptom.append(skw)

            if matched_root and not matched_symptom:
                error_type_score = 95.0
            elif matched_root and matched_symptom:
                error_type_score = 75.0
            elif matched_symptom:
                error_type_score = 35.0
            else:
                error_type_score = 50.0

            # D. Trace Score:
            # If trace data is available across candidates
            trace_score: Optional[float] = None
            if cand["traces"]:
                # If caller services share this trace, this candidate is an implicated span
                has_downstream_match = False
                for other_sid, other_cand in candidate_services.items():
                    if other_sid != sid and (cand["traces"] & other_cand["traces"]):
                        has_downstream_match = True
                        break
                trace_score = 90.0 if has_downstream_match else 60.0

            # Calculate weighted total, normalizing across available factors
            available_weights = {
                "temporal": self.weights["temporal"],
                "dependency": self.weights["dependency"],
                "error_type": self.weights["error_type"],
            }
            if trace_score is not None:
                available_weights["trace"] = self.weights["trace"]

            weight_sum = sum(available_weights.values())
            total_score = (
                (temporal_score * available_weights["temporal"]) +
                (dependency_score * available_weights["dependency"]) +
                (error_type_score * available_weights["error_type"]) +
                ((trace_score or 0.0) * available_weights.get("trace", 0.0))
            ) / weight_sum

            # Construct transparent human-readable explanation
            explanation_parts = []
            if delta_sec < 1.0:
                explanation_parts.append("Earliest detected failure in incident timeline.")
            else:
                explanation_parts.append(f"Errors began {delta_sec:.1f}s after initial incident onset.")

            if num_transitive_deps > 0:
                explanation_parts.append(f"{num_transitive_deps} service(s) directly or transitively depend on this service.")

            if matched_root:
                explanation_parts.append(f"Error signatures indicate primary resource failure: '{matched_root[0]}'.")
            elif matched_symptom:
                explanation_parts.append(f"Error messages indicate downstream failure symptom: '{matched_symptom[0]}'.")

            explanation = " ".join(explanation_parts)

            candidate_scores.append({
                "serviceId": cand["serviceId"],
                "serviceName": cand["serviceName"],
                "temporalScore": round(temporal_score, 2),
                "dependencyScore": round(dependency_score, 2),
                "errorTypeScore": round(error_type_score, 2),
                "traceScore": round(trace_score, 2) if trace_score is not None else None,
                "totalScore": round(total_score, 2),
                "explanation": explanation,
                "earliestTime": cand["earliestTime"],
            })

        # Rank candidates by totalScore DESC
        candidate_scores.sort(key=lambda x: x["totalScore"], reverse=True)
        for i, c in enumerate(candidate_scores):
            c["rank"] = i + 1

        top_candidate = candidate_scores[0]
        confidence = min(0.98, max(0.40, top_candidate["totalScore"] / 100.0))
        conclusion = (
            f"Primary root cause identified as '{top_candidate['serviceName']}' with "
            f"{confidence * 100:.1f}% confidence. {top_candidate['explanation']}"
        )

        # 5. Persist into rca_analyses and root_cause_candidates
        analysis_id = str(uuid.uuid4())
        analysis_data = {
            "incidentId": incident_id,
            "topCandidate": top_candidate["serviceName"],
            "candidatesCount": len(candidate_scores),
            "scoringWeights": self.weights,
        }

        self.db.execute(
            text("""
                INSERT INTO rca_analyses (
                    id, "incidentId", conclusion, confidence, "analysisData", "createdAt"
                ) VALUES (
                    :id, :inc_id, :conclusion, :confidence, CAST(:data AS jsonb), NOW()
                )
            """),
            {
                "id": analysis_id,
                "inc_id": incident_id,
                "conclusion": conclusion,
                "confidence": confidence,
                "data": json.dumps(analysis_data),
            }
        )

        for c in candidate_scores:
            if c["serviceId"]:
                self.db.execute(
                    text("""
                        INSERT INTO root_cause_candidates (
                            id, "analysisId", "serviceId", "totalScore",
                            "temporalScore", "dependencyScore", "errorTypeScore",
                            "traceScore", explanation, rank
                        ) VALUES (
                            :id, :analysis_id, :service_id, :total,
                            :temporal, :dep, :err, :trace, :explanation, :rank
                        )
                    """),
                    {
                        "id": str(uuid.uuid4()),
                        "analysis_id": analysis_id,
                        "service_id": c["serviceId"],
                        "total": c["totalScore"],
                        "temporal": c["temporalScore"],
                        "dep": c["dependencyScore"],
                        "err": c["errorTypeScore"],
                        "trace": c["traceScore"] if c["traceScore"] is not None else 0.0,
                        "explanation": c["explanation"],
                        "rank": c["rank"],
                    }
                )

        self.db.commit()
        logger.info(f"RCA analysis {analysis_id} saved for incident {incident_id}. Winner: {top_candidate['serviceName']}")

        return {
            "analysisId": analysis_id,
            "incidentId": incident_id,
            "conclusion": conclusion,
            "confidence": confidence,
            "topCandidate": top_candidate,
            "candidates": candidate_scores,
        }
