import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import { memoryCache } from "../../shared/utils/cache.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.validation.js";

export class ProjectService {
  /**
   * Validates whether an organization exists and is owned by the user
   */
  async validateOrganizationOwnership(organizationId: string, userId: string) {
    const cacheKey = `org_owner:${organizationId}:${userId}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, ownerId: true },
    });

    if (!organization) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Target organization not found");
    }

    if (organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not own the target organization");
    }

    memoryCache.set(cacheKey, organization, 120);
    return organization;
  }

  /**
   * Creates a new project under an organization owned by the user
   */
  async createProject(userId: string, data: CreateProjectInput) {
    // Verify ownership of the parent organization
    await this.validateOrganizationOwnership(data.organizationId, userId);

    const project = await prisma.project.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description ?? null,
        timezone: data.timezone || "UTC",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            logSources: true,
            logEntries: true,
            incidents: true,
            anomalies: true,
          },
        },
      },
    });

    memoryCache.invalidatePrefix(`user_projects:${userId}`);
    return project;
  }

  /**
   * Retrieves all projects under organizations owned by the user
   */
  async getUserProjects(userId: string, organizationId?: string) {
    const cacheKey = `user_projects:${userId}:${organizationId || 'all'}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    if (organizationId) {
      await this.validateOrganizationOwnership(organizationId, userId);
    }

    let projects = await prisma.project.findMany({
      where: {
        organization: {
          ownerId: userId,
        },
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            logSources: true,
            logEntries: true,
            anomalies: true,
            incidents: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (projects.length === 0 && !organizationId) {
      let org = await prisma.organization.findFirst({
        where: { ownerId: userId },
      });
      if (!org) {
        org = await prisma.organization.create({
          data: {
            name: "Default Organization",
            ownerId: userId,
          },
        });
      }

      const defaultProject = await prisma.project.create({
        data: {
          organizationId: org.id,
          name: "Default Workspace",
          description: "Default log intelligence dataset workspace",
          timezone: "UTC",
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              logSources: true,
              logEntries: true,
              anomalies: true,
              incidents: true,
            },
          },
        },
      });

      projects = [defaultProject];
    }

    memoryCache.set(cacheKey, projects, 20);
    return projects;
  }

  /**
   * Retrieves single project with related stats after verifying user ownership
   */
  async getProjectById(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        _count: {
          select: {
            logSources: true,
            logEntries: true,
            anomalies: true,
            incidents: true,
            processingJobs: true,
          },
        },
      },
    });

    if (!project) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
    }

    if (project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this project");
    }

    return project;
  }

  /**
   * Updates project details after verifying ownership
   */
  async updateProject(projectId: string, userId: string, data: UpdateProjectInput) {
    await this.getProjectById(projectId, userId);

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Deletes a project and all associated logs, and incidents (Cascade)
   */
  async deleteProject(projectId: string, userId: string) {
    await this.getProjectById(projectId, userId);

    await prisma.project.delete({
      where: { id: projectId },
    });

    return { deleted: true, id: projectId };
  }
}

export const projectService = new ProjectService();
