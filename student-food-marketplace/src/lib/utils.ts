import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = "Asia/Kolkata";

export function formatPrice(amount: number): string {
  return `₹${amount}`;
}

/** Format a DB date string (YYYY-MM-DD) for display */
export function formatSlotDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, d MMM");
}

/** Format a DB time string (HH:mm:ss) for display in IST */
export function formatTime(timeStr: string): string {
  // timeStr comes from postgres as "HH:mm:ss"
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  const zoned = toZonedTime(d, IST);
  return format(zoned, "h:mm a");
}

/** Format pickup window, e.g. "12:00–2:00 PM" */
export function formatPickupWindow(startTime: string, endTime: string): string {
  return `${formatTime(startTime)}–${formatTime(endTime)}`;
}

export function buildWhatsAppUrl(phone: string, dishName: string, qty: number, date: string): string {
  const message = `Hi! I've reserved ${qty} portion${qty > 1 ? "s" : ""} of ${dishName} for ${formatSlotDate(date)}. See you at the cafeteria!`;
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("91") ? digits : `91${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export const CUISINE_LABELS: Record<string, string> = {
  north_indian: "North Indian",
  south_indian: "South Indian",
  east_indian: "East Indian",
  west_indian: "West Indian",
  street_food: "Street Food",
  chinese: "Chinese",
  dessert: "Dessert",
  beverages: "Beverages",
  other: "Other",
};
