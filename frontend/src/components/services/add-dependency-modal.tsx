"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Network, AlertCircle, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  outgoingDependencies?: Array<{ id: string; targetServiceId: string; dependencyType: string; isRequired: boolean }>;
  incomingDependencies?: Array<{ id: string; sourceServiceId: string; dependencyType: string; isRequired: boolean }>;
}

interface AddDependencyModalProps {
  projectId: string;
  sourceService: ServiceItem | null;
  services: ServiceItem[];
  isOpen: boolean;
  onClose: () => void;
}

const DEPENDENCY_TYPES = [
  { value: "HTTP", label: "HTTP / REST API" },
  { value: "DATABASE", label: "Database Connection (SQL / NoSQL)" },
  { value: "GRPC", label: "gRPC RPC Protocol" },
  { value: "MESSAGE_QUEUE", label: "Message Broker (Kafka / RabbitMQ / SQS)" },
  { value: "CACHE", label: "In-Memory Cache (Redis / Memcached)" },
  { value: "OTHER", label: "Other Protocol" },
];

export function AddDependencyModal({
  projectId,
  sourceService,
  services,
  isOpen,
  onClose,
}: AddDependencyModalProps) {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState(sourceService?.id || "");
  const [targetId, setTargetId] = useState("");
  const [dependencyType, setDependencyType] = useState("HTTP");
  const [isRequired, setIsRequired] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync sourceId if sourceService prop changes
  const effectiveSourceId = sourceService?.id || sourceId;

  const availableTargets = services.filter((s) => s.id !== effectiveSourceId);

  const addDependencyMutation = useMutation({
    mutationFn: async (payload: {
      sourceServiceId: string;
      targetServiceId: string;
      dependencyType: string;
      isRequired: boolean;
    }) => {
      setErrorMessage(null);
      const res = await apiClient.post("/services/dependencies", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", projectId] });
      queryClient.invalidateQueries({ queryKey: ["services-graph", projectId] });
      setTargetId("");
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to create dependency connection";
      setErrorMessage(msg);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveSourceId || !targetId) {
      setErrorMessage("Please select both a caller service and a target dependency");
      return;
    }

    addDependencyMutation.mutate({
      sourceServiceId: effectiveSourceId,
      targetServiceId: targetId,
      dependencyType,
      isRequired,
    });
  };

  const currentSourceObj = services.find((s) => s.id === effectiveSourceId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e0e11] border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100">
                Connect Service Dependency
              </h3>
              <p className="text-xs text-zinc-400">
                Maps directed edges in the architecture DAG for Root Cause Analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Direction Preview */}
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
            <div className="truncate">
              <span className="text-zinc-500 block text-[10px] uppercase font-sans">
                Caller Service (Source)
              </span>
              <span className="text-zinc-200 font-semibold">
                {currentSourceObj?.name || "Select source"}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0 mx-2" />
            <div className="truncate text-right">
              <span className="text-zinc-500 block text-[10px] uppercase font-sans">
                Dependency (Target)
              </span>
              <span className="text-zinc-200 font-semibold">
                {services.find((s) => s.id === targetId)?.name || "Select target"}
              </span>
            </div>
          </div>

          {/* Source Selection (if not fixed) */}
          {!sourceService && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Caller Service (Source)
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Select source service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Service Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Target Dependency
            </label>
            <select
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              <option value="">Select target service...</option>
              {availableTargets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dependency Type Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Communication Protocol / Type
            </label>
            <select
              value={dependencyType}
              onChange={(e) => setDependencyType(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              {DEPENDENCY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Is Required Switch / Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-0"
            />
            <div className="text-xs">
              <span className="font-medium text-zinc-200 block">
                Required Dependency (Hard Dependency)
              </span>
              <span className="text-[11px] text-zinc-500 block mt-0.5">
                If checked, failure in the target service will be factored as a critical failure trigger for the caller service during RCA.
              </span>
            </div>
          </label>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!targetId || addDependencyMutation.isPending}
              className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-semibold text-xs transition-colors shadow-sm"
            >
              {addDependencyMutation.isPending ? "Connecting..." : "Add Dependency Edge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
