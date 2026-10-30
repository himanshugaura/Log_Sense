import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../core/middlewares/validateRequest.middleware.js";
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject,
} from "./project.controller.js";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  updateProjectSchema,
} from "./project.validation.js";

const router = Router();

// All project operations require authenticated session
router.use(authMiddleware);

router.post("/", validateBody(createProjectSchema), createProject);
router.get("/", validateQuery(listProjectsQuerySchema), getProjects);
router.get("/:id", validateParams(projectIdParamSchema), getProjectById);
router.patch(
  "/:id",
  validateParams(projectIdParamSchema),
  validateBody(updateProjectSchema),
  updateProject,
);
router.delete("/:id", validateParams(projectIdParamSchema), deleteProject);

export default router;
