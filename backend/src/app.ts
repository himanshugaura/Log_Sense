import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import { clerkMiddleware } from "@clerk/express";

import { env } from "./core/config/env.js";
import { errorMiddleware } from "./core/middlewares/error.middleware.js";
import { notFoundMiddleware } from "./core/middlewares/notFound.middleware.js";
import { requestLogger } from "./core/middlewares/requestLogger.js";
import apiRoutes from "./modules/index.route.js";

const app = express();

// Configure Helmet for secure headers while allowing cross-origin resource requests
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Production-ready CORS configuration
const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow wildcard or development mode
      if (allowedOrigins.includes("*") || env.NODE_ENV === "development") {
        return callback(null, true);
      }

      // Check exact match or wildcard subdomain (e.g. https://*.vercel.app)
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === origin) return true;
        if (allowed.includes("*")) {
          const regex = new RegExp(`^${allowed.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
          return regex.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Content-Disposition"],
    optionsSuccessStatus: 200,
  }),
);

// Parse JSON body and preserve rawBuffer for webhook signature verification (Svix/Clerk)
app.use(
  express.json({
    limit: "1mb",
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Attach Clerk auth state to req.auth (only validates when real Clerk keys are provided)
if (
  env.CLERK_PUBLISHABLE_KEY.startsWith("pk_") &&
  !env.CLERK_PUBLISHABLE_KEY.includes("placeholder")
) {
  app.use(
    clerkMiddleware({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    }),
  );
} else {
  app.use((req: Request, _res: Response, next) => {
    req.auth = { userId: null, sessionId: null };
    next();
  });
}

app.use(requestLogger);

app.get(["/", "/health"], (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: "LogSense Backend REST API is running",
    env: env.NODE_ENV,
  });
});

app.use("/api/v1", apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
