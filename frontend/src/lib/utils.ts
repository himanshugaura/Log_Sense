import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "unknown";
  const date = typeof dateInput === "number" 
    ? (dateInput < 10000000000 ? new Date(dateInput * 1000) : new Date(dateInput))
    : new Date(dateInput);
  
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return "—";
  return id.length > len ? `${id.slice(0, len)}` : id;
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}
