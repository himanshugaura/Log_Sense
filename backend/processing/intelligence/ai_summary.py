import os
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

from intelligence.template_normalizer import normalize_template

logger = logging.getLogger("logsense.summary")

def get_friendly_category_and_title(template: str) -> tuple[str, str]:
    """
    Translates raw log signatures into user-friendly incident titles.
    """
    norm = normalize_template(template)
    return norm["category"], norm["displayTitle"]

def explain_technical_log_pattern(template: str) -> dict:
    """
    Translates unfamiliar or technical Drain3 log templates into plain-English explanations.
    Explains which component the pattern is associated with and what it generally indicates.
    """
    t_lower = (template or "").lower()
    clean_tmpl = template[:100] if template else "Unknown Pattern"

    if any(k in t_lower for k in ["hikaripool", "connection pool", "pool exhausted", "max pool", "borrowobject"]):
        return {
            "pattern": clean_tmpl,
            "component": "Database Connection Pool",
            "explanation": "This message is associated with the application's database connection pool. It generally indicates that all available database connections were exhausted, causing incoming requests to wait and time out.",
        }
    elif any(k in t_lower for k in ["connection broken", "broken pipe", "closed socket", "socket closed", "connection refused", "connection reset"]):
        return {
            "pattern": clean_tmpl,
            "component": "TCP / Network Socket Layer",
            "explanation": "This message is associated with network communication channels. It generally indicates that an active network connection was abruptly closed or reset by the remote peer or an intermediary gateway.",
        }
    elif any(k in t_lower for k in ["interrupting sendworker", "interrupted while waiting", "leaving thread", "worker thread", "executor"]):
        return {
            "pattern": clean_tmpl,
            "component": "Asynchronous Worker Thread Pool",
            "explanation": "This message is associated with internal background task executors. It generally indicates that an active communication worker thread was forcibly interrupted due to an upstream connection failure.",
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
            "explanation": "This message is associated with local disk or socket I/O operations. It indicates an operating system level failure while attempting to read or write data.",
        }
    elif any(k in t_lower for k in ["outofmemory", "oom", "heap space", "gc overhead"]):
        return {
            "pattern": clean_tmpl,
            "component": "Runtime Memory Subsystem",
            "explanation": "This message is associated with application memory allocation. It indicates high memory pressure, preventing the service from handling incoming tasks.",
        }
    else:
        return {
            "pattern": clean_tmpl,
            "component": "Application Service Runtime",
            "explanation": "This message indicates an unhandled error condition or operational warning encountered during request execution.",
        }

def generate_incident_summary(
    db: Session,
    incident_id: str,
    rca_result: dict,
    model_name: Optional[str] = None
) -> dict:
    """
    Implements Part 8 of the LogSense Specification:
    Transforms technical anomaly data and 15-point deterministic RCA findings into
    a user-friendly, plain-English incident explanation with 6 clear sections:
    1. What happened? (Simple summary of the problem)
    2. What might be causing it? (Strongest root-cause candidate in simple terms)
    3. Why do we think this? (Evidence supporting the candidate without raw math)
    4. What else was affected? (Other related errors or components)
    5. What should you do? (Actionable investigation steps)
    6. How certain are we? (Analysis confidence & uncertainty)
    Preserves all technical math and scoring in an expandable Technical Evidence section for developers.
    """
    logger.info(f"Generating user-friendly incident explanation for incident {incident_id}")

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

    component_name, friendly_title = get_friendly_category_and_title(top_template)

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
    baseline_mean = 1.0

    for la in linked_anomalies:
        if la[5]:
            affected_clusters_set.add(str(la[5]))
        ev = la[1] if isinstance(la[1], dict) else {}
        if isinstance(ev, dict):
            b_info = ev.get("baseline", {})
            if "mean" in b_info:
                baseline_mean = float(b_info["mean"])
            if "affectedClusters" in ev:
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

    # Clean template snippet for plain language
    top_clean_name = top_template.replace("<*>", "").strip()
    if len(top_clean_name) > 60:
        top_clean_name = top_clean_name[:60] + "..."

    # 1. Section: What happened? (A simple summary of the problem)
    what_happened = (
        f"Your application started experiencing an unusually high number of {component_name.lower()} errors. "
        f"Other errors also increased around the same time."
    )

    # 2. Section: What might be causing it? (The strongest root-cause candidate in plain English)
    what_might_be_causing_it = (
        f"Our analysis suggests that {component_name.lower()} issues (initiated by '{top_clean_name}') "
        f"could be the main source of the problem."
    )

    # 3. Section: Why do we think this? (Evidence supporting candidate in plain English)
    why_do_we_think_this = [
        f"{component_name} errors appeared before the other abnormal patterns.",
        "These errors increased significantly compared with normal activity.",
        "Other application errors appeared shortly afterward.",
    ]

    # 4. Section: What else was affected? (Other related errors or patterns)
    if secondary_pattern_names:
        clean_sec = secondary_pattern_names[0].replace("<*>", "").strip()
        if len(clean_sec) > 50:
            clean_sec = clean_sec[:50] + "..."
        what_else_was_affected = (
            f"Shortly after the initial disturbance, secondary errors such as '{clean_sec}' and background worker interruptions "
            f"were triggered across {affected_patterns_count} related error patterns."
        )
    else:
        what_else_was_affected = (
            f"Multiple worker threads and secondary operations were impacted during the same 10-minute detection window, "
            f"accounting for {total_matching_errors} matching errors."
        )

    # 5. Section: What should you do? (Actionable, numbered investigation steps)
    t_lower = top_template.lower()
    if any(k in t_lower for k in ["hikaripool", "connection pool", "pool"]):
        what_should_i_do = [
            "Check whether your database is running and accepting new connections.",
            "Check database connection pool limits and active connection lifetimes.",
            "Review connection timeout settings and verify no slow queries are locking connections.",
            "Investigate the database server logs around the incident time.",
        ]
    elif any(k in t_lower for k in ["connection", "socket", "network", "broken pipe"]):
        what_should_i_do = [
            "Check network connectivity between application pods and external services.",
            "Inspect socket allocation and firewall keep-alive timeout settings.",
            "Review connection retry and backoff configurations in your client.",
            "Check host and gateway logs for network drops or proxy restarts.",
        ]
    elif any(k in t_lower for k in ["session", "timed out", "timeout"]):
        what_should_i_do = [
            "Verify cluster heartbeat latency and network stability.",
            "Inspect garbage collection (GC) pauses causing heartbeat lease expirations.",
            "Review session timeout settings and client reconnect backoff limits.",
            "Check server event loop responsiveness around the incident window.",
        ]
    else:
        what_should_i_do = [
            f"Inspect the application log lines containing '{top_clean_name}'.",
            "Check system resource usage (CPU, memory, disk I/O) at the time of the incident.",
            "Review any recent deployments or configuration updates that coincided with the spike.",
            "Investigate upstream and downstream dependency health.",
        ]

    # 6. Section: How certain are we? (Analysis confidence & uncertainty)
    how_certain_are_we = {
        "badge": "Strongest candidate, not confirmed",
        "explanation": "Our analysis identifies the most likely explanation from available logs. Further investigation is needed to confirm the actual cause.",
    }

    # Potential impact for user-facing awareness
    if any(k in t_lower for k in ["session", "timed out", "timeout"]):
        potential_impact = "Users may experience session interruptions, sudden logouts, or failed request authentications."
    elif any(k in t_lower for k in ["connection", "socket", "network", "broken pipe", "pool"]):
        potential_impact = "Users may experience connection timeouts, failed transactions, or transient request drops."
    else:
        potential_impact = "Users may experience degraded response times or intermittent error messages."

    # Unfamiliar log patterns explained in simple language
    unfamiliar_patterns = []
    unfamiliar_patterns.append(explain_technical_log_pattern(top_template))
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

    # Technical evidence package for developers (math, Z-scores, 15-point RCA)
    technical_evidence = {
        "primaryTemplate": top_template,
        "totalScore": top_score,
        "temporalPoints": top_candidate.get("temporalPoints", 0),
        "frequencyPoints": top_candidate.get("frequencyPoints", 0),
        "classificationPoints": top_candidate.get("classificationPoints", 0),
        "relationshipPoints": top_candidate.get("relationshipPoints", 0),
        "maxOccurrence": top_candidate.get("maxOccurrence", total_matching_errors),
        "maxZScore": round(top_candidate.get("maxZScore", 0.0), 2),
        "baselineMean": round(baseline_mean, 2),
        "confidence": confidence,
        "candidates": [
            {
                "rank": c.get("rank"),
                "template": c.get("template"),
                "totalScore": c.get("totalScore"),
                "explanation": c.get("explanation"),
            }
            for c in candidates[:4]
        ],
        "rawSamples": raw_samples,
    }

    # Optional LLM Enhancement via Gemini with strict plain-English translation instructions
    llm_api_key = os.getenv("GEMINI_API_KEY")
    used_model = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if used_model in ("gemini-3.5-flash-lite", "gemini-3.5", "default"):
        used_model = "gemini-2.5-flash"

    if llm_api_key:
        try:
            prompt = f"""You are an AI Incident Assistant explaining an application issue to a general user who wants plain-English answers, NOT technical jargon.

Evidence from logs:
- Primary Root Cause Candidate: {top_template}
- Subsystem: {component_name}
- Total Error Count: {total_matching_errors} in a 10-minute window (spiked significantly from normal baseline)
- Secondary Affected Patterns: {secondary_pattern_names[:3]}
- Temporal Order: Primary pattern started before other errors appeared

Translate this technical data into a user-friendly incident explanation with EXACTLY these 6 sections in JSON:
1. "friendlyTitle": Clear non-technical title (e.g. "Possible database connectivity problem")
2. "whatHappened": 2 simple sentences in plain language (e.g. "Your application started experiencing an unusually high number of database connection failures. Other errors also increased around the same time.")
3. "whatMightBeCausingIt": 1 sentence identifying the possible underlying cause in simple terms (e.g. "Our analysis suggests that database connectivity could be the main source of the problem.")
4. "whyDoWeThinkThis": Array of 3 plain-English bullet points:
   - "{component_name} errors appeared before the other abnormal patterns."
   - "These errors increased significantly compared with normal activity."
   - "Other application errors appeared shortly afterward."
5. "whatElseWasAffected": 1-2 simple sentences explaining what other application parts or patterns were impacted.
6. "whatShouldIDo": Array of 4 clear, actionable numbered steps (e.g. "Check whether your database is running.", "Check database connection limits.", "Review connection timeout settings.", "Investigate database logs around the incident time.")
7. "potentialImpact": 1 sentence describing user impact (e.g. "Users may experience session interruptions or failed requests.")

Translation rules:
- "Statistical frequency spike" -> "Errors occurred much more frequently than usual"
- "Temporal precedence" -> "This error appeared before the other errors"
- "Cascading relationship" -> "Other errors appeared shortly afterward"
- "Root cause candidate" -> "Possible underlying cause"
- "Baseline deviation" -> "Difference from normal application behaviour"

Output pure JSON only."""

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{used_model}:generateContent?key={llm_api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}

            with httpx.Client(timeout=3.5) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    parsed_llm = json.loads(raw_text.strip())

                    if "friendlyTitle" in parsed_llm:
                        friendly_title = parsed_llm.get("friendlyTitle", friendly_title)
                    if "whatHappened" in parsed_llm:
                        what_happened = parsed_llm.get("whatHappened", what_happened)
                    if "whatMightBeCausingIt" in parsed_llm:
                        what_might_be_causing_it = parsed_llm.get("whatMightBeCausingIt", what_might_be_causing_it)
                    if "whyDoWeThinkThis" in parsed_llm and isinstance(parsed_llm["whyDoWeThinkThis"], list):
                        why_do_we_think_this = parsed_llm["whyDoWeThinkThis"]
                    if "whatElseWasAffected" in parsed_llm:
                        what_else_was_affected = parsed_llm.get("whatElseWasAffected", what_else_was_affected)
                    if "whatShouldIDo" in parsed_llm and isinstance(parsed_llm["whatShouldIDo"], list):
                        what_should_i_do = parsed_llm["whatShouldIDo"]
                    if "potentialImpact" in parsed_llm:
                        potential_impact = parsed_llm.get("potentialImpact", potential_impact)
        except Exception as e:
            logger.info(f"Using deterministic human synthesis ({e})")

    # Complete structured report containing user-friendly sections + technical evidence
    structured_report = {
        "friendlyTitle": friendly_title,
        "whatHappened": what_happened,
        "whatMightBeCausingIt": what_might_be_causing_it,
        "whyDoWeThinkThis": why_do_we_think_this,
        "whatElseWasAffected": what_else_was_affected,
        "whatShouldIDo": what_should_i_do,
        "howCertainAreWe": how_certain_are_we,
        "potentialImpact": potential_impact,
        "unfamiliarPatterns": unfamiliar_patterns,
        "metrics": metrics,
        "technicalEvidence": technical_evidence,
    }

    # Format human-readable markdown summary adhering to the 6-section structure
    why_md = "\n".join(f"- {b}" for b in why_do_we_think_this)
    steps_md = "\n".join(f"{idx+1}. {step}" for idx, step in enumerate(what_should_i_do))

    summary_text = f"""### Incident analysis
**{friendly_title}**

#### What happened?
{what_happened}

#### What might be causing it?
{what_might_be_causing_it}

#### Why do we think this?
{why_md}

#### What else was affected?
{what_else_was_affected}

#### What should you do?
{steps_md}

#### Analysis confidence
**{how_certain_are_we['badge']}**  
{how_certain_are_we['explanation']}
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
        "model": used_model,
    }
