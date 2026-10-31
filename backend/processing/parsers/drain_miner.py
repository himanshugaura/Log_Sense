import uuid
from typing import Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session
from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from drain3.persistence_handler import PersistenceHandler

class PostgresDrainPersistenceHandler(PersistenceHandler):
    """
    Persists and loads Drain3 internal clustering tree state
    directly to/from PostgreSQL `parser_states.stateData` per project.
    """
    def __init__(self, db: Session, project_id: str):
        self.db = db
        self.project_id = project_id
        self.parser_state_id: Optional[str] = None

    def load_state(self) -> Optional[bytes]:
        row = self.db.execute(
            text("""
                SELECT id, "stateData"
                FROM parser_states
                WHERE "projectId" = :project_id
                LIMIT 1
            """),
            {"project_id": self.project_id}
        ).fetchone()

        if row and row[1]:
            self.parser_state_id = str(row[0])
            return row[1].encode("utf-8")
        elif row:
            self.parser_state_id = str(row[0])

        return None

    def save_state(self, state: bytes):
        state_str = state.decode("utf-8") if isinstance(state, bytes) else str(state)
        parser_id = self.get_or_create_parser_state_id()
        self.db.execute(
            text("""
                UPDATE parser_states
                SET "stateData" = :state_data, "updatedAt" = NOW()
                WHERE id = :id
            """),
            {
                "id": parser_id,
                "state_data": state_str,
            }
        )

    def get_or_create_parser_state_id(self) -> str:
        """Returns the UUID of the parser_state record for this project."""
        if self.parser_state_id:
            return self.parser_state_id

        row = self.db.execute(
            text("""
                SELECT id FROM parser_states
                WHERE "projectId" = :project_id
                LIMIT 1
            """),
            {"project_id": self.project_id}
        ).fetchone()

        if row:
            self.parser_state_id = str(row[0])
            return self.parser_state_id

        new_id = str(uuid.uuid4())
        self.db.execute(
            text("""
                INSERT INTO parser_states (id, "projectId", "stateData", "updatedAt")
                VALUES (:id, :project_id, '', NOW())
                ON CONFLICT ("projectId") DO NOTHING
            """),
            {
                "id": new_id,
                "project_id": self.project_id,
            }
        )
        self.db.commit()

        # Re-fetch in case of race condition
        row = self.db.execute(
            text("SELECT id FROM parser_states WHERE \"projectId\" = :project_id LIMIT 1"),
            {"project_id": self.project_id}
        ).fetchone()

        self.parser_state_id = str(row[0]) if row else new_id
        return self.parser_state_id

class DrainManager:
    """
    Manages Drain3 TemplateMiner lifecycle with PostgreSQL persistence.
    Operates at dataset/project level without registered service dependencies.
    """
    def __init__(self, db: Session, project_id: str):
        self.db = db
        self.project_id = project_id
        self.handler = PostgresDrainPersistenceHandler(db, project_id)

        config = TemplateMinerConfig()
        config.drain_sim_th = 0.5
        config.drain_depth = 4
        config.drain_max_children = 100
        config.snapshot_compress_state = False

        self.miner = TemplateMiner(persistence_handler=self.handler, config=config)
        self.parser_state_id = self.handler.get_or_create_parser_state_id()

    def process_message(self, message: str) -> Tuple[int, str, bool]:
        """
        Feeds a log message into Drain3.
        Returns:
            (drain_cluster_id, template, is_new_cluster)
        """
        res = self.miner.add_log_message(message)
        cluster_id = res["cluster_id"]
        template = res["template_mined"]
        is_new = (res["change_type"] == "cluster_created")
        return cluster_id, template, is_new

    def save_state(self, reason: str = "batch_processed"):
        """Saves Drain3 learned memory to the database."""
        self.miner.save_state(snapshot_reason=reason)
