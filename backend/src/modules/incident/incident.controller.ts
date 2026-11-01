import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { incidentService } from "./incident.service.js";
import type { IncidentChatBody, ListIncidentsQuery, UpdateIncidentStatusBody } from "./incident.validation.js";

export class IncidentController {
  getIncidents = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const query = req.query as unknown as ListIncidentsQuery;

    const result = await incidentService.getIncidents(projectId, userId, query);

    sendResponse(res, StatusCodes.OK, "Incidents retrieved successfully", { ...result });
  });

  getIncidentById = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const incidentId = req.params.incidentId as string;

    const result = await incidentService.getIncidentById(projectId, incidentId, userId);

    sendResponse(res, StatusCodes.OK, "Incident details retrieved successfully", { incident: result });
  });

  updateIncidentStatus = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const incidentId = req.params.incidentId as string;
    const body = req.body as UpdateIncidentStatusBody;

    const result = await incidentService.updateIncidentStatus(projectId, incidentId, userId, body);

    sendResponse(res, StatusCodes.OK, "Incident status updated successfully", { incident: result });
  });

  getSimilarIncidents = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const incidentId = req.params.incidentId as string;

    const results = await incidentService.getSimilarPastIncidents(projectId, incidentId, userId);

    sendResponse(res, StatusCodes.OK, "Similar past incidents retrieved successfully", {
      similarIncidents: results,
      total: results.length,
    });
  });

  chatWithCopilot = CatchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "User authentication required");
    }

    const projectId = req.params.projectId as string;
    const incidentId = req.params.incidentId as string;
    const body = req.body as IncidentChatBody;

    const result = await incidentService.chatWithIncidentCopilot({
      projectId,
      incidentId,
      userId,
      message: body.message,
      history: body.history,
    });

    sendResponse(res, StatusCodes.OK, "RCA Copilot response generated successfully", result);
  });
}

export const incidentController = new IncidentController();
