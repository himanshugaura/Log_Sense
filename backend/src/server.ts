import app from "./app.js";
import { connectDB, disconnectDB } from "./core/config/db.js";
import { env } from "./core/config/env.js";
import { logger } from "./core/config/logger.js";

const startServer = async (): Promise<void> => {
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
  });

  const handleShutdown = async (signal: string) => {
    logger.info(`${signal} received: closing HTTP server and database connection...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void handleShutdown("SIGINT"));
  process.on("SIGTERM", () => void handleShutdown("SIGTERM"));
};

startServer().catch((error: unknown) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
