import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Search,
  Filter,
  ChevronRight,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusIndicator } from '../../components/ui/Badge';
import { Incident, IncidentStatus, SeverityLevel, ServiceNodeData } from '../../types';
import { incidentService } from '../../services/incident-service';
import { serviceMapService } from '../../services/service-map-service';
import { useProject } from '../../context/ProjectContext';

export const IncidentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useProject();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  useEffect(() => {
    if (!activeProjectId) return;
    serviceMapService.getServices(activeProjectId).then(setServices).catch(console.warn);
  }, [activeProjectId]);

  const loadIncidents = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const data = await incidentService.getIncidents(activeProjectId, {
        severity: selectedSeverity as any,
        status: selectedStatus as any,
        service: selectedService,
        query: searchQuery,
      });
      setIncidents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [activeProjectId, searchQuery, selectedSeverity, selectedStatus, selectedService]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Incident Management & Triage
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Multi-service correlated incidents with automated Gemini AI summaries, 4-factor ranked root causes, and verifiable log evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadIncidents}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <div className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
            {incidents.filter((i) => i.status !== 'RESOLVED').length} Active Incidents
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <Input
              placeholder="Search incident title, ID, or root service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Incidents List */}
      <div className="space-y-3.5">
        {incidents.map((inc) => (
          <Card
            key={inc.id}
            padding="none"
            className="hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors cursor-pointer overflow-hidden"
            onClick={() => navigate(`/dashboard/incidents/${inc.id}`)}
          >
            <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-neutral-400">
                    {inc.id.slice(0, 10)}
                  </span>
                  <StatusIndicator variant={inc.severity} label={inc.severity.toUpperCase()} />
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      inc.status === 'RESOLVED'
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        : inc.status === 'INVESTIGATING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                    }`}
                  >
                    {inc.status}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    Detected: {inc.firstDetected}
                  </span>
                </div>

                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {inc.title}
                </h2>

                <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 max-w-4xl leading-relaxed">
                  {inc.aiSummary}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-neutral-400">Suspected Root Cause:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {inc.suspectedRootCauseService}
                  </span>

                  <span className="text-neutral-300 dark:text-neutral-700">·</span>
                  <span className="text-neutral-400">Blast Radius:</span>
                  <div className="flex items-center gap-1">
                    {inc.affectedServices.map((svc) => (
                      <span
                        key={svc}
                        className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-3 lg:self-center shrink-0">
                <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Enter RCA Room
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {incidents.length === 0 && !loading && (
          <Card padding="lg" className="text-center py-12 text-xs text-neutral-500 space-y-3">
            <p>No active incidents found in the active project.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/logs')}
            >
              Upload Logs to Trigger Detection
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
