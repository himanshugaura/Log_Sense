import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import type { CreateDependencyInput, CreateServiceInput, UpdateServiceInput } from "./service.validation.js";

export class ServiceManagementService {
  /**
   * Validates that the project exists and is owned by the user
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
   * Validates that the service exists and belongs to a project owned by the user
   */
  async validateServiceOwnership(serviceId: string, userId: string) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        project: {
          include: {
            organization: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!service) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Service not found");
    }

    if (service.project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this service");
    }

    return service;
  }

  /**
   * Registers a new microservice in a project
   */
  async createService(userId: string, data: CreateServiceInput) {
    await this.validateProjectOwnership(data.projectId, userId);

    const existing = await prisma.service.findUnique({
      where: {
        projectId_name: {
          projectId: data.projectId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Service with name '${data.name}' already exists in this project`,
      );
    }

    const service = await prisma.service.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
      },
      include: {
        _count: {
          select: {
            outgoingDependencies: true,
            incomingDependencies: true,
            logSources: true,
          },
        },
      },
    });

    return service;
  }

  /**
   * Retrieves all services in a project
   */
  async getServicesByProject(userId: string, projectId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const services = await prisma.service.findMany({
      where: { projectId },
      include: {
        outgoingDependencies: {
          select: {
            id: true,
            targetServiceId: true,
            dependencyType: true,
            isRequired: true,
            targetService: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        incomingDependencies: {
          select: {
            id: true,
            sourceServiceId: true,
            dependencyType: true,
            isRequired: true,
            sourceService: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            logSources: true,
            logEntries: true,
            anomalies: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return services;
  }

  /**
   * Retrieves single service details with full dependency topology
   */
  async getServiceById(serviceId: string, userId: string) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        },
        outgoingDependencies: {
          include: {
            targetService: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        incomingDependencies: {
          include: {
            sourceService: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        logSources: {
          select: {
            id: true,
            name: true,
            sourceType: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            logEntries: true,
            anomalies: true,
            rootCauseCandidates: true,
          },
        },
      },
    });

    if (!service) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Service not found");
    }

    if (service.project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this service");
    }

    return service;
  }

  /**
   * Updates service information
   */
  async updateService(serviceId: string, userId: string, data: UpdateServiceInput) {
    const existing = await this.validateServiceOwnership(serviceId, userId);

    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.service.findUnique({
        where: {
          projectId_name: {
            projectId: existing.projectId,
            name: data.name,
          },
        },
      });

      if (duplicate) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Service with name '${data.name}' already exists in this project`,
        );
      }
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    return updated;
  }

  /**
   * Deletes a service and all its associated dependencies and logs (Cascade)
   */
  async deleteService(serviceId: string, userId: string) {
    await this.validateServiceOwnership(serviceId, userId);

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return { deleted: true, id: serviceId };
  }

  /**
   * Creates a directed dependency between two services
   */
  async createDependency(userId: string, data: CreateDependencyInput) {
    const sourceService = await this.validateServiceOwnership(data.sourceServiceId, userId);
    const targetService = await this.validateServiceOwnership(data.targetServiceId, userId);

    // Verify services belong to the same project
    if (sourceService.projectId !== targetService.projectId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Cannot create dependency between services in different projects",
      );
    }

    const existing = await prisma.serviceDependency.findUnique({
      where: {
        sourceServiceId_targetServiceId: {
          sourceServiceId: data.sourceServiceId,
          targetServiceId: data.targetServiceId,
        },
      },
    });

    if (existing) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Dependency from '${sourceService.name}' to '${targetService.name}' already exists`,
      );
    }

    const dependency = await prisma.serviceDependency.create({
      data: {
        sourceServiceId: data.sourceServiceId,
        targetServiceId: data.targetServiceId,
        dependencyType: data.dependencyType,
        isRequired: data.isRequired ?? true,
      },
      include: {
        sourceService: {
          select: {
            id: true,
            name: true,
          },
        },
        targetService: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return dependency;
  }

  /**
   * Deletes a service dependency relationship
   */
  async deleteDependency(dependencyId: string, userId: string) {
    const dependency = await prisma.serviceDependency.findUnique({
      where: { id: dependencyId },
      include: {
        sourceService: {
          include: {
            project: {
              include: {
                organization: {
                  select: { ownerId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!dependency) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Service dependency not found");
    }

    if (dependency.sourceService.project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this dependency");
    }

    await prisma.serviceDependency.delete({
      where: { id: dependencyId },
    });

    return { deleted: true, id: dependencyId };
  }

  /**
   * Returns a complete dependency graph (nodes & edges) for interactive UI visualization
   */
  async getDependencyGraph(projectId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const services = await prisma.service.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            anomalies: true,
            logEntries: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const serviceIds = services.map((s) => s.id);

    const dependencies = await prisma.serviceDependency.findMany({
      where: {
        sourceServiceId: { in: serviceIds },
        targetServiceId: { in: serviceIds },
      },
      include: {
        sourceService: {
          select: { name: true },
        },
        targetService: {
          select: { name: true },
        },
      },
    });

    const nodes = services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      createdAt: service.createdAt,
      anomaliesCount: service._count.anomalies,
      logEntriesCount: service._count.logEntries,
    }));

    const edges = dependencies.map((dep) => ({
      id: dep.id,
      source: dep.sourceServiceId,
      target: dep.targetServiceId,
      sourceName: dep.sourceService.name,
      targetName: dep.targetService.name,
      dependencyType: dep.dependencyType,
      isRequired: dep.isRequired,
    }));

    return {
      projectId,
      totalServices: nodes.length,
      totalDependencies: edges.length,
      nodes,
      edges,
    };
  }
}

export const serviceManagementService = new ServiceManagementService();
