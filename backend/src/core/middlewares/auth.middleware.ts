import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/db.js";
import ApiError from "../../shared/utils/ApiError.js";

/**
 * Middleware to authenticate requests using Clerk.
 * Verifies active session token and attaches local user record to req.user.
 */
export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized: Authentication required");
    }

    req.auth = auth;

    // Attach local database user record
    const user = await prisma.user.findUnique({
      where: { clerkUserId: auth.userId },
    });

    req.user = user ?? {
      id: "",
      clerkUserId: auth.userId,
      email: "",
      name: null,
    };

    next();
  } catch (error) {
    next(error);
  }
};
