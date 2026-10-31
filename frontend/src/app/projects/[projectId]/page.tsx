"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Zap,
  Cpu,
  Boxes,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId } from "@/lib/utils";
import { Meter } from "@/components/ui/meter";
import { SeverityBadge, StatusBadge, Tag } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

interface IncidentItem {
  id: string;
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  rcaAnalyses?: Array<{
    confidence: number;
    conclusion?: string;
    candidates: Array<{
      service: { id: string; name: string };
      totalScore: number;
      rank: number;
    }>;
  }>;
  incidentSummaries?: Array<{
    summary: string;
  }>;
  incidentAnomalies?: Array<{
    anomaly: {
      service?: { name: string };
    };
  }>;
}

interface AnomalyItem {
  id: string;
  anomalyType: string;
  title: string;
  severity: string;
  status: string;
  firstDetectedAt: string;
  service?: { id: string; name: string };
  evidence?: {
    spikeRatio?: number;
    currentRate?: number;
    baselineRate?: number;
  };
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  // 1. Fetch Incidents
  const { data: incidentsData, isLoading: incidentsLoading } = useQuery({
    queryKey: ["incidents", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { items: IncidentItem[]; pagination: any };
      }>(`/incidents/${projectId}?limit=5`);
      return res.data.data;
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  // 2. Fetch Anomalies
  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ["anomalies", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { items: AnomalyItem[]; pagination: any };
      }>(`/anomalies/${projectId}?limit=5`);
      return res.data.data;
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  // 3. Fetch Services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ["services", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        services: any[];
      }>(`/services?projectId=${projectId}`);
      return res.data.services;
    },
    enabled: !!projectId,
  });

  // 4. Fetch Clusters
  const { data: clustersData } = useQuery({
    queryKey: ["log-clusters", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        clusters: any[];
      }>(`/logs/${projectId}/clusters?limit=5`);
      return res.data.clusters;
    },
    enabled: !!projectId,
  });

  const incidents = incidentsData?.items || [];
  const anomalies = anomaliesData?.items || [];
  const services = servicesData || [];
  const clusters = clustersData || [];

  const activeIncidents = incidents.filter(
    (i) => i.status === "OPEN" || i.status === "INVESTIGATING"
  );
  const criticalCount = activeIncidents.filter((i) => i.severity === "CRITICAL").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            System Observability Overview
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated log clustering, anomaly correlation, and Gemini-powered root-cause isolation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/logs`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700/60 transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5 text-zinc-400" />
            <span>Ingest Logs</span>
          </Link>
          <Link
            href={`/projects/${projectId}/services`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Topology Graph</span>
          </Link>
        </div>
      </div>

      {/* Active Incident Alert Banner */}
      {activeIncidents.length > 0 && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <StatusDot state="critical" pulse />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-300">
                  {activeIncidents.length} Active System {activeIncidents.length === 1 ? "Incident" : "Incidents"} Requiring Attention
                </span>
                {criticalCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-200 border border-rose-700">
                    {criticalCount} CRITICAL
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Primary suspect identified by AI RCA:{" "}
                <span className="text-zinc-200 font-mono font-medium">
                  {activeIncidents[0].rcaAnalyses?.[0]?.candidates?.[0]?.service?.name ||
                    activeIncidents[0].title}
                </span>
              </p>
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/incidents/${activeIncidents[0].id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-900/40 hover:bg-rose-900/70 border border-rose-800/80 px-3 py-1.5 rounded-md transition-colors"
          >
            <span>Open Triage Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {incidentsLoading ? "—" : activeIncidents.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Total {incidents.length} logged
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Detected Anomalies</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {anomaliesLoading ? "—" : anomalies.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Spikes & Patterns</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Monitored Services</span>
            <Cpu className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {servicesLoading ? "—" : services.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Topology Nodes</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Drain3 Clusters</span>
            <Boxes className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
              {clusters.length}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Mined Templates</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Observability Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Live Incidents & Triage Feed */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Recent Correlated Incidents
              </h2>
            </div>
            <Link
              href={`/projects/${projectId}/incidents`}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-850 flex-1">
            {incidentsLoading ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                Loading incidents...
              </div>
            ) : incidents.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                No incidents reported. All services operating normally.
              </div>
            ) : (
              incidents.map((incident) => {
                const latestRca = incident.rcaAnalyses?.[0];
                const primaryCandidate = latestRca?.candidates?.[0];

                return (
                  <div
                    key={incident.id}
                    onClick={() =>
                      router.push(`/projects/${projectId}/incidents/${incident.id}`)
                    }
                    className="p-4 hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-zinc-500">
                            {shortId(incident.id)}
                          </span>
                          <SeverityBadge severity={incident.severity} />
                          <StatusBadge status={incident.status} />
                          <span className="text-[11px] text-zinc-500 font-mono">
                            {relativeTime(incident.startedAt)}
                          </span>
                        </div>
                        <h3 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                          {incident.title}
                        </h3>
                      </div>

                      {latestRca && (
                        <div className="w-28 shrink-0">
                          <Meter value={latestRca.confidence} label="RCA" />
                        </div>
                      )}
                    </div>

                    {primaryCandidate && (
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-zinc-400">
                        <span className="text-[11px] text-zinc-500">Root Cause:</span>
                        <Tag className="text-zinc-200 border-zinc-700 bg-zinc-800">
                          {primaryCandidate.service.name}
                        </Tag>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          (Confidence {Math.round(primaryCandidate.totalScore * 100)}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Log Anomalies & Pattern Outliers */}
        <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-zinc-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Log Anomalies & Outliers
              </h2>
            </div>
            <Link
              href={`/projects/${projectId}/anomalies`}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-850 flex-1">
            {anomaliesLoading ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                Loading anomalies...
              </div>
            ) : anomalies.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                No statistical anomalies or template spikes detected.
              </div>
            ) : (
              anomalies.map((anomaly) => (
                <div key={anomaly.id} className="p-4 hover:bg-zinc-900/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={anomaly.severity} />
                        <span className="text-[11px] font-mono text-zinc-500">
                          {anomaly.anomalyType}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {relativeTime(anomaly.firstDetectedAt)}
                        </span>
                      </div>
                      <h4 className="text-xs font-medium text-zinc-200">{anomaly.title}</h4>
                    </div>

                    {anomaly.service && <Tag>{anomaly.service.name}</Tag>}
                  </div>

                  {anomaly.evidence?.spikeRatio && (
                    <div className="mt-2 text-[11px] font-mono text-amber-400/90 flex items-center gap-2">
                      <span>Spike Ratio: {anomaly.evidence.spikeRatio.toFixed(1)}x</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-zinc-400">
                        Current: {anomaly.evidence.currentRate}/min (Baseline:{" "}
                        {anomaly.evidence.baselineRate}/min)
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
