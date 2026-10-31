import os
from typing import Generator, Optional
import boto3
from botocore.config import Config

from config import settings

def get_s3_client():
    s3_config = Config(s3={"addressing_style": "path"})
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_ENDPOINT_URL_S3,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        config=s3_config,
    )

def stream_file_lines(
    bucket: str,
    key: str,
    local_path: Optional[str] = None
) -> Generator[str, None, None]:
    """
    Fast log stream generator.
    If local_path exists (e.g. uploaded locally), reads directly from disk in milliseconds.
    Otherwise fetches object from S3 in one fast block read rather than chunked line-by-line TLS streams.
    """
    if local_path and os.path.exists(local_path):
        with open(local_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield line
        return

    s3 = get_s3_client()
    response = s3.get_object(Bucket=bucket, Key=key)
    raw_bytes = response["Body"].read()

    try:
        text_content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text_content = raw_bytes.decode("latin-1", errors="replace")

    for line in text_content.splitlines():
        line = line.strip()
        if line:
            yield line

def get_object_metadata(bucket: str, key: str) -> dict:
    s3 = get_s3_client()
    return s3.head_object(Bucket=bucket, Key=key)
