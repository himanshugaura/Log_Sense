"""
Rule-Based Log Template Normalizer for LogicSense.

Maps raw Drain3 log templates containing technical signatures and dynamic wildcards
into clean, concise, human-readable display titles and descriptions for non-technical users.

Preserves the original Drain3 template for clustering, anomaly detection, and RCA.
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class NormalizationRule:
    id: str
    pattern: re.Pattern
    display_title: str
    category: str
    short_description: str


# Configurable, easily extensible normalization rules.
# Targeted regex patterns prevent overly broad keyword misclassifications.
NORMALIZATION_RULES: List[NormalizationRule] = [
    # 1. User-specified example: "Established session <*> with negotiated timeout <*> for client /<*>"
    NormalizationRule(
        id="session_establishment_issue",
        pattern=re.compile(
            r"(?i)\bestablished\s+session\b.*\bnegotiated\s+timeout\b",
            re.DOTALL,
        ),
        display_title="Session establishment issue",
        category="Session & Consensus",
        short_description="Repeated session renegotiation or connection establishment disturbance detected.",
    ),
    # 2. User-specified example: "Expiring session <*>, timeout of 10000ms exceeded"
    NormalizationRule(
        id="session_timeout_exceeded",
        pattern=re.compile(
            r"(?i)\bexpiring\s+session\b.*\btimeout.*exceeded\b",
            re.DOTALL,
        ),
        display_title="Session timeout exceeded",
        category="Session & Consensus",
        short_description="Client session expired after exceeding the configured heartbeat lease timeout window.",
    ),
    # 3. User-specified example: "caught end of stream exception"
    NormalizationRule(
        id="connection_stream_interrupted",
        pattern=re.compile(
            r"(?i)\bcaught\s+end\s+of\s+stream\s+exception\b",
            re.DOTALL,
        ),
        display_title="Connection stream interrupted",
        category="Network & Transport",
        short_description="Network communication stream terminated prematurely by the remote peer or intermediary proxy.",
    ),
    # 4. User-specified example: "Database connection failed for user <*>"
    NormalizationRule(
        id="database_connection_failure",
        pattern=re.compile(
            r"(?i)\bdatabase\s+connection\s+failed\b",
            re.DOTALL,
        ),
        display_title="Database connection failure",
        category="Database",
        short_description="Failed to authenticate or establish an active connection to the backend database.",
    ),
    # 5. Database Connection Pool Exhaustion (HikariCP / c3p0 / DBCP)
    NormalizationRule(
        id="connection_pool_exhausted",
        pattern=re.compile(
            r"(?i)\b(hikaripool|connection\s+pool)\b.*\b(not\s+available|exhausted|timeout)\b",
            re.DOTALL,
        ),
        display_title="Database connection pool exhausted",
        category="Database Connection Pool",
        short_description="All available database connections in the connection pool were occupied, causing incoming queries to time out.",
    ),
    # 6. TCP Connection Reset / Socket Termination
    NormalizationRule(
        id="network_socket_reset",
        pattern=re.compile(
            r"(?i)\b(connection\s+(broken|reset|refused)|broken\s+pipe|socket\s+closed|connection\s+closed\s+by\s+peer)\b",
            re.DOTALL,
        ),
        display_title="Network connection reset",
        category="Network & Transport",
        short_description="Active TCP socket was abruptly closed or reset by the remote host, gateway, or load balancer.",
    ),
    # 7. Asynchronous Worker / Thread Interruption
    NormalizationRule(
        id="worker_thread_interrupted",
        pattern=re.compile(
            r"(?i)\b(interrupting\s+sendworker|interrupted\s+while\s+waiting|worker\s+thread\s+interrupted|leaving\s+thread)\b",
            re.DOTALL,
        ),
        display_title="Background task worker interrupted",
        category="Worker Thread Pool",
        short_description="An asynchronous worker thread was forcibly halted due to an upstream socket closure or queue backpressure.",
    ),
    # 8. Memory Limit Exhaustion
    NormalizationRule(
        id="memory_limit_exceeded",
        pattern=re.compile(
            r"(?i)\b(outofmemoryerror|java\s+heap\s+space|gc\s+overhead\s+limit|out\s+of\s+memory)\b",
            re.DOTALL,
        ),
        display_title="Memory limit exceeded",
        category="System Resources",
        short_description="Process heap memory reached capacity, triggering garbage collection pause or allocation failures.",
    ),
    # 9. Storage / Disk Capacity & I/O
    NormalizationRule(
        id="storage_io_failure",
        pattern=re.compile(
            r"(?i)\b(disk\s+full|no\s+space\s+left\s+on\s+device|ioexception.*write|file\s+system\s+error)\b",
            re.DOTALL,
        ),
        display_title="Storage capacity or I/O failure",
        category="Storage & File System",
        short_description="Failed to complete file system read or write operations due to disk constraints or permission errors.",
    ),
    # 10. Authentication / Authorization Failures
    NormalizationRule(
        id="authentication_failure",
        pattern=re.compile(
            r"(?i)\b(authentication\s+failed|access\s+denied|unauthorized|invalid\s+credentials|token\s+expired)\b",
            re.DOTALL,
        ),
        display_title="Authentication failure",
        category="Security & Access",
        short_description="Access request rejected due to invalid credentials, expired session token, or permission restrictions.",
    ),
    # 11. Upstream HTTP / RPC Service Gateway Failure
    NormalizationRule(
        id="upstream_service_gateway_error",
        pattern=re.compile(
            r"(?i)\b(bad\s+gateway|service\s+unavailable|gateway\s+timeout|502\s+bad\s+gateway|503\s+service\s+unavailable|504\s+gateway\s+timeout)\b",
            re.DOTALL,
        ),
        display_title="Upstream service gateway failure",
        category="Microservice Integration",
        short_description="Upstream dependency failed to respond within expected latency SLA or returned a gateway error.",
    ),
    # 12. Deadlock / Lock Acquisition Timeout
    NormalizationRule(
        id="lock_acquisition_timeout",
        pattern=re.compile(
            r"(?i)\b(deadlock\s+detected|lock\s+wait\s+timeout|failed\s+to\s+acquire\s+lock)\b",
            re.DOTALL,
        ),
        display_title="Resource lock contention timeout",
        category="Concurrency & Locking",
        short_description="Concurrent operations exceeded lock wait limits, resulting in transaction rollback or cancellation.",
    ),
    # 13. SSL / TLS Handshake Failure
    NormalizationRule(
        id="ssl_handshake_failure",
        pattern=re.compile(
            r"(?i)\b(ssl\s+handshake\s+failed|tls\s+handshake|ssl\s+handshake|certificate\s+verify\s+failed)\b",
            re.DOTALL,
        ),
        display_title="SSL/TLS handshake failure",
        category="Security & Transport",
        short_description="Encrypted connection negotiation with remote payment provider or API endpoint failed.",
    ),
    # 14. Circuit Breaker Tripped / Isolation
    NormalizationRule(
        id="circuit_breaker_tripped",
        pattern=re.compile(
            r"(?i)\b(circuit\s+breaker\s+open|circuit\s+breaker\s+tripped)\b",
            re.DOTALL,
        ),
        display_title="Circuit breaker tripped",
        category="Microservice Resilience",
        short_description="Automated circuit breaker opened after consecutive downstream upstream failure thresholds were reached.",
    ),
    # 15. Payment Provider Gateway Failure
    NormalizationRule(
        id="payment_gateway_failure",
        pattern=re.compile(
            r"(?i)\b(upstream\s+stripe-gateway|payment\s+timeout|downstream\s+payment\s+failure)\b",
            re.DOTALL,
        ),
        display_title="Payment provider gateway failure",
        category="External Gateway",
        short_description="External payment gateway failed to respond or returned service unavailable during checkout transactions.",
    ),
]


def strip_wildcards(template: str) -> str:
    """
    Strips raw Drain3 wildcard placeholders (<*>, [<*>], <*ms>, etc.) and cleans up formatting.
    """
    if not template:
        return ""
    # Strip wildcards like <*>, [<*>], /<*>, <*:*>, <*ms>
    cleaned = re.sub(r"\[?\s*/?<\*[^>]*>\s*\]?", " ", template)
    # Strip hex/UUID sequences if raw
    cleaned = re.sub(r"\b0x[0-9a-fA-F]+\b", "", cleaned)
    # Strip extra punctuation and multiple spaces
    cleaned = re.sub(r"[:\-_/]\s*$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def normalize_template(template: str, raw_title: Optional[str] = None) -> dict:
    """
    Derives a human-readable display title, category, and short description
    from a raw Drain3 template or raw event title.

    Never modifies the underlying technical template string.
    """
    text_to_eval = template or raw_title or ""

    # Clean off any outer "Incident: " or "Cluster Spike: " prefixes if testing raw titles
    eval_stripped = re.sub(
        r"(?i)^(incident:\s*(critical\s*spike\s*in\s*|new\s*pattern\s*emergence\s*)?|cluster\s*spike:\s*)",
        "",
        text_to_eval,
    ).strip("'\" ")

    # 1. Match against configured rules
    for rule in NORMALIZATION_RULES:
        if rule.pattern.search(eval_stripped) or rule.pattern.search(text_to_eval):
            return {
                "displayTitle": rule.display_title,
                "category": rule.category,
                "shortDescription": rule.short_description,
                "isMatched": True,
                "ruleId": rule.id,
            }

    # 2. Generic fallback for unknown templates (removes wildcards and formats gracefully)
    cleaned = strip_wildcards(eval_stripped)
    if cleaned and len(cleaned) > 4:
        # Capitalize first letter cleanly
        fallback_title = cleaned[0].upper() + cleaned[1:]
        if len(fallback_title) > 65:
            fallback_title = fallback_title[:62].rstrip() + "..."
        display_title = fallback_title
        short_desc = f"An unusual frequency of '{fallback_title}' log events was detected."
    else:
        display_title = "Unexpected application disruption"
        short_desc = "An unexpected surge in operational error logs was detected."

    return {
        "displayTitle": display_title,
        "category": "Application Service",
        "shortDescription": short_desc,
        "isMatched": False,
        "ruleId": "generic_fallback",
    }


def get_display_title(template: str, fallback: Optional[str] = None) -> str:
    """Convenience accessor to get just the displayTitle string."""
    res = normalize_template(template, fallback)
    return res["displayTitle"]
