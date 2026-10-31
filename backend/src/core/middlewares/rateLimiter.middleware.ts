import type { Request, Response, NextFunction } from "express";

/**
 * Rate limiting disabled per user request.
 * Passthrough middleware to maintain interface compatibility.
 */
export const globalRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();
export const authRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();
