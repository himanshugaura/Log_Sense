import re
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from dateutil import parser as date_parser

# Common log level normalization
LEVEL_MAP = {
    "ERR": "ERROR",
    "ERRO": "ERROR",
    "ERROR": "ERROR",
    "CRIT": "ERROR",
    "CRITICAL": "ERROR",
    "FATAL": "ERROR",
    "WARN": "WARN",
    "WARNING": "WARN",
    "INFO": "INFO",
    "INFORMATIONAL": "INFO",
    "DBG": "DEBUG",
    "DEBUG": "DEBUG",
    "TRACE": "DEBUG",
}

# Regex patterns
TIMESTAMP_PATTERN = re.compile(
    r"^\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?"
)

LEVEL_PATTERN = re.compile(
    r"\b(?P<level>FATAL|CRITICAL|ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b",
    re.IGNORECASE
)

SERVICE_PATTERN = re.compile(
    r"\[(?P<service>[a-zA-Z0-9_\-\.]+)\]|service=(?P<service2>[a-zA-Z0-9_\-\.]+)|app=(?P<service3>[a-zA-Z0-9_\-\.]+)"
)

TRACE_ID_PATTERN = re.compile(
    r"(?:trace[_-]?id)[=:\s\"']+([a-fA-F0-9]{16,32})",
    re.IGNORECASE
)

SPAN_ID_PATTERN = re.compile(
    r"(?:span[_-]?id)[=:\s\"']+([a-fA-F0-9]{8,16})",
    re.IGNORECASE
)

# Normalization patterns for dynamic variables
RE_IPV4 = re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b")
RE_UUID = re.compile(r"\b[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}\b")
RE_HEX = re.compile(r"\b0x[a-fA-F0-9]+\b|\b[a-fA-F0-9]{16,64}\b")
RE_URL = re.compile(r"https?://[^\s'\"]+")
RE_NUMBERS = re.compile(r"(?<=\s|=|-|/|#)\d+(?=\s|,|;|\.|$|/|#)")

@dataclass
class ExtractedLogRecord:
    timestamp: datetime
    level: str
    service_name: Optional[str]
    raw_message: str
    normalized_message: str
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

def normalize_text(text: str) -> str:
    """Replaces dynamic variables (IPs, UUIDs, numbers, URLs) with standard <*> wildcard."""
    text = RE_URL.sub("<*>", text)
    text = RE_IPV4.sub("<*>", text)
    text = RE_UUID.sub("<*>", text)
    text = RE_HEX.sub("<*>", text)
    text = RE_NUMBERS.sub("<*>", text)
    return text.strip()

def parse_timestamp(val: Any) -> datetime:
    """Converts a string or epoch number into a timezone-aware UTC datetime."""
    if isinstance(val, (int, float)):
        # Epoch seconds or milliseconds
        if val > 1e11:
            val = val / 1000.0
        return datetime.fromtimestamp(val, tz=timezone.utc)

    if isinstance(val, str):
        try:
            dt = date_parser.parse(val)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass

    return datetime.now(timezone.utc)

def extract_log_record(raw_line: str, fallback_service_name: Optional[str] = None) -> ExtractedLogRecord:
    """
    Parses an individual log line (JSON or plaintext) and extracts structured fields
    (timestamp, level, service, message, trace_id, span_id, normalized_message).
    """
    line = raw_line.strip()
    if not line:
        return ExtractedLogRecord(
            timestamp=datetime.now(timezone.utc),
            level="INFO",
            service_name=fallback_service_name,
            raw_message="",
            normalized_message="",
        )

    # 1. Try parsing JSON format
    if (line.startswith("{") and line.endswith("}")) or (line.startswith("{\\") and line.endswith("\\}")):
        try:
            data = json.loads(line)
            if isinstance(data, dict):
                # Extract timestamp
                raw_ts = data.get("timestamp") or data.get("time") or data.get("@timestamp") or data.get("datetime")
                ts = parse_timestamp(raw_ts)

                # Extract level
                raw_level = str(data.get("level") or data.get("severity") or data.get("log_level") or "INFO").upper()
                level = LEVEL_MAP.get(raw_level, "INFO")

                # Extract service
                service = data.get("service") or data.get("service_name") or data.get("app") or fallback_service_name

                # Extract message
                raw_msg = str(data.get("message") or data.get("msg") or data.get("log") or line)

                # Extract trace & span
                trace_id = data.get("traceId") or data.get("trace_id") or data.get("trace")
                span_id = data.get("spanId") or data.get("span_id") or data.get("span")

                # Remaining fields as metadata
                metadata = {
                    k: v for k, v in data.items()
                    if k not in {"timestamp", "time", "@timestamp", "datetime", "level", "severity", "service", "message", "msg"}
                }

                normalized = normalize_text(raw_msg)

                return ExtractedLogRecord(
                    timestamp=ts,
                    level=level,
                    service_name=str(service) if service else None,
                    raw_message=raw_msg,
                    normalized_message=normalized,
                    trace_id=str(trace_id) if trace_id else None,
                    span_id=str(span_id) if span_id else None,
                    metadata=metadata,
                )
        except Exception:
            pass

    # 2. Plaintext Parsing
    timestamp = datetime.now(timezone.utc)
    ts_match = TIMESTAMP_PATTERN.search(line)
    remaining = line

    if ts_match:
        ts_str = ts_match.group("ts")
        timestamp = parse_timestamp(ts_str)
        remaining = line[ts_match.end():].strip()

    # Extract level
    level = "INFO"
    lvl_match = LEVEL_PATTERN.search(remaining)
    if lvl_match:
        raw_lvl = lvl_match.group("level").upper()
        level = LEVEL_MAP.get(raw_lvl, "INFO")

    # Extract service name
    service = fallback_service_name
    for svc_match in SERVICE_PATTERN.finditer(remaining):
        detected_svc = svc_match.group("service") or svc_match.group("service2") or svc_match.group("service3")
        if detected_svc and detected_svc.upper() not in LEVEL_MAP:
            service = detected_svc
            break

    # Extract trace / span ID
    trace_id = None
    span_id = None
    tr_match = TRACE_ID_PATTERN.search(remaining)
    if tr_match:
        trace_id = tr_match.group(1)

    sp_match = SPAN_ID_PATTERN.search(remaining)
    if sp_match:
        span_id = sp_match.group(1)

    # Clean message body by stripping leading [LEVEL] and [SERVICE] prefixes
    msg_body = remaining
    while True:
        stripped = False
        bracket_match = re.match(r"^\[(?P<token>[a-zA-Z0-9_\-\.]+)\]\s*", msg_body)
        if bracket_match:
            tok = bracket_match.group("token")
            if tok.upper() in LEVEL_MAP or (service and tok.lower() == service.lower()):
                msg_body = msg_body[bracket_match.end():]
                stripped = True
        if not stripped:
            break

    # Also clean loose level keywords at the start of msg_body
    if lvl_match and msg_body.upper().startswith(level):
        msg_body = msg_body[len(level):].strip(" :-\t")

    if not msg_body:
        msg_body = line

    normalized = normalize_text(msg_body)

    return ExtractedLogRecord(
        timestamp=timestamp,
        level=level,
        service_name=service,
        raw_message=line,
        normalized_message=normalized,
        trace_id=trace_id,
        span_id=span_id,
        metadata={},
    )
