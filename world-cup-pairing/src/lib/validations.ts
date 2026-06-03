import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  // Accept empty string OR a proper nationality string (min 2 chars)
  nationality: z
    .string()
    .max(100)
    .optional()
    .transform((v) => (v && v.trim().length >= 2 ? v.trim() : undefined)),
  teamId: z.string().uuid("Invalid team").optional(),
  isHonoraryFan: z.boolean().optional(),
  visibility: z.enum(["public", "friends", "stealth"]).default("public"),
  pin: z.string().min(1, "Class PIN is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  pin: z.string().min(1, "PIN is required"),
});

export const updateStudentSchema = z.object({
  teamId: z.string().uuid().optional().nullable(),
  isHonoraryFan: z.boolean().optional(),
  visibility: z.enum(["public", "friends", "stealth"]).optional(),
});

export const predictionSchema = z.object({
  matchId: z.string().uuid(),
  predictedScore1: z.number().int().min(0).max(20),
  predictedScore2: z.number().int().min(0).max(20),
});

export const reactionSchema = z.object({
  matchId: z.string().uuid(),
  emoji: z.string().min(1).max(10),
  matchMinute: z.number().int().min(1).max(120).optional(),
});

export const vibeSchema = z.object({
  matchId: z.string().uuid(),
  vibe: z.enum(["intense", "boring", "heartbreaking"]),
});

export const watchTogetherSchema = z.object({
  matchId: z.string().uuid(),
  locationName: z.string().min(1).max(200),
  locationUrl: z
    .string()
    .url("Must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
});

export const connectionSchema = z.object({
  requesteeId: z.string().uuid(),
});
