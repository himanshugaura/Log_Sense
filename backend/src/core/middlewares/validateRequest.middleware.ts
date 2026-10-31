import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

const validatePart = (part: "body" | "params" | "query", input: ZodTypeAny) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await input.parseAsync(req[part]);

      if (part === "query") {
        req.query = parsed as any;
      } else if (part === "params") {
        req.params = parsed as Request["params"];
      } else {
        req.body = parsed;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = (input: ZodTypeAny) => validatePart("body", input);
export const validateParams = (input: ZodTypeAny) => validatePart("params", input);
export const validateQuery = (input: ZodTypeAny) => validatePart("query", input);