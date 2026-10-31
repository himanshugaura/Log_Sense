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
import { Anomaly, SeverityLevel, AnomalyType, ServiceNodeData } from '../../types';
import { anomalyService } from '../../services/anomaly-service';
import { serviceMapService } from '../../services/service-map-service';
import { MOCK_ACTIVITY_CHART } from '../../mocks';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';

export const AnomaliesPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { activeProjectId } = useProject();

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProjectId) return;
    serviceMapService.getServices(activeProjectId).then(setServices).catch(console.warn);
  }, [activeProjectId]);

  const loadAnomalies = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const list = await anomalyService.getAnomalies(activeProjectId, {
        service: selectedService,
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
  }, [activeProjectId, selectedService, selectedSeverity]);

  const activeAnomaly = anomalies.find((a) => a.id === selectedAnomalyId) || anomalies[0];

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#262626' : '#e5e5e5';
  const textColor = isDark ? '#a3a3a3' : '#737373';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipBorder = isDark ? '#262626' : '#e5e5e5';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Anomaly Detection & Timeline
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Statistical frequency deviation tracking, error surges, and Drain3 template novelty emergence.
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
              Correlated deviation bursts recorded across monitored services
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-amber-700 dark:text-amber-500">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>FastAPI Anomaly Detector Active</span>
          </div>
        </div>

        <div className="h-56 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_ACTIVITY_CHART}>
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
              <Bar dataKey="anomalies" fill="#b45309" radius={[4, 4, 0, 0]} name="Anomaly Spikes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Two Column Section: Anomaly List & Focused Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Anomalies Feed */}
        <div className="lg:col-span-6 space-y-3">
          <Card padding="sm" className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All Services ({services.length})</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 text-xs text-neutral-800 dark:text-neutral-200"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
          </Card>

          <div className="space-y-2.5">
            {anomalies.map((anom) => {
              const isSelected = anom.id === activeAnomaly?.id;
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
                        {anom.id.slice(0, 10)}
                      </span>
                      <StatusIndicator variant={anom.severity} label={anom.severity.toUpperCase()} />
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {anom.timestamp}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {anom.title}
                  </h3>

                  <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                    {anom.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-[11px]">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Service: {anom.service}
                    </span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      Observed: {typeof anom.observedValue === 'number' ? anom.observedValue.toFixed(1) : anom.observedValue} (base: {anom.expectedBaseline})
                    </span>
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
                  </div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {activeAnomaly.title}
                  </h2>
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

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Observed Value:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                    {typeof activeAnomaly.observedValue === 'number' ? activeAnomaly.observedValue.toFixed(2) : activeAnomaly.observedValue} {activeAnomaly.unit}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Baseline Expected:</span>
                  <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 text-sm">
                    {activeAnomaly.expectedBaseline} {activeAnomaly.unit}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Pattern / Context Description:
                </span>
                <p className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono leading-relaxed text-neutral-800 dark:text-neutral-200">
                  {activeAnomaly.description}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
                <span>Timestamp: {activeAnomaly.timestamp}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/dashboard/logs?service=${activeAnomaly.service}`)}
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
