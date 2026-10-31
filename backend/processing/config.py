import os
from pathlib import Path
from dataclasses import dataclass
from dotenv import load_dotenv

# Look for .env in current directory, then parent backend directory
current_dir = Path(__file__).resolve().parent
backend_env = current_dir.parent / ".env"
local_env = current_dir / ".env"

if local_env.exists():
    load_dotenv(local_env)
elif backend_env.exists():
    load_dotenv(backend_env)

@dataclass
class Settings:
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    PORT: int = int(os.getenv("PORT", "8000"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # S3 / Neon Object Storage
    AWS_ENDPOINT_URL_S3: str | None = os.getenv("AWS_ENDPOINT_URL_S3")
    AWS_ACCESS_KEY_ID: str | None = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-2")
    STORAGE_BUCKET_NAME: str = os.getenv("STORAGE_BUCKET_NAME", "logicsense-bucket")

    @property
    def sqlalchemy_db_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

settings = Settings()
