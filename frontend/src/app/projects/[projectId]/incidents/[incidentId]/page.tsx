"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  CheckSquare,
  Square,
  FileCode2,
  Network,
  RotateCcw,
  Zap,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId, formatDateTime } from "@/lib/utils";
import { Meter } from "@/components/ui/meter";
import { SeverityBadge, StatusBadge, Tag } from "@/components/ui/badge";

interface IncidentDetail {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  startedAt: string;
  resolvedAt?: string;
  incidentAnomalies: Array<{
    id: string;
    anomaly: {
      id: string;
      title: string;
      severity: string;
      status: string;
      service?: { id: string; name: string };
      cluster?: { id: string; template: string; occurrenceCount: number };
      evidence?: any;
    };
  }>;
  rcaAnalyses: Array<{
    id: string;
    conclusion?: string;
    confidence: number;
    analysisData?: any;
    createdAt: string;
    candidates: Array<{
      id: string;
      rank: number;
      serviceId: string;
      totalScore: number;
      temporalScore: number;
      dependencyScore: number;
      errorTypeScore: number;
      traceScore: number;
      explanation?: string;
      service: {
        id: string;
        name: string;
        description?: string;
      };
    }>;
  }>;
  incidentSummaries: Array<{
    id: string;
    summary: string;
    recommendations?: Array<{
      id?: string;
      action?: string;
      description?: string;
      step?: string;
      type?: string;
    }> | any;
    model: string;
    createdAt: string;
  }>;
}

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.projectId as string;
  const incidentId = params.incidentId as string;

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Fetch incident details
  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", projectId, incidentId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: IncidentDetail;
      }>(`/incidents/${projectId}/${incidentId}`);
      return res.data.data;
    },
    enabled: !!projectId && !!incidentId,
  });

  // Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiClient.patch(
        `/incidents/${projectId}/${incidentId}/status`,
        { status: newStatus }
      );
      return res.data;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["incident", projectId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ["incidents", projectId] });
      setStatusNotification(`Status updated to ${newStatus}`);
      setTimeout(() => setStatusNotification(null), 3500);
    },
  });

  const toggleCheck = (idxKey: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [idxKey]: !prev[idxKey],
    }));
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-xs font-mono text-zinc-500">
        Loading incident dossier and RCA evidence...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center space-y-4">
        <h2 className="text-base font-bold text-zinc-200">Incident Not Found</h2>
        <p className="text-xs text-zinc-500">
          The requested incident {incidentId} was not found in this project.
        </p>
        <Link
          href={`/projects/${projectId}/incidents`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents</span>
        </Link>
      </div>
    );
  }

  const latestRca = incident.rcaAnalyses?.[0];
  const candidates = latestRca?.candidates || [];
  const primarySuspect = candidates[0];
  const latestSummary = incident.incidentSummaries?.[0];

  // Parse recommendations from JSON or fallback
  let recommendations: Array<{ title: string; detail?: string }> = [];
  if (latestSummary?.recommendations) {
    if (Array.isArray(latestSummary.recommendations)) {
      recommendations = latestSummary.recommendations.map((item: any) => ({
        title: item.action || item.step || item.title || String(item),
        detail: item.description || item.reason || "",
      }));
    } else if (typeof latestSummary.recommendations === "object") {
      recommendations = Object.entries(latestSummary.recommendations).map(([k, v]) => ({
        title: k,
        detail: String(v),
      }));
    }
  }

  // Fallback defaults if recommendations wasn't populated yet
  if (recommendations.length === 0 && primarySuspect) {
    recommendations = [
      {
        title: `Verify ${primarySuspect.service.name} connection pool and upstream saturation`,
        detail: "Check connection metrics and response latency spikes in dependency graph.",
      },
      {
        title: `Rollback recent deployment or canary on ${primarySuspect.service.name}`,
        detail: "Audit recent commit SHA or container image updates matching incident start time.",
      },
      {
        title: "Scale replicas or adjust circuit-breaker fallback thresholds",
        detail: "Prevent cascade timeout propagation to downstream services.",
      },
    ];
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Status Notification */}
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${projectId}/incidents`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Incidents</span>
        </Link>

        {statusNotification && (
          <div className="text-xs font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-md animate-fade-in">
            {statusNotification}
          </div>
        )}
      </div>

      {/* Incident Header & Triage Controls */}
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">{shortId(incident.id)}</span>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              <span className="text-xs font-mono text-zinc-400">
                Started {formatDateTime(incident.startedAt)} ({relativeTime(incident.startedAt)})
              </span>
              {incident.resolvedAt && (
                <span className="text-xs font-mono text-emerald-400">
                  &middot; Resolved {formatDateTime(incident.resolvedAt)}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">{incident.title}</h1>
            {incident.description && (
              <p className="text-xs text-zinc-400">{incident.description}</p>
            )}
          </div>

          {/* Status Changer Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-500 mr-1 hidden sm:inline">
              Transition Status:
            </span>
            <button
              onClick={() => updateStatusMutation.mutate("OPEN")}
              disabled={incident.status === "OPEN" || updateStatusMutation.isPending}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                incident.status === "OPEN"
                  ? "bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              OPEN
            </button>
            <button
              onClick={() => updateStatusMutation.mutate("INVESTIGATING")}
              disabled={incident.status === "INVESTIGATING" || updateStatusMutation.isPending}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                incident.status === "INVESTIGATING"
                  ? "bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              INVESTIGATING
            </button>
            <button
              onClick={() => updateStatusMutation.mutate("RESOLVED")}
              disabled={incident.status === "RESOLVED" || updateStatusMutation.isPending}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                incident.status === "RESOLVED"
                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-semibold"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              RESOLVED
            </button>
          </div>
        </div>

        {/* Affected Services & Blast Radius */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-500 font-medium">Correlated Services:</span>
            {candidates.map((cand, idx) => (
              <React.Fragment key={cand.id}>
                <Tag
                  className={
                    idx === 0
                      ? "bg-rose-950/50 text-rose-300 border-rose-800/80 font-bold"
                      : "text-zinc-300 bg-zinc-900 border-zinc-800"
                  }
                >
                  {cand.service.name}
                </Tag>
                {idx < candidates.length - 1 && <span className="text-zinc-600">→</span>}
              </React.Fragment>
            ))}
          </div>

          <Link
            href={`/projects/${projectId}/services`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-mono transition-colors"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Inspect Microservice Topology</span>
          </Link>
        </div>
      </div>

      {/* AI Incident Summary (Gemini Powered) */}
      {latestSummary && (
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI Executive Summary</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              Model: {latestSummary.model}
            </span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-3.5 rounded border border-zinc-850">
            {latestSummary.summary}
          </p>
        </div>
      )}

      {/* Ranked Root Cause Hypotheses (4-Factor Engine) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Ranked Root-Cause Hypotheses
            </h2>
            <p className="text-[11px] text-zinc-500">
              Ranked using 4-factor scoring: Temporal precedence, Dependency graph propagation, Error severity, and Trace correlation.
            </p>
          </div>
          {latestRca && (
            <div className="w-36">
              <Meter value={latestRca.confidence} label="Overall RCA" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {candidates.map((cand, idx) => {
            const isPrimary = idx === 0;

            return (
              <div
                key={cand.id}
                className={`rounded-lg border bg-[#0c0c0e] p-5 space-y-4 transition-all ${
                  isPrimary
                    ? "border-amber-800/80 bg-gradient-to-b from-amber-950/10 to-transparent"
                    : "border-zinc-800"
                }`}
              >
                {/* Hypothesis Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-850">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-200 text-xs font-bold font-mono flex items-center justify-center shrink-0 border border-zinc-700">
                      #{cand.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-zinc-100">
                          {cand.service.name}
                        </span>
                        {isPrimary && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800 font-semibold uppercase">
                            Primary Suspect
                          </span>
                        )}
                      </div>
                      {cand.service.description && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {cand.service.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-48 shrink-0">
                    <Meter value={cand.totalScore} label="Candidate Score" />
                  </div>
                </div>

                {/* 4-Factor Scoring Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950/70 p-3 rounded border border-zinc-850">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                      Temporal Precedence
                    </span>
                    <Meter value={cand.temporalScore} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                      Dependency Weight
                    </span>
                    <Meter value={cand.dependencyScore} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                      Error Type Score
                    </span>
                    <Meter value={cand.errorTypeScore} />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono block mb-1">
                      Trace Density
                    </span>
                    <Meter value={cand.traceScore} />
                  </div>
                </div>

                {/* Qualitative Explanation */}
                {cand.explanation && (
                  <div className="text-xs text-zinc-400 bg-zinc-950/40 p-3 rounded border border-zinc-850">
                    <span className="text-zinc-500 font-semibold mr-1">RCA Reasoning:</span>
                    {cand.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Actions & Remediation Checklist */}
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Recommended Remediation Checklist
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {Object.values(completedSteps).filter(Boolean).length} / {recommendations.length} completed
          </span>
        </div>

        <div className="space-y-2.5">
          {recommendations.map((rec, i) => {
            const key = `rec-${i}`;
            const isDone = Boolean(completedSteps[key]);

            return (
              <div
                key={i}
                onClick={() => toggleCheck(key)}
                className={`p-3 rounded-md border transition-all cursor-pointer flex items-start gap-3 ${
                  isDone
                    ? "bg-zinc-950/80 border-emerald-900/60 opacity-60"
                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="pt-0.5 text-zinc-400">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div
                    className={`text-xs font-medium ${
                      isDone ? "line-through text-zinc-500" : "text-zinc-200"
                    }`}
                  >
                    {rec.title}
                  </div>
                  {rec.detail && <p className="text-[11px] text-zinc-500">{rec.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Correlated Log Anomalies & Evidence */}
      {incident.incidentAnomalies?.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Correlated Log Anomalies ({incident.incidentAnomalies.length})
              </h2>
            </div>
            <Link
              href={`/projects/${projectId}/logs`}
              className="text-xs text-zinc-400 hover:text-zinc-200 font-mono transition-colors"
            >
              Open Log Explorer
            </Link>
          </div>

          <div className="divide-y divide-zinc-850">
            {incident.incidentAnomalies.map(({ anomaly }) => (
              <div key={anomaly.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={anomaly.severity} />
                    <span className="text-xs font-medium text-zinc-200">{anomaly.title}</span>
                  </div>
                  {anomaly.cluster && (
                    <div className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
                      Drain3 Template: <span className="text-zinc-300">{anomaly.cluster.template}</span>
                    </div>
                  )}
                </div>

                {anomaly.service && (
                  <Tag className="shrink-0">{anomaly.service.name}</Tag>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
