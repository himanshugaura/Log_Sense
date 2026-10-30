import { z } from "zod";

export const createServiceSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  name: z
    .string()
    .trim()
    .min(2, "Service name must be at least 2 characters")
    .max(100, "Service name cannot exceed 100 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Service name can only contain alphanumeric characters, underscores, and hyphens (e.g., auth-service)",
    ),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
});

export const updateServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Service name must be at least 2 characters")
    .max(100, "Service name cannot exceed 100 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Service name can only contain alphanumeric characters, underscores, and hyphens",
    )
    .optional(),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
});

export const serviceIdParamSchema = z.object({
  id: z.string().uuid("Invalid service ID format"),
});

export const listServicesQuerySchema = z.object({
  projectId: z.string().uuid("Project ID is required in query params"),
});

export const createDependencySchema = z
  .object({
    sourceServiceId: z.string().uuid("Invalid source service ID format"),
    targetServiceId: z.string().uuid("Invalid target service ID format"),
    dependencyType: z
      .enum(["HTTP", "GRPC", "DATABASE", "MESSAGE_QUEUE", "CACHE", "OTHER"])
      .or(z.string().min(1, "Dependency type is required")),
    isRequired: z.boolean().default(true),
  })
  .refine((data) => data.sourceServiceId !== data.targetServiceId, {
    message: "A service cannot declare a dependency on itself",
    path: ["targetServiceId"],
  });

export const dependencyIdParamSchema = z.object({
  id: z.string().uuid("Invalid dependency ID format"),
});

export const graphParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
