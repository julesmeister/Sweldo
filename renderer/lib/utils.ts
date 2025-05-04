import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Safely retrieves an item from localStorage.
 * Returns null if localStorage is not available or an error occurs.
 */
export function safeLocalStorageGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  } catch (e) {
    console.error(`Error getting item ${key} from localStorage:`, e);
    return null;
  }
}

/**
 * Safely sets an item in localStorage.
 * Does nothing if localStorage is not available or an error occurs.
 */
export function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    console.error(`Error setting item ${key} in localStorage:`, e);
  }
}
