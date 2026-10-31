import os
import json
import logging
import uuid
from typing import Dict, List, Optional, Any
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
    Implements Part 8 of the LogSense Specification:
    Synthesizes deterministic, point-based RCA findings and statistical log evidence
    into an expert Site Reliability Engineering explanation using Gemini API (or structured fallback).
    """
    logger.info(f"Generating incident summary for incident {incident_id}")

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

    # Fetch anomalies linked to this incident to gather affected clusters & baselines
    linked_anomalies = db.execute(
        text("""
            SELECT a.title, a.evidence, a."anomalyType", a."occurrenceCount", a."firstDetectedAt"
            FROM incident_anomalies ia
            JOIN anomalies a ON ia."anomalyId" = a.id
            WHERE ia."incidentId" = :inc_id
            ORDER BY a."firstDetectedAt" ASC
        """),
        {"inc_id": incident_id}
    ).fetchall()

    affected_clusters_summary = []
    for la in linked_anomalies:
        ev = la[1] if isinstance(la[1], dict) else {}
        if isinstance(ev, dict) and "affectedClusters" in ev:
            for aff in ev["affectedClusters"]:
                if isinstance(aff, dict):
                    affected_clusters_summary.append(
                        f"- Pattern '{aff.get('template')}' spiked to {aff.get('currentCount')} logs/min (baseline mean: {aff.get('baselineMean')}, Z={aff.get('zScore')})"
                    )

    affected_section = "\n".join(affected_clusters_summary[:5]) if affected_clusters_summary else "- No secondary cluster spikes recorded."

    recommendations = [
        f"Investigate initiating error pattern: '{top_template}'.",
        "Check network connection stability, socket pool exhaustion, and thread interruption rates.",
        "Review queue timeouts and downstream consumer latency around the incident start window.",
        "Verify application configuration for connection keep-alive and retry backoff limits.",
    ]

    llm_api_key = os.getenv("GEMINI_API_KEY")
    summary_text = ""
    used_model = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # If the environment variable is set to a legacy or non-existent model name, fall back to standard 2.5/1.5-flash
    if used_model in ("gemini-3.5-flash-lite", "gemini-3.5", "default"):
        used_model = "gemini-2.5-flash"

    if llm_api_key:
        try:
            prompt = f"""You are an expert Site Reliability Engineer analyzing a production log incident.
Statistical Anomaly Detection and Deterministic 15-Point Root Cause Analysis have produced the following verified evidence:

Incident: {inc_title} (Severity: {inc_sev}, Started At: {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')})
Primary Initiating Log Pattern: {top_template}
RCA Score: {top_score:.1f} / 15.0 Points (Confidence: {confidence * 100:.1f}%)

Point Breakdown for Top Candidate:
- Temporal Precedence: {top_candidate.get('temporalPoints', 0)} / 4 pts
- Frequency Increase: {top_candidate.get('frequencyPoints', 0)} / 4 pts (Max Count: {top_candidate.get('maxOccurrence', 0)}, Z-Score: {top_candidate.get('maxZScore', 0):.2f})
- Error Classification: {top_candidate.get('classificationPoints', 0)} / 3 pts
- Relationship to Affected Patterns: {top_candidate.get('relationshipPoints', 0)} / 4 pts

Candidate Rankings:
{json.dumps([{'rank': c['rank'], 'template': c['template'], 'score': f"{c['totalScore']}/15"} for c in candidates[:4]], indent=2)}

Co-occurring Affected Patterns:
{affected_section}

Sample Raw Log Lines:
{chr(10).join(raw_samples[:4]) if raw_samples else 'No raw logs sampled'}

Write a comprehensive, professional incident explanation covering:
1. Executive Incident Overview
2. Most Likely Initiating Error Pattern
3. Why It Was Selected (RCA scoring breakdown & statistical deviation)
4. Other Affected Patterns & Cascading Disturbance
5. Timeline of Events
6. Supporting Log Evidence
7. Recommended Immediate Verification Steps
8. Uncertainty and Limitations

Do NOT invent fictitious services or unobserved causes. Ground your analysis strictly in the verified evidence."""

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{used_model}:generateContent?key={llm_api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    summary_text = data["candidates"][0]["content"]["parts"][0]["text"]
                elif res.status_code == 404:
                    # Model not found, try fallback to gemini-1.5-flash
                    url_fb = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={llm_api_key}"
                    res_fb = client.post(url_fb, json=payload)
                    if res_fb.status_code == 200:
                        data_fb = res_fb.json()
                        summary_text = data_fb["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.warn(f"Gemini API call failed, falling back to structured synthesis: {e}")

    # Fallback to high-quality deterministic synthesis if API not configured or unavailable
    if not summary_text:
        why_bullets = [
            f"**Temporal Precedence ({top_candidate.get('temporalPoints', 0)}/4 pts):** Pattern initiated earliest in the failure timeline.",
            f"**Statistical Frequency Spike ({top_candidate.get('frequencyPoints', 0)}/4 pts):** Reached a peak volume of {top_candidate.get('maxOccurrence', 0)} logs/min with Z-score {top_candidate.get('maxZScore', 0):.2f}.",
            f"**Error Classification ({top_candidate.get('classificationPoints', 0)}/3 pts):** Structural failure signature matching direct system/network disruption.",
            f"**Relationship with Affected Clusters ({top_candidate.get('relationshipPoints', 0)}/4 pts):** High explanatory correlation with co-occurring worker disruptions.",
        ]

        summary_text = f"""### Incident: {inc_title}

**Most Likely Initiating Log Pattern:** `{top_template}`  
**RCA Score:** {top_score:.1f} / 15.0 Points (Confidence: {confidence * 100:.1f}%)

#### 1. Executive Incident Overview
At {started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}, statistical anomaly detection identified a correlated disturbance cascade initiated by `{top_template}`. This disturbance triggered multiple secondary thread disruptions across the application.

#### 2. Why It Was Selected (RCA Point Breakdown):
- {chr(10).join(why_bullets)}

#### 3. Other Affected Patterns:
{affected_section}

#### 4. Supporting Log Evidence:
```text
{chr(10).join(raw_samples) if raw_samples else 'No raw log lines available'}
```

#### 5. Recommended Immediate Verification Steps:
1. {recommendations[0]}
2. {recommendations[1]}
3. {recommendations[2]}
4. {recommendations[3]}

#### 6. Uncertainty and Limitations:
This analysis is based on statistical 5-minute moving baselines and Drain3 template clustering. In distributed environments without distributed trace propagation, temporal co-occurrence is strongly indicative but should be verified with network metrics.
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
            "rec": json.dumps(recommendations),
            "model": used_model if summary_text else "deterministic-synthesizer",
        }
    )
    db.commit()

    return {
        "id": summary_id,
        "incidentId": incident_id,
        "summary": summary_text,
        "recommendations": recommendations,
        "model": used_model,
    }
