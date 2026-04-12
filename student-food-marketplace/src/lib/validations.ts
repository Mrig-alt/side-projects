import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const onboardingSchema = z.object({
  whatsappNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  upiId: z
    .string()
    .min(3, "UPI ID too short")
    .max(100)
    .optional()
    .or(z.literal("")),
});

export const createSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
});

export const createListingSchema = z.object({
  slotId: z.string().uuid(),
  dishName: z.string().min(2).max(100),
  description: z.string().max(500).optional().or(z.literal("")),
  cuisineType: z.enum([
    "north_indian",
    "south_indian",
    "east_indian",
    "west_indian",
    "street_food",
    "chinese",
    "dessert",
    "beverages",
    "other",
  ]),
  isVeg: z.boolean(),
  pricePerPortion: z.number().int().min(1).max(9999),
  totalQuantity: z.number().int().min(1).max(100),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

export const reserveSchema = z.object({
  listingId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
});

export const patchOrderSchema = z.object({
  status: z.enum(["accepted", "rejected", "ready", "picked_up", "cancelled"]),
});
