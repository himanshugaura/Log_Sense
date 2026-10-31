import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from db import get_db
from storage import stream_file_lines
from parsers.extractor import extract_log_record, ExtractedLogRecord
from parsers.drain_miner import DrainManager
from intelligence.anomaly_detector import detect_and_evaluate_anomalies
from intelligence.incident_correlator import correlate_incidents
from intelligence.rca_engine import RcaEngine
from intelligence.ai_summary import generate_incident_summary

logger = logging.getLogger("logsense.processor")
logging.basicConfig(level=logging.INFO)

BATCH_INSERT_SIZE = 500

class LogProcessor:
    """
    Coordinates streaming log files from Object Storage, extracting structured records,
    mining templates via Drain3, and batch-persisting into PostgreSQL.
    """
    def __init__(self, db: Session, project_id: str):
        self.db = db
        self.project_id = project_id
        self.drain_managers: Dict[str, DrainManager] = {}
        self.cluster_id_cache: Dict[Tuple[str, int], str] = {} # (parser_state_id, drain_cluster_id) -> cluster_uuid
        self.cluster_counts: Dict[str, int] = {} # cluster_uuid -> increment count

        # Preload registered project services
        self.services_by_name: Dict[str, str] = {}
        self.services_by_id: Dict[str, str] = {}
        self._load_services()

    def _load_services(self):
        rows = self.db.execute(
            text("""
                SELECT id, name
                FROM services
                WHERE "projectId" = :project_id
            """),
            {"project_id": self.project_id}
        ).fetchall()

        for row in rows:
            sid, sname = str(row[0]), str(row[1])
            self.services_by_name[sname.lower()] = sid
            self.services_by_id[sid] = sname

    def _get_drain_manager(self, service_id: Optional[str]) -> DrainManager:
        svc_key = service_id or "unassigned"
        if svc_key not in self.drain_managers:
            self.drain_managers[svc_key] = DrainManager(self.db, self.project_id, service_id)
        return self.drain_managers[svc_key]

    def _resolve_cluster(
        self,
        parser_state_id: str,
        drain_cluster_id: int,
        template: str,
        log_timestamp: datetime
    ) -> str:
        """
        Resolves the PostgreSQL log_clusters UUID for a given Drain3 cluster ID.
        Inserts new row if first seen, otherwise increments occurrence count.
        """
        cache_key = (parser_state_id, drain_cluster_id)
        if cache_key in self.cluster_id_cache:
            cluster_uuid = self.cluster_id_cache[cache_key]
            self.cluster_counts[cluster_uuid] = self.cluster_counts.get(cluster_uuid, 0) + 1
            return cluster_uuid

        # Look up in DB
        row = self.db.execute(
            text("""
                SELECT id
                FROM log_clusters
                WHERE "parserStateId" = :parser_state_id AND "drainClusterId" = :drain_cluster_id
                LIMIT 1
            """),
            {"parser_state_id": parser_state_id, "drain_cluster_id": drain_cluster_id}
        ).fetchone()

        if row:
            cluster_uuid = str(row[0])
        else:
            cluster_uuid = str(uuid.uuid4())
            self.db.execute(
                text("""
                    INSERT INTO log_clusters (
                        id, "parserStateId", "drainClusterId", template,
                        "occurrenceCount", "firstSeenAt", "lastSeenAt"
                    ) VALUES (
                        :id, :parser_state_id, :drain_cluster_id, :template,
                        1, :first_seen, :last_seen
                    )
                    ON CONFLICT ("parserStateId", "drainClusterId") DO NOTHING
                """),
                {
                    "id": cluster_uuid,
                    "parser_state_id": parser_state_id,
                    "drain_cluster_id": drain_cluster_id,
                    "template": template,
                    "first_seen": log_timestamp,
                    "last_seen": log_timestamp,
                }
            )

        self.cluster_id_cache[cache_key] = cluster_uuid
        self.cluster_counts[cluster_uuid] = self.cluster_counts.get(cluster_uuid, 0) + 1
        return cluster_uuid

    def _flush_cluster_counts(self):
        """Updates occurrenceCount and lastSeenAt for all touched clusters."""
        if not self.cluster_counts:
            return

        for cluster_uuid, added_count in self.cluster_counts.items():
            self.db.execute(
                text("""
                    UPDATE log_clusters
                    SET "occurrenceCount" = "occurrenceCount" + :added_count,
                        "lastSeenAt" = NOW()
                    WHERE id = :id
                """),
                {"id": cluster_uuid, "added_count": added_count}
            )
        self.cluster_counts.clear()

    def process_log_source(
        self,
        job_id: str,
        log_source_id: str,
        file_key: str,
        default_service_id: Optional[str] = None,
        bucket: Optional[str] = None,
    ) -> int:
        bucket_name = bucket or settings.STORAGE_BUCKET_NAME
        logger.info(f"Starting ingestion job {job_id} for {bucket_name}/{file_key}")

        # 1. Update job to PROCESSING
        self.db.execute(
            text("""
                UPDATE processing_jobs
                SET status = 'PROCESSING', "errorMessage" = NULL
                WHERE id = :job_id
            """),
            {"job_id": job_id}
        )
        self.db.commit()

        total_processed = 0
        batch_entries: List[dict] = []
        fallback_service_name = self.services_by_id.get(default_service_id) if default_service_id else None

        try:
            # 2. Stream lines from S3
            for line in stream_file_lines(bucket_name, file_key):
                if not line:
                    continue

                # 3. Extract record
                rec: ExtractedLogRecord = extract_log_record(line, fallback_service_name=fallback_service_name)

                # 4. Resolve service
                service_id = default_service_id
                if not service_id and rec.service_name:
                    service_id = self.services_by_name.get(rec.service_name.lower())

                # 5. Feed into Drain3
                drain_mgr = self._get_drain_manager(service_id)
                drain_cluster_id, template, _is_new = drain_mgr.process_message(rec.normalized_message)

                # 6. Resolve cluster database UUID
                cluster_uuid = self._resolve_cluster(
                    parser_state_id=drain_mgr.parser_state_id,
                    drain_cluster_id=drain_cluster_id,
                    template=template,
                    log_timestamp=rec.timestamp
                )

                # 7. Queue log_entry
                batch_entries.append({
                    "id": str(uuid.uuid4()),
                    "projectId": self.project_id,
                    "serviceId": service_id,
                    "sourceId": log_source_id,
                    "clusterId": cluster_uuid,
                    "timestamp": rec.timestamp,
                    "level": rec.level,
                    "rawMessage": rec.raw_message,
                    "normalizedMessage": rec.normalized_message,
                    "traceId": rec.trace_id,
                    "spanId": rec.span_id,
                    "metadata": json.dumps(rec.metadata) if rec.metadata else None,
                })

                total_processed += 1

                # Batch flush to avoid memory pressure
                if len(batch_entries) >= BATCH_INSERT_SIZE:
                    self._flush_batch(batch_entries)
                    batch_entries.clear()

            # Flush remaining entries
            if batch_entries:
                self._flush_batch(batch_entries)
                batch_entries.clear()

            # Flush cluster occurrence counts
            self._flush_cluster_counts()

            # 8. Save Drain3 parser states to database
            for drain_mgr in self.drain_managers.values():
                drain_mgr.save_state(reason=f"job_{job_id}_completed")

            # 9. Intelligence Pipeline: Anomaly Detection -> Correlation -> RCA -> AI Summary
            try:
                logger.info(f"Triggering Phase 3 Intelligence pipeline for project {self.project_id}")
                # Step A: Anomaly Detection & Evaluation
                detect_and_evaluate_anomalies(self.db, self.project_id)

                # Step B: Incident Correlation
                incident_ids = correlate_incidents(self.db, self.project_id)

                # Step C: Deterministic RCA Engine & Step D: AI Incident Summary
                rca = RcaEngine(self.db)
                for inc_id in incident_ids:
                    rca_result = rca.analyze_incident(inc_id)
                    if rca_result:
                        try:
                            generate_incident_summary(self.db, inc_id, rca_result)
                        except Exception as sum_err:
                            logger.warn(f"Summary generation warning for incident {inc_id}: {sum_err}")
            except Exception as intel_err:
                logger.warn(f"Intelligence pipeline warning for project {self.project_id}: {intel_err}", exc_info=True)

            # 10. Mark job COMPLETED
            self.db.execute(
                text("""
                    UPDATE processing_jobs
                    SET status = 'COMPLETED',
                        "processedItems" = :total,
                        "totalItems" = :total,
                        "completedAt" = NOW()
                    WHERE id = :job_id
                """),
                {"job_id": job_id, "total": total_processed}
            )
            self.db.commit()

            logger.info(f"Ingestion job {job_id} successfully completed. Processed {total_processed} log records.")
            return total_processed

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {str(e)}", exc_info=True)
            self.db.rollback()
            self.db.execute(
                text("""
                    UPDATE processing_jobs
                    SET status = 'FAILED',
                        "errorMessage" = :error,
                        "completedAt" = NOW()
                    WHERE id = :job_id
                """),
                {"job_id": job_id, "error": str(e)[:1000]}
            )
            self.db.commit()
            raise

    def _flush_batch(self, entries: List[dict]):
        if not entries:
            return

        self.db.execute(
            text("""
                INSERT INTO log_entries (
                    id, "projectId", "serviceId", "sourceId", "clusterId",
                    timestamp, level, "rawMessage", "normalizedMessage",
                    "traceId", "spanId", metadata
                ) VALUES (
                    :id, :projectId, :serviceId, :sourceId, :clusterId,
                    :timestamp, :level, :rawMessage, :normalizedMessage,
                    :traceId, :spanId, CAST(:metadata AS jsonb)
                )
            """),
            entries
        )
        self.db.commit()


def process_uploaded_log_source(
    job_id: str,
    log_source_id: str,
    project_id: str,
    service_id: Optional[str],
    file_key: str,
    bucket: Optional[str] = None,
) -> int:
    """Entry point for processing job execution with isolated session."""
    with get_db() as db:
        processor = LogProcessor(db, project_id)
        return processor.process_log_source(
            job_id=job_id,
            log_source_id=log_source_id,
            file_key=file_key,
            default_service_id=service_id,
            bucket=bucket,
        )
