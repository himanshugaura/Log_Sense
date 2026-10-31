import { Router } from "express";

import authRoutes from "./auth/auth.route.js";
import anomalyRoutes from "./anomaly/anomaly.route.js";
import incidentRoutes from "./incident/incident.route.js";
import logRoutes from "./log/log.route.js";
import organizationRoutes from "./organization/organization.route.js";
import projectRoutes from "./project/project.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/projects", projectRoutes);
router.use("/logs", logRoutes);
router.use("/anomalies", anomalyRoutes);
router.use("/incidents", incidentRoutes);

export default router;
