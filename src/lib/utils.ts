import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as originalFormat, formatDistanceToNow as originalFormatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormat(dateInput: any, formatStr: string, fallback = "—"): string {
  if (!dateInput) return fallback;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return fallback;
  try {
    return originalFormat(d, formatStr);
  } catch {
    return fallback;
  }
}

export function safeFormatDistanceToNow(dateInput: any, options?: any, fallback = "—"): string {
  if (!dateInput) return fallback;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return fallback;
  try {
    return originalFormatDistanceToNow(d, options);
  } catch {
    return fallback;
  }
}

