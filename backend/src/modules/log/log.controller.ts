import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { logService } from "./log.service.js";
import type {
  GetLogClustersQuery,
  GetLogEntriesQuery,
  GetLogSourcesQuery,
  GetProcessingJobsQuery,
} from "./log.validation.js";

export class LogController {
  /**
   * Handles multipart log file upload and initiates storage and processing
   * POST /api/v1/logs/:projectId/upload
   */
  uploadLog = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    if (!req.file) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "No file uploaded. Please attach a log file.");
    }

    const projectId = req.params.projectId as string;
    const { serviceName, sourceType } = req.body;

    const result = await logService.uploadLogFile({
      userId,
      projectId,
      serviceName: serviceName || null,
      file: req.file,
      sourceType,
    });

    sendResponse(
      res,
      StatusCodes.CREATED,
      "Log file successfully uploaded to object storage and queued for processing",
      { ...result },
    );
  });

  /**
   * Retrieves log sources for a project
   * GET /api/v1/logs/:projectId/sources
   */
  getLogSources = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as GetLogSourcesQuery;

    const result = await logService.getLogSources(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Log sources retrieved successfully", { ...result });
  });

  /**
   * Retrieves single log source with a presigned download URL
   * GET /api/v1/logs/:projectId/sources/:sourceId
   */
  getLogSourceById = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const sourceId = req.params.sourceId as string;

    const result = await logService.getLogSourceById(projectId, sourceId, userId);

    sendResponse(res, StatusCodes.OK, "Log source details retrieved successfully", {
      logSource: result,
    });
  });

  /**
   * Retrieves log clusters (Drain3 templates) for a project
   * GET /api/v1/logs/:projectId/clusters
   */
  getLogClusters = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as GetLogClustersQuery;

    const result = await logService.getLogClusters(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Log clusters retrieved successfully", { ...result });
  });

  /**
   * Retrieves single log cluster with sample original log lines
   * GET /api/v1/logs/:projectId/clusters/:clusterId
   */
  getLogClusterById = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const clusterId = req.params.clusterId as string;

    const result = await logService.getLogClusterById(projectId, clusterId, userId);

    sendResponse(res, StatusCodes.OK, "Log cluster details retrieved successfully", {
      cluster: result,
    });
  });

  /**
   * Queries parsed log entries with filtering & full-text search
   * GET /api/v1/logs/:projectId/entries
   */
  getLogEntries = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as GetLogEntriesQuery;

    const result = await logService.getLogEntries(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Log entries retrieved successfully", { ...result });
  });

  /**
   * Retrieves processing jobs for a project
   * GET /api/v1/logs/:projectId/jobs
   */
  getProcessingJobs = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as GetProcessingJobsQuery;

    const result = await logService.getProcessingJobs(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Processing jobs retrieved successfully", { ...result });
  });

  /**
   * Deletes a log source and its object storage file
   * DELETE /api/v1/logs/:projectId/sources/:sourceId
   */
  deleteLogSource = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const sourceId = req.params.sourceId as string;

    const result = await logService.deleteLogSource(projectId, sourceId, userId);

    sendResponse(res, StatusCodes.OK, "Log source deleted successfully", { ...result });
  });
}

export const logController = new LogController();
