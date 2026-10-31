import sys
import os
import argparse
import logging

# Ensure processing directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from parsers.processor import process_uploaded_log_source

logger = logging.getLogger("logsense.runner")
logging.basicConfig(level=logging.INFO)

def main():
    parser = argparse.ArgumentParser(description="Execute LogSense Processing Job")
    parser.add_argument("--job-id", required=True, help="Processing job UUID")
    parser.add_argument("--source-id", required=True, help="Log source UUID")
    parser.add_argument("--project-id", required=True, help="Project UUID")
    parser.add_argument("--file-key", required=True, help="Storage file key")
    parser.add_argument("--bucket", default=None, help="Optional bucket name")
    parser.add_argument("--local-path", default=None, help="Optional local file path for instant zero-latency processing")

    args = parser.parse_args()
    logger.info(f"CLI Runner executing job {args.job_id} for project {args.project_id}")

    try:
        count = process_uploaded_log_source(
            job_id=args.job_id,
            log_source_id=args.source_id,
            project_id=args.project_id,
            file_key=args.file_key,
            bucket=args.bucket,
            local_path=args.local_path,
        )
        logger.info(f"Job {args.job_id} completed successfully with {count} records.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Job {args.job_id} failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
