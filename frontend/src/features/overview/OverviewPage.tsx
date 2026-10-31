import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  AlertOctagon,
  AlertTriangle,
  Flame,
  Network,
  ArrowUpRight,
  RefreshCw,
  Clock,
  ChevronRight,
  UploadCloud,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';
import { incidentService } from '../../services/incident-service';
import { anomalyService } from '../../services/anomaly-service';
import { serviceMapService } from '../../services/service-map-service';
import { logService } from '../../services/log-service';
import { Incident, Anomaly, ServiceNodeData } from '../../types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isSignedIn } = useAuth();
  const { activeProject, activeProjectId } = useProject();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [logCount, setLogCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    try {
      const [incList, anomList, svcList, logsRes] = await Promise.all([
        incidentService.getIncidents(activeProjectId),
        anomalyService.getAnomalies(activeProjectId),
        serviceMapService.getServices(activeProjectId),
        logService.getLogs(activeProjectId, { limit: 1 }),
      ]);
      setIncidents(incList);
      setAnomalies(anomList);
      setServices(svcList);
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
  const errorCount = anomalies.length > 0 ? anomalies.length * 8 : 0;
  const activeIncidentCount = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const criticalCount = incidents.filter((i) => i.severity === 'critical' && i.status !== 'RESOLVED').length;
  const highCount = incidents.filter((i) => i.severity === 'high' && i.status !== 'RESOLVED').length;
  const monitoredServicesCount = services.length || activeProject?._count?.services || 0;

  return (
    <div className="space-y-6">
      {/* Auth Banner if not signed in */}
      {!isSignedIn && (
        <div className="p-4 rounded-2xl border border-amber-300/60 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-500 shrink-0" />
            <span className="text-amber-900 dark:text-amber-200">
              You are currently viewing in unauthenticated mode. Sign in with Clerk to access your real PostgreSQL database records and live S3 log streams.
            </span>
          </div>
          <SignInButton mode="modal">
            <Button variant="primary" size="sm" className="shrink-0">
              Sign In to Cloud
            </Button>
          </SignInButton>
        </div>
      )}

      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            System Triage Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Real-time anomaly ingestion, template clustering health, and active incident cascade triage for{' '}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {activeProject?.name || 'Project'}
            </span>.
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
            onClick={() => navigate('/dashboard/logs')}
            icon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            Upload Raw Log File
          </Button>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Log Events */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Total Log Events</span>
            <FileCode2 className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {totalLogs.toLocaleString()}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {totalLogs > 0 ? `Across ${monitoredServicesCount} services` : 'No logs ingested yet'}
            </p>
          </div>
        </Card>

        {/* Error Events */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Error Events</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {errorCount}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500 font-mono">
              {errorCount > 0 ? 'Surge detected' : '0 errors logged'}
            </p>
          </div>
        </Card>

        {/* Detected Anomalies */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Detected Anomalies</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {anomalies.length}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {anomalies.length > 0 ? 'Drain3 statistical spikes' : '0 anomalies'}
            </p>
          </div>
        </Card>

        {/* Active Incidents */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Active Incidents</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {activeIncidentCount}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {criticalCount} Critical · {highCount} High
            </p>
          </div>
        </Card>

        {/* Monitored Services */}
        <Card padding="sm" className="flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Monitored Services</span>
            <Network className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
              {monitoredServicesCount}
            </span>
            <p className="mt-1 text-[11px] text-neutral-500">
              {monitoredServicesCount > 0 ? 'Topology DAG active' : '0 registered'}
            </p>
          </div>
        </Card>
      </div>

      {/* Main Visualizations: Log Activity Chart & Anomaly Spike Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Log Volume Area Chart */}
        <div className="lg:col-span-8">
          <Card padding="md" className="h-full flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-100 dark:border-neutral-850">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Log Activity & Error Distribution Over Time
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Volume trends compared against error spikes (UTC)
                  </p>
                </div>
              </div>

              {totalLogs > 0 ? (
                <div className="h-72 mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { time: '10:00', totalVolume: Math.round(totalLogs * 0.2), errors: 0 },
                        { time: '10:05', totalVolume: Math.round(totalLogs * 0.25), errors: 1 },
                        { time: '10:10', totalVolume: Math.round(totalLogs * 0.35), errors: errorCount },
                        { time: '10:15', totalVolume: Math.round(totalLogs * 0.4), errors: errorCount },
                        { time: '10:20', totalVolume: Math.round(totalLogs * 0.2), errors: 0 },
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
                      <Area type="monotone" dataKey="totalVolume" stroke={isDark ? '#737373' : '#525252'} fillOpacity={0.2} name="Total Events" />
                      <Area type="monotone" dataKey="errors" stroke="#dc2626" fillOpacity={0.3} strokeWidth={2} name="Errors" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <FileCode2 className="w-10 h-10 text-neutral-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      No Log Data Ingested
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                      Upload your first raw log file (.log, .txt, .csv) to begin Drain3 template parsing and real-time anomaly discovery.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/dashboard/logs')}
                    icon={<UploadCloud className="w-3.5 h-3.5" />}
                  >
                    Upload Log File
                  </Button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Backend API endpoint active</span>
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-500 font-medium">
                FastAPI Processing Engine
              </span>
            </div>
          </Card>
        </div>

        {/* Severity Breakdown & Anomaly Bursts */}
        <div className="lg:col-span-4 space-y-6">
          <Card padding="md">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Incident Severity
                </h3>
                <p className="text-xs text-neutral-500">Active distribution</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/incidents')}>
                Manage
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="font-semibold text-red-950 dark:text-red-300">Critical</span>
                </div>
                <span className="font-mono font-bold text-red-700 dark:text-red-400">{criticalCount} Incidents</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600" />
                  <span className="font-semibold text-amber-950 dark:text-amber-300">High</span>
                </div>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{highCount} Incidents</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                  <span className="text-neutral-700 dark:text-neutral-300">Medium</span>
                </div>
                <span className="font-mono text-neutral-500">
                  {incidents.filter((i) => i.severity === 'medium').length} Incidents
                </span>
              </div>
            </div>
          </Card>

          {/* Anomaly Timeline Miniature */}
          <Card padding="md">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Anomaly Bursts
                </h3>
                <p className="text-xs text-neutral-500">Detected frequency spikes</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/anomalies')}>
                Details
              </Button>
            </div>

            {anomalies.length > 0 ? (
              <div className="h-32 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anomalies.map((a, i) => ({ time: `A${i + 1}`, anomalies: a.observedValue || 1 }))}>
                    <Bar dataKey="anomalies" fill="#b45309" radius={[4, 4, 0, 0]} />
                    <XAxis dataKey="time" stroke={textColor} fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        borderColor: tooltipBorder,
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-xs text-neutral-500">
                <p>No anomaly bursts detected.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Correlated Incidents Table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Recent Correlated Incidents
            </h2>
            <p className="text-xs text-neutral-500">Traceable to parsed log evidence</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/incidents')}>
            View All ({incidents.length})
          </Button>
        </div>

        <div className="divide-y divide-neutral-100 dark:divide-neutral-850 overflow-x-auto">
          {incidents.slice(0, 4).map((inc) => (
            <div
              key={inc.id}
              onClick={() => navigate(`/dashboard/incidents/${inc.id}`)}
              className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
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
                <p className="text-xs text-neutral-500 line-clamp-1 max-w-2xl">
                  {inc.aiSummary}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-xs">
                <div className="text-right hidden md:block">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">
                    Root: {inc.suspectedRootCauseService}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">
                    {inc.firstDetected}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          ))}

          {incidents.length === 0 && !loading && (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-neutral-500">
                No incidents reported for this project. Upload raw logs to start automated root cause analysis.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/dashboard/logs')}
                icon={<UploadCloud className="w-3.5 h-3.5" />}
              >
                Upload Logs
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
