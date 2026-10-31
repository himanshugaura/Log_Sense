"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MeterProps {
  value: number; // 0.0 to 1.0 or 0 to 100
  label?: string;
  showPercentage?: boolean;
  className?: string;
  variant?: "default" | "subtle" | "amber" | "emerald";
}

export function Meter({
  value,
  label,
  showPercentage = true,
  className,
  variant = "default",
}: MeterProps) {
  // Normalize value between 0 and 100
  const normalizedValue = value <= 1.0 && value >= 0 ? value * 100 : value;
  const pct = Math.round(Math.max(0, Math.min(100, normalizedValue)));

  const fillVariants = {
    default: "bg-zinc-200",
    subtle: "bg-zinc-400",
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
  };

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {label && <span className="text-[11px] font-mono text-zinc-400 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/40 min-w-[60px]">
        <div
          className={cn("h-full transition-all duration-300 rounded-full", fillVariants[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-[11px] font-mono tabular-nums text-zinc-300 w-8 text-right shrink-0">
          {pct}%
        </span>
      )}
    </div>
  );
}
