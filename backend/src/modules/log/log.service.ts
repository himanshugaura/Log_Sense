import { StatusCodes } from "http-status-codes";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";
import { prisma } from "../../core/config/db.js";
import { storageService } from "../../core/services/storage.service.js";
import ApiError from "../../shared/utils/ApiError.js";
import type {
  GetLogClustersQuery,
  GetLogEntriesQuery,
  GetLogSourcesQuery,
  GetProcessingJobsQuery,
} from "./log.validation.js";

export class LogService {
  /**
   * Validates whether a project exists and is owned by the user
   */
  async validateProjectOwnership(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!project) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Target project not found");
    }

    if (project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this project");
    }

    return project;
  }

  /**
   * Uploads raw log file to object storage and initializes ingestion record & processing job
   */
  async uploadLogFile(params: {
    userId: string;
    projectId: string;
    serviceName?: string | null;
    file: Express.Multer.File;
    sourceType?: string;
  }) {
    const project = await this.validateProjectOwnership(params.projectId, params.userId);

    // 1. Generate structured S3 key: logsense/{orgId}/{projectId}/logs/{timestamp}-{fileName}
    const storageKey = storageService.generateLogKey({
      organizationId: project.organization.id,
      projectId: project.id,
      serviceName: params.serviceName || "logs",
      originalFileName: params.file.originalname,
    });

    // 2. Upload file to Object Storage (Neon / S3 / R2)
    const uploadResult = await storageService.uploadFile({
      key: storageKey,
      body: params.file.buffer,
      contentType: params.file.mimetype || "text/plain",
    });

    // 3. Reset previous log telemetry for this project to ensure 1:1 service-to-log isolation
    try {
      await prisma.incident.deleteMany({ where: { projectId: params.projectId } });
      await prisma.anomaly.deleteMany({ where: { projectId: params.projectId } });
      await prisma.parserState.deleteMany({ where: { projectId: params.projectId } });
      await prisma.processingJob.deleteMany({ where: { projectId: params.projectId } });
      await prisma.logSource.deleteMany({ where: { projectId: params.projectId } });
    } catch (err: any) {
      logger.warn(`Notice during cleanup of previous project telemetry: ${err?.message}`);
    }

    // 4. Create fresh LogSource and ProcessingJob
    const logSource = await prisma.logSource.create({
      data: {
        projectId: params.projectId,
        serviceName: params.serviceName || project.name,
        name: params.file.originalname,
        sourceType: params.sourceType || "FILE_UPLOAD",
        fileKey: uploadResult.key,
        fileSize: params.file.size,
        fileType: params.file.mimetype || "text/plain",
      },
    });

    const processingJob = await prisma.processingJob.create({
      data: {
        projectId: params.projectId,
        logSourceId: logSource.id,
        jobType: "LOG_INGESTION",
        status: "PENDING",
      },
    });

    // 4. Trigger asynchronous processing via Python FastAPI service
    this.triggerProcessingJob({
      jobId: processingJob.id,
      logSourceId: logSource.id,
      projectId: project.id,
      fileKey: uploadResult.key,
    }).catch((err) => {
      logger.warn(
        `Python processing trigger failed or queued for job ${processingJob.id}: ${err.message}`,
      );
    });

    return {
      logSource,
      processingJob,
      objectStorage: {
        bucket: uploadResult.bucket,
        key: uploadResult.key,
        sizeBytes: uploadResult.size,
      },
    };
  }

  /**
   * Asynchronously triggers Python log parsing, Drain3 clustering, and statistical RCA.
   * If the HTTP service on port 8000 is not reachable, seamlessly falls back to spawning
   * the local CLI worker so ingestion never hangs.
   */
  private async triggerProcessingJob(payload: {
    jobId: string;
    logSourceId: string;
    projectId: string;
    fileKey: string;
  }): Promise<void> {
    const processingEndpoint = `${env.PROCESSING_SERVICE_URL}/api/v1/process`;

    try {
      logger.info(`Dispatching processing request to Python service: ${processingEndpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(processingEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      } else {
        logger.info(`Python processing job successfully accepted via HTTP: ${payload.jobId}`);
      }
    } catch (error: any) {
      logger.warn(
        `Python HTTP service unreachable (${processingEndpoint}): ${error.message}. Spawning local CLI worker fallback...`
      );

      try {
        await this.spawnPythonWorkerFallback(payload);
      } catch (spawnErr: any) {
        logger.error(`Failed to spawn Python CLI worker: ${spawnErr.message}`);
        await prisma.processingJob
          .update({
            where: { id: payload.jobId },
            data: {
              status: "FAILED",
              errorMessage: `Processing service offline and CLI fallback failed: ${spawnErr.message}`,
              completedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    }
  }

  /**
   * Spawns backend/processing/run_job.py directly using the virtualenv python binary
   */
  private async spawnPythonWorkerFallback(payload: {
    jobId: string;
    logSourceId: string;
    projectId: string;
    fileKey: string;
  }): Promise<void> {
    const isWindows = process.platform === "win32";

    // Candidate paths for virtualenv python
    const candidates = [
      path.resolve(process.cwd(), "processing", ".venv", isWindows ? "Scripts/python.exe" : "bin/python"),
      path.resolve(process.cwd(), "backend", "processing", ".venv", isWindows ? "Scripts/python.exe" : "bin/python"),
      path.resolve(process.cwd(), "..", "backend", "processing", ".venv", isWindows ? "Scripts/python.exe" : "bin/python"),
    ];

    let pythonBin = "python";
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        pythonBin = cand;
        break;
      }
    }

    const scriptCandidates = [
      path.resolve(process.cwd(), "processing", "run_job.py"),
      path.resolve(process.cwd(), "backend", "processing", "run_job.py"),
      path.resolve(process.cwd(), "..", "backend", "processing", "run_job.py"),
    ];

    let scriptPath = "";
    for (const cand of scriptCandidates) {
      if (fs.existsSync(cand)) {
        scriptPath = cand;
        break;
      }
    }

    if (!scriptPath) {
      throw new Error("Could not find run_job.py script in workspace");
    }

    const args = [
      scriptPath,
      "--job-id", payload.jobId,
      "--source-id", payload.logSourceId,
      "--project-id", payload.projectId,
      "--file-key", payload.fileKey,
    ];

    logger.info(`Spawning background Python worker: ${pythonBin} ${args.join(" ")}`);

    const child = spawn(pythonBin, args, {
      stdio: "inherit",
      detached: true,
      windowsHide: true,
    });

    child.unref();
  }

  /**
   * Retrieves log sources for a project
   */
  async getLogSources(projectId: string, userId: string, query: GetLogSourcesQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = { projectId };
    if (query.search && query.search.trim().length > 0) {
      where.name = { contains: query.search.trim(), mode: "insensitive" };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.logSource.count({ where }),
      prisma.logSource.findMany({
        where,
        include: {
          processingJobs: {
            select: {
              id: true,
              status: true,
              processedItems: true,
              totalItems: true,
              createdAt: true,
              completedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { logEntries: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single log source and generates fresh presigned URL for downloading original log file
   */
  async getLogSourceById(projectId: string, sourceId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const logSource = await prisma.logSource.findFirst({
      where: { id: sourceId, projectId },
      include: {
        processingJobs: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { logEntries: true },
        },
      },
    });

    if (!logSource) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Log source not found");
    }

    let downloadUrl: string | null = null;
    if (logSource.fileKey) {
      try {
        downloadUrl = await storageService.getPresignedDownloadUrl(logSource.fileKey, 3600);
      } catch (err) {
        logger.error(`Could not generate presigned download URL for ${logSource.fileKey}:`, err);
      }
    }

    return {
      ...logSource,
      downloadUrl,
    };
  }

  /**
   * Retrieves mined log clusters (Drain3 templates) for a project
   */
  async getLogClusters(projectId: string, userId: string, query: GetLogClustersQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = {
      parserState: {
        projectId,
      },
    };

    if (query.search && query.search.trim().length > 0) {
      where.template = { contains: query.search.trim(), mode: "insensitive" };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.logCluster.count({ where }),
      prisma.logCluster.findMany({
        where,
        include: {
          _count: {
            select: { logEntries: true, anomalies: true },
          },
        },
        orderBy: { occurrenceCount: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a specific log cluster with sample original log entries
   */
  async getLogClusterById(projectId: string, clusterId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const cluster = await prisma.logCluster.findFirst({
      where: {
        id: clusterId,
        parserState: { projectId },
      },
      include: {
        logEntries: {
          orderBy: { timestamp: "desc" },
          take: 15,
          select: {
            id: true,
            timestamp: true,
            level: true,
            serviceName: true,
            rawMessage: true,
            normalizedMessage: true,
            traceId: true,
            spanId: true,
          },
        },
        anomalies: {
          select: {
            id: true,
            anomalyType: true,
            severity: true,
            title: true,
            firstDetectedAt: true,
          },
        },
      },
    });

    if (!cluster) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Log cluster not found");
    }

    return cluster;
  }

  /**
   * Queries structured log entries with filtering, pagination, and full-text keyword search
   */
  async getLogEntries(projectId: string, userId: string, query: GetLogEntriesQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = { projectId };

    if (query.sourceId) {
      where.sourceId = query.sourceId;
    }
    if (query.clusterId) {
      where.clusterId = query.clusterId;
    }
    if (query.serviceName) {
      where.serviceName = { contains: query.serviceName, mode: "insensitive" };
    }
    if (query.level) {
      where.level = { equals: query.level, mode: "insensitive" };
    }

    if (query.startTime || query.endTime) {
      where.timestamp = {};
      if (query.startTime) {
        where.timestamp.gte = new Date(query.startTime);
      }
      if (query.endTime) {
        where.timestamp.lte = new Date(query.endTime);
      }
    }

    if (query.search && query.search.trim().length > 0) {
      const searchTerm = query.search.trim();
      where.OR = [
        { rawMessage: { contains: searchTerm, mode: "insensitive" } },
        { normalizedMessage: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.logEntry.count({ where }),
      prisma.logEntry.findMany({
        where,
        include: {
          cluster: {
            select: { id: true, drainClusterId: true, template: true },
          },
          source: {
            select: { id: true, name: true },
          },
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves processing jobs for a project
   */
  async getProcessingJobs(projectId: string, userId: string, query: GetProcessingJobsQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = { projectId };
    if (query.status) {
      where.status = query.status;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.processingJob.count({ where }),
      prisma.processingJob.findMany({
        where,
        include: {
          logSource: {
            select: { id: true, name: true, sourceType: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Deletes a log source and its object storage file
   */
  async deleteLogSource(projectId: string, sourceId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const logSource = await prisma.logSource.findFirst({
      where: { id: sourceId, projectId },
    });

    if (!logSource) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Log source not found");
    }

    if (logSource.fileKey) {
      await storageService.deleteFile(logSource.fileKey).catch((err) => {
        logger.warn(`Could not delete object storage file ${logSource.fileKey}: ${err.message}`);
      });
    }

    await prisma.logSource.delete({
      where: { id: sourceId },
    });

    return { deleted: true, id: sourceId };
  }
}

export const logService = new LogService();
