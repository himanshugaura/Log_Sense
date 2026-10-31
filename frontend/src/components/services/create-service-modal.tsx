"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Cpu, AlertCircle, Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface CreateServiceModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATE_SUGGESTIONS = [
  "api-gateway",
  "auth-service",
  "payment-service",
  "order-service",
  "inventory-service",
  "database-service",
  "notification-service",
];

export function CreateServiceModal({
  projectId,
  isOpen,
  onClose,
}: CreateServiceModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: {
      projectId: string;
      name: string;
      description?: string;
    }) => {
      setErrorMessage(null);
      const res = await apiClient.post("/services", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", projectId] });
      queryClient.invalidateQueries({ queryKey: ["services-graph", projectId] });
      setName("");
      setDescription("");
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to register service";
      setErrorMessage(msg);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      setErrorMessage(
        "Service name can only contain letters, numbers, hyphens, and underscores (e.g. payment-service)",
      );
      return;
    }

    createMutation.mutate({
      projectId,
      name: cleanName,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e0e11] border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100">
                Register Microservice
              </h3>
              <p className="text-xs text-zinc-400">
                Define a service component for anomaly detection & RCA
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
          {/* Service Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
              <span>Service Identifier</span>
              <span className="text-[11px] text-zinc-500 font-mono">
                [a-zA-Z0-9_-]
              </span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. payment-service"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                setErrorMessage(null);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500 font-medium">
              Common Service Templates:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_SUGGESTIONS.map((sug) => (
                <button
                  type="button"
                  key={sug}
                  onClick={() => setName(sug)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    name === sug
                      ? "bg-zinc-100 text-zinc-950 font-semibold border-white"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  +{sug}
                </button>
              ))}
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              Description <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Handles checkout card charges, refunds, and Stripe webhook verification"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
            />
          </div>

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
              disabled={!name.trim() || createMutation.isPending}
              className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{createMutation.isPending ? "Registering..." : "Register Service"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
