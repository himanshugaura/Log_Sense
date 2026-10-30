import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Webhook } from "svix";

import { env } from "../../core/config/env.js";
import { logger } from "../../core/config/logger.js";
import ApiError from "../../shared/utils/ApiError.js";
import sendResponse from "../../shared/utils/ApiResponse.js";
import CatchAsync from "../../shared/utils/CatchAsync.js";
import { authService } from "./auth.service.js";
import {
  type ClerkWebhookEvent,
  clerkWebhookEventSchema,
  clerkWebhookHeadersSchema,
} from "./auth.validation.js";

/**
 * Handles Clerk Webhooks for automatic user profile synchronization
 */
export const clerkWebhook = CatchAsync(async (req: Request, res: Response) => {
  const secret = env.CLERK_WEBHOOK_SECRET;

  if (!secret || secret === "whsec_placeholder") {
    logger.error("CLERK_WEBHOOK_SECRET is not configured in environment variables");
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Webhook secret not configured on server");
  }

  // Validate Svix verification headers
  const headerValidation = clerkWebhookHeadersSchema.safeParse({
    "svix-id": req.headers["svix-id"],
    "svix-timestamp": req.headers["svix-timestamp"],
    "svix-signature": req.headers["svix-signature"],
  });

  if (!headerValidation.success) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Missing or invalid Svix verification headers", [
      headerValidation.error.flatten(),
    ]);
  }

  const { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature } =
    headerValidation.data;

  // Retrieve raw request body for accurate cryptographic signature check
  const rawPayload = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);

  const wh = new Webhook(secret);
  let verifiedPayload: unknown;

  try {
    verifiedPayload = wh.verify(rawPayload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (error) {
    logger.warn("Clerk webhook signature verification failed", { error });
    throw new ApiError(StatusCodes.BAD_REQUEST, "Webhook signature verification failed");
  }

  const parsedEvent = clerkWebhookEventSchema.safeParse(verifiedPayload);
  if (!parsedEvent.success) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid webhook event format", [
      parsedEvent.error.flatten(),
    ]);
  }

  const result = await authService.handleClerkWebhook(parsedEvent.data as ClerkWebhookEvent);

  sendResponse(res, StatusCodes.OK, "Webhook processed successfully", result);
});

/**
 * Returns current authenticated user profile and their organizations
 */
export const getMe = CatchAsync(async (req: Request, res: Response) => {
  const clerkUserId = req.auth?.userId || req.user?.clerkUserId;

  if (!clerkUserId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized: Authentication required");
  }

  const user = await authService.getCurrentUser(clerkUserId);
  sendResponse(res, StatusCodes.OK, "User profile retrieved successfully", { user });
});

/**
 * Manually synchronizes current authenticated user profile
 */
export const syncProfile = CatchAsync(async (req: Request, res: Response) => {
  const clerkUserId = req.auth?.userId || req.user?.clerkUserId;

  if (!clerkUserId) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized: Authentication required");
  }

  const user = await authService.syncUser(clerkUserId, req.body);
  sendResponse(res, StatusCodes.OK, "User profile synchronized successfully", { user });
});
