"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Tag as TagIcon,
  Zap,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId, formatDateTime } from "@/lib/utils";
import { Tag } from "@/components/ui/badge";

interface LogCluster {
  id: string;
  drainClusterId: number;
  template: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  _count?: {
    logEntries: number;
    anomalies: number;
  };
}

export default function LogClustersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "recent">("count");

  const { data, isLoading } = useQuery({
    queryKey: ["log-clusters", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        clusters: LogCluster[];
      }>(`/logs/${projectId}/clusters`);
      return res.data.clusters;
    },
    enabled: !!projectId,
    refetchInterval: 15000,
  });

  const clusters = data || [];

  const filteredClusters = clusters
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      return c.template.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "count") {
        return b.occurrenceCount - a.occurrenceCount;
      }
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });

  // Render template with highlighted <*> wildcard tokens
  const renderTemplateTokens = (templateStr: string) => {
    const parts = templateStr.split(/(<\*>)/g);
    return parts.map((part, i) => {
      if (part === "<*>") {
        return (
          <span
            key={i}
            className="inline-block px-1 py-0.2 mx-0.5 rounded bg-amber-950/70 border border-amber-800/80 text-amber-300 font-bold"
          >
            &lt;*&gt;
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            Mined Drain3 Log Templates
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Online prefix-tree log clustering isolating invariant syntax templates from dynamic wildcard tokens.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
          {clusters.length} Mined Templates
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0c0c0e] border border-zinc-800">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search template patterns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(sortBy === "count" ? "recent" : "count")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-900 font-mono"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
            <span>Sort: {sortBy === "count" ? "Frequency (Highest)" : "Recently Detected"}</span>
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500 rounded-lg border border-zinc-800 bg-[#0c0c0e]">
            Clustering log lines through Drain3 parse trees...
          </div>
        ) : filteredClusters.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-zinc-800 bg-[#0c0c0e] space-y-2">
            <Boxes className="w-8 h-8 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-200">No Templates Found</h3>
            <p className="text-xs text-zinc-500">
              No Drain3 clusters match your filter or no logs have been parsed yet.
            </p>
          </div>
        ) : (
          filteredClusters.map((cluster) => {
            const anomalyCount = cluster._count?.anomalies || 0;

            return (
              <div
                key={cluster.id}
                className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4 space-y-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-850">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                      Cluster #{cluster.drainClusterId}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      ID: {shortId(cluster.id)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {anomalyCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/60 px-2 py-0.5 rounded">
                        <Zap className="w-3 h-3" />
                        <span>{anomalyCount} {anomalyCount === 1 ? "Anomaly" : "Anomalies"}</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300">
                      <span className="text-zinc-500">Hits:</span>
                      <span className="font-bold tabular-nums">
                        {cluster.occurrenceCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Masked Template String */}
                <div className="p-3 rounded bg-zinc-950/80 border border-zinc-850 font-mono text-xs text-zinc-200 leading-relaxed overflow-x-auto">
                  {renderTemplateTokens(cluster.template)}
                </div>

                {/* Footer metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-500 pt-1">
                  <span>First seen: {relativeTime(cluster.firstSeenAt)}</span>
                  <span>Last seen: {relativeTime(cluster.lastSeenAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
