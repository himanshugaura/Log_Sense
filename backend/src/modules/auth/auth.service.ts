import { StatusCodes } from "http-status-codes";

import { prisma } from "../../core/config/db.js";
import { logger } from "../../core/config/logger.js";
import ApiError from "../../shared/utils/ApiError.js";
import {
  type ClerkWebhookEvent,
  type SyncUserInput,
  clerkUserDataSchema,
} from "./auth.validation.js";

export class AuthService {
  /**
   * Processes verified Clerk webhook events to keep local database in sync
   */
  async handleClerkWebhook(event: ClerkWebhookEvent) {
    const { type, data } = event;
    logger.info(`Processing Clerk webhook event: ${type}`);

    switch (type) {
      case "user.created":
      case "user.updated": {
        const parsedData = clerkUserDataSchema.safeParse(data);
        if (!parsedData.success) {
          logger.warn("Received Clerk user payload missing required fields", {
            errors: parsedData.error.flatten(),
          });
          return { processed: false, reason: "Invalid user payload" };
        }

        const { id: clerkUserId, first_name, last_name, username, email_addresses, primary_email_address_id } =
          parsedData.data;

        const primaryEmailObj =
          email_addresses.find((item) => item.id === primary_email_address_id) ??
          email_addresses[0];

        if (!primaryEmailObj?.email_address) {
          logger.warn(`Clerk user ${clerkUserId} has no email address`);
          return { processed: false, reason: "No email address found" };
        }

        const email = primaryEmailObj.email_address.toLowerCase().trim();
        const fullName = [first_name, last_name].filter(Boolean).join(" ").trim();
        const name = fullName.length > 0 ? fullName : (username ?? null);

        const user = await prisma.user.upsert({
          where: { clerkUserId },
          update: {
            email,
            name,
          },
          create: {
            clerkUserId,
            email,
            name,
          },
        });

        logger.info(`Successfully synced user ${user.id} (${clerkUserId}) from Clerk webhook event: ${type}`);
        return { processed: true, userId: user.id, clerkUserId };
      }

      case "user.deleted": {
        const clerkUserId = data.id as string | undefined;
        if (!clerkUserId) {
          return { processed: false, reason: "Missing Clerk User ID" };
        }

        await prisma.user.deleteMany({
          where: { clerkUserId },
        });

        logger.info(`Deleted user with Clerk ID ${clerkUserId} from database`);
        return { processed: true, clerkUserId };
      }

      default:
        logger.debug(`Ignored unhandled Clerk webhook event: ${type}`);
        return { processed: true, ignored: true, event: type };
    }
  }

  /**
   * Retrieves user profile and owned organizations by Clerk User ID
   */
  async getCurrentUser(clerkUserId: string) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        ownedOrganizations: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User profile not found. Please sync your account.");
    }

    return user;
  }

  /**
   * Fallback user sync endpoint (e.g. called from frontend when user first logs in)
   */
  async syncUser(clerkUserId: string, input: SyncUserInput) {
    const email = input.email.toLowerCase().trim();
    const name = input.name?.trim() || null;

    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: {
        email,
        ...(name ? { name } : {}),
      },
      create: {
        clerkUserId,
        email,
        name,
      },
      include: {
        ownedOrganizations: true,
      },
    });

    return user;
  }
}

export const authService = new AuthService();
