import { z } from "zod";

export const clerkWebhookHeadersSchema = z.object({
  "svix-id": z.string().min(1, "svix-id header is required"),
  "svix-timestamp": z.string().min(1, "svix-timestamp header is required"),
  "svix-signature": z.string().min(1, "svix-signature header is required"),
});

export const clerkUserDataSchema = z.object({
  id: z.string().min(1, "Clerk User ID is required"),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  email_addresses: z
    .array(
      z.object({
        id: z.string(),
        email_address: z.string().email(),
      }),
    )
    .default([]),
  primary_email_address_id: z.string().nullable().optional(),
});

export const clerkWebhookEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const syncUserSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().trim().optional().nullable(),
});

export type ClerkWebhookHeaders = z.infer<typeof clerkWebhookHeadersSchema>;
export type ClerkUserData = z.infer<typeof clerkUserDataSchema>;
export type ClerkWebhookEvent = z.infer<typeof clerkWebhookEventSchema>;
export type SyncUserInput = z.infer<typeof syncUserSchema>;
