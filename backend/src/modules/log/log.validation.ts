import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

export const sourceIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  sourceId: z.string().uuid("Invalid log source ID format"),
});

export const clusterIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clusterId: z.string().uuid("Invalid cluster ID format"),
});

export const uploadLogBodySchema = z.object({
  serviceName: z.string().optional().nullable(),
  sourceType: z
    .enum(["FILE_UPLOAD", "FILE", "API", "OTEL"])
    .transform((val) => (val === "FILE" ? "FILE_UPLOAD" : val))
    .default("FILE_UPLOAD")
    .optional(),
});

export const listLogSourcesQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listLogClustersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listLogEntriesQuerySchema = z.object({
  sourceId: z.string().uuid("Invalid log source ID format").optional(),
  clusterId: z.string().uuid("Invalid cluster ID format").optional(),
  level: z.string().optional(),
  search: z.string().optional(),
  serviceName: z.string().optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listProcessingJobsQuerySchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UploadLogBody = z.infer<typeof uploadLogBodySchema>;
export type GetLogSourcesQuery = z.infer<typeof listLogSourcesQuerySchema>;
export type GetLogClustersQuery = z.infer<typeof listLogClustersQuerySchema>;
export type GetLogEntriesQuery = z.infer<typeof listLogEntriesQuerySchema>;
export type GetProcessingJobsQuery = z.infer<typeof listProcessingJobsQuerySchema>;
