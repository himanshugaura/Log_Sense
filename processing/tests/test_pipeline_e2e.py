import os
import uuid
import boto3
from botocore.config import Config
from datetime import datetime, timezone
from sqlalchemy import text

from config import settings
from db import get_db
from parsers.processor import process_uploaded_log_source

SAMPLE_LOG_DATA = """
2026-10-31 10:00:00.100 [INFO] [auth-service] User login succeeded for user 1001
2026-10-31 10:00:01.200 [INFO] [order-service] trace_id=4bf92f3577b34da6a3ce929d0e0e4736 span_id=00f067aa0ba902b7 Creating order for user 1001
2026-10-31 10:00:02.300 [WARN] [payment-service] trace_id=4bf92f3577b34da6a3ce929d0e0e4736 span_id=5fb397be34d23b0f Database latency high: 450ms
2026-10-31 10:00:03.400 [ERROR] [database-service] Connection pool exhausted: 100/100 connections active
2026-10-31 10:00:04.500 [ERROR] [payment-service] trace_id=4bf92f3577b34da6a3ce929d0e0e4736 span_id=5fb397be34d23b0f Payment timeout connecting to database-service:5432
2026-10-31 10:00:05.600 [ERROR] [order-service] trace_id=4bf92f3577b34da6a3ce929d0e0e4736 span_id=00f067aa0ba902b7 Order creation failed due to downstream payment failure
{"timestamp": "2026-10-31T10:00:06.700Z", "level": "ERROR", "service": "payment-service", "message": "Circuit breaker OPEN for database-service", "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"}
""".strip()

def run_e2e_test():
    print("Starting Complete End-to-End LogSense Processing & Intelligence Verification...")

    # 1. Setup S3 client and upload sample log
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.AWS_ENDPOINT_URL_S3,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=Config(s3={"addressing_style": "path"}),
    )

    test_suffix = str(uuid.uuid4())[:8]
    test_key = f"tests/pipeline-{test_suffix}.log"
    bucket = settings.STORAGE_BUCKET_NAME

    print(f"1. Uploading test log file to {bucket}/{test_key}...")
    s3.put_object(
        Bucket=bucket,
        Key=test_key,
        Body=SAMPLE_LOG_DATA.encode("utf-8"),
        ContentType="text/plain",
    )

    with get_db() as db:
        # 2. Create test user, org, project, and registered services
        user_id = str(uuid.uuid4())
        clerk_id = f"user_e2e_{test_suffix}"
        db.execute(
            text("""
                INSERT INTO users (id, "clerkUserId", email, name, "createdAt", "updatedAt")
                VALUES (:id, :clerk_id, :email, 'E2E User', NOW(), NOW())
            """),
            {"id": user_id, "clerk_id": clerk_id, "email": f"{clerk_id}@example.com"}
        )

        org_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO organizations (id, "ownerId", name, "createdAt")
                VALUES (:id, :owner_id, 'E2E Org', NOW())
            """),
            {"id": org_id, "owner_id": user_id}
        )

        proj_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO projects (id, "organizationId", name, timezone, "createdAt")
                VALUES (:id, :org_id, 'E2E Microservices', 'UTC', NOW())
            """),
            {"id": proj_id, "org_id": org_id}
        )

        # Register services
        services = ["auth-service", "order-service", "payment-service", "database-service"]
        service_ids = {}
        for sname in services:
            sid = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO services (id, "projectId", name, description, "createdAt")
                    VALUES (:id, :proj_id, :name, 'Service description', NOW())
                """),
                {"id": sid, "proj_id": proj_id, "name": sname}
            )
            service_ids[sname] = sid

        # Configure service dependencies:
        # order-service -> payment-service
        # payment-service -> database-service
        db.execute(
            text("""
                INSERT INTO service_dependencies (id, "sourceServiceId", "targetServiceId", "dependencyType", "isRequired")
                VALUES
                  (:d1, :order_id, :pay_id, 'HTTP', true),
                  (:d2, :pay_id, :db_id, 'DATABASE', true)
            """),
            {
                "d1": str(uuid.uuid4()),
                "d2": str(uuid.uuid4()),
                "order_id": service_ids["order-service"],
                "pay_id": service_ids["payment-service"],
                "db_id": service_ids["database-service"],
            }
        )

        # Create LogSource and ProcessingJob
        log_source_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO log_sources (id, "projectId", name, "sourceType", "fileKey", "fileSize", "fileType", "createdAt")
                VALUES (:id, :proj_id, 'sample-app.log', 'FILE_UPLOAD', :key, :size, 'text/plain', NOW())
            """),
            {"id": log_source_id, "proj_id": proj_id, "key": test_key, "size": len(SAMPLE_LOG_DATA)}
        )

        job_id = str(uuid.uuid4())
        db.execute(
            text("""
                INSERT INTO processing_jobs (id, "projectId", "logSourceId", "jobType", status, "totalItems", "processedItems", "createdAt")
                VALUES (:id, :proj_id, :source_id, 'LOG_INGESTION', 'PENDING', 0, 0, NOW())
            """),
            {"id": job_id, "proj_id": proj_id, "source_id": log_source_id}
        )
        db.commit()

        print("2. Created test project hierarchy, services, and dependency topology.")

        # 3. Execute Log Processing & Intelligence Pipeline
        print("3. Executing complete processing pipeline (Ingestion -> Drain3 -> Anomalies -> Incidents -> RCA -> Summary)...")
        total_records = process_uploaded_log_source(
            job_id=job_id,
            log_source_id=log_source_id,
            project_id=proj_id,
            service_id=None,
            file_key=test_key,
            bucket=bucket,
        )
        print(f"Pipeline executed successfully. Processed {total_records} records.")
        assert total_records == 7

        # 4. Verify ProcessingJob record
        job_row = db.execute(
            text("SELECT status, \"processedItems\", \"totalItems\", \"errorMessage\" FROM processing_jobs WHERE id = :id"),
            {"id": job_id}
        ).fetchone()
        print("Job status in DB:", job_row)
        assert job_row[0] == "COMPLETED"
        assert job_row[1] == 7

        # 5. Verify Anomalies Detected
        anomalies = db.execute(
            text("""
                SELECT a.id, s.name, a."anomalyType", a.severity, a.status, a.title
                FROM anomalies a
                LEFT JOIN services s ON a."serviceId" = s.id
                WHERE a."projectId" = :proj_id
            """),
            {"proj_id": proj_id}
        ).fetchall()
        print(f"\n4. Verified {len(anomalies)} Anomalies Detected:")
        for a in anomalies:
            print(f"  - [{a[1]}] {a[2]} ({a[3]}/{a[4]}): {a[5]}")
        assert len(anomalies) > 0

        # 6. Verify Incident Correlation
        incidents = db.execute(
            text("""
                SELECT i.id, i.title, i.severity, i.status, COUNT(ia.id) as anomaly_count
                FROM incidents i
                LEFT JOIN incident_anomalies ia ON i.id = ia."incidentId"
                WHERE i."projectId" = :proj_id
                GROUP BY i.id, i.title, i.severity, i.status
            """),
            {"proj_id": proj_id}
        ).fetchall()
        print(f"\n5. Verified {len(incidents)} Incidents Correlated:")
        for inc in incidents:
            print(f"  - Incident '{inc[1]}' (Severity: {inc[2]}, Status: {inc[3]}, Linked Anomalies: {inc[4]})")
        assert len(incidents) > 0
        inc_id = str(incidents[0][0])

        # 7. Verify Deterministic RCA Engine Results
        rca_res = db.execute(
            text("""
                SELECT ra.id, ra.conclusion, ra.confidence
                FROM rca_analyses ra
                WHERE ra."incidentId" = :inc_id
            """),
            {"inc_id": inc_id}
        ).fetchone()
        print(f"\n6. Verified RCA Analysis:")
        print(f"  - Conclusion: {rca_res[1]}")
        print(f"  - Confidence: {rca_res[2] * 100:.1f}%")
        assert rca_res is not None

        candidates = db.execute(
            text("""
                SELECT s.name, rc.rank, rc."totalScore", rc."temporalScore",
                       rc."dependencyScore", rc."errorTypeScore", rc."traceScore", rc.explanation
                FROM root_cause_candidates rc
                JOIN services s ON rc."serviceId" = s.id
                WHERE rc."analysisId" = :analysis_id
                ORDER BY rc.rank ASC
            """),
            {"analysis_id": str(rca_res[0])}
        ).fetchall()

        print("\n7. Ranked Root Cause Candidates:")
        for c in candidates:
            print(f"  Rank #{c[1]}: [{c[0]}] Total Score: {c[2]} (Temporal: {c[3]}, Dep: {c[4]}, Err: {c[5]}, Trace: {c[6]})")
            print(f"    Reasoning: {c[7]}")

        # Assert database-service is ranked #1 as the primary root cause!
        assert candidates[0][0] == "database-service", f"Expected database-service as #1 root cause, got {candidates[0][0]}"

        # 8. Verify AI Incident Summary
        summaries = db.execute(
            text("""
                SELECT isum.model, isum.summary, isum.recommendations
                FROM incident_summaries isum
                WHERE isum."incidentId" = :inc_id
            """),
            {"inc_id": inc_id}
        ).fetchall()
        print(f"\n8. Verified AI Incident Summary (Model: {summaries[0][0]}):")
        print(summaries[0][1])
        print("Recommendations:", summaries[0][2])
        assert len(summaries) > 0

        # 9. Clean up
        print("\n9. Cleaning up test data...")
        db.execute(text("DELETE FROM projects WHERE id = :id"), {"id": proj_id})
        db.execute(text("DELETE FROM organizations WHERE id = :id"), {"id": org_id})
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        db.commit()

        s3.delete_object(Bucket=bucket, Key=test_key)
        print("Cleanup completed successfully.")

    print("\n========================================================")
    print("ALL LOGSENSE PIPELINE & INTELLIGENCE VERIFICATIONS PASSED!")
    print("========================================================")

if __name__ == "__main__":
    run_e2e_test()
