import re
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from dateutil import parser as date_parser

LEVEL_MAP = {
    "FATAL": "FATAL",
    "CRIT": "CRITICAL",
    "CRITICAL": "CRITICAL",
    "ERR": "ERROR",
    "ERRO": "ERROR",
    "ERROR": "ERROR",
    "WARN": "WARN",
    "WARNING": "WARN",
    "INFO": "INFO",
    "INFORMATIONAL": "INFO",
    "DBG": "DEBUG",
    "DEBUG": "DEBUG",
    "TRACE": "TRACE",
}

TIMESTAMP_PATTERN = re.compile(
    r"^\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?"
)

LEVEL_PATTERN = re.compile(
    r"\b(?P<level>FATAL|CRITICAL|ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b",
    re.IGNORECASE
)

SERVICE_PATTERN = re.compile(
    r"(?:service|app)[=:\s\"']+([a-zA-Z0-9_\-\.]+)|\[(?P<service>[a-zA-Z0-9_\-\.]+)\]",
    re.IGNORECASE
)

TRACE_ID_PATTERN = re.compile(
    r"(?:trace[_-]?id)[=:\s\"']+([a-fA-F0-9]{16,32})",
    re.IGNORECASE
)

SPAN_ID_PATTERN = re.compile(
    r"(?:span[_-]?id)[=:\s\"']+([a-fA-F0-9]{8,16})",
    re.IGNORECASE
)

# Robust variable masking for Drain3 clustering
RE_MASKS = [
    (re.compile(r"https?://[^\s'\"]+"), "<*>"),
    (re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b"), "<*>"), # IPv4:port
    (re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b"), "<*>"), # IPv6
    (re.compile(r"/[a-zA-Z0-9_\-\.\/]+"), "<*>"), # file paths & leading /IPs
    (re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"), "<*>"), # UUID
    (re.compile(r"\b0x[0-9a-fA-F]+\b|\b[0-9a-fA-F]{8,64}\b"), "<*>"), # hex hashes & memory addresses
    (re.compile(r"(?<=[^\w])[-+]?\d+(?=[^\w]|$)"), "<*>"), # standalone integers
    (re.compile(r"^[-+]?\d+"), "<*>"),
    (re.compile(r"[-+]?\d+$"), "<*>"),
]

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
    """Masks dynamic parameters with standard <*> placeholder."""
    norm = text
    for pattern, repl in RE_MASKS:
        norm = pattern.sub(repl, norm)
    # Collapse repetitive <*> tokens
    norm = re.sub(r"(<\*>[\s,;:=-]*)+<\*>", "<*>", norm)
    return norm.strip()

def parse_timestamp(val: Any) -> datetime:
    """Converts a string or epoch number into UTC datetime."""
    if isinstance(val, (int, float)):
        if val > 1e11:
            val = val / 1000.0
        return datetime.fromtimestamp(val, tz=timezone.utc)

    if isinstance(val, str):
        try:
            # Handle ISO or standard formats like "2015-07-29 17:41:44,747"
            clean_str = val.replace(",", ".")
            dt = date_parser.parse(clean_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            return dt
        except Exception:
            pass

    return datetime.now(timezone.utc)

def extract_log_record(raw_line: str, fallback_service_name: Optional[str] = None) -> ExtractedLogRecord:
    """
    Parses a log line (plaintext or JSON) into structured components.
    Ensures that the normalized_message contains the true semantic content
    free of header prefixes, so Drain3 produces high-accuracy clusters.
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
                raw_ts = data.get("timestamp") or data.get("time") or data.get("@timestamp") or data.get("datetime")
                ts = parse_timestamp(raw_ts)

                raw_level = str(data.get("level") or data.get("severity") or data.get("log_level") or "INFO").upper()
                level = LEVEL_MAP.get(raw_level, "INFO")

                service = data.get("service") or data.get("service_name") or data.get("app") or fallback_service_name
                raw_msg = str(data.get("message") or data.get("msg") or data.get("log") or line)

                trace_id = data.get("traceId") or data.get("trace_id") or data.get("trace")
                span_id = data.get("spanId") or data.get("span_id") or data.get("span")

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

    # 2. Plaintext Parsing with Clean Component Extraction
    # Handles: "2015-07-29 17:41:44,747 - INFO  [QuorumPeer...:FastLeaderElection@774] - Notification time out: 3200"
    # as well as: "2024-01-01 12:00:00 [ERROR] Database connection failed"
    timestamp = datetime.now(timezone.utc)
    ts_match = TIMESTAMP_PATTERN.search(line)
    remaining = line

    if ts_match:
        ts_str = ts_match.group("ts")
        timestamp = parse_timestamp(ts_str)
        remaining = line[ts_match.end():].strip()

    # Strip optional leading delimiter (e.g. " - ")
    remaining = re.sub(r"^[ \t]*-[ \t]*", "", remaining).strip()

    # Extract log level
    level = "INFO"
    lvl_match = LEVEL_PATTERN.search(remaining)
    if lvl_match:
        raw_lvl = lvl_match.group("level").upper()
        level = LEVEL_MAP.get(raw_lvl, "INFO")
        # Remove level token from the beginning if present
        if remaining.upper().startswith(raw_lvl):
            remaining = remaining[len(raw_lvl):].strip()

    # Strip optional delimiter after level
    remaining = re.sub(r"^[ \t]*-[ \t]*", "", remaining).strip()

    # Extract optional service name from plaintext if present
    service = fallback_service_name
    svc_match = SERVICE_PATTERN.search(remaining)
    if svc_match:
        found_svc = svc_match.group(1) or svc_match.group("service")
        if found_svc and found_svc.upper() not in LEVEL_MAP and len(found_svc) < 32:
            service = found_svc

    # Extract trace / span ID
    trace_id = None
    span_id = None
    tr_match = TRACE_ID_PATTERN.search(remaining)
    if tr_match:
        trace_id = tr_match.group(1)
    sp_match = SPAN_ID_PATTERN.search(remaining)
    if sp_match:
        span_id = sp_match.group(1)

    # Strip bracketed logger/thread prefix (e.g. "[QuorumPeer...:FastLeaderElection@774] - ")
    logger_header = None
    bracket_match = re.match(r"^\[(?P<header>.*?)\](?:\s*-\s*|\s+)", remaining)
    if bracket_match:
        logger_header = bracket_match.group("header")
        remaining = remaining[bracket_match.end():].strip()
    elif remaining.startswith("[") and "]" in remaining:
        # Handle cases with nested brackets like [QuorumPeer[myid=1]/...]
        last_bracket_idx = remaining.rfind("]")
        if last_bracket_idx != -1 and last_bracket_idx < len(remaining) - 1:
            after_bracket = remaining[last_bracket_idx + 1:].strip()
            if after_bracket.startswith("-"):
                after_bracket = after_bracket[1:].strip()
            if len(after_bracket) > 0:
                logger_header = remaining[1:last_bracket_idx]
                remaining = after_bracket

    # If message is still empty, fall back to line
    msg_body = remaining if remaining else line

    normalized = normalize_text(msg_body)

    metadata: Dict[str, Any] = {}
    if logger_header:
        metadata["logger"] = logger_header

    return ExtractedLogRecord(
        timestamp=timestamp,
        level=level,
        service_name=service,
        raw_message=line,
        normalized_message=normalized,
        trace_id=trace_id,
        span_id=span_id,
        metadata=metadata,
    )
