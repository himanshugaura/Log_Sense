"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ServiceItem } from "./add-dependency-modal";

interface ServiceCardProps {
  service: ServiceItem & {
    _count?: {
      outgoingDependencies: number;
      incomingDependencies: number;
      logSources: number;
      anomalies: number;
    };
  };
  projectId: string;
  allServices: ServiceItem[];
  onAddDependency: (service: ServiceItem) => void;
}

export function ServiceCard({
  service,
  projectId,
  allServices,
  onAddDependency,
}: ServiceCardProps) {
  const queryClient = useQueryClient();

  // Delete Service Mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/services/${service.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", projectId] });
      queryClient.invalidateQueries({ queryKey: ["services-graph", projectId] });
    },
  });

  // Delete Dependency Edge Mutation
  const deleteDependencyMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      await apiClient.delete(`/services/dependencies/${dependencyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", projectId] });
      queryClient.invalidateQueries({ queryKey: ["services-graph", projectId] });
    },
  });

  const outgoing = service.outgoingDependencies || [];
  const incoming = service.incomingDependencies || [];

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-[#0e0e11] hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 shadow-sm group">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <h3 className="font-semibold text-sm font-mono text-zinc-100 group-hover:text-white transition-colors">
                  {service.name}
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                ID: {service.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete service "${service.name}"?`)) {
                deleteServiceMutation.mutate();
              }
            }}
            disabled={deleteServiceMutation.isPending}
            className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-zinc-900 transition-colors"
            title="Delete Service"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
          {service.description || "Microservice registered for observability and root cause analysis."}
        </p>

        {/* Dependencies Section */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 space-y-3">
          {/* Outgoing Dependencies (What this service calls) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span className="flex items-center gap-1 font-medium">
                <ArrowRight className="w-3 h-3 text-zinc-400" /> Calls Downstream ({outgoing.length})
              </span>
              <button
                onClick={() => onAddDependency(service)}
                className="text-[11px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> Connect
              </button>
            </div>

            {outgoing.length === 0 ? (
              <div className="text-[11px] font-mono text-zinc-600 italic pl-4">
                No downstream dependencies (Leaf service)
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-4">
                {outgoing.map((dep) => {
                  const target = allServices.find((s) => s.id === dep.targetServiceId);
                  return (
                    <span
                      key={dep.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300"
                    >
                      <span>{target?.name || "service"}</span>
                      <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-400 uppercase font-sans">
                        {dep.dependencyType}
                      </span>
                      <button
                        onClick={() => deleteDependencyMutation.mutate(dep.id)}
                        className="text-zinc-500 hover:text-red-400 ml-0.5"
                        title="Remove dependency"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming Callers (Services that call this service) */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500 flex items-center gap-1 font-medium">
              <ArrowLeft className="w-3 h-3 text-zinc-400" /> Depended on by ({incoming.length})
            </div>

            {incoming.length === 0 ? (
              <div className="text-[11px] font-mono text-zinc-600 italic pl-4">
                No upstream callers (Entrypoint / Root)
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 pl-4">
                {incoming.map((dep) => {
                  const source = allServices.find((s) => s.id === dep.sourceServiceId);
                  return (
                    <span
                      key={dep.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950/60 border border-zinc-800/60 text-[11px] font-mono text-zinc-400"
                    >
                      <span>{source?.name || "service"}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-sans">
                        ({dep.dependencyType})
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Meta */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="font-mono">
          Logs: {service._count?.logSources ?? 0} files
        </span>
        <button
          onClick={() => onAddDependency(service)}
          className="text-zinc-300 hover:text-white font-medium flex items-center gap-1 text-xs transition-colors"
        >
          <span>Add Edge</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
