import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/db.js";
import ApiError from "../../shared/utils/ApiError.js";

/**
 * Middleware to authenticate requests using Clerk.
 * Verifies active session token and ensures local user record is resolved and attached to req.user.
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
    let user = await prisma.user.findUnique({
      where: { clerkUserId: auth.userId },
    });

    // Auto-sync if user is authenticated in Clerk but not yet present in PostgreSQL
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          `${auth.userId}@clerk.user`;
        const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
        const name = fullName.length > 0 ? fullName : (clerkUser.username ?? null);

        user = await prisma.user.upsert({
          where: { clerkUserId: auth.userId },
          create: {
            clerkUserId: auth.userId,
            email,
            name,
          },
          update: {},
        });
      } catch {
        // Fallback placeholder record to guarantee a valid database UUID foreign key
        user = await prisma.user.upsert({
          where: { clerkUserId: auth.userId },
          create: {
            clerkUserId: auth.userId,
            email: `${auth.userId}@clerk.user`,
            name: "User",
          },
          update: {},
        });
      }
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
