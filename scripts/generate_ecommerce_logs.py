#!/usr/bin/env python3
"""
High-fidelity E-Commerce Microservices Log Generator for LogSense.
Generates thousands of realistic logs producing 3 distinct incidents
separated by healthy baseline windows (> 5-minute correlation window).

Incidents Created:
1. Incident 1 (Minutes 06 - 09): Database Connection Pool Exhaustion & Deadlocks (database-service)
2. Incident 2 (Minutes 21 - 24): Authentication & Redis Session Memory Collapse (auth-service)
3. Incident 3 (Minutes 36 - 39): External Payment Gateway 503 Outage & Circuit Breaker (payment-service)
"""

import sys
import json
import random
import uuid
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

SERVICES = [
    "api-gateway",
    "auth-service",
    "product-catalog",
    "cart-service",
    "order-service",
    "payment-service",
    "inventory-service",
    "notification-service",
    "database-service",
]

NORMAL_IPS = [f"192.168.1.{i}" for i in range(10, 80)] + [f"10.0.2.{i}" for i in range(10, 60)]
PRODUCTS = [f"prod_{1000 + i}" for i in range(50)]
CATEGORIES = ["electronics", "footwear", "home-appliances", "apparel", "books", "fitness"]

def generate_trace_and_span():
    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]
    return trace_id, span_id

def format_log_entry(
    t: datetime,
    level: str,
    service: str,
    message: str,
    trace_id: str = None,
    span_id: str = None,
    metadata: dict = None,
    output_format: str = "plaintext"
) -> str:
    if output_format == "json":
        payload = {
            "timestamp": t.isoformat(),
            "level": level,
            "service": service,
            "message": message,
        }
        if trace_id:
            payload["traceId"] = trace_id
        if span_id:
            payload["spanId"] = span_id
        if metadata:
            payload.update(metadata)
        return json.dumps(payload)
    else:
        # Standard Plaintext Microservice format with millisecond precision
        ts_str = t.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        trace_str = f" trace_id={trace_id}" if trace_id else ""
        span_str = f" span_id={span_id}" if span_id else ""
        return f"{ts_str} {level} [{service}]{trace_str}{span_str} {message}"

def generate_3_incidents_dataset(
    output_path: str = "ecommerce_3_incidents.log",
    output_format: str = "plaintext",
    start_time: datetime = None
) -> int:
    if start_time is None:
        start_time = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

    logs = []

    def add(t, lvl, svc, msg, trace_id=None, span_id=None, meta=None):
        line = format_log_entry(t, lvl, svc, msg, trace_id, span_id, meta, output_format)
        logs.append((t, line))

    def healthy_minute(m_dt, count=120):
        for _ in range(count):
            sec = random.uniform(0.0, 59.8)
            t = m_dt + timedelta(seconds=sec)
            tr, sp = generate_trace_and_span()
            uid = random.randint(1000, 9999)
            client_ip = random.choice(NORMAL_IPS)

            pick = random.choices(
                population=["login", "search", "view", "cart", "checkout", "inv", "notify"],
                weights=[18, 26, 20, 16, 10, 6, 4]
            )[0]

            if pick == "login":
                add(t, "INFO", "auth-service", f"User login succeeded for user {uid} from ip={client_ip}", tr, sp)
            elif pick == "search":
                cat = random.choice(CATEGORIES)
                query = random.choice(["running-shoes", "laptop", "wireless-headphones", "winter-jacket", "coffee-maker"])
                latency = random.randint(12, 60)
                add(t, "INFO", "product-catalog", f"Query executed for category='{cat}' q='{query}' results=24 latency={latency}ms", tr, sp)
            elif pick == "view":
                prod = random.choice(PRODUCTS)
                if random.random() < 0.85:
                    add(t, "INFO", "product-catalog", f"Cache hit for product id {prod} response_time={random.randint(2, 8)}ms", tr, sp)
                else:
                    add(t, "WARN", "product-catalog", f"Cache miss for product id {prod} reading from primary db latency={random.randint(45, 110)}ms", tr, sp)
            elif pick == "cart":
                add(t, "INFO", "cart-service", f"Updated shopping cart for user {uid} added item {random.choice(PRODUCTS)} qty={random.randint(1, 3)}", tr, sp)
            elif pick == "checkout":
                oid = f"ord-{random.randint(10000, 99999)}"
                amt = round(random.uniform(25.00, 399.00), 2)
                sub_span_1 = uuid.uuid4().hex[:16]
                sub_span_2 = uuid.uuid4().hex[:16]
                add(t, "INFO", "order-service", f"Initializing checkout transaction for user {uid} order={oid} total=${amt}", tr, sp)
                t_sub1 = t + timedelta(milliseconds=random.randint(20, 45))
                add(t_sub1, "INFO", "inventory-service", f"Reserved items for order {oid} warehouse_id=wh-east-1", tr, sub_span_1)
                t_sub2 = t + timedelta(milliseconds=random.randint(50, 90))
                add(t_sub2, "INFO", "payment-service", f"Authorization approved by payment gateway provider=Stripe amount=${amt}", tr, sub_span_2)
            elif pick == "inv":
                add(t, "INFO", "inventory-service", f"Stock verification passed for product {random.choice(PRODUCTS)} available_count=42", tr, sp)
            elif pick == "notify":
                add(t, "INFO", "notification-service", f"Dispatched push notification for user {uid} template=ORDER_SHIPPED", tr, sp)

    # =========================================================================
    # TIMELINE OVERVIEW (Total 49 minutes: 10:00 to 10:48)
    # 10:00 - 10:05 (M00-M05): Baseline Healthy (0 errors/min)
    # 10:06 - 10:09 (M06-M09): INCIDENT 1 -> Database Connection Pool & Deadlocks
    # 10:10 - 10:20 (M10-M20): Healthy Calm Window 1 (11 minutes > 5 min correlation window)
    # 10:21 - 10:24 (M21-M24): INCIDENT 2 -> Auth & Redis Session Memory Collapse
    # 10:25 - 10:35 (M25-M35): Healthy Calm Window 2 (11 minutes > 5 min correlation window)
    # 10:36 - 10:39 (M36-M39): INCIDENT 3 -> Payment Gateway 503 Provider Outage & Circuit Breaker
    # 10:40 - 10:48 (M40-M48): Post-incident Healthy Stabilized (9 minutes)
    # =========================================================================

    # 1. Baseline Healthy Period (10:00 - 10:05)
    for m in range(0, 6):
        healthy_minute(start_time + timedelta(minutes=m), count=130)

    # 2. INCIDENT 1: Database Connection Pool Exhaustion & Deadlocks (10:06 - 10:09)
    # Minute 06: Pool Saturation & Deadlock (Genesis)
    m6 = start_time + timedelta(minutes=6)
    for i in range(120):
        t = m6 + timedelta(seconds=random.uniform(0.0, 59.8))
        tr, sp = generate_trace_and_span()
        if i < 30:
            add(t, "WARN", "database-service", f"Connection pool utilization high: {88 + i//2}/100 connections active latency={random.randint(180, 420)}ms")
        elif i < 70:
            add(t, "ERROR", "database-service", "Connection pool exhausted: 100/100 connections active")
        else:
            tx1 = f"0x{uuid.uuid4().hex[:8]}"
            tx2 = f"0x{uuid.uuid4().hex[:8]}"
            add(t, "CRITICAL", "database-service", f"deadlock detected between transaction {tx1} and {tx2} on table inventory_locks")

    # Minute 07-08: Downstream Cascade to payment, order, and gateway
    for m in [7, 8]:
        m_dt = start_time + timedelta(minutes=m)
        for _ in range(160):
            t = m_dt + timedelta(seconds=random.uniform(0.0, 59.8))
            tr, sp = generate_trace_and_span()
            oid = f"ord-{random.randint(10000, 99999)}"
            p = random.choice(["db_err", "pay_timeout", "ord_fail", "gw_504"])
            if p == "db_err":
                ip = f"10.0.4.{random.randint(12, 18)}"
                add(t, "CRITICAL", "database-service", f"connection broken: PostgreSQL backend closed socket unexpectedly to {ip}:5432")
            elif p == "pay_timeout":
                add(t, "ERROR", "payment-service", "Payment timeout connecting to database-service:5432 after 5000ms", tr, sp)
            elif p == "ord_fail":
                add(t, "ERROR", "order-service", f"Order creation failed due to downstream payment failure for order #{oid}", tr, sp)
            elif p == "gw_504":
                add(t, "ERROR", "api-gateway", f"HTTP 504 Gateway Timeout on POST /api/v1/checkout/orders client_ip={random.choice(NORMAL_IPS)} latency=5025ms", tr)

    # Minute 09: Incident 1 Mitigation
    m9 = start_time + timedelta(minutes=9)
    add(m9 + timedelta(seconds=5), "INFO", "database-service", "Restarting connection pool manager with max_connections=250")
    add(m9 + timedelta(seconds=12), "INFO", "database-service", "Connection pool reset, 250 connections initialized, 0 active")
    healthy_minute(m9, count=90)

    # 3. Calm Window 1 (10:10 - 10:20): 11 full minutes of healthy traffic
    for m in range(10, 21):
        healthy_minute(start_time + timedelta(minutes=m), count=110)

    # 4. INCIDENT 2: Auth Service & Redis Session Memory Collapse (10:21 - 10:24)
    # Minute 21: Redis OOM & Connection Refused
    m21 = start_time + timedelta(minutes=21)
    for i in range(120):
        t = m21 + timedelta(seconds=random.uniform(0.0, 59.8))
        tr, sp = generate_trace_and_span()
        if i < 40:
            add(t, "CRITICAL", "auth-service", "out of memory: Redis session cluster reached maxmemory 16384mb allocation failed")
        elif i < 80:
            add(t, "ERROR", "auth-service", "pool exhausted: Redis connection pool 50/50 connections active")
        else:
            add(t, "CRITICAL", "auth-service", "connection refused: unable to connect to redis-master:6379")

    # Minute 22-23: Downstream Cascade to API Gateway & Cart
    for m in [22, 23]:
        m_dt = start_time + timedelta(minutes=m)
        for _ in range(150):
            t = m_dt + timedelta(seconds=random.uniform(0.0, 59.8))
            tr, sp = generate_trace_and_span()
            uid = random.randint(1000, 9999)
            p = random.choice(["auth_fail", "jwt_401", "cart_fail", "redis_refused"])
            if p == "auth_fail":
                add(t, "ERROR", "auth-service", f"User authentication failed: session token validation timeout after 3000ms for user {uid}", tr, sp)
            elif p == "jwt_401":
                add(t, "ERROR", "api-gateway", f"HTTP 401 Unauthorized: JWT authentication failed due to auth-service timeout client_ip={random.choice(NORMAL_IPS)}", tr)
            elif p == "cart_fail":
                add(t, "ERROR", "cart-service", f"Redis connection timeout: failed to persist cart session for user {uid}", tr, sp)
            elif p == "redis_refused":
                add(t, "CRITICAL", "auth-service", "connection refused: unable to connect to redis-master:6379")

    # Minute 24: Incident 2 Mitigation
    m24 = start_time + timedelta(minutes=24)
    add(m24 + timedelta(seconds=4), "INFO", "auth-service", "Redis memory eviction policy triggered: evicted 150000 expired keys, memory usage 42%")
    add(m24 + timedelta(seconds=10), "INFO", "auth-service", "Session validation service health check passed latency=2ms")
    healthy_minute(m24, count=80)

    # 5. Calm Window 2 (10:25 - 10:35): 11 full minutes of healthy traffic
    for m in range(25, 36):
        healthy_minute(start_time + timedelta(minutes=m), count=110)

    # 6. INCIDENT 3: Payment Gateway Provider Outage (10:36 - 10:39)
    # Minute 36: SSL Handshake failure & 503 from external payment provider
    m36 = start_time + timedelta(minutes=36)
    for i in range(120):
        t = m36 + timedelta(seconds=random.uniform(0.0, 59.8))
        tr, sp = generate_trace_and_span()
        if i < 40:
            add(t, "CRITICAL", "payment-service", "fatal exception: payment gateway provider SSL handshake failed with error closed socket")
        elif i < 80:
            add(t, "ERROR", "payment-service", "503 Service Unavailable: upstream stripe-gateway returned 503 Provider Unavailable")
        else:
            add(t, "ERROR", "payment-service", "circuit breaker OPEN for external payment provider after 10 consecutive failures", tr, sp)

    # Minute 37-38: Downstream Cascade to order-service & api-gateway
    for m in [37, 38]:
        m_dt = start_time + timedelta(minutes=m)
        for _ in range(150):
            t = m_dt + timedelta(seconds=random.uniform(0.0, 59.8))
            tr, sp = generate_trace_and_span()
            oid = f"ord-{random.randint(10000, 99999)}"
            p = random.choice(["pay_fail", "ord_fail", "gw_502", "breaker"])
            if p == "pay_fail":
                add(t, "ERROR", "payment-service", "503 Service Unavailable: upstream stripe-gateway returned 503 Provider Unavailable")
            elif p == "ord_fail":
                add(t, "ERROR", "order-service", f"Order creation failed due to downstream payment failure for order #{oid}", tr, sp)
            elif p == "gw_502":
                add(t, "ERROR", "api-gateway", f"HTTP 502 Bad Gateway on POST /api/v1/checkout/capture client_ip={random.choice(NORMAL_IPS)} latency=3210ms", tr)
            elif p == "breaker":
                add(t, "ERROR", "payment-service", "circuit breaker OPEN for external payment provider after 10 consecutive failures", tr, sp)

    # Minute 39: Incident 3 Mitigation
    m39 = start_time + timedelta(minutes=39)
    add(m39 + timedelta(seconds=6), "INFO", "payment-service", "Secondary payment gateway provider Adyen activated as active failover")
    add(m39 + timedelta(seconds=12), "INFO", "payment-service", "Circuit breaker state transitioned to CLOSED, normal routing resumed")
    healthy_minute(m39, count=80)

    # 7. Post-Incident Healthy Stabilized (10:40 - 10:48)
    for m in range(40, 49):
        healthy_minute(start_time + timedelta(minutes=m), count=110)

    # Sort all logs chronologically
    logs.sort(key=lambda x: x[0])

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        for _, line in logs:
            f.write(line + "\n")

    print(f"Generated {len(logs)} log lines saved to {out_file.resolve()} (format: {output_format})")
    return len(logs)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate realistic E-Commerce microservices logs for LogSense.")
    parser.add_argument("--out", "-o", default="ecommerce_3_incidents.log", help="Output file path (default: ecommerce_3_incidents.log)")
    parser.add_argument("--format", "-f", choices=["plaintext", "json"], default="plaintext", help="Format: plaintext or json")
    args = parser.parse_args()

    generate_3_incidents_dataset(output_path=args.out, output_format=args.format)
