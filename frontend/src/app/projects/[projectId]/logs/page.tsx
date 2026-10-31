"use client";

import React, { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Search,
  UploadCloud,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { relativeTime, shortId, formatDateTime } from "@/lib/utils";
import { Tag } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  rawMessage: string;
  normalizedMessage?: string;
  traceId?: string;
  spanId?: string;
  metadata?: any;
  service?: {
    id: string;
    name: string;
  };
}

interface ProcessingJob {
  id: string;
  jobType: string;
  status: string; // PENDING | IN_PROGRESS | COMPLETED | FAILED
  totalItems: number;
  processedItems: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export default function LogExplorerPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const projectId = params.projectId as string;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [uploadFormat, setUploadFormat] = useState("STANDARD");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Services for filters & upload
  const { data: services = [] } = useQuery({
    queryKey: ["services", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; services: any[] }>(
        `/services?projectId=${projectId}`
      );
      return res.data.services;
    },
    enabled: !!projectId,
  });

  // 2. Fetch Active Processing Jobs (poll every 4s if running)
  const { data: jobs = [] } = useQuery({
    queryKey: ["log-jobs", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        jobs: ProcessingJob[];
      }>(`/logs/${projectId}/jobs`);
      return res.data.jobs;
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === "PENDING" || j.status === "IN_PROGRESS"
      );
      return hasActive ? 3000 : 15000;
    },
  });

  // 3. Fetch Log Entries
  const {
    data: logData,
    isLoading: logsLoading,
    isFetching: logsFetching,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ["logs", projectId, levelFilter, serviceFilter, searchQuery, page],
    queryFn: async () => {
      const qParams = new URLSearchParams();
      qParams.append("page", page.toString());
      qParams.append("limit", "50");
      if (levelFilter !== "all") qParams.append("level", levelFilter);
      if (serviceFilter !== "all") qParams.append("serviceId", serviceFilter);
      if (searchQuery.trim()) qParams.append("search", searchQuery.trim());

      const res = await apiClient.get<{
        success: boolean;
        data: {
          items: LogEntry[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      }>(`/logs/${projectId}/entries?${qParams.toString()}`);
      return res.data.data;
    },
    enabled: !!projectId,
    placeholderData: (prev) => prev,
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("Please select a log file");
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (selectedServiceId) formData.append("serviceId", selectedServiceId);
      formData.append("logFormat", uploadFormat);

      const res = await apiClient.post(`/logs/${projectId}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    },
    onSuccess: () => {
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["log-jobs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["logs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["log-clusters", projectId] });
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.message || err.message || "Failed to upload log file");
    },
  });

  const activeJob = jobs.find((j) => j.status === "PENDING" || j.status === "IN_PROGRESS");
  const entries = logData?.items || [];
  const pagination = logData?.pagination;

  const getLevelStyle = (level: string) => {
    switch (level?.toUpperCase()) {
      case "ERROR":
      case "FATAL":
      case "CRITICAL":
        return "text-rose-400 bg-rose-950/40 border-rose-800/60";
      case "WARN":
      case "WARNING":
        return "text-amber-400 bg-amber-950/40 border-amber-800/60";
      case "INFO":
        return "text-zinc-300 bg-zinc-800 border-zinc-700/60";
      case "DEBUG":
        return "text-zinc-500 bg-zinc-900 border-zinc-800";
      default:
        return "text-zinc-400 bg-zinc-850 border-zinc-800";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            Structured Log Stream & Explorer
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Distributed log ingestion via S3 storage, Drain3 pattern template mining, and real-time structured search.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchLogs()}
            disabled={logsFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-300 border border-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${logsFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Ingest S3 Logs</span>
          </button>
        </div>
      </div>

      {/* Active Processing Job Tracker */}
      {activeJob && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>
                Ingestion in Progress: Drain3 Parser & Clustering Pipeline Active
              </span>
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              {activeJob.processedItems} / {activeJob.totalItems || "..."} records
            </span>
          </div>

          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300 rounded-full"
              style={{
                width: `${
                  activeJob.totalItems > 0
                    ? Math.round((activeJob.processedItems / activeJob.totalItems) * 100)
                    : 45
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#0c0c0e] border border-zinc-800">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search raw logs, trace IDs, error messages..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
          />
        </div>

        {/* Microservice Filter */}
        <select
          value={serviceFilter}
          onChange={(e) => {
            setServiceFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter logs by microservice"
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
        >
          <option value="all">All Services</option>
          {services.map((svc: any) => (
            <option key={svc.id} value={svc.id}>
              {svc.name}
            </option>
          ))}
        </select>

        {/* Log Level Filter */}
        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter logs by log level"
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
        >
          <option value="all">All Levels</option>
          <option value="ERROR">ERROR / FATAL</option>
          <option value="WARN">WARN</option>
          <option value="INFO">INFO</option>
          <option value="DEBUG">DEBUG</option>
        </select>
      </div>

      {/* Structured Log Viewer Table */}
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] overflow-hidden">
        {logsLoading ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500">
            Streaming structured log events...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No Log Entries</h3>
            <p className="text-xs text-zinc-500">
              No matching log records found. Try adjusting your query or upload a log file.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/70 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3 w-40">Timestamp</th>
                  <th className="py-2.5 px-3 w-20">Level</th>
                  <th className="py-2.5 px-3 w-36">Service</th>
                  <th className="py-2.5 px-3 w-28">Trace ID</th>
                  <th className="py-2.5 px-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 font-mono text-xs">
                {entries.map((entry) => {
                  const isExpanded = expandedRow === entry.id;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                        className="hover:bg-zinc-900/60 transition-colors cursor-pointer select-none"
                      >
                        <td className="py-2 px-3 text-zinc-600">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-zinc-400 whitespace-nowrap">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLevelStyle(
                              entry.level
                            )}`}
                          >
                            {entry.level}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                          {entry.service?.name ? (
                            <Tag>{entry.service.name}</Tag>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-zinc-500 text-[11px] whitespace-nowrap">
                          {shortId(entry.traceId, 10)}
                        </td>
                        <td className="py-2 px-3 text-zinc-200 truncate max-w-xl">
                          {entry.normalizedMessage || entry.rawMessage}
                        </td>
                      </tr>

                      {/* Expandable Row Drawer */}
                      {isExpanded && (
                        <tr className="bg-zinc-950/90 border-b border-zinc-850">
                          <td colSpan={6} className="p-4 space-y-2">
                            <div className="text-[11px] text-zinc-400 font-sans font-semibold">
                              Raw Unparsed Payload:
                            </div>
                            <pre className="p-3 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
                              {entry.rawMessage}
                            </pre>

                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <div className="pt-2">
                                <div className="text-[11px] text-zinc-400 font-sans font-semibold mb-1">
                                  Extracted Metadata:
                                </div>
                                <pre className="p-3 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono overflow-x-auto">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-xs">
          <span className="text-zinc-500 font-mono">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
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

      {/* S3 File Ingestion Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-[#0c0c0e] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Ingest Log Dataset into S3
                </h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded bg-rose-950/50 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Select Log File (.log, .txt, .json)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-lg p-6 text-center cursor-pointer transition-colors bg-zinc-950/60"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".log,.txt,.json,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <FileText className="w-6 h-6 text-emerald-400 mx-auto" />
                      <div className="text-xs font-semibold text-zinc-200">
                        {uploadFile.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {(uploadFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-6 h-6 text-zinc-500 mx-auto" />
                      <div className="text-xs text-zinc-400">
                        Click or drag file to upload
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        Standard log format or JSON lines
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Target Microservice (Optional)
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
                >
                  <option value="">Auto-Detect from Payload</option>
                  {services.map((svc: any) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Log Format */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Parser Format
                </label>
                <select
                  value={uploadFormat}
                  onChange={(e) => setUploadFormat(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 font-mono"
                >
                  <option value="STANDARD">Standard Timestamped Text (Syslog / Spring)</option>
                  <option value="JSON">Structured JSON Lines (Pino / Winston / Go)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => uploadMutation.mutate()}
                disabled={!uploadFile || uploadMutation.isPending}
                className="px-4 py-1.5 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs disabled:opacity-40 flex items-center gap-2"
              >
                {uploadMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Upload & Parse</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
