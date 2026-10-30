import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer | string;
      auth?: {
        userId: string | null;
        sessionId?: string | null;
        getToken?: () => Promise<string | null>;
        [key: string]: unknown;
      };
      user?: User | {
        id: string;
        clerkUserId: string;
        email: string;
        name: string | null;
      } | null;
      refreshToken?: string;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer | string;
    auth?: {
      userId: string | null;
      sessionId?: string | null;
      getToken?: () => Promise<string | null>;
      [key: string]: unknown;
    };
    user?: User | {
      id: string;
      clerkUserId: string;
      email: string;
      name: string | null;
    } | null;
    refreshToken?: string;
  }
}

export {};
