from datetime import datetime, timezone
from parsers.extractor import extract_log_record

def test_json_log():
    json_line = '{"time": "2026-10-31T10:00:00Z", "level": "ERROR", "service": "payment-service", "msg": "Payment failed for user 101", "traceId": "abc1234567890123"}'
    rec = extract_log_record(json_line)
    print("Parsed JSON record:", rec)
    assert rec.level == "ERROR"
    assert rec.service_name == "payment-service"
    assert rec.trace_id == "abc1234567890123"
    assert rec.normalized_message == "Payment failed for user <*>"

def test_plaintext_microservice_log():
    raw_line = "2026-10-31 10:00:01 ERROR [order-service] trace_id=fedcba9876543210 span_id=12345678 Order creation failed for order #98765"
    rec = extract_log_record(raw_line)
    print("Parsed Plaintext record:", rec)
    assert rec.level == "ERROR"
    assert rec.service_name == "order-service"
    assert rec.trace_id == "fedcba9876543210"
    assert rec.span_id == "12345678"
    assert "<*>" in rec.normalized_message

def test_syslog_plain():
    raw_line = "2026-10-31 10:00:02 INFO database-service: Connection opened to 192.168.1.50:5432"
    rec = extract_log_record(raw_line, fallback_service_name="database-service")
    print("Parsed Syslog record:", rec)
    assert rec.level == "INFO"
    assert rec.service_name == "database-service"
    assert "<*>" in rec.normalized_message

if __name__ == "__main__":
    test_json_log()
    test_plaintext_microservice_log()
    test_syslog_plain()
    print("All extractor tests passed!")
