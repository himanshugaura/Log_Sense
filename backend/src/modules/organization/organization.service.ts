import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import type { CreateOrganizationInput, UpdateOrganizationInput } from "./organization.validation.js";

export class OrganizationService {
  /**
   * Creates a new organization owned by the authenticated user
   */
  async createOrganization(userId: string, data: CreateOrganizationInput) {
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        ownerId: userId,
      },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    return organization;
  }

  /**
   * Retrieves all organizations owned by the user
   */
  async getUserOrganizations(userId: string) {
    const organizations = await prisma.organization.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return organizations;
  }

  /**
   * Retrieves an organization by ID and validates ownership
   */
  async getOrganizationById(organizationId: string, userId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            timezone: true,
            createdAt: true,
            _count: {
              select: {
                services: true,
                incidents: true,
                anomalies: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!organization) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Organization not found");
    }

    if (organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this organization");
    }

    return organization;
  }

  /**
   * Updates organization details after validating ownership
   */
  async updateOrganization(organizationId: string, userId: string, data: UpdateOrganizationInput) {
    // Check existence and ownership
    await this.getOrganizationById(organizationId, userId);

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: data.name,
      },
      include: {
        _count: {
          select: { projects: true },
        },
      },
    });

    return updated;
  }

  /**
   * Deletes organization after validating ownership (cascades to all projects, services, logs)
   */
  async deleteOrganization(organizationId: string, userId: string) {
    // Check existence and ownership
    await this.getOrganizationById(organizationId, userId);

    await prisma.organization.delete({
      where: { id: organizationId },
    });

    return { deleted: true, id: organizationId };
  }
}

export const organizationService = new OrganizationService();
