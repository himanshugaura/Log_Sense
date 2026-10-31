"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusDotState = "good" | "critical" | "warning" | "monitoring" | "unknown";

interface StatusDotProps {
  state: StatusDotState | string;
  className?: string;
  pulse?: boolean;
}

export function StatusDot({ state, className, pulse = false }: StatusDotProps) {
  const normalizedState: StatusDotState =
    state === "OPEN" || state === "CRITICAL"
      ? "critical"
      : state === "INVESTIGATING" || state === "HIGH" || state === "MEDIUM" || state === "warning"
      ? "warning"
      : state === "RESOLVED" || state === "COMPLETED" || state === "good"
      ? "good"
      : state === "PENDING" || state === "IN_PROGRESS" || state === "monitoring"
      ? "monitoring"
      : "unknown";

  const colorMap: Record<StatusDotState, string> = {
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
    monitoring: "bg-zinc-400",
    unknown: "bg-zinc-600",
  };

  return (
    <span className={cn("relative inline-flex items-center justify-center shrink-0", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute w-2.5 h-2.5 rounded-full opacity-75 animate-ping",
            colorMap[normalizedState]
          )}
        />
      )}
      <span className={cn("w-2 h-2 rounded-full", colorMap[normalizedState])} />
    </span>
  );
}
