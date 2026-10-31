import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";
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
   * Validates project existence and ensures caller owns the project
   */
  async validateProjectOwnership(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: {
            id: true,
            ownerId: true,
          },
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
    serviceId?: string | null;
    file: Express.Multer.File;
    sourceType?: string;
  }) {
    const project = await this.validateProjectOwnership(params.projectId, params.userId);

    let serviceName: string | null = null;
    let validatedServiceId: string | null = null;

    if (params.serviceId && params.serviceId.trim() !== "") {
      const service = await prisma.service.findFirst({
        where: {
          id: params.serviceId,
          projectId: params.projectId,
        },
        select: { id: true, name: true },
      });

      if (!service) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          `Service with ID '${params.serviceId}' not found in this project`,
        );
      }

      validatedServiceId = service.id;
      serviceName = service.name;
    }

    // 1. Generate structured S3 key: logsense/{orgId}/{projectId}/{serviceName}/{timestamp}-{fileName}
    const storageKey = storageService.generateLogKey({
      organizationId: project.organization.id,
      projectId: project.id,
      serviceName,
      originalFileName: params.file.originalname,
    });

    // 2. Upload file to Object Storage (Neon / S3 / R2)
    const uploadResult = await storageService.uploadFile({
      key: storageKey,
      body: params.file.buffer,
      contentType: params.file.mimetype || "text/plain",
    });

    // 3. Atomically create LogSource and ProcessingJob in PostgreSQL
    const { logSource, processingJob } = await prisma.$transaction(async (tx) => {
      const source = await tx.logSource.create({
        data: {
          projectId: params.projectId,
          serviceId: validatedServiceId,
          name: params.file.originalname,
          sourceType: params.sourceType || "FILE_UPLOAD",
          fileKey: uploadResult.key,
          fileSize: params.file.size,
          fileType: params.file.mimetype || "text/plain",
        },
        include: {
          service: {
            select: { id: true, name: true },
          },
        },
      });

      const job = await tx.processingJob.create({
        data: {
          projectId: params.projectId,
          logSourceId: source.id,
          jobType: "LOG_INGESTION",
          status: "PENDING",
        },
      });

      return { logSource: source, processingJob: job };
    });

    // 4. Trigger asynchronous processing via Python FastAPI service
    this.triggerProcessingJob({
      jobId: processingJob.id,
      logSourceId: logSource.id,
      projectId: project.id,
      serviceId: validatedServiceId,
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
   * Asynchronously calls Python FastAPI service to begin parsing, clustering, and anomaly detection
   */
  private async triggerProcessingJob(payload: {
    jobId: string;
    logSourceId: string;
    projectId: string;
    serviceId: string | null;
    fileKey: string;
  }): Promise<void> {
    const processingEndpoint = `${env.PROCESSING_SERVICE_URL}/api/v1/process`;

    try {
      logger.info(`Dispatching processing request to Python service: ${processingEndpoint}`);

      // Native fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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
        logger.warn(`Python processing service responded with status ${response.status}: ${errorText}`);
      } else {
        logger.info(`Python processing job successfully accepted: ${payload.jobId}`);
      }
    } catch (error: any) {
      logger.warn(`Could not reach Python processing service (${processingEndpoint}): ${error.message}`);
    }
  }

  /**
   * Retrieves log sources for a project
   */
  async getLogSources(projectId: string, userId: string, query: GetLogSourcesQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = { projectId };
    if (query.serviceId) {
      where.serviceId = query.serviceId;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.logSource.count({ where }),
      prisma.logSource.findMany({
        where,
        include: {
          service: {
            select: { id: true, name: true },
          },
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
        service: {
          select: { id: true, name: true },
        },
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
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
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
          parserState: {
            select: {
              id: true,
              serviceId: true,
              service: { select: { id: true, name: true } },
            },
          },
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
        parserState: {
          select: {
            id: true,
            serviceId: true,
            service: { select: { id: true, name: true, description: true } },
          },
        },
        logEntries: {
          orderBy: { timestamp: "desc" },
          take: 15,
          select: {
            id: true,
            timestamp: true,
            level: true,
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

    if (query.serviceId) {
      where.serviceId = query.serviceId;
    }
    if (query.sourceId) {
      where.sourceId = query.sourceId;
    }
    if (query.clusterId) {
      where.clusterId = query.clusterId;
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
          service: {
            select: { id: true, name: true },
          },
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
            select: { id: true, name: true, fileKey: true, fileSize: true },
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
   * Deletes a log source and its associated file in object storage
   */
  async deleteLogSource(projectId: string, sourceId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const logSource = await prisma.logSource.findFirst({
      where: { id: sourceId, projectId },
    });

    if (!logSource) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Log source not found");
    }

    // Delete object from S3 if fileKey exists
    if (logSource.fileKey) {
      try {
        await storageService.deleteFile(logSource.fileKey);
      } catch (err) {
        logger.warn(`Could not delete S3 object for log source ${sourceId}:`, err);
      }
    }

    // Cascade deletes logEntries in database
    await prisma.logSource.delete({
      where: { id: sourceId },
    });

    return { deleted: true, id: sourceId };
  }
}

export const logService = new LogService();
