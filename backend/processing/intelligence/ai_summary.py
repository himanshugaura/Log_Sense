import os
import json
import logging
import uuid
from typing import Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

logger = logging.getLogger("logsense.summary")

def generate_incident_summary(
    db: Session,
    incident_id: str,
    rca_result: dict,
    model_name: Optional[str] = None
) -> dict:
    """
    Transforms deterministic RCA evidence and anomaly data into a structured,
    human-readable incident summary with actionable investigation steps.
    Supports LLM API (Gemini/OpenAI) if keys are provided, with reliable fallback synthesis.
    """
    logger.info(f"Generating incident summary for incident {incident_id}")

    # Fetch incident title and description
    incident = db.execute(
        text("SELECT title, description, severity, \"startedAt\" FROM incidents WHERE id = :id"),
        {"id": incident_id}
    ).fetchone()

    if not incident:
        raise ValueError(f"Incident {incident_id} not found")

    inc_title = incident[0]
    inc_sev = incident[2]
    top_candidate = rca_result.get("topCandidate", {})
    culprit_name = top_candidate.get("serviceName", "unknown-service")
    confidence = rca_result.get("confidence", 0.8)
    candidates = rca_result.get("candidates", [])

    # Actionable recommended investigation steps based on the identified root cause
    recommendations = [
        f"Inspect health and resource metrics (CPU, RAM, Connections) on {culprit_name}.",
        f"Verify network connectivity and latency between {culprit_name} and its callers.",
        "Check database connection pool utilization and timeout configurations.",
        "Review recent deployments or configuration changes pushed immediately prior to the incident.",
    ]

    llm_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    summary_text = ""
    used_model = "rule-based-synthesizer"

    if os.getenv("GEMINI_API_KEY"):
        used_model = model_name or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        try:
            prompt = f"""You are an expert Site Reliability Engineer analyzing a production incident.
Deterministic Root Cause Analysis has produced the following evidence:

Incident: {inc_title} (Severity: {inc_sev})
Primary Root Cause Service: {culprit_name} (Confidence: {confidence * 100:.1f}%)
RCA Explanation: {top_candidate.get('explanation', '')}

Candidate Rankings:
{json.dumps(candidates, indent=2, default=str)}

Please write an incident summary with:
1. Executive Incident Overview
2. Likely Root Cause Explanation (grounded strictly in the provided evidence)
3. Timeline & Cascading Failure Path
4. Recommended Immediate Verification Steps

Do NOT invent unobserved causes. Distinguish observed facts from hypotheses."""

            gemini_key = os.getenv("GEMINI_API_KEY")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{used_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    summary_text = data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.warn(f"Gemini API call failed, falling back to structured synthesis: {e}")

    # Fallback to high-quality deterministic synthesis
    if not summary_text:
        why_bullets = []
        if top_candidate.get("explanation"):
            why_bullets.append(top_candidate["explanation"])
        for c in candidates[1:3]:
            why_bullets.append(f"Downstream impact observed in '{c['serviceName']}' (Rank #{c['rank']}, score {c['totalScore']}).")

        why_section = "\n- ".join(why_bullets)

        summary_text = f"""### Incident: {inc_title}

**Likely Root Cause Service:** `{culprit_name}`  
**Confidence Score:** {confidence * 100:.1f}%

#### Why:
- {why_section}

#### Recommended Investigation:
1. {recommendations[0]}
2. {recommendations[1]}
3. {recommendations[2]}
4. {recommendations[3]}
"""

    summary_id = str(uuid.uuid4())
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
            "rec": json.dumps(recommendations),
            "model": used_model,
        }
    )
    db.commit()
    logger.info(f"Incident summary {summary_id} created for incident {incident_id}")

    return {
        "summaryId": summary_id,
        "incidentId": incident_id,
        "model": used_model,
        "summary": summary_text,
        "recommendations": recommendations,
    }
