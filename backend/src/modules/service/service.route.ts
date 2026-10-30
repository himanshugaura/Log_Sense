import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../core/middlewares/validateRequest.middleware.js";
import {
  createDependency,
  createService,
  deleteDependency,
  deleteService,
  getDependencyGraph,
  getServiceById,
  getServices,
  updateService,
} from "./service.controller.js";
import {
  createDependencySchema,
  createServiceSchema,
  dependencyIdParamSchema,
  graphParamSchema,
  listServicesQuerySchema,
  serviceIdParamSchema,
  updateServiceSchema,
} from "./service.validation.js";

const router = Router();

// All service operations require authenticated session
router.use(authMiddleware);

// Services CRUD
router.post("/", validateBody(createServiceSchema), createService);
router.get("/", validateQuery(listServicesQuerySchema), getServices);
router.get("/graph/:projectId", validateParams(graphParamSchema), getDependencyGraph);
router.get("/:id", validateParams(serviceIdParamSchema), getServiceById);
router.patch(
  "/:id",
  validateParams(serviceIdParamSchema),
  validateBody(updateServiceSchema),
  updateService,
);
router.delete("/:id", validateParams(serviceIdParamSchema), deleteService);

// Dependencies Management
router.post("/dependencies", validateBody(createDependencySchema), createDependency);
router.delete(
  "/dependencies/:id",
  validateParams(dependencyIdParamSchema),
  deleteDependency,
);

export default router;
