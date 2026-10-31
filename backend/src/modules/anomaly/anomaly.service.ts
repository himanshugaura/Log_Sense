import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import type { ListAnomaliesQuery } from "./anomaly.validation.js";

export class AnomalyService {
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

  async getAnomalies(projectId: string, userId: string, query: ListAnomaliesQuery) {
    await this.validateProjectOwnership(projectId, userId);

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

  async getAnomalyById(projectId: string, anomalyId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

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

    return anomaly;
  }
}

export const anomalyService = new AnomalyService();
