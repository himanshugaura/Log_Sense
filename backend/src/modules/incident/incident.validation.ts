import { z } from "zod";

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

export const incidentIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  incidentId: z.string().uuid("Invalid incident ID format"),
});

export const listIncidentsQuerySchema = z.object({
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]),
});

export const incidentChatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;
export type UpdateIncidentStatusBody = z.infer<typeof updateIncidentStatusSchema>;
export type IncidentChatBody = z.infer<typeof incidentChatSchema>;
