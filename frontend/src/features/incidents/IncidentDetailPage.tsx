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
  RotateCcw,
  RefreshCw,
  TrendingUp,
  Activity,
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
  const [activeTab, setActiveTab] = useState<'rca' | 'timeline' | 'action_plan'>('rca');

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
      const ok = await incidentService.updateStatus(activeProjectId, incident.id, newStatus);
      if (ok) {
        setIncident({ ...incident, status: newStatus });
        setStatusMessage(`Incident transitioned to ${newStatus}.`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-neutral-500 space-y-2">
        <RefreshCw className="w-5 h-5 mx-auto animate-spin text-neutral-400" />
        <p>Loading RCA dossier and statistical evidence...</p>
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
          The requested incident does not exist in the active dataset.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/incidents')}>
          Back to Incidents
        </Button>
      </div>
    );
  }

  const topCandidate = incident.rootCauseCandidates[0];

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
            <span>AI Evidence-Backed Incident Brief (Gemini)</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-neutral-200 font-sans whitespace-pre-wrap">
            {incident.aiSummary}
          </p>
        </div>

        {/* Key Metrics / Attributes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Top Root Cause Pattern:</span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs truncate block">
              {incident.suspectedRootCauseTemplate || topCandidate?.template || 'Under Analysis'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">RCA Candidates:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              {incident.rootCauseCandidates.length} Log Patterns
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Evidence Anomalies:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              {incident.correlatedTimeline.length} Events
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Top Candidate Score:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              {topCandidate ? `${topCandidate.totalScore} / 15 pts` : 'N/A'}
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
          <span>Ranked Log Patterns (15-Point RCA Engine)</span>
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
          <span>Chronological Evidence Timeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('action_plan')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'action_plan'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Investigation Action Plan</span>
        </button>
      </div>

      {/* Tab 1: Ranked Root Causes (15-Point Statistical System) */}
      {activeTab === 'rca' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            Our deterministic root-cause analysis ranks candidate log patterns out of <strong>15 maximum points</strong>:
            <strong> (1) Temporal Precedence (≤4 pts)</strong> for earliest initiating patterns,
            <strong> (2) Frequency Spike Magnitude (≤4 pts)</strong> based on statistical standard deviation Z-scores,
            <strong> (3) Error Classification (≤3 pts)</strong>, and
            <strong> (4) Relationship to Affected Clusters (≤4 pts)</strong>.
          </div>

          <div className="space-y-4">
            {incident.rootCauseCandidates.map((candidate, idx) => (
              <Card key={candidate.clusterId || idx} padding="lg" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-850">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-400 font-bold">
                          Cluster: {candidate.clusterId?.slice(0, 10) || 'Pattern'}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Rank #{candidate.rank || idx + 1}
                        </span>
                      </div>
                      <p className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100 break-words">
                        {candidate.template}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {candidate.totalScore} <span className="text-sm font-normal text-neutral-400">/ 15</span>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-mono">Deterministic Score</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
                  {candidate.explanation}
                </p>

                {/* 15-Point Breakdown Visualizer */}
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                    Point Breakdown:
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-400 block mb-0.5">Temporal Precedence</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {candidate.temporalPoints} <span className="text-xs text-neutral-400">/ 4</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-400 block mb-0.5">Frequency Surge (Z-Score)</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {candidate.frequencyPoints} <span className="text-xs text-neutral-400">/ 4</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-400 block mb-0.5">Classification Severity</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {candidate.classificationPoints} <span className="text-xs text-neutral-400">/ 3</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-400 block mb-0.5">Cluster Relationships</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {candidate.relationshipPoints} <span className="text-xs text-neutral-400">/ 4</span>
                      </span>
                    </div>
                  </div>

                  {candidate.evidence && (
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 space-y-1">
                      <div>
                        Baseline: {candidate.evidence.baselineMean?.toFixed(2) ?? 0} logs/min · Count in window: {candidate.evidence.observedCount ?? 0} · Z-score: {candidate.evidence.zScore?.toFixed(2) ?? 'N/A'}
                      </div>
                      {candidate.evidence.firstSeen && (
                        <div>First Observed At: {candidate.evidence.firstSeen}</div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}

            {incident.rootCauseCandidates.length === 0 && (
              <Card padding="lg" className="text-center py-10 text-xs text-neutral-500">
                Evaluating candidate log clusters for this incident.
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Correlated Timeline */}
      {activeTab === 'timeline' && (
        <Card padding="lg">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-850">
            Chronological Anomaly Perturbation Sequence
          </h3>

          <div className="space-y-6 relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
            {incident.correlatedTimeline.map((item) => (
              <div key={item.id} className="relative">
                <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-[#121212]" />
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <StatusIndicator variant={item.severity} label={item.severity.toUpperCase()} />
                    <span className="font-mono text-neutral-400">{item.time}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {item.event}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] text-neutral-500 mt-1 font-mono break-words">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {incident.correlatedTimeline.length === 0 && (
              <div className="text-xs text-neutral-500 py-6 text-center">
                No chronological timeline events logged for this incident.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab 3: Action Plan */}
      {activeTab === 'action_plan' && (
        <Card padding="lg" className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 pb-2 border-b border-neutral-100 dark:border-neutral-850">
            Recommended Action Plan & Remediation
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1.5">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                1. Inspect Initiating Cluster Pattern
              </span>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 font-mono">
                {incident.suspectedRootCauseTemplate || topCandidate?.template || 'Under analysis'}
              </p>
              <p className="text-xs text-neutral-500">
                Check whether parameters matching &lt;*&gt; (such as socket addresses, file descriptors, or error codes) point to an external resource exhaustion or network partition.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1.5">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                2. Correlate Downstream Impact
              </span>
              <p className="text-xs text-neutral-500">
                Review the affected clusters that spiked in the 5-minute disturbance window following the primary anomaly to confirm whether failure cascaded into thread termination or queue backpressure.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1.5">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                3. Verify Steady-State Recovery
              </span>
              <p className="text-xs text-neutral-500">
                Ensure error rate drops back below the 5-minute moving baseline threshold (mean + 2*s) once the underlying disruption is cleared.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
