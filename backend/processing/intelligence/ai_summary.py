import os
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

logger = logging.getLogger("logsense.summary")

def explain_technical_log_pattern(template: str) -> dict:
    """
    Decodes unfamiliar or technical Drain3 log templates into plain-English explanations.
    Explains which subsystem the pattern is associated with and what it generally indicates.
    """
    t_lower = (template or "").lower()
    clean_tmpl = template[:100] if template else "Unknown Pattern"

    if any(k in t_lower for k in ["hikaripool", "connection pool", "pool exhausted", "max pool", "borrowobject"]):
        return {
            "pattern": clean_tmpl,
            "component": "Database Connection Pool",
            "explanation": "This message is associated with the application's database connection pool manager. It generally indicates that all available database connections are exhausted or blocked, forcing incoming worker threads to wait and eventually time out.",
        }
    elif any(k in t_lower for k in ["connection broken", "broken pipe", "closed socket", "socket closed", "connection refused", "connection reset"]):
        return {
            "pattern": clean_tmpl,
            "component": "TCP / Network Socket Layer",
            "explanation": "This message is associated with underlying network communication channels. It generally indicates that an active network socket was abruptly terminated or reset by the remote peer, load balancer, or firewall keep-alive timeout.",
        }
    elif any(k in t_lower for k in ["interrupting sendworker", "interrupted while waiting", "leaving thread", "worker thread", "executor"]):
        return {
            "pattern": clean_tmpl,
            "component": "Asynchronous Worker Thread Pool",
            "explanation": "This message is associated with internal background task executors and worker threads. It generally indicates that an active worker thread was forcibly interrupted or aborted due to an upstream socket drop or queue backpressure.",
        }
    elif any(k in t_lower for k in ["session", "timed out", "timeout", "expiring session", "notification time out"]):
        return {
            "pattern": clean_tmpl,
            "component": "Distributed Heartbeat & Session State",
            "explanation": "This message is associated with cluster consensus or client session leasing. It generally indicates that heartbeat signals between nodes failed to arrive within the lease timeout window, triggering session expiration.",
        }
    elif any(k in t_lower for k in ["ioexception", "file not found", "disk full", "permission denied"]):
        return {
            "pattern": clean_tmpl,
            "component": "File System & I/O Subsystem",
            "explanation": "This message is associated with storage and I/O channels. It generally indicates an operating system level failure while attempting to read or write local data.",
        }
    elif any(k in t_lower for k in ["outofmemory", "oom", "heap space", "gc overhead"]):
        return {
            "pattern": clean_tmpl,
            "component": "Runtime Memory Subsystem",
            "explanation": "This message is associated with process memory allocation. It indicates severe memory pressure or allocation stalls, preventing the service from handling incoming tasks.",
        }
    else:
        return {
            "pattern": clean_tmpl,
            "component": "Application Service Runtime",
            "explanation": "This message is associated with application execution and indicates an unhandled error condition or operational warning encountered during request execution.",
        }

def generate_incident_summary(
    db: Session,
    incident_id: str,
    rca_result: dict,
    model_name: Optional[str] = None
) -> dict:
    """
    Implements Part 8 of the LogSense Specification:
    Synthesizes technical anomaly data and 15-point deterministic RCA findings into
    a simple, plain-English incident explanation:
    1. Simple Explanation ("What happened?" & "Potential impact")
    2. Root cause explanation (why the top pattern scored X/15 points)
    3. Investigation recommendations (evidence-based suggestions)
    4. Explanation of unfamiliar/complex Drain3 log patterns
    """
    logger.info(f"Generating structured incident explanation for incident {incident_id}")

    incident = db.execute(
        text("SELECT id, \"projectId\", title, description, severity, \"startedAt\" FROM incidents WHERE id = :id"),
        {"id": incident_id}
    ).fetchone()

    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    project_id = str(incident[1])
    inc_title = incident[2]
    inc_sev = incident[4]
    started_at = incident[5]

    top_candidate = rca_result.get("topCandidate", {})
    top_template = top_candidate.get("template", "Unknown Pattern")
    top_score = top_candidate.get("totalScore", 0.0)
    confidence = rca_result.get("confidence", 0.8)
    candidates = rca_result.get("candidates", [])

    # Fetch sample raw log lines for top candidate cluster
    raw_samples = []
    if top_candidate.get("clusterId"):
        raw_rows = db.execute(
            text("""
                SELECT "rawMessage", timestamp
                FROM log_entries
                WHERE "clusterId" = :cluster_id
                ORDER BY timestamp DESC
                LIMIT 5
            """),
            {"cluster_id": top_candidate["clusterId"]}
        ).fetchall()
        raw_samples = [f"[{r[1].strftime('%H:%M:%S')}] {r[0]}" for r in raw_rows]

    # Fetch anomalies linked to this incident
    linked_anomalies = db.execute(
        text("""
            SELECT a.title, a.evidence, a."anomalyType", a."occurrenceCount", a."firstDetectedAt", a."clusterId"
            FROM incident_anomalies ia
            JOIN anomalies a ON ia."anomalyId" = a.id
            WHERE ia."incidentId" = :inc_id
            ORDER BY a."firstDetectedAt" ASC
        """),
        {"inc_id": incident_id}
    ).fetchall()

    # Aggregate metrics across the incident window
    total_matching_errors = sum((la[3] or 1) for la in linked_anomalies) or top_candidate.get("maxOccurrence", 1)
    affected_clusters_set = set()
    secondary_pattern_names = []

    for la in linked_anomalies:
        if la[5]:
            affected_clusters_set.add(str(la[5]))
        ev = la[1] if isinstance(la[1], dict) else {}
        if isinstance(ev, dict) and "affectedClusters" in ev:
            for aff in ev["affectedClusters"]:
                if isinstance(aff, dict):
                    cid = aff.get("clusterId")
                    if cid:
                        affected_clusters_set.add(str(cid))
                    tmpl = aff.get("template")
                    if tmpl and tmpl != top_template:
                        secondary_pattern_names.append(tmpl)

    if top_candidate.get("clusterId"):
        affected_clusters_set.add(top_candidate["clusterId"])

    affected_patterns_count = max(len(affected_clusters_set), len(candidates), 1)

    # 1. Plain-English "What happened?" and "Potential impact"
    top_clean_name = top_template.replace("<*>", "parameters").strip()
    if len(top_clean_name) > 60:
        top_clean_name = top_clean_name[:60] + "..."

    secondary_mention = ""
    if secondary_pattern_names:
        clean_sec = secondary_pattern_names[0].replace("<*>", "parameters").strip()
        if len(clean_sec) > 50:
            clean_sec = clean_sec[:50] + "..."
        secondary_mention = f", followed by cascading spikes in '{clean_sec}'"

    what_happened = (
        f"A sudden statistical surge in '{top_clean_name}' was detected with {total_matching_errors} matching errors "
        f"across the investigation window{secondary_mention}. Multiple related log patterns appeared contemporaneously."
    )

    t_lower = top_template.lower()
    if any(k in t_lower for k in ["session", "timed out", "timeout"]):
        potential_impact = "Users may experience session interruptions, sudden logouts, or failed request authentications."
    elif any(k in t_lower for k in ["connection", "socket", "network", "broken pipe"]):
        potential_impact = "Users may experience request timeouts, failed transactions, or transient connection drops."
    elif any(k in t_lower for k in ["pool", "deadlock", "lock"]):
        potential_impact = "Application threads may stall, causing elevated response latency and service unresponsiveness."
    else:
        potential_impact = "Users may experience degraded performance or intermittent error responses across affected operations."

    # 2. Plain-English "Why it received that score"
    temporal_pts = top_candidate.get("temporalPoints", 0)
    freq_pts = top_candidate.get("frequencyPoints", 0)
    rel_pts = top_candidate.get("relationshipPoints", 0)
    class_pts = top_candidate.get("classificationPoints", 0)
    max_occ = top_candidate.get("maxOccurrence", total_matching_errors)
    max_z = top_candidate.get("maxZScore", 0.0)

    rca_explanation = (
        f"Your RCA engine ranks '{top_clean_name}' as the strongest candidate with {top_score:.1f}/15 points. "
        f"It was selected because it initiated earliest in the failure cascade, surged significantly beyond baseline, "
        f"and had multiple downstream error patterns appear immediately afterward."
    )

    rca_bullets = [
        f"It appeared before the other abnormal patterns (Temporal precedence: {temporal_pts:.0f}/4 pts).",
        f"Its occurrence count increased significantly (Statistical surge: {freq_pts:.0f}/4 pts, peak volume: {max_occ} logs/min with Z-score {max_z:.1f}).",
        f"Other potentially related error patterns appeared afterward (Cascading relationship: {rel_pts:.0f}/4 pts).",
        f"Structural failure signature matches direct disruption rather than secondary symptoms (Error classification: {class_pts:.0f}/3 pts).",
    ]

    # 3. Investigation Recommendations (Framed as evidence-based suggestions)
    if any(k in t_lower for k in ["connection", "socket", "refused", "reset"]):
        recommendations = [
            "Check database and external service availability.",
            "Inspect socket allocation and network connectivity between application pods.",
            "Review database and service timeout configurations.",
            "Check database server and proxy logs for abrupt connection terminations.",
        ]
    elif any(k in t_lower for k in ["pool", "hikaripool", "exhausted"]):
        recommendations = [
            "Inspect database connection pool limits and active connection lifetimes.",
            "Check for unclosed database connections or slow queries blocking pool threads.",
            "Review database server CPU and active session capacity.",
            "Check application connection acquire timeout thresholds.",
        ]
    elif any(k in t_lower for k in ["session", "timed out", "timeout"]):
        recommendations = [
            "Verify cluster heartbeat latency and network stability.",
            "Inspect garbage collection (GC) pauses causing heartbeat lease expirations.",
            "Review session timeout settings and client reconnect backoff limits.",
            "Check downstream consumer and server event loop responsiveness.",
        ]
    else:
        recommendations = [
            f"Inspect the initiating log pattern parameters matching '{top_clean_name}'.",
            "Review application logs surrounding the detection window for preceding configuration changes.",
            "Check system resource metrics (CPU, memory, and disk I/O) at the time of the perturbation.",
            "Verify downstream service health and retry policies.",
        ]

    # 4. Explain Unfamiliar / Technical Log Patterns
    unfamiliar_patterns = []
    # Top candidate pattern
    unfamiliar_patterns.append(explain_technical_log_pattern(top_template))
    # Secondary candidate patterns
    for c in candidates[1:3]:
        c_tmpl = c.get("template")
        if c_tmpl and c_tmpl != top_template:
            unfamiliar_patterns.append(explain_technical_log_pattern(c_tmpl))

    metrics = {
        "affectedPatterns": affected_patterns_count,
        "detectionWindow": "10 min",
        "totalMatchingErrors": total_matching_errors,
        "candidateCount": len(candidates),
    }

    # Optional LLM Enhancement via Gemini if configured
    llm_api_key = os.getenv("GEMINI_API_KEY")
    used_model = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if used_model in ("gemini-3.5-flash-lite", "gemini-3.5", "default"):
        used_model = "gemini-2.5-flash"

    if llm_api_key:
        try:
            prompt = f"""You are an expert Site Reliability Engineer explaining a production log incident to application developers.
Statistical Anomaly Detection and Deterministic 15-Point Root Cause Analysis produced this verified evidence:

Incident Title: {inc_title} (Severity: {inc_sev}, Started At: {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')})
Primary Initiating Log Pattern: {top_template}
RCA Score: {top_score:.1f}/15 Points
Score Breakdown:
- Temporal Precedence: {temporal_pts}/4 pts (appeared before other patterns)
- Frequency Spike: {freq_pts}/4 pts (peak volume: {max_occ} logs/min, Z-score: {max_z:.2f})
- Classification: {class_pts}/3 pts
- Relationship to Affected Patterns: {rel_pts}/4 pts

Total Matching Errors in Window: {total_matching_errors}
Affected Pattern Count: {affected_patterns_count}
Secondary Patterns: {secondary_pattern_names[:3]}

Generate a structured JSON response with EXACTLY these keys:
1. "whatHappened": Convert the technical anomaly data into a simple, plain-English 2-sentence explanation of what occurred.
2. "potentialImpact": 1 sentence explaining what users or requests may experience.
3. "rootCauseExplanation": 2 sentences explaining why the top candidate received its RCA score (it appeared before others, count surged, others followed).
4. "rcaBullets": Array of 3 short bullet points explaining why it received the score.
5. "investigationRecommendations": Array of 4 suggestions based on detected evidence for what developers should investigate next.

Do NOT invent fictitious services. Output pure JSON."""

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{used_model}:generateContent?key={llm_api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}

            with httpx.Client(timeout=3.5) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    # Clean markdown codeblocks if wrapped
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    parsed_llm = json.loads(raw_text.strip())
                    if "whatHappened" in parsed_llm:
                        what_happened = parsed_llm.get("whatHappened", what_happened)
                    if "potentialImpact" in parsed_llm:
                        potential_impact = parsed_llm.get("potentialImpact", potential_impact)
                    if "rootCauseExplanation" in parsed_llm:
                        rca_explanation = parsed_llm.get("rootCauseExplanation", rca_explanation)
                    if "rcaBullets" in parsed_llm and isinstance(parsed_llm["rcaBullets"], list):
                        rca_bullets = parsed_llm["rcaBullets"]
                    if "investigationRecommendations" in parsed_llm and isinstance(parsed_llm["investigationRecommendations"], list):
                        recommendations = parsed_llm["investigationRecommendations"]
        except Exception as e:
            logger.info(f"Using deterministic synthesis ({e})")

    # Construct the full structured report dictionary
    structured_report = {
        "whatHappened": what_happened,
        "potentialImpact": potential_impact,
        "rootCauseExplanation": rca_explanation,
        "rcaBullets": rca_bullets,
        "unfamiliarPatterns": unfamiliar_patterns,
        "investigationRecommendations": recommendations,
        "metrics": metrics,
    }

    # Format human-readable markdown summary
    unfamiliar_md_lines = []
    for up in unfamiliar_patterns:
        unfamiliar_md_lines.append(f"- **`{up['pattern']}`** ({up['component']}): {up['explanation']}")

    unfamiliar_section = "\n".join(unfamiliar_md_lines) if unfamiliar_md_lines else "- No complex unfamiliar patterns."
    rec_bullets = "\n".join(f"{idx+1}. {r}" for idx, r in enumerate(recommendations))
    bullets_text = "\n".join(f"- {b}" for b in rca_bullets)

    summary_text = f"""### What happened?
{what_happened}

### Potential impact
{potential_impact}

### Root cause explanation
{rca_explanation}
{bullets_text}

### Unfamiliar log patterns explained
{unfamiliar_section}

### Investigation recommendations
{rec_bullets}
"""

    summary_id = str(uuid.uuid4())

    # Clean existing summaries for this incident
    db.execute(
        text("DELETE FROM incident_summaries WHERE \"incidentId\" = :inc_id"),
        {"inc_id": incident_id}
    )

    db.execute(
        text("""
            INSERT INTO incident_summaries (
                id, "incidentId", summary, recommendations, model, "createdAt"
            ) VALUES (
                :id, :inc_id, :summary, CAST(:rec AS jsonb), :model, NOW()
            )
        """),
        {
            "id": summary_id,
            "inc_id": incident_id,
            "summary": summary_text,
            "rec": json.dumps(structured_report),
            "model": used_model,
        }
    )
    db.commit()

    return {
        "id": summary_id,
        "incidentId": incident_id,
        "summary": summary_text,
        "structuredReport": structured_report,
        "recommendations": recommendations,
        "model": used_model,
    }
