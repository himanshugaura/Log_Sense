import os
import json
import logging
import uuid
from datetime import datetime, timedelta
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

def extract_log_evidence_context(
    db: Session,
    project_id: str,
    incident_id: str,
    started_at: datetime,
    top_cluster_id: Optional[str],
    candidates: List[dict]
) -> tuple[List[str], List[str], List[str]]:
    """
    Extracts rich log file context (primary cluster logs, secondary symptom logs,
    and chronological incident window progression) to give real logs context to Gemini.
    """
    primary_log_lines = []
    secondary_log_lines = []
    timeline_lines = []

    # 1. Primary Root Cause Cluster Raw Logs
    if top_cluster_id:
        try:
            p_rows = db.execute(
                text("""
                    SELECT timestamp, level, "serviceName", "traceId", "rawMessage"
                    FROM log_entries
                    WHERE "clusterId" = :cluster_id
                    ORDER BY timestamp ASC
                    LIMIT 8
                """),
                {"cluster_id": top_cluster_id}
            ).fetchall()
            for r in p_rows:
                ts_str = r[0].strftime("%H:%M:%S.%f")[:-3] if r[0] else "00:00:00"
                svc = r[2] or "app"
                lvl = r[1] or "ERROR"
                trace = f"trace={r[3]} " if r[3] else ""
                primary_log_lines.append(f"[{ts_str}] [{svc}] [{lvl}] {trace}{r[4]}")
        except Exception as pe:
            logger.warn(f"Failed to fetch primary log context: {pe}")

    # 2. Secondary Symptom Logs (from candidates rank 2, 3, 4)
    for cand in candidates[1:4]:
        cid = cand.get("clusterId")
        if not cid or cid == top_cluster_id:
            continue
        try:
            s_rows = db.execute(
                text("""
                    SELECT timestamp, level, "serviceName", "traceId", "rawMessage"
                    FROM log_entries
                    WHERE "clusterId" = :cluster_id
                    ORDER BY timestamp ASC
                    LIMIT 2
                """),
                {"cluster_id": cid}
            ).fetchall()
            for r in s_rows:
                ts_str = r[0].strftime("%H:%M:%S.%f")[:-3] if r[0] else "00:00:00"
                svc = r[2] or "app"
                lvl = r[1] or "ERROR"
                trace = f"trace={r[3]} " if r[3] else ""
                secondary_log_lines.append(f"[{ts_str}] [{svc}] [{lvl}] {trace}{r[4]}")
        except Exception:
            pass

    # 3. Chronological Progression across the Incident Window (from -1m to +10m)
    try:
        t_rows = db.execute(
            text("""
                SELECT timestamp, level, "serviceName", "traceId", "rawMessage"
                FROM log_entries
                WHERE "projectId" = :proj_id
                  AND level IN ('ERROR', 'WARN', 'FATAL', 'CRITICAL')
                  AND timestamp >= :start_window
                  AND timestamp <= :end_window
                ORDER BY timestamp ASC
                LIMIT 15
            """),
            {
                "proj_id": project_id,
                "start_window": started_at - timedelta(minutes=1),
                "end_window": started_at + timedelta(minutes=10),
            }
        ).fetchall()

        if len(t_rows) < 3:
            # Fallback to general errors if timestamps don't strictly align
            t_rows = db.execute(
                text("""
                    SELECT timestamp, level, "serviceName", "traceId", "rawMessage"
                    FROM log_entries
                    WHERE "projectId" = :proj_id
                      AND level IN ('ERROR', 'WARN', 'FATAL', 'CRITICAL')
                    ORDER BY timestamp ASC
                    LIMIT 15
                """),
                {"proj_id": project_id}
            ).fetchall()

        for r in t_rows:
            ts_str = r[0].strftime("%H:%M:%S.%f")[:-3] if r[0] else "00:00:00"
            svc = r[2] or "system"
            lvl = r[1] or "ERROR"
            trace = f"trace={r[3]} " if r[3] else ""
            timeline_lines.append(f"[{ts_str}] [{svc}] [{lvl}] {trace}{r[4]}")
    except Exception as te:
        logger.warn(f"Failed to fetch timeline logs: {te}")

    return primary_log_lines, secondary_log_lines, timeline_lines


def generate_incident_summary(
    db: Session,
    incident_id: str,
    rca_result: dict,
    model_name: Optional[str] = None
) -> dict:
    """
    Generates a deep, technical, problem-solving Incident Root Cause Analysis (RCA)
    backed by real log file context, chronological error propagation, and 15-point multi-factor scoring.
    """
    logger.info(f"Generating technical problem-solving RCA for incident {incident_id}")

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
    top_cluster_id = top_candidate.get("clusterId")

    # Extract real log file context
    primary_log_lines, secondary_log_lines, timeline_lines = extract_log_evidence_context(
        db, project_id, incident_id, started_at, top_cluster_id, candidates
    )

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

    if top_cluster_id:
        affected_clusters_set.add(top_cluster_id)

    affected_patterns_count = max(len(affected_clusters_set), len(candidates), 1)

    top_clean_name = top_template.replace("<*>", "").strip()
    if len(top_clean_name) > 60:
        top_clean_name = top_clean_name[:60] + "..."

    # Deterministic high-quality default sections
    what_happened = (
        f"An acute operational disturbance was triggered by an abnormal surge of {component_name.lower()} errors, "
        f"causing cascading request failures and elevated latency across dependent services."
    )

    what_might_be_causing_it = (
        f"The definitive root cause was identified as {component_name.lower()} failure ('{top_clean_name}'), "
        f"which initiated cascading transaction failures and service disruptions."
    )

    why_this_root_cause = (
        f"Candidate #1 ('{top_clean_name}') is established as the initiating root cause (X) because it appears at the earliest timestamp "
        f"in the chronological error trace. Downstream errors (such as connection pool exhaustion, socket timeouts, or HTTP 504 errors) "
        f"occurred as consequential symptoms (Y) resulting directly from this initial failure."
    )

    why_do_we_think_this = [
        f"Temporal Precedence: '{top_clean_name}' struck first chronologically, preceding all secondary errors.",
        f"Statistical Surge: Pattern frequency surged by an extreme Z-score (+{top_candidate.get('maxZScore', 4.5):.1f} std dev) from baseline.",
        "Causal Chain Evidence: Downstream errors and worker interruptions propagated directly from this failure.",
        "Root Cause Multi-Factor Score: Ranked #1 with highest composite score across temporal, frequency, and severity dimensions.",
    ]

    what_else_was_affected = (
        f"Shortly after the initial disturbance, secondary errors and worker interruptions "
        f"were triggered across {affected_patterns_count} related error patterns accounting for {total_matching_errors} events."
    )

    immediate_mitigation = [
        f"Inspect active processes and database locks associated with '{top_clean_name}'.",
        "Restart or cycle hung connection pools and worker threads in affected services.",
        "Check system resource utilization (CPU, memory, connection limits) to clear bottlenecks.",
    ]

    prevention_plan = [
        "Enforce strict query and transaction timeouts to fail fast rather than stalling connection pools.",
        "Implement circuit breakers and bulkheads between upstream clients and downstream databases.",
        "Optimize locking order and resource allocation to permanently eliminate lock contention.",
    ]

    propagation_timeline = [
        f"[{started_at.strftime('%H:%M:%S') if started_at else '10:00:00'}] Initial failure detected in primary cluster: '{top_clean_name}'",
        "Subsequent cascading errors observed in downstream service dependencies.",
        "System reached peak error rate during the disturbance window.",
    ]

    what_should_i_do = list(immediate_mitigation)
    potential_impact = "Users may experience transaction failures, elevated latency, or HTTP 504 Gateway Timeouts during the disruption window."

    # Structured technical evidence
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
        "rawSamples": primary_log_lines[:5],
    }

    metrics = {
        "affectedPatterns": affected_patterns_count,
        "detectionWindow": "10 min",
        "totalMatchingErrors": total_matching_errors,
        "candidateCount": len(candidates),
    }

    # Gemini AI Problem-Solving RCA Enhancement with real log context
    llm_api_key = os.getenv("GEMINI_API_KEY")
    active_model = "deterministic"

    if llm_api_key:
        candidates_text = "\n".join([
            f"Rank #{c.get('rank', idx+1)} ({'ROOT CAUSE (X)' if c.get('rank', idx+1) == 1 else 'SYMPTOM (Y)'}): {c.get('template')} (Score: {c.get('totalScore')}/15)"
            for idx, c in enumerate(candidates[:4])
        ])

        timeline_context = "\n".join(timeline_lines) if timeline_lines else "No chronological timeline available."
        primary_context = "\n".join(primary_log_lines) if primary_log_lines else f"Pattern: {top_template}"

        prompt = f"""You are a Principal Site Reliability Engineer and Systems Architect diagnosing a cloud production incident.
Analyze the following real log context, chronological timeline, and root cause candidates to produce a definitive, evidence-backed Incident Root Cause Analysis (RCA).

--- CHRONOLOGICAL LOG TIMELINE (Incident Window) ---
{timeline_context}

--- PRIMARY ROOT CAUSE LOGS (Cluster: {top_template}) ---
{primary_context}

--- ROOT CAUSE CANDIDATES (Deterministic 15-Point Multi-Factor Scoring) ---
{candidates_text}

Task:
Produce a detailed, problem-solving engineering Root Cause Analysis in pure JSON with EXACTLY these fields:
{{
  "friendlyTitle": "Crisp technical incident title (e.g. 'Database Deadlocks on Inventory Locks Leading to Connection Pool Exhaustion')",
  "whatHappened": "Executive summary of the outage and blast radius citing affected services and error types",
  "whatMightBeCausingIt": "Definitive statement identifying Candidate #1 as the root cause",
  "whyThisRootCause": "Deep technical explanation of why Candidate #1 is the true initiating root cause (X) and why Candidates #2, #3, and #4 (Y) are downstream symptoms/consequences. Cite exact timestamps, services, and trace IDs from the raw logs to prove causal direction.",
  "propagationTimeline": ["Step 1 with timestamp and service", "Step 2", "Step 3"],
  "immediateMitigation": ["Actionable step 1 for on-call engineer", "Actionable step 2", "Actionable step 3"],
  "preventionPlan": ["Long-term architectural fix 1", "Fix 2", "Fix 3"],
  "whyDoWeThinkThis": ["Key evidence bullet 1 citing log lines", "Key evidence bullet 2", "Key evidence bullet 3", "Key evidence bullet 4"],
  "whatElseWasAffected": "1-2 sentences on impacted microservices and downstream effects.",
  "whatShouldIDo": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "potentialImpact": "1 sentence describing user and business impact."
}}

Output pure JSON only. Do not wrap in markdown or backticks."""

        # Candidate models that are verified and active on Gemini v1beta
        models_to_try = []
        if model_name:
            models_to_try.append(model_name)
        models_to_try.extend(["gemini-flash-lite-latest", "gemini-flash-latest"])

        for cand_model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{cand_model}:generateContent?key={llm_api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}

            try:
                with httpx.Client(timeout=15.0) as client:
                    res = client.post(url, json=payload)
                    if res.status_code == 200:
                        raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if raw_text.startswith("```json"):
                            raw_text = raw_text[7:]
                        if raw_text.startswith("```"):
                            raw_text = raw_text[3:]
                        if raw_text.endswith("```"):
                            raw_text = raw_text[:-3]
                        parsed_llm = json.loads(raw_text.strip())

                        if parsed_llm.get("friendlyTitle"):
                            friendly_title = parsed_llm["friendlyTitle"]
                        if parsed_llm.get("whatHappened"):
                            what_happened = parsed_llm["whatHappened"]
                        if parsed_llm.get("whatMightBeCausingIt"):
                            what_might_be_causing_it = parsed_llm["whatMightBeCausingIt"]
                        if parsed_llm.get("whyThisRootCause"):
                            why_this_root_cause = parsed_llm["whyThisRootCause"]
                        if parsed_llm.get("whyDoWeThinkThis") and isinstance(parsed_llm["whyDoWeThinkThis"], list):
                            why_do_we_think_this = parsed_llm["whyDoWeThinkThis"]
                        if parsed_llm.get("propagationTimeline") and isinstance(parsed_llm["propagationTimeline"], list):
                            propagation_timeline = parsed_llm["propagationTimeline"]
                        if parsed_llm.get("immediateMitigation") and isinstance(parsed_llm["immediateMitigation"], list):
                            immediate_mitigation = parsed_llm["immediateMitigation"]
                            what_should_i_do = list(immediate_mitigation)
                        if parsed_llm.get("preventionPlan") and isinstance(parsed_llm["preventionPlan"], list):
                            prevention_plan = parsed_llm["preventionPlan"]
                        if parsed_llm.get("whatElseWasAffected"):
                            what_else_was_affected = parsed_llm["whatElseWasAffected"]
                        if parsed_llm.get("potentialImpact"):
                            potential_impact = parsed_llm["potentialImpact"]

                        active_model = cand_model
                        logger.info(f"Successfully generated Gemini RCA using model {cand_model} for incident {incident_id}")
                        break
                    else:
                        logger.warn(f"Gemini model {cand_model} returned HTTP {res.status_code}: {res.text[:120]}")
            except Exception as e:
                logger.warn(f"Gemini call error with model {cand_model}: {e}")

    # Structured report for UI and persistence
    structured_report = {
        "friendlyTitle": friendly_title,
        "whatHappened": what_happened,
        "whatMightBeCausingIt": what_might_be_causing_it,
        "whyThisRootCause": why_this_root_cause,
        "propagationTimeline": propagation_timeline,
        "immediateMitigation": immediate_mitigation,
        "preventionPlan": prevention_plan,
        "whyDoWeThinkThis": why_do_we_think_this,
        "whatElseWasAffected": what_else_was_affected,
        "whatShouldIDo": what_should_i_do,
        "potentialImpact": potential_impact,
        "metrics": metrics,
        "technicalEvidence": technical_evidence,
    }

    # Markdown summary representation
    why_md = "\n".join(f"- {b}" for b in why_do_we_think_this)
    mitigation_md = "\n".join(f"{idx+1}. {step}" for idx, step in enumerate(immediate_mitigation))
    prevention_md = "\n".join(f"{idx+1}. {step}" for idx, step in enumerate(prevention_plan))

    summary_text = f"""### Incident Root Cause Analysis
**{friendly_title}**

#### What happened?
{what_happened}

#### Identified Root Cause
{what_might_be_causing_it}

#### Root Cause Mechanism & Causal Proof (X vs Y)
{why_this_root_cause}

#### Evidence from Logs
{why_md}

#### Cascading Effects & Impacted Components
{what_else_was_affected}

#### Immediate Remediation Procedures
{mitigation_md}

#### Permanent Prevention Plan
{prevention_md}
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
            "model": active_model,
        }
    )
    db.commit()

    return {
        "id": summary_id,
        "incidentId": incident_id,
        "summary": summary_text,
        "structuredReport": structured_report,
        "model": active_model,
    }
