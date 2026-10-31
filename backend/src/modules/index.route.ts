import { Router } from "express";

import authRoutes from "./auth/auth.route.js";
import logRoutes from "./log/log.route.js";
import organizationRoutes from "./organization/organization.route.js";
import projectRoutes from "./project/project.route.js";
import serviceRoutes from "./service/service.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/projects", projectRoutes);
router.use("/services", serviceRoutes);
router.use("/logs", logRoutes);

export default router;
