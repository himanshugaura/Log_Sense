"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Zap,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId, formatDateTime } from "@/lib/utils";
import { SeverityBadge, StatusBadge, Tag } from "@/components/ui/badge";

interface AnomalyItem {
  id: string;
  projectId: string;
  serviceId?: string;
  clusterId?: string;
  anomalyType: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  occurrenceCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  evidence?: {
    spikeRatio?: number;
    currentRate?: number;
    baselineRate?: number;
    windowStart?: string;
    windowEnd?: string;
    [key: string]: any;
  };
  service?: {
    id: string;
    name: string;
  };
  cluster?: {
    id: string;
    template: string;
    occurrenceCount: number;
  };
  incidentAnomalies?: Array<{
    incident: {
      id: string;
      title: string;
      status: string;
    };
  }>;
}

export default function AnomaliesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch anomalies from backend
  const { data, isLoading } = useQuery({
    queryKey: ["anomalies", projectId, severityFilter, statusFilter, page],
    queryFn: async () => {
      const qParams = new URLSearchParams();
      qParams.append("page", page.toString());
      qParams.append("limit", "20");
      if (severityFilter !== "all") qParams.append("severity", severityFilter);
      if (statusFilter !== "all") qParams.append("status", statusFilter);

      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: AnomalyItem[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      }>(`/anomalies/${projectId}?${qParams.toString()}`);
      return res.data.data;
    },
    enabled: !!projectId,
    refetchInterval: 15000,
  });

  const anomalies = data?.items || [];
  const pagination = data?.pagination;

  const filtered = anomalies.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.anomalyType.toLowerCase().includes(q) ||
      a.service?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            Log Anomalies & Pattern Outliers
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Statistical frequency deviations, new error pattern spikes, and template drifts correlated across microservices.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
          {pagination?.total || anomalies.length} Outliers Monitored
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0c0c0e] border border-zinc-800">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search anomalies by signature, type, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter anomalies by severity"
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter anomalies by status"
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500 rounded-lg border border-zinc-800 bg-[#0c0c0e]">
            Scanning log clusters for statistical rate spikes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-zinc-800 bg-[#0c0c0e] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <h3 className="text-sm font-semibold text-zinc-200">No Outliers Detected</h3>
            <p className="text-xs text-zinc-500">
              No anomaly patterns match your current filter parameters.
            </p>
          </div>
        ) : (
          filtered.map((anomaly) => {
            const isExpanded = expandedId === anomaly.id;
            const evidence = anomaly.evidence;
            const linkedIncidents = anomaly.incidentAnomalies || [];

            return (
              <div
                key={anomaly.id}
                className="rounded-lg border border-zinc-800 bg-[#0c0c0e] transition-colors"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/40 select-none"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-zinc-500 pt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={anomaly.severity} />
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {anomaly.anomalyType}
                        </span>
                        {anomaly.service && <Tag>{anomaly.service.name}</Tag>}
                        <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {relativeTime(anomaly.firstDetectedAt)}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-zinc-200">{anomaly.title}</h3>
                    </div>
                  </div>

                  {evidence?.spikeRatio && (
                    <div className="flex items-center gap-2 text-right shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                        {evidence.spikeRatio.toFixed(1)}x Spike
                      </span>
                    </div>
                  )}
                </div>

                {/* Evidence Drawer */}
                {isExpanded && (
                  <div className="p-4 border-t border-zinc-850 bg-zinc-950/70 space-y-3 text-xs">
                    {anomaly.description && (
                      <p className="text-zinc-400">{anomaly.description}</p>
                    )}

                    {/* Spike Metrics Grid */}
                    {evidence && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px] bg-zinc-900/60 p-3 rounded border border-zinc-800">
                        {evidence.spikeRatio && (
                          <div>
                            <span className="text-zinc-500 block">Spike Ratio</span>
                            <span className="text-amber-400 font-bold">
                              {evidence.spikeRatio.toFixed(2)}x
                            </span>
                          </div>
                        )}
                        {evidence.currentRate !== undefined && (
                          <div>
                            <span className="text-zinc-500 block">Current Rate</span>
                            <span className="text-zinc-200">{evidence.currentRate} / min</span>
                          </div>
                        )}
                        {evidence.baselineRate !== undefined && (
                          <div>
                            <span className="text-zinc-500 block">Baseline Rate</span>
                            <span className="text-zinc-400">{evidence.baselineRate} / min</span>
                          </div>
                        )}
                        <div>
                          <span className="text-zinc-500 block">Occurrences</span>
                          <span className="text-zinc-200">{anomaly.occurrenceCount}</span>
                        </div>
                      </div>
                    )}

                    {/* Associated Drain3 Cluster Template */}
                    {anomaly.cluster && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-mono text-zinc-500">
                          Mined Drain3 Template:
                        </span>
                        <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
                          {anomaly.cluster.template}
                        </div>
                      </div>
                    )}

                    {/* Linked Incident */}
                    {linkedIncidents.length > 0 && (
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">Correlated in Incident:</span>
                        <Link
                          href={`/projects/${projectId}/incidents/${linkedIncidents[0].incident.id}`}
                          className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <span>{linkedIncidents[0].incident.title}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-xs">
          <span className="text-zinc-500 font-mono">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 font-mono"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 font-mono"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
