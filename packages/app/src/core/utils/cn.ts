/**
 * @overview Tailwind Class Union Utility
 *
 * Combines clsx and tailwind-merge to handle conditional classes and merge conflicts.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
