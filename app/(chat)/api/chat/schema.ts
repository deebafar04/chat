import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.string(), // Accept any MIME type
  name: z.string().min(1).max(255),
  url: z.string().url(),
  storagePath: z.string().optional(), // Optional storage path for deletion
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.string().min(1),
  selectedVisibilityType: z.enum(["public", "private"]),
  thinkingEnabled: z.boolean().optional().default(false),
  selectedRepos: z.array(z.string()).optional().default([]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
