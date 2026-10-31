"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "critical"
    | "warning"
    | "success"
    | "info"
    | "outline"
    | "mono";
  size?: "sm" | "md";
}

export function Badge({
  children,
  className,
  variant = "default",
  size = "sm",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700/60",
    critical: "bg-rose-950/40 text-rose-300 border-rose-800/60",
    warning: "bg-amber-950/40 text-amber-300 border-amber-800/60",
    success: "bg-emerald-950/40 text-emerald-300 border-emerald-800/60",
    info: "bg-zinc-800/90 text-zinc-200 border-zinc-700",
    outline: "bg-transparent text-zinc-400 border-zinc-800",
    mono: "font-mono bg-zinc-900 text-zinc-400 border-zinc-800",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded font-medium border select-none transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toUpperCase();
  if (s === "CRITICAL") {
    return <Badge variant="critical">CRITICAL</Badge>;
  }
  if (s === "HIGH") {
    return <Badge variant="warning">HIGH</Badge>;
  }
  if (s === "MEDIUM") {
    return <Badge variant="warning">MEDIUM</Badge>;
  }
  return <Badge variant="default">{s || "LOW"}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === "OPEN") {
    return <Badge variant="critical">OPEN</Badge>;
  }
  if (s === "INVESTIGATING") {
    return <Badge variant="warning">INVESTIGATING</Badge>;
  }
  if (s === "RESOLVED") {
    return <Badge variant="success">RESOLVED</Badge>;
  }
  return <Badge variant="default">{s || "UNKNOWN"}</Badge>;
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400",
        className
      )}
    >
      {children}
    </span>
  );
}
