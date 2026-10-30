import { PrismaClient } from "@prisma/client";

import { env } from "./env.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected via Prisma");
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL database", { error });
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info("PostgreSQL connection closed");
};
