import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import { memoryCache } from "../../shared/utils/cache.js";
import type { ListAnomaliesQuery } from "./anomaly.validation.js";

export class AnomalyService {
  async validateProjectOwnership(projectId: string, userId: string) {
    const cacheKey = `proj_owner:${projectId}:${userId}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

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

    memoryCache.set(cacheKey, project, 120);
    return project;
  }

  async getAnomalies(projectId: string, userId: string, query: ListAnomaliesQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const cacheKey = `anomalies_list:${projectId}:${query.severity || ''}:${query.status || ''}:${query.anomalyType || ''}:${query.clusterId || ''}:${query.page || 1}:${query.limit || 50}`;
    const cachedResult = memoryCache.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const where: any = { projectId };
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.anomalyType) where.anomalyType = query.anomalyType;
    if (query.clusterId) where.clusterId = query.clusterId;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.anomaly.count({ where }),
      prisma.anomaly.findMany({
        where,
        include: {
          cluster: {
            select: { id: true, template: true, occurrenceCount: true },
          },
          incidentAnomalies: {
            select: {
              incident: {
                select: { id: true, title: true, severity: true, status: true },
              },
            },
          },
        },
        orderBy: { firstDetectedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const result = {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    memoryCache.set(cacheKey, result, 20); // 20s TTL
    return result;
  }

  async getAnomalyById(projectId: string, anomalyId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const cacheKey = `anomaly_detail:${projectId}:${anomalyId}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    const anomaly = await prisma.anomaly.findFirst({
      where: { id: anomalyId, projectId },
      include: {
        cluster: {
          select: { id: true, template: true, occurrenceCount: true, firstSeenAt: true, lastSeenAt: true },
        },
        incidentAnomalies: {
          include: {
            incident: true,
          },
        },
      },
    });

    if (!anomaly) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Anomaly not found");
    }

    memoryCache.set(cacheKey, anomaly, 20);
    return anomaly;
  }
}

export const anomalyService = new AnomalyService();
