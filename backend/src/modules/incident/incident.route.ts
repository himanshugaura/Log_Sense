import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../core/middlewares/validateRequest.middleware.js";
import { incidentController } from "./incident.controller.js";
import {
  incidentIdParamSchema,
  listIncidentsQuerySchema,
  projectIdParamSchema,
  updateIncidentStatusSchema,
} from "./incident.validation.js";

const router = Router();

router.use(authMiddleware);

// GET /api/v1/incidents/:projectId
router.get(
  "/:projectId",
  validateParams(projectIdParamSchema),
  validateQuery(listIncidentsQuerySchema),
  incidentController.getIncidents,
);

// GET /api/v1/incidents/:projectId/:incidentId
router.get(
  "/:projectId/:incidentId",
  validateParams(incidentIdParamSchema),
  incidentController.getIncidentById,
);

// PATCH /api/v1/incidents/:projectId/:incidentId/status
router.patch(
  "/:projectId/:incidentId/status",
  validateParams(incidentIdParamSchema),
  validateBody(updateIncidentStatusSchema),
  incidentController.updateIncidentStatus,
);

export default router;
