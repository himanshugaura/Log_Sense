import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from parsers.processor import process_uploaded_log_source
from config import settings

logger = logging.getLogger("logsense.api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="LogSense Processing API",
    description="Python FastAPI service for log stream processing, Drain3 clustering, and intelligence.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessLogRequest(BaseModel):
    jobId: str = Field(..., description="UUID of the processing_jobs record")
    logSourceId: str = Field(..., description="UUID of the log_sources record")
    projectId: str = Field(..., description="UUID of the project")
    serviceId: Optional[str] = Field(None, description="Optional UUID of the service")
    fileKey: str = Field(..., description="Object storage S3 key")
    bucket: Optional[str] = Field(None, description="Optional S3 bucket name")
    filePath: Optional[str] = Field(None, description="Optional local file path for instant processing")

class ProcessLogResponse(BaseModel):
    success: bool
    jobId: str
    status: str
    message: str

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "logsense-processing",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "s3_bucket": settings.STORAGE_BUCKET_NAME,
    }

@app.get("/")
def root():
    return {
        "message": "LogSense Processing Intelligence API is running",
        "health": "/health",
    }

@app.post("/api/v1/process", response_model=ProcessLogResponse, status_code=status.HTTP_202_ACCEPTED)
async def process_log_async(payload: ProcessLogRequest, background_tasks: BackgroundTasks):
    """
    Accepts an uploaded log file and streams it asynchronously for Drain3 clustering
    and structured database persistence.
    """
    logger.info(f"Accepted async processing request for job: {payload.jobId}, file: {payload.fileKey}")

    background_tasks.add_task(
        process_uploaded_log_source,
        job_id=payload.jobId,
        log_source_id=payload.logSourceId,
        project_id=payload.projectId,
        service_id=payload.serviceId,
        file_key=payload.fileKey,
        bucket=payload.bucket,
        local_path=payload.filePath,
    )

    return ProcessLogResponse(
        success=True,
        jobId=payload.jobId,
        status="PROCESSING",
        message="Log source processing scheduled in background",
    )

@app.post("/api/v1/process/sync", response_model=ProcessLogResponse)
def process_log_sync(payload: ProcessLogRequest):
    """
    Synchronously processes an uploaded log file (useful for integration tests and pipeline verification).
    """
    logger.info(f"Accepted synchronous processing request for job: {payload.jobId}, file: {payload.fileKey}")
    try:
        total = process_uploaded_log_source(
            job_id=payload.jobId,
            log_source_id=payload.logSourceId,
            project_id=payload.projectId,
            service_id=payload.serviceId,
            file_key=payload.fileKey,
            bucket=payload.bucket,
            local_path=payload.filePath,
        )
        return ProcessLogResponse(
            success=True,
            jobId=payload.jobId,
            status="COMPLETED",
            message=f"Log file processed successfully. Total entries: {total}",
        )
    except Exception as e:
        logger.error(f"Processing failed for job {payload.jobId}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Log processing failed: {str(e)}",
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
