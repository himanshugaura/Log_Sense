import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Flame,
  Sparkles,
  GitCommit,
  CheckSquare,
  FileCode2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Network,
  ExternalLink,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { Incident, IncidentStatus } from '../../types';
import { incidentService } from '../../services/incident-service';
import { useProject } from '../../context/ProjectContext';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProjectId } = useProject();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rca' | 'timeline' | 'checklist'>('rca');

  const fetchIncident = async () => {
    if (!id || !activeProjectId) return;
    setLoading(true);
    try {
      const data = await incidentService.getIncidentById(activeProjectId, id);
      setIncident(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id, activeProjectId]);

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    if (!incident || !activeProjectId) return;
    setStatusUpdating(true);
    try {
      const updated = await incidentService.updateIncidentStatus(
        activeProjectId,
        incident.id,
        newStatus
      );
      if (updated) {
        setIncident(updated);
        setStatusMessage(`Incident transitioned to ${newStatus}.`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleToggleChecklist = async (checkId: string) => {
    if (!incident) return;
    const updated = await incidentService.toggleChecklistItem(incident, checkId);
    setIncident(updated);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-neutral-500 space-y-2">
        <RefreshCw className="w-5 h-5 mx-auto animate-spin text-neutral-400" />
        <p>Loading RCA dossier from backend...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
          Incident {id} Not Found
        </h2>
        <p className="text-xs text-neutral-500">
          The requested incident does not exist in the active project.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/incidents')}>
          Back to Incidents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top back navigation & status message banner */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/incidents"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Incidents</span>
        </Link>

        {statusMessage && (
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Incident Dossier Header Card */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-850">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs font-bold text-neutral-400">
                {incident.id}
              </span>
              <StatusIndicator variant={incident.severity} label={incident.severity.toUpperCase()} />
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  incident.status === 'RESOLVED'
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    : incident.status === 'INVESTIGATING'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                }`}
              >
                {incident.status}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Detected: {incident.firstDetected}
              </span>
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {incident.title}
            </h1>
          </div>

          {/* Status Transitions */}
          <div className="flex items-center gap-2">
            {incident.status !== 'INVESTIGATING' && incident.status !== 'RESOLVED' && (
              <Button
                variant="outline"
                size="sm"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('INVESTIGATING')}
              >
                Mark Investigating
              </Button>
            )}

            {incident.status !== 'RESOLVED' ? (
              <Button
                variant="primary"
                size="sm"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('RESOLVED')}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Mark Resolved
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('OPEN')}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reopen Incident
              </Button>
            )}
          </div>
        </div>

        {/* AI Incident Summary Box */}
        <div className="p-4 sm:p-5 rounded-xl bg-neutral-900 text-neutral-100 dark:bg-black border border-neutral-800 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Incident Executive Brief</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-neutral-200 font-sans">
            {incident.aiSummary}
          </p>
        </div>

        {/* Key Metrics / Attributes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Suspected Root Cause:</span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
              {incident.suspectedRootCauseService}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Impacted Services:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              {incident.affectedServices.length} Nodes
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Timeline Points:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              {incident.correlatedTimeline.length} Evidence Events
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Top Confidence:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              {incident.rootCauseCandidates[0]?.confidenceScore || 92}% Score
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('rca')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'rca'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Ranked Root Causes (4-Factor Algorithm)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <GitCommit className="w-4 h-4" />
          <span>Correlated Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'checklist'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Remediation & Checklist</span>
        </button>
      </div>

      {/* Tab 1: Ranked Root Causes (4-Factor Algorithm) */}
      {activeTab === 'rca' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            Our deterministic RCA algorithm ranks candidates based on 4 independent factors: <strong>(1) Temporal Precedence</strong> (earliest anomaly), <strong>(2) Topology Centrality</strong> (DAG upstream impact), <strong>(3) Error Volume Surge</strong> (Poisson/Z-score deviation), and <strong>(4) Novelty</strong> (new pattern novelty).
          </div>

          <div className="space-y-4">
            {incident.rootCauseCandidates.map((candidate, idx) => (
              <Card key={candidate.service} padding="lg" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-850">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                        {candidate.service}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Rank #{idx + 1} Candidate Root Cause Service
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {candidate.confidenceScore}%
                    </div>
                    <span className="text-[11px] text-neutral-400">Composite Confidence</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
                  {candidate.reasoning}
                </p>

                {/* 4-Factor Breakdown Visualizer */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                    Algorithmic 4-Factor Scoring Breakdown:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {candidate.supportingEvidence.map((ev, eIdx) => (
                      <div key={eIdx} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="font-mono">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suggested Remediation */}
                <div>
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block mb-2">
                    Suggested Automated Actions:
                  </span>
                  <div className="space-y-1.5">
                    {candidate.suggestedRemediation.map((rem, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-2.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200"
                      >
                        → {rem}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Correlated Timeline */}
      {activeTab === 'timeline' && (
        <Card padding="lg">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-850">
            Chronological Cascading Anomaly Sequence
          </h3>

          <div className="space-y-6 relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
            {incident.correlatedTimeline.map((item, idx) => (
              <div key={item.id} className="relative">
                <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-[#121212]" />
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      {item.service}
                    </span>
                    <span className="font-mono text-neutral-400">{item.time}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.event}
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: Investigation Checklist */}
      {activeTab === 'checklist' && (
        <Card padding="lg">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-850">
            SRE Incident Resolution Checklist
          </h3>

          <div className="space-y-3">
            {incident.investigationChecklist.map((item) => (
              <label
                key={item.id}
                onClick={() => handleToggleChecklist(item.id)}
                className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                  item.completed
                    ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-neutral-400 line-through'
                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  readOnly
                  className="rounded border-neutral-400 text-neutral-900 focus:ring-0"
                />
                <span className="text-xs font-mono">{item.text}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
