import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import { uploadLogMiddleware } from "../../core/middlewares/upload.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../core/middlewares/validateRequest.middleware.js";
import { logController } from "./log.controller.js";
import {
  clusterIdParamSchema,
  listLogClustersQuerySchema,
  listLogEntriesQuerySchema,
  listLogSourcesQuerySchema,
  listProcessingJobsQuerySchema,
  projectIdParamSchema,
  sourceIdParamSchema,
  uploadLogBodySchema,
} from "./log.validation.js";

const router = Router();

// All log operations require an authenticated session
router.use(authMiddleware);

// --- Multipart Upload ---
// POST /api/v1/logs/:projectId/upload OR /api/v1/logs/projects/:projectId/upload
router.post(
  ["/:projectId/upload", "/projects/:projectId/upload"],
  uploadLogMiddleware.single("file"),
  validateParams(projectIdParamSchema),
  validateBody(uploadLogBodySchema),
  logController.uploadLog,
);

// --- Cluster Explorer / Drain3 Templates ---
// GET /api/v1/logs/:projectId/clusters OR /api/v1/logs/projects/:projectId/clusters
router.get(
  ["/:projectId/clusters", "/projects/:projectId/clusters"],
  validateParams(projectIdParamSchema),
  validateQuery(listLogClustersQuerySchema),
  logController.getLogClusters,
);

// GET /api/v1/logs/:projectId/clusters/:clusterId OR /api/v1/logs/projects/:projectId/clusters/:clusterId
router.get(
  ["/:projectId/clusters/:clusterId", "/projects/:projectId/clusters/:clusterId"],
  validateParams(clusterIdParamSchema),
  logController.getLogClusterById,
);

// --- Log Explorer / Structured Entries ---
// GET /api/v1/logs/:projectId/entries OR /api/v1/logs/projects/:projectId/entries
router.get(
  ["/:projectId/entries", "/projects/:projectId/entries"],
  validateParams(projectIdParamSchema),
  validateQuery(listLogEntriesQuerySchema),
  logController.getLogEntries,
);

// --- Log Sources / Upload Records ---
// GET /api/v1/logs/:projectId/sources OR /api/v1/logs/projects/:projectId/sources
router.get(
  ["/:projectId/sources", "/projects/:projectId/sources"],
  validateParams(projectIdParamSchema),
  validateQuery(listLogSourcesQuerySchema),
  logController.getLogSources,
);

// GET /api/v1/logs/:projectId/sources/:sourceId OR /api/v1/logs/projects/:projectId/sources/:sourceId
router.get(
  ["/:projectId/sources/:sourceId", "/projects/:projectId/sources/:sourceId"],
  validateParams(sourceIdParamSchema),
  logController.getLogSourceById,
);

// DELETE /api/v1/logs/:projectId/sources/:sourceId OR /api/v1/logs/projects/:projectId/sources/:sourceId
router.delete(
  ["/:projectId/sources/:sourceId", "/projects/:projectId/sources/:sourceId"],
  validateParams(sourceIdParamSchema),
  logController.deleteLogSource,
);

// --- Ingestion & Processing Jobs ---
// GET /api/v1/logs/:projectId/jobs/:jobId OR /api/v1/logs/projects/:projectId/jobs/:jobId
router.get(
  ["/:projectId/jobs/:jobId", "/projects/:projectId/jobs/:jobId"],
  validateParams(projectIdParamSchema),
  logController.getProcessingJobById,
);

// GET /api/v1/logs/:projectId/jobs OR /api/v1/logs/projects/:projectId/jobs
router.get(
  ["/:projectId/jobs", "/projects/:projectId/jobs"],
  validateParams(projectIdParamSchema),
  validateQuery(listProcessingJobsQuerySchema),
  logController.getProcessingJobs,
);

export default router;
