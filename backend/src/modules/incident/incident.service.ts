import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import type { ListIncidentsQuery, UpdateIncidentStatusBody } from "./incident.validation.js";

export class IncidentService {
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

  async getIncidents(projectId: string, userId: string, query: ListIncidentsQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const where: any = { projectId };
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        include: {
          incidentAnomalies: {
            include: {
              anomaly: {
                select: {
                  id: true,
                  title: true,
                  severity: true,
                  status: true,
                  serviceId: true,
                  firstDetectedAt: true,
                  service: { select: { id: true, name: true } },
                },
              },
            },
          },
          rcaAnalyses: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              candidates: {
                orderBy: { rank: "asc" },
                take: 3,
                include: { service: { select: { id: true, name: true } } },
              },
            },
          },
          incidentSummaries: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { incidentAnomalies: true },
          },
        },
        orderBy: { startedAt: "desc" },
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

  async getIncidentById(projectId: string, incidentId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        incidentAnomalies: {
          include: {
            anomaly: {
              include: {
                service: { select: { id: true, name: true } },
                cluster: { select: { id: true, template: true, occurrenceCount: true } },
              },
            },
          },
        },
        rcaAnalyses: {
          orderBy: { createdAt: "desc" },
          include: {
            candidates: {
              orderBy: { rank: "asc" },
              include: {
                service: { select: { id: true, name: true, description: true } },
              },
            },
          },
        },
        incidentSummaries: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!incident) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Incident not found");
    }

    return incident;
  }

  async updateIncidentStatus(
    projectId: string,
    incidentId: string,
    userId: string,
    body: UpdateIncidentStatusBody,
  ) {
    await this.validateProjectOwnership(projectId, userId);

    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, projectId },
    });

    if (!incident) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Incident not found");
    }

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: body.status,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      },
    });

    return updated;
  }
}

export const incidentService = new IncidentService();
