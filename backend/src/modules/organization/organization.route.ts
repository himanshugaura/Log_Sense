import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import { validateBody, validateParams } from "../../core/middlewares/validateRequest.middleware.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  getOrganizations,
  updateOrganization,
} from "./organization.controller.js";
import {
  createOrganizationSchema,
  organizationIdParamSchema,
  updateOrganizationSchema,
} from "./organization.validation.js";

const router = Router();

// All organization operations require authenticated session
router.use(authMiddleware);

router.post("/", validateBody(createOrganizationSchema), createOrganization);
router.get("/", getOrganizations);
router.get("/:id", validateParams(organizationIdParamSchema), getOrganizationById);
router.patch(
  "/:id",
  validateParams(organizationIdParamSchema),
  validateBody(updateOrganizationSchema),
  updateOrganization,
);
router.delete("/:id", validateParams(organizationIdParamSchema), deleteOrganization);

export default router;
