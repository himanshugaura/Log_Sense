import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

export const anomalyIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  anomalyId: z.string().uuid("Invalid anomaly ID format"),
});

export const listAnomaliesQuerySchema = z.object({
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["RECORD", "MONITOR", "ESCALATE", "ACTIVE", "RESOLVED"]).optional(),
  anomalyType: z.enum(["SPIKE", "NEW_PATTERN"]).optional(),
  clusterId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAnomaliesQuery = z.infer<typeof listAnomaliesQuerySchema>;
