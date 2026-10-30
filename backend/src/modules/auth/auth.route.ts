import { Router } from "express";

import { authMiddleware } from "../../core/middlewares/auth.middleware.js";
import { validateBody } from "../../core/middlewares/validateRequest.middleware.js";
import { clerkWebhook, getMe, syncProfile } from "./auth.controller.js";
import { syncUserSchema } from "./auth.validation.js";

const router = Router();

// Clerk Webhook endpoint for background user creation/update/deletion
router.post("/webhook", clerkWebhook);

// Protected user profile routes
router.get("/me", authMiddleware, getMe);
router.post("/sync", authMiddleware, validateBody(syncUserSchema), syncProfile);

export default router;
