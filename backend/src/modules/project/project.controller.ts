import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { projectService } from "./project.service.js";

export const createProject = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const project = await projectService.createProject(userId, req.body);
  sendResponse(res, StatusCodes.CREATED, "Project created successfully", { project });
});

export const getProjects = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const organizationId = req.query.organizationId as string | undefined;
  const projects = await projectService.getUserProjects(userId, organizationId);
  sendResponse(res, StatusCodes.OK, "Projects retrieved successfully", { projects });
});

export const getProjectById = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const project = await projectService.getProjectById(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Project retrieved successfully", { project });
});

export const updateProject = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const project = await projectService.updateProject(req.params.id as string, userId, req.body);
  sendResponse(res, StatusCodes.OK, "Project updated successfully", { project });
});

export const deleteProject = CatchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
  }

  const result = await projectService.deleteProject(req.params.id as string, userId);
  sendResponse(res, StatusCodes.OK, "Project deleted successfully", result);
});
