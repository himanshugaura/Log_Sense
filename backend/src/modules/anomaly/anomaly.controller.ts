import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { anomalyService } from "./anomaly.service.js";
import type { ListAnomaliesQuery } from "./anomaly.validation.js";

export class AnomalyController {
  getAnomalies = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as ListAnomaliesQuery;

    const result = await anomalyService.getAnomalies(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Anomalies retrieved successfully", { ...result });
  });

  getAnomalyById = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const anomalyId = req.params.anomalyId as string;

    const result = await anomalyService.getAnomalyById(projectId, anomalyId, userId);

    sendResponse(res, StatusCodes.OK, "Anomaly details retrieved successfully", { anomaly: result });
  });
}

export const anomalyController = new AnomalyController();
