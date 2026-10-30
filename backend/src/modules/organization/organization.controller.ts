import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { organizationService } from "./organization.service.js";

export const createOrganization = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const organization = await organizationService.createOrganization(userId, req.body);
  sendResponse(res, StatusCodes.CREATED, "Organization created successfully", { organization });
});

export const getOrganizations = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const organizations = await organizationService.getUserOrganizations(userId);
  sendResponse(res, StatusCodes.OK, "Organizations retrieved successfully", { organizations });
});

export const getOrganizationById = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const organization = await organizationService.getOrganizationById(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Organization retrieved successfully", { organization });
});

export const updateOrganization = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const organization = await organizationService.updateOrganization(
    req.params.id as string,
    userId,
    req.body,
  );
  sendResponse(res, StatusCodes.OK, "Organization updated successfully", { organization });
});

export const deleteOrganization = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const result = await organizationService.deleteOrganization(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Organization deleted successfully", result);
});
