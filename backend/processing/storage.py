from typing import Generator
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

def stream_file_lines(bucket: str, key: str) -> Generator[str, None, None]:
    """
    Streams file lines one-by-one directly from object storage without loading
    the full file into memory. Handles decoding gracefully.
    """
    s3 = get_s3_client()
    response = s3.get_object(Bucket=bucket, Key=key)
    body = response["Body"]

    for raw_line in body.iter_lines():
        if not raw_line:
            continue
        try:
            line = raw_line.decode("utf-8")
        except UnicodeDecodeError:
            line = raw_line.decode("latin-1", errors="replace")

        line = line.strip()
        if line:
            yield line

def get_object_metadata(bucket: str, key: str) -> dict:
    s3 = get_s3_client()
    return s3.head_object(Bucket=bucket, Key=key)
