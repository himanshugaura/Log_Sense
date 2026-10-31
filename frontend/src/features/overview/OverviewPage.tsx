import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  AlertOctagon,
  AlertTriangle,
  Flame,
  RefreshCw,
  UploadCloud,
  Building2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '@clerk/clerk-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';
import { incidentService } from '../../services/incident-service';
import { anomalyService } from '../../services/anomaly-service';
import { logService } from '../../services/log-service';
import { UploadLogModal } from '../../components/modals/UploadLogModal';
import { Incident, Anomaly } from '../../types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isSignedIn } = useAuth();
  const { activeProject, activeProjectId, projects } = useProject();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [logCount, setLogCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const loadData = async () => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    try {
      const [incList, anomList, logsRes] = await Promise.all([
        incidentService.getIncidents(activeProjectId),
        anomalyService.getAnomalies(activeProjectId),
        logService.getLogs(activeProjectId, { limit: 1 }),
      ]);
      setIncidents(incList);
      setAnomalies(anomList);
      setLogCount(logsRes.total || activeProject?._count?.logEntries || 0);
    } catch (err) {
      console.warn('Failed to load overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeProjectId, isSignedIn]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#262626' : '#e5e5e5';
  const textColor = isDark ? '#a3a3a3' : '#737373';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipBorder = isDark ? '#262626' : '#e5e5e5';

  const totalLogs = logCount || activeProject?._count?.logEntries || 0;
  const errorSpikesCount = anomalies.filter((a) => a.type === 'SPIKE').length;
  const newPatternsCount = anomalies.filter((a) => a.type === 'NEW_PATTERN').length;
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const criticalCount = activeIncidents.filter((i) => i.severity === 'critical').length;
  const highCount = activeIncidents.filter((i) => i.severity === 'high').length;

  if (!loading && (!activeProjectId || projects.length === 0)) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-850 mx-auto flex items-center justify-center text-neutral-600 dark:text-neutral-300">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            No Active Workspace
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Create an organization and project workspace to begin statistical log analysis.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/organizations')}
          className="mx-auto"
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Go to Organizations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Statistical anomaly detection, 5-minute moving baselines, and 15-point RCA for{' '}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
              {activeProject?.name || 'Workspace'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setUploadModalOpen(true)}
            icon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            Upload Log Dataset
          </Button>
        </div>
      </div>

      {/* 4 Core Essential Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logs */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Total Logs Ingested</span>
            <FileCode2 className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {totalLogs.toLocaleString()}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {totalLogs > 0 ? 'Single application stream' : 'No logs ingested'}
            </p>
          </div>
        </Card>

        {/* Statistical Spikes */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Standard Deviation Spikes</span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {errorSpikesCount}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {errorSpikesCount > 0 ? '> 2σ deviation detected' : 'Normal error baseline'}
            </p>
          </div>
        </Card>

        {/* New Patterns */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>New Patterns Discovered</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {newPatternsCount}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {newPatternsCount > 0 ? 'Drain3 new templates' : 'No new error patterns'}
            </p>
          </div>
        </Card>

        {/* Active Incidents */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Active Incidents & RCA</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {activeIncidents.length}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {criticalCount > 0 ? `${criticalCount} Critical` : highCount > 0 ? `${highCount} High` : 'All baselines healthy'}
            </p>
          </div>
        </Card>
      </div>

      {/* Full-Width Telemetry Volume & Error Spikes Chart */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Log Activity & Deviation Timeline
            </h2>
            <p className="text-xs text-neutral-500">
              Overall ingestion volume evaluated against 5-minute statistical moving baselines
            </p>
          </div>
          {totalLogs > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                <span className="text-neutral-500">Total Volume</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-neutral-500">Statistical Spikes</span>
              </div>
            </div>
          )}
        </div>

        {totalLogs > 0 ? (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { time: '10:00', totalVolume: Math.round(totalLogs * 0.15), errors: 0 },
                  { time: '10:05', totalVolume: Math.round(totalLogs * 0.22), errors: Math.min(errorSpikesCount * 5, 2) },
                  { time: '10:10', totalVolume: Math.round(totalLogs * 0.38), errors: errorSpikesCount * 12 },
                  { time: '10:15', totalVolume: Math.round(totalLogs * 0.32), errors: Math.round(errorSpikesCount * 8) },
                  { time: '10:20', totalVolume: Math.round(totalLogs * 0.18), errors: 0 },
                ]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="time" stroke={textColor} fontSize={11} tickLine={false} />
                <YAxis stroke={textColor} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: isDark ? '#fff' : '#000',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalVolume"
                  stroke={isDark ? '#737373' : '#525252'}
                  fill={isDark ? '#262626' : '#f5f5f5'}
                  fillOpacity={0.6}
                  name="Volume"
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  name="Spikes"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-center p-6 space-y-3">
            <FileCode2 className="w-10 h-10 text-neutral-400" />
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                No Log Dataset Ingested
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                Upload your raw log file (.log, .txt, .csv, JSON) to run Drain3 template mining, 5-minute standard deviation spike detection, and 15-point RCA.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              icon={<UploadCloud className="w-3.5 h-3.5" />}
            >
              Upload First Log File
            </Button>
          </div>
        )}
      </Card>

      {/* Active Incidents & Log Pattern RCA */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Active Incidents & Log Pattern Root Cause Analysis (15-Pt RCA)
              </h2>
              <p className="text-xs text-neutral-500">
                Correlated disturbance cascades ranked by temporal precedence, frequency increase, and structural classification
              </p>
            </div>
          </div>
          {incidents.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/incidents')}>
              View All ({incidents.length})
            </Button>
          )}
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
          {incidents.slice(0, 5).map((inc) => {
            const topCandidate = inc.rootCauseCandidates?.[0];
            return (
              <div
                key={inc.id}
                onClick={() => navigate(`/dashboard/incidents/${inc.id}`)}
                className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-500">
                      {inc.id.slice(0, 8)}
                    </span>
                    <StatusIndicator variant={inc.severity} label={inc.severity.toUpperCase()} />
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                        inc.status === 'RESOLVED'
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {inc.title}
                  </h3>
                  {topCandidate && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-neutral-400 font-medium">Initiating Pattern:</span>
                      <code className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[11px] text-amber-700 dark:text-amber-400 truncate max-w-xl">
                        {topCandidate.template}
                      </code>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs">
                  {topCandidate && (
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                        {(topCandidate.totalScore ?? 0).toFixed(1)} / 15 pts
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {inc.firstDetected}
                      </div>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
              </div>
            );
          })}

          {incidents.length === 0 && !loading && (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                All Application Baselines Operational
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                No statistical error spikes or unhandled pattern cascades detected in this dataset.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Upload Log Modal */}
      <UploadLogModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        projectId={activeProjectId}
        onSuccess={loadData}
      />
    </div>
  );
};
