import json
import logging
import uuid
import os
import threading
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

BATCH_INSERT_SIZE = 2500

class LogProcessor:
    """
    Coordinates fast log ingestion, Drain3 pattern mining, and statistical root-cause analysis.
    Optimized for zero-redundancy network I/O and batch PostgreSQL operations.
    """
    def __init__(self, db: Session, project_id: str):
        self.db = db
        self.project_id = project_id
        self.drain_manager = DrainManager(self.db, self.project_id)
        self.cluster_id_cache: Dict[Tuple[str, int], str] = {} # (parser_state_id, drain_cluster_id) -> cluster_uuid
        self.new_clusters: Dict[str, dict] = {} # cluster_uuid -> row dict
        self.cluster_counts: Dict[str, int] = {} # cluster_uuid -> increment count

        # Preload existing clusters into cache to eliminate redundant SELECT queries
        if self.drain_manager.parser_state_id:
            rows = self.db.execute(
                text("""
                    SELECT id, "drainClusterId"
                    FROM log_clusters
                    WHERE "parserStateId" = :parser_state_id
                """),
                {"parser_state_id": self.drain_manager.parser_state_id}
            ).fetchall()
            for r in rows:
                self.cluster_id_cache[(self.drain_manager.parser_state_id, r[1])] = str(r[0])

    def _resolve_cluster(
        self,
        parser_state_id: str,
        drain_cluster_id: int,
        template: str,
        log_timestamp: datetime
    ) -> str:
        """
        Resolves the PostgreSQL log_clusters UUID for a given Drain3 cluster ID in memory.
        New clusters are staged and batch-inserted, eliminating per-cluster network pauses.
        """
        cache_key = (parser_state_id, drain_cluster_id)
        if cache_key in self.cluster_id_cache:
            cluster_uuid = self.cluster_id_cache[cache_key]
            self.cluster_counts[cluster_uuid] = self.cluster_counts.get(cluster_uuid, 0) + 1
            return cluster_uuid

        cluster_uuid = str(uuid.uuid4())
        self.cluster_id_cache[cache_key] = cluster_uuid
        self.new_clusters[cluster_uuid] = {
            "id": cluster_uuid,
            "parser_state_id": parser_state_id,
            "drain_cluster_id": drain_cluster_id,
            "template": template,
            "first_seen": log_timestamp,
            "last_seen": log_timestamp,
        }
        self.cluster_counts[cluster_uuid] = self.cluster_counts.get(cluster_uuid, 0) + 1
        return cluster_uuid

    def _flush_new_clusters(self):
        """Batch inserts all newly discovered Drain3 clusters."""
        if not self.new_clusters:
            return
        insert_sql = """
            INSERT INTO log_clusters (
                id, "parserStateId", "drainClusterId", template,
                "occurrenceCount", "firstSeenAt", "lastSeenAt"
            ) VALUES (
                :id, :parser_state_id, :drain_cluster_id, :template,
                1, :first_seen, :last_seen
            )
            ON CONFLICT ("parserStateId", "drainClusterId") DO NOTHING
        """
        self.db.execute(text(insert_sql), list(self.new_clusters.values()))
        self.db.commit()
        self.new_clusters.clear()

    def _flush_cluster_counts(self):
        """
        Batch updates occurrenceCount and lastSeenAt for all touched clusters in a single SQL statement.
        Replaces N separate round-trips with 1 multi-row VALUES query.
        """
        if not self.cluster_counts:
            return

        self._flush_new_clusters()

        values_tuples = ", ".join(f"('{cid}'::text, {cnt}::int)" for cid, cnt in self.cluster_counts.items())
        batch_sql = f"""
            UPDATE log_clusters AS c
            SET "occurrenceCount" = c."occurrenceCount" + v.cnt,
                "lastSeenAt" = NOW()
            FROM (VALUES {values_tuples}) AS v(id, cnt)
            WHERE c.id = v.id
        """
        self.db.execute(text(batch_sql))
        self.db.commit()
        self.cluster_counts.clear()

    def process_log_source(
        self,
        job_id: str,
        log_source_id: str,
        file_key: str,
        bucket: Optional[str] = None,
        default_service_name: Optional[str] = None,
        local_path: Optional[str] = None,
    ) -> int:
        bucket_name = bucket or settings.STORAGE_BUCKET_NAME
        logger.info(f"Starting fast ingestion job {job_id} for key {file_key} (local_path: {local_path})")

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
        bucket_map: Dict[Tuple[datetime, str, str], dict] = {}

        try:
            # 2. Stream lines (from local disk if available, or fast S3 single fetch)
            for line in stream_file_lines(bucket_name, file_key, local_path=local_path):
                if not line:
                    continue

                # 3. Extract record cleanly
                rec: ExtractedLogRecord = extract_log_record(line, fallback_service_name=default_service_name)

                # 4. Feed into Drain3
                drain_cluster_id, template, _is_new = self.drain_manager.process_message(rec.normalized_message)

                # 5. Resolve cluster database UUID in memory
                cluster_uuid = self._resolve_cluster(
                    parser_state_id=self.drain_manager.parser_state_id,
                    drain_cluster_id=drain_cluster_id,
                    template=template,
                    log_timestamp=rec.timestamp
                )

                # 6. Queue log_entry
                batch_entries.append({
                    "id": str(uuid.uuid4()),
                    "projectId": self.project_id,
                    "sourceId": log_source_id,
                    "clusterId": cluster_uuid,
                    "serviceName": rec.service_name,
                    "timestamp": rec.timestamp,
                    "level": rec.level,
                    "rawMessage": rec.raw_message,
                    "normalizedMessage": rec.normalized_message,
                    "traceId": rec.trace_id,
                    "spanId": rec.span_id,
                    "metadata": json.dumps(rec.metadata) if rec.metadata else None,
                })

                # Precompute 1-minute anomaly time bucket in memory (eliminates heavy database GROUP BY query)
                m_bucket = rec.timestamp.replace(second=0, microsecond=0)
                b_key = (m_bucket, cluster_uuid, rec.level)
                if b_key not in bucket_map:
                    bucket_map[b_key] = {
                        "cnt": 0,
                        "min_ts": rec.timestamp,
                        "sample_service": rec.service_name,
                    }
                bucket_map[b_key]["cnt"] += 1
                if rec.timestamp < bucket_map[b_key]["min_ts"]:
                    bucket_map[b_key]["min_ts"] = rec.timestamp
                if rec.service_name and not bucket_map[b_key]["sample_service"]:
                    bucket_map[b_key]["sample_service"] = rec.service_name

                total_processed += 1

                # Batch flush to avoid memory pressure
                if len(batch_entries) >= BATCH_INSERT_SIZE:
                    self._flush_new_clusters()
                    self._flush_batch(batch_entries)
                    batch_entries.clear()

            # Flush remaining entries
            if batch_entries:
                self._flush_new_clusters()
                self._flush_batch(batch_entries)
                batch_entries.clear()

            # Flush cluster occurrence counts in 1 single SQL call
            self._flush_cluster_counts()

            # 7. Save Drain3 parser state to database
            self.drain_manager.save_state(reason=f"job_{job_id}_completed")

            # 8. Statistical Intelligence Pipeline (Anomaly Detection -> Incidents -> 15-Point RCA)
            rca_results = {}
            try:
                logger.info(f"Executing Statistical Anomaly & Point-based RCA pipeline for project {self.project_id}")
                precomputed_rows = [
                    (k[0], k[1], k[2], v["cnt"], v["min_ts"], v["sample_service"])
                    for k, v in bucket_map.items()
                ]
                # Step A: Standard deviation spike detection & new pattern discovery
                detect_and_evaluate_anomalies(self.db, self.project_id, precomputed_buckets=precomputed_rows)

                # Step B: Incident Correlation
                incident_ids = correlate_incidents(self.db, self.project_id)

                # Step C: Point-based RCA Engine (ranking log patterns on top primary incidents)
                rca = RcaEngine(self.db)
                for inc_id in incident_ids[:2]:
                    rca_res = rca.analyze_incident(inc_id)
                    if rca_res:
                        rca_results[inc_id] = rca_res
            except Exception as intel_err:
                logger.warn(f"Intelligence pipeline warning for project {self.project_id}: {intel_err}", exc_info=True)

            # 9. Mark job COMPLETED immediately - Dashboard & Explorer are ready to view!
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
            logger.info(f"Ingestion job {job_id} successfully COMPLETED. Processed {total_processed} records.")

            # 10. Generate Incident Explanations (AI / Deterministic) asynchronously for primary incidents in background
            if rca_results:
                def run_summaries():
                    try:
                        with get_db() as bg_db:
                            for inc_id, rca_res in list(rca_results.items())[:2]:
                                try:
                                    generate_incident_summary(bg_db, inc_id, rca_res)
                                except Exception as e:
                                    logger.warn(f"Background summary warning for incident {inc_id}: {e}")
                    except Exception as bg_err:
                        logger.warn(f"Background summary worker error: {bg_err}")

                summary_thread = threading.Thread(target=run_summaries, daemon=True)
                summary_thread.start()

            return total_processed

        except Exception as e:
            logger.error(f"Ingestion job {job_id} failed: {e}", exc_info=True)
            try:
                self.db.rollback()
            except Exception:
                pass
            self.db.execute(
                text("""
                    UPDATE processing_jobs
                    SET status = 'FAILED', "errorMessage" = :err, "completedAt" = NOW()
                    WHERE id = :job_id
                """),
                {"job_id": job_id, "err": str(e)[:500]}
            )
            self.db.commit()
            raise e

    def _flush_batch(self, entries: List[dict]):
        if not entries:
            return

        # Attempt ultra-fast PostgreSQL streaming COPY via psycopg3 driver
        try:
            raw_conn = self.db.connection().connection
            driver = getattr(raw_conn, "driver_connection", raw_conn)
            if hasattr(driver, "cursor"):
                with driver.cursor() as cur:
                    with cur.copy(
                        'COPY log_entries (id, "projectId", "sourceId", "clusterId", "serviceName", '
                        'timestamp, level, "rawMessage", "normalizedMessage", "traceId", "spanId", metadata) '
                        'FROM STDIN'
                    ) as copy:
                        for e in entries:
                            copy.write_row((
                                e["id"],
                                e["projectId"],
                                e["sourceId"],
                                e["clusterId"],
                                e["serviceName"],
                                e["timestamp"],
                                e["level"],
                                e["rawMessage"],
                                e["normalizedMessage"],
                                e["traceId"],
                                e["spanId"],
                                e["metadata"],
                            ))
                self.db.commit()
                return
        except Exception as copy_err:
            logger.debug(f"Fast COPY fallback to parameterized batch insert: {copy_err}")
            try:
                self.db.rollback()
            except Exception:
                pass

        insert_sql = """
            INSERT INTO log_entries (
                id, "projectId", "sourceId", "clusterId", "serviceName",
                timestamp, level, "rawMessage", "normalizedMessage",
                "traceId", "spanId", metadata
            ) VALUES (
                :id, :projectId, :sourceId, :clusterId, :serviceName,
                :timestamp, :level, :rawMessage, :normalizedMessage,
                :traceId, :spanId, CAST(:metadata AS jsonb)
            )
        """
        self.db.execute(text(insert_sql), entries)
        self.db.commit()


def process_uploaded_log_source(
    job_id: str,
    log_source_id: str,
    project_id: str,
    file_key: str,
    bucket: Optional[str] = None,
    service_id: Optional[str] = None,
    local_path: Optional[str] = None,
) -> int:
    """Entry point called by FastAPI background task or CLI worker."""
    with get_db() as db:
        processor = LogProcessor(db=db, project_id=project_id)
        return processor.process_log_source(
            job_id=job_id,
            log_source_id=log_source_id,
            file_key=file_key,
            bucket=bucket,
            local_path=local_path,
        )
