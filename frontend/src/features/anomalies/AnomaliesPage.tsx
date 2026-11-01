import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { Anomaly, SeverityLevel } from '../../types';
import { anomalyService } from '../../services/anomaly-service';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';
import { normalizeLogTemplate } from '../../utils/template-normalizer';

export const AnomaliesPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { activeProjectId, isLoading: isProjectLoading, projects } = useProject();

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadAnomalies = async () => {
    if (!activeProjectId) {
      if (!isProjectLoading) {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const list = await anomalyService.getAnomalies(activeProjectId, {
        anomalyType: selectedType,
        severity: selectedSeverity as any,
      });
      setAnomalies(list);
      if (list.length > 0 && (!selectedAnomalyId || !list.find((a) => a.id === selectedAnomalyId))) {
        setSelectedAnomalyId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, [activeProjectId, isProjectLoading, selectedType, selectedSeverity]);

  const activeAnomaly = anomalies.find((a) => a.id === selectedAnomalyId) || anomalies[0];

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#262626' : '#e5e5e5';
  const textColor = isDark ? '#a3a3a3' : '#737373';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipBorder = isDark ? '#262626' : '#e5e5e5';

  // Loading state: Do not render any anomaly UI until telemetry is completely loaded
  if (loading || isProjectLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-4 max-w-md mx-auto text-center animate-fade-in">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shadow-xs">
            <RefreshCw className="w-6 h-6 text-neutral-500 dark:text-neutral-400 animate-spin" />
          </div>
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 animate-pulse border-2 border-white dark:border-neutral-900" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Loading Anomaly Detection Telemetry...
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">
            Evaluating 5-minute statistical moving baselines, frequency standard deviation Z-scores, and template emergence.
          </p>
        </div>
      </div>
    );
  }

  // Zero-state if no project
  if (!activeProjectId || projects.length === 0) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-850 mx-auto flex items-center justify-center text-neutral-600 dark:text-neutral-300">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            No Project Workspace Selected
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Select or create a project workspace to inspect statistical anomalies and baseline deviations.
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Statistical Anomaly Detection & Timeline
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            5-minute moving baseline analysis, sample standard deviation spikes, and template emergence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnomalies}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {activeAnomaly?.relatedIncidentId && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/dashboard/incidents/${activeAnomaly.relatedIncidentId}`)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Correlated Incident Dossier
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Timeline Chart Card */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-100 dark:border-neutral-850">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Interactive Anomaly Activity Timeline
            </h2>
            <p className="text-xs text-neutral-500">
              Deviation events scored with sample standard deviation and Z-scores
            </p>
          </div>
        </div>

        {anomalies.length > 0 ? (
          <div className="h-56 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={anomalies.map((a, i) => ({
                  time: a.timestamp.slice(11, 16) || `A${i + 1}`,
                  observed: typeof a.observedValue === 'number' ? a.observedValue : 1,
                  points: a.points || 0,
                }))}
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
                <Bar dataKey="observed" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Observed Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs text-neutral-500">
            <p>No statistical anomalies detected in the active dataset.</p>
          </div>
        )}
      </Card>

      {/* Two Column Section: Anomaly List & Focused Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Anomalies Feed */}
        <div className="lg:col-span-6 space-y-3">
          <Card padding="sm" className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All Anomaly Types</option>
                <option value="SPIKE">Statistical Spikes</option>
                <option value="NEW_PATTERN">New Patterns</option>
              </select>
            </div>
            <div className="flex-1">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical (13-17 pts)</option>
                <option value="high">High (9-12 pts)</option>
                <option value="medium">Medium / Moderate (5-8 pts)</option>
                <option value="low">Low (1-4 pts)</option>
              </select>
            </div>
          </Card>

          <div className="space-y-2.5">
            {anomalies.map((anom) => {
              const isSelected = anom.id === activeAnomaly?.id;
              const ev = anom.evidence || {};
              const zVal = anom.zScore ?? ev.detection?.zScore;

              return (
                <div
                  key={anom.id}
                  onClick={() => setSelectedAnomalyId(anom.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-neutral-900 bg-white dark:border-neutral-100 dark:bg-[#121212] shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-[#121212]/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-400">
                        {anom.id.slice(0, 8)}
                      </span>
                      <StatusIndicator variant={anom.severity} label={anom.severity.toUpperCase()} />
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {anom.type}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {anom.timestamp}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {anom.displayTitle || normalizeLogTemplate(anom.clusterTemplate || anom.title).displayTitle}
                  </h3>

                  <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                    {anom.shortDescription || normalizeLogTemplate(anom.clusterTemplate || anom.title).shortDescription}
                  </p>

                  <p className="text-[10px] text-neutral-400 font-mono mt-1 line-clamp-1 truncate bg-neutral-100 dark:bg-neutral-850 px-1.5 py-0.5 rounded">
                    Drain3: {anom.clusterTemplate || anom.title}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-neutral-600 dark:text-neutral-400">
                      Observed: <strong className="text-amber-700 dark:text-amber-400">{anom.observedValue}</strong> (base: {anom.expectedBaseline})
                    </span>
                    <div className="flex items-center gap-2">
                      {zVal !== undefined && (
                        <span className="font-mono font-semibold text-neutral-500">
                          Z: {Number(zVal).toFixed(2)}
                        </span>
                      )}
                      {anom.points !== undefined && (
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {anom.points} pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {anomalies.length === 0 && !loading && (
              <Card padding="lg" className="text-center py-10 text-xs text-neutral-500">
                No anomalies registered for this query.
              </Card>
            )}
          </div>
        </div>

        {/* Right: Detailed Inspection Panel */}
        <div className="lg:col-span-6">
          {activeAnomaly ? (
            <Card padding="lg" className="space-y-5 sticky top-20">
              <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-neutral-400">
                      {activeAnomaly.id}
                    </span>
                    <StatusIndicator
                      variant={activeAnomaly.severity}
                      label={activeAnomaly.severity.toUpperCase()}
                    />
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold uppercase">
                      {activeAnomaly.type}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {activeAnomaly.displayTitle || normalizeLogTemplate(activeAnomaly.clusterTemplate || activeAnomaly.title).displayTitle}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {activeAnomaly.shortDescription || normalizeLogTemplate(activeAnomaly.clusterTemplate || activeAnomaly.title).shortDescription}
                  </p>
                </div>

                {activeAnomaly.relatedIncidentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/incidents/${activeAnomaly.relatedIncidentId}`)}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    View Incident
                  </Button>
                )}
              </div>

              {/* Statistical Baseline Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Observed Count:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400 text-base">
                    {activeAnomaly.observedValue}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">current 1m window</span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Baseline Mean:</span>
                  <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 text-base">
                    {typeof activeAnomaly.evidence?.baseline?.mean === 'number'
                      ? activeAnomaly.evidence.baseline.mean.toFixed(2)
                      : activeAnomaly.expectedBaseline}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">5m moving baseline</span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Sample Std Dev (s):</span>
                  <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 text-base">
                    {typeof activeAnomaly.evidence?.baseline?.stdDev === 'number'
                      ? activeAnomaly.evidence.baseline.stdDev.toFixed(2)
                      : '0.00'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    thr: {typeof activeAnomaly.evidence?.baseline?.threshold === 'number'
                      ? activeAnomaly.evidence.baseline.threshold.toFixed(2)
                      : '-'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Z-Score & Score:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-base">
                    {activeAnomaly.zScore !== undefined
                      ? Number(activeAnomaly.zScore).toFixed(2)
                      : activeAnomaly.evidence?.detection?.zScore !== undefined
                      ? Number(activeAnomaly.evidence.detection.zScore).toFixed(2)
                      : '-'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block">
                    Points: {activeAnomaly.points ?? activeAnomaly.evidence?.scoring?.totalPoints ?? 0} / 17
                  </span>
                </div>
              </div>

              {/* Template / Pattern Box */}
              <div>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Drain3 Template / Log Pattern:
                </span>
                <p className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono leading-relaxed text-neutral-800 dark:text-neutral-200 break-words">
                  {activeAnomaly.clusterTemplate || activeAnomaly.description}
                </p>
              </div>

              {/* Affected Clusters Around Same Time */}
              {activeAnomaly.affectedClusters && activeAnomaly.affectedClusters.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-850">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    <span>Affected Log Clusters in Perturbation Window ([-5m, +5m]):</span>
                  </div>
                  <div className="space-y-1.5">
                    {activeAnomaly.affectedClusters.map((aff, aIdx) => (
                      <div
                        key={aIdx}
                        className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-neutral-400">
                            Cluster {aff.clusterId?.slice(0, 8)}
                          </span>
                          <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            count: {aff.currentCount} (base: {aff.baselineMean.toFixed(1)}, Z: {aff.zScore.toFixed(1)})
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300 truncate">
                          {aff.template}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
                <span>Timestamp: {activeAnomaly.timestamp}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/dashboard/logs?query=${encodeURIComponent(activeAnomaly.clusterId || '')}`)}
                >
                  View Related Logs
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="lg" className="text-center py-12 text-xs text-neutral-500">
              Select an anomaly from the left feed to inspect statistical deviation.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
