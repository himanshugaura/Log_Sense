"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId } from "@/lib/utils";
import { Meter } from "@/components/ui/meter";
import { SeverityBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

interface IncidentItem {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  startedAt: string;
  resolvedAt?: string;
  incidentAnomalies?: Array<{
    anomaly: {
      id: string;
      title: string;
      severity: string;
      service?: { id: string; name: string };
    };
  }>;
  rcaAnalyses?: Array<{
    confidence: number;
    conclusion?: string;
    candidates: Array<{
      rank: number;
      totalScore: number;
      service: { id: string; name: string };
      explanation?: string;
    }>;
  }>;
  incidentSummaries?: Array<{
    summary: string;
    model: string;
  }>;
}

export default function IncidentsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch incidents from backend
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["incidents", projectId, statusFilter, severityFilter, page],
    queryFn: async () => {
      const qParams = new URLSearchParams();
      qParams.append("page", page.toString());
      qParams.append("limit", "15");
      if (statusFilter !== "all") qParams.append("status", statusFilter);
      if (severityFilter !== "all") qParams.append("severity", severityFilter);

      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: IncidentItem[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      }>(`/incidents/${projectId}?${qParams.toString()}`);
      return res.data.data;
    },
    enabled: !!projectId,
    refetchInterval: 15000,
  });

  const incidents = data?.items || [];
  const pagination = data?.pagination;

  // Client-side search filtering by title, id, or candidate service
  const filteredIncidents = incidents.filter((incident) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = incident.title.toLowerCase().includes(q);
    const matchesId = incident.id.toLowerCase().includes(q);
    const matchesService = incident.rcaAnalyses?.[0]?.candidates?.some((c) =>
      c.service.name.toLowerCase().includes(q)
    );
    return matchesTitle || matchesId || matchesService;
  });

  const activeCount = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "INVESTIGATING"
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <span>Incident Triage & Management</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Correlated multi-service incidents with automated root-cause analysis, Gemini summaries, and actionable checklists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
            <StatusDot state={activeCount > 0 ? "critical" : "good"} pulse={activeCount > 0} />
            <span>{activeCount} Active</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0c0c0e] border border-zinc-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search incidents by title, ID, or affected service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter incidents by status"
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
          >
            <option value="all">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter incidents by severity"
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
      </div>

      {/* Incidents Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500 rounded-lg border border-zinc-800 bg-[#0c0c0e]">
            Scanning active incidents and RCA models...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center rounded-lg border border-zinc-800 bg-[#0c0c0e] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <h3 className="text-sm font-semibold text-zinc-200">No Incidents Found</h3>
            <p className="text-xs text-zinc-500">
              No incidents match the selected status, severity, or search parameters.
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => {
            const latestRca = incident.rcaAnalyses?.[0];
            const primaryCandidate = latestRca?.candidates?.[0];
            const summary = incident.incidentSummaries?.[0]?.summary;
            const affectedCount = incident.incidentAnomalies?.length || 0;

            return (
              <div
                key={incident.id}
                onClick={() =>
                  router.push(`/projects/${projectId}/incidents/${incident.id}`)
                }
                className="rounded-lg border border-zinc-800 hover:border-zinc-700 bg-[#0c0c0e] p-5 transition-all cursor-pointer group space-y-3"
              >
                {/* Top Row: ID, Badges, Time, Confidence */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-500">
                      {shortId(incident.id)}
                    </span>
                    <SeverityBadge severity={incident.severity} />
                    <StatusBadge status={incident.status} />
                    <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {relativeTime(incident.startedAt)}
                    </span>
                  </div>

                  {latestRca && (
                    <div className="flex items-center gap-3 w-40 shrink-0">
                      <Meter value={latestRca.confidence} label="Confidence" />
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
                    {incident.title}
                  </h2>
                </div>

                {/* AI Executive Summary Snippet */}
                {summary && (
                  <div className="text-xs text-zinc-400 line-clamp-2 bg-zinc-950/60 p-2.5 rounded border border-zinc-850">
                    <span className="text-zinc-500 font-semibold mr-1">AI Context:</span>
                    {summary}
                  </div>
                )}

                {/* Bottom Row: Suspected Root Cause & Affected Count */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-850 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {primaryCandidate ? (
                      <>
                        <span className="text-[11px] text-zinc-500">Root Cause Candidate:</span>
                        <Tag className="text-zinc-200 border-zinc-700 bg-zinc-800">
                          {primaryCandidate.service.name}
                        </Tag>
                        <span className="text-[10px] font-mono text-zinc-500">
                          Score: {Math.round(primaryCandidate.totalScore * 100)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Root cause isolation pending</span>
                    )}

                    {affectedCount > 0 && (
                      <span className="text-[11px] text-zinc-500 font-mono ml-2">
                        &middot; {affectedCount} correlated {affectedCount === 1 ? "anomaly" : "anomalies"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-zinc-100 transition-colors">
                    <span>Inspect Triage Room</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
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
              className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
