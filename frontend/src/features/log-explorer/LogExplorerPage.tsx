import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  UploadCloud,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  FileUp,
  CheckCircle2,
  Clock,
  Loader2,
  Network,
  Plus,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusIndicator } from '../../components/ui/Badge';
import { LogEntry, ServiceNodeData, ProcessingJob } from '../../types';
import { logService } from '../../services/log-service';
import { serviceMapService } from '../../services/service-map-service';
import { useProject } from '../../context/ProjectContext';
import { UploadLogModal } from '../../components/modals/UploadLogModal';

export const LogExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeProject, activeProjectId } = useProject();

  const urlService = searchParams.get('service') || '';
  const urlUpload = searchParams.get('upload') === 'true';

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState(urlService || 'all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Upload modal visibility
  const [uploadModalOpen, setUploadModalOpen] = useState(urlUpload);

  // Load available services for filter & upload
  useEffect(() => {
    if (!activeProjectId) return;
    serviceMapService.getServices(activeProjectId).then(setServices).catch(console.warn);
  }, [activeProjectId]);

  useEffect(() => {
    if (urlService) {
      setSelectedService(urlService);
    }
    if (urlUpload) {
      setUploadModalOpen(true);
    }
  }, [urlService, urlUpload]);

  const fetchLogs = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await logService.getLogs(activeProjectId, {
        service: selectedService,
        level: selectedLevel,
        query: searchQuery,
        page: currentPage,
        limit: pageSize,
      });
      setLogs(res.logs);
      setTotalLogs(res.total);
      if (res.logs.length > 0 && !expandedLogId) {
        setExpandedLogId(res.logs[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeProjectId, selectedService, selectedLevel, searchQuery, currentPage]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Log Stream & Ingestion Explorer
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Directly query parsed log events, inspect cluster patterns, and upload log streams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          {services.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              icon={<UploadCloud className="w-3.5 h-3.5" />}
            >
              Upload Raw Log File
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/dashboard/service-map')}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Register Service First
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="sm:col-span-6">
            <Input
              placeholder="Search keyword, normalized pattern, or traceId..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Service Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Services ({services.length})</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Severity Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Showing <strong className="text-neutral-800 dark:text-neutral-200">{logs.length}</strong> of{' '}
            <strong className="text-neutral-800 dark:text-neutral-200">{totalLogs}</strong> matched logs
          </span>
          <span className="text-[11px] text-neutral-400">
            Real-time clustering active
          </span>
        </div>
      </Card>

      {/* Log Feed Table & Expandable Details */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100/60 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 font-medium">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4 font-mono w-44">Timestamp (UTC)</th>
                <th className="py-3 px-4 w-28">Level</th>
                <th className="py-3 px-4 w-40">Service</th>
                <th className="py-3 px-4">Message / Normalized Event</th>
                <th className="py-3 px-4 w-28 font-mono">Cluster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isError = log.level === 'ERROR' || log.level === 'FATAL';

                return (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-850/80 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-neutral-50 dark:bg-neutral-850' : ''
                      } ${isError ? 'bg-red-50/20 dark:bg-red-950/10' : ''}`}
                    >
                      <td className="py-3 px-4 text-neutral-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-500 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator variant={log.level} label={log.level} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                        {log.service}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-800 dark:text-neutral-300 max-w-xl truncate">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-400">
                        {log.clusterId.slice(0, 10)}
                      </td>
                    </tr>

                    {/* Expandable Log Details Drawer */}
                    {isExpanded && (
                      <tr className="bg-neutral-100/40 dark:bg-neutral-900/40">
                        <td colSpan={6} className="p-4 sm:p-5">
                          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-4 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                  Log Record ID: {log.id}
                                </span>
                                {log.isAnomaly && (
                                  <span className="text-[10px] font-mono bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 px-2 py-0.5 rounded font-bold uppercase">
                                    Anomaly Surge Tagged
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(log.message, log.id);
                                }}
                                icon={
                                  copiedId === log.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )
                                }
                              >
                                {copiedId === log.id ? 'Copied' : 'Copy Message'}
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div>
                                <span className="text-neutral-400 block mb-1">Service Node:</span>
                                <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                                  {log.service}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-400 block mb-1">Cluster ID:</span>
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                  {log.clusterId}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-medium text-neutral-400 block mb-1.5">
                                Normalized Message Payload:
                              </span>
                              <pre className="p-3 rounded-lg bg-neutral-900 text-neutral-100 dark:bg-black font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {log.message}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs text-neutral-500">
                    {services.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <Network className="w-8 h-8 text-neutral-400 mx-auto" />
                        <div>
                          <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                            No microservices registered yet
                          </p>
                          <p className="max-w-sm text-neutral-500 mt-1">
                            A microservice architecture must be defined before log files can be ingested and mapped.
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate('/dashboard/service-map')}
                          icon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Register First Service
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <p>No log records found matching the active filter query.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUploadModalOpen(true)}
                          icon={<UploadCloud className="w-3.5 h-3.5" />}
                        >
                          Upload New Log File
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalLogs > pageSize && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-500">
              Page {currentPage} of {Math.ceil(totalLogs / pageSize)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalLogs / pageSize)}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Centralized Log File Upload Modal */}
      <UploadLogModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        projectId={activeProjectId}
        targetService={
          selectedService !== 'all'
            ? services.find((s) => s.name === selectedService || s.id === selectedService) || null
            : null
        }
        availableServices={services.map((s) => ({ id: s.id, name: s.name }))}
        onSuccess={fetchLogs}
      />
    </div>
  );
};
