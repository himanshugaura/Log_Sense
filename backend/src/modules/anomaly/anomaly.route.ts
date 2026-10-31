import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import {
  validateParams,
  validateQuery,
} from "../../core/middlewares/validateRequest.middleware.js";
import { anomalyController } from "./anomaly.controller.js";
import {
  anomalyIdParamSchema,
  listAnomaliesQuerySchema,
  projectIdParamSchema,
} from "./anomaly.validation.js";

const router = Router();

router.use(authMiddleware);

// GET /api/v1/anomalies/:projectId
router.get(
  "/:projectId",
  validateParams(projectIdParamSchema),
  validateQuery(listAnomaliesQuerySchema),
  anomalyController.getAnomalies,
);

// GET /api/v1/anomalies/:projectId/:anomalyId
router.get(
  "/:projectId/:anomalyId",
  validateParams(anomalyIdParamSchema),
  anomalyController.getAnomalyById,
);

export default router;
