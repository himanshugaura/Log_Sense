import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { serviceManagementService } from "./service.service.js";

export const createService = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const service = await serviceManagementService.createService(userId, req.body);
  sendResponse(res, StatusCodes.CREATED, "Service created successfully", { service });
});

export const getServices = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const projectId = req.query.projectId as string;
  const services = await serviceManagementService.getServicesByProject(userId, projectId);
  sendResponse(res, StatusCodes.OK, "Services retrieved successfully", { services });
});

export const getServiceById = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const service = await serviceManagementService.getServiceById(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Service retrieved successfully", { service });
});

export const updateService = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const service = await serviceManagementService.updateService(
    req.params.id as string,
    userId,
    req.body,
  );
  sendResponse(res, StatusCodes.OK, "Service updated successfully", { service });
});

export const deleteService = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const result = await serviceManagementService.deleteService(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Service deleted successfully", result);
});

export const createDependency = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const dependency = await serviceManagementService.createDependency(userId, req.body);
  sendResponse(res, StatusCodes.CREATED, "Service dependency created successfully", { dependency });
});

export const deleteDependency = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const result = await serviceManagementService.deleteDependency(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Service dependency removed successfully", result);
});

export const getDependencyGraph = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const graph = await serviceManagementService.getDependencyGraph(
    req.params.projectId as string,
    userId,
  );
  sendResponse(res, StatusCodes.OK, "Dependency graph retrieved successfully", { graph });
});
