import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a student's first name to ensure proper spacing before parentheses.
 * Fixes cases like "Yuhui(Kitty)" to "Yuhui (Kitty)"
 */
export function normalizeStudentFirstName(firstName: string): string {
  if (!firstName) return firstName;
  // Add space before opening parenthesis if missing
  return firstName.replace(/([^\s])\(/g, '$1 (');
}

/**
 * Formats a student's full name with proper spacing.
 * Ensures parentheses in first names have proper spacing.
 */
export function formatStudentName(firstName: string, lastName: string): string {
  const normalizedFirstName = normalizeStudentFirstName(firstName);
  return `${normalizedFirstName} ${lastName}`.trim();
}
