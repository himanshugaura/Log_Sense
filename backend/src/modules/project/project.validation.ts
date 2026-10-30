import { z } from "zod";

export const createProjectSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID format"),
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(100, "Project name cannot exceed 100 characters"),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  timezone: z.string().trim().default("UTC"),
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters")
    .max(100, "Project name cannot exceed 100 characters")
    .optional(),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  timezone: z.string().trim().optional(),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid("Invalid project ID format"),
});

export const listProjectsQuerySchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID format").optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
