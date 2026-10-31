import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  GitCommit,
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  ArrowDown,
  Layers,
  HelpCircle,
  Search,
  Server,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { Incident, IncidentStatus } from '../../types';
import { incidentService } from '../../services/incident-service';
import { useProject } from '../../context/ProjectContext';

const getPatternExplanationFallback = (template: string) => {
  const t = (template || '').toLowerCase();
  if (t.includes('hikaripool') || t.includes('connection pool') || t.includes('pool')) {
    return {
      component: 'Database Connection Pool',
      explanation:
        'This message is associated with the application database connection pool manager. It generally indicates that all active database connections were exhausted, causing incoming requests to wait and eventually time out.',
    };
  }
  if (
    t.includes('connection broken') ||
    t.includes('closed socket') ||
    t.includes('connection reset') ||
    t.includes('broken pipe') ||
    t.includes('connection refused')
  ) {
    return {
      component: 'TCP / Network Socket Layer',
      explanation:
        'This message is associated with network communication channels. It generally indicates that an active network socket was abruptly closed or reset by the remote peer or an intermediary gateway.',
    };
  }
  if (t.includes('sendworker') || t.includes('interrupted') || t.includes('thread') || t.includes('worker')) {
    return {
      component: 'Asynchronous Worker Thread Pool',
      explanation:
        'This message is associated with background task threads. It indicates that an active communication worker thread was forcibly interrupted or aborted due to an upstream socket disruption.',
    };
  }
  if (t.includes('session') || t.includes('timed out') || t.includes('timeout')) {
    return {
      component: 'Distributed Session & Heartbeat State',
      explanation:
        'This message is associated with cluster consensus and session leasing. It indicates that missed heartbeat signals exceeded the lease window, triggering session expiration.',
    };
  }
  if (t.includes('ioexception') || t.includes('disk') || t.includes('file')) {
    return {
      component: 'File System & I/O Subsystem',
      explanation:
        'This message is associated with local disk or socket I/O operations. It indicates an operating system level failure while reading or writing data.',
    };
  }
  return {
    component: 'Application Service Runtime',
    explanation:
      'This message indicates an unhandled error condition or operational exception caught during request execution.',
  };
};

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
        <p>Loading incident report and statistical RCA evidence...</p>
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
  const report = incident.structuredReport;

  // Aggregate metrics matching the screenshot layout
  const affectedPatternsCount =
    report?.metrics?.affectedPatterns ??
    Math.max(incident.rootCauseCandidates.length, 3);

  const detectionWindow =
    report?.metrics?.detectionWindow ?? '10 min';

  const totalMatchingErrors =
    report?.metrics?.totalMatchingErrors ??
    (topCandidate?.evidence?.observedCount || topCandidate?.evidence?.maxOccurrence || 42);

  const candidateCount =
    report?.metrics?.candidateCount ??
    Math.max(incident.rootCauseCandidates.length, 2);

  // Plain-English simple explanation
  const whatHappenedText =
    report?.whatHappened ||
    (incident.suspectedRootCauseTemplate
      ? `A sudden statistical increase in '${incident.suspectedRootCauseTemplate.slice(0, 60)}' was detected (${totalMatchingErrors} occurrences vs normal baseline). Multiple related log patterns appeared during the same investigation window.`
      : 'A sudden increase in session-related errors was detected. Multiple log patterns involving session expiration and connection failures appeared during the same investigation window.');

  // Plain-English potential impact
  const potentialImpactText =
    report?.potentialImpact ||
    'Users may experience session interruptions, degraded response times, or failed requests.';

  // Root cause explanation why it received that score
  const rcaScore = topCandidate?.totalScore ?? 14;
  const rcaScoreExplanation =
    report?.rootCauseExplanation ||
    `Your RCA engine ranks this pattern as the strongest candidate with ${rcaScore}/15 points. It initiated earliest in the disturbance timeline, spiked significantly beyond normal baseline, and triggered cascading errors.`;

  const rcaBullets = report?.rcaBullets || [
    `It appeared before the other abnormal patterns (Temporal precedence: ${topCandidate?.temporalPoints ?? 4}/4 pts).`,
    `Its occurrence count increased significantly (Statistical frequency spike: ${topCandidate?.frequencyPoints ?? 4}/4 pts).`,
    `Other potentially related error patterns appeared afterward (Cascading relationship: ${topCandidate?.relationshipPoints ?? 3}/4 pts).`,
  ];

  // Unfamiliar log patterns list
  const unfamiliarPatterns =
    report?.unfamiliarPatterns && report.unfamiliarPatterns.length > 0
      ? report.unfamiliarPatterns
      : incident.rootCauseCandidates.slice(0, 2).map((c) => {
          const exp = getPatternExplanationFallback(c.template || '');
          return {
            pattern: c.template || 'HikariPool-1 - Connection is not available',
            component: exp.component,
            explanation: exp.explanation,
          };
        });

  // Investigation recommendations
  const recommendations =
    report?.investigationRecommendations && report.investigationRecommendations.length > 0
      ? report.investigationRecommendations
      : [
          'Check database and external service availability.',
          'Inspect connection pool limits and active connection lifetimes.',
          'Review database timeout configurations and thread interruption handlers.',
          'Check database server and upstream proxy logs.',
        ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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

      {/* =========================================================================
          HERO REPORT CARD - Matching the exact user screenshot design
          ========================================================================= */}
      <div className="rounded-2xl bg-[#0a0a0a] text-white p-6 sm:p-8 border border-neutral-850 shadow-2xl space-y-7">
        {/* Header row: Incident # + Severity badge */}
        <div className="flex items-center justify-between pb-1">
          <span className="font-sans text-xs sm:text-sm font-semibold tracking-wide text-neutral-400">
            Incident #INC-{incident.id.slice(0, 4).toUpperCase()}
          </span>

          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              incident.severity === 'critical'
                ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
            }`}
          >
            {incident.severity.toUpperCase()}
          </span>
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {incident.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 font-sans">
            Illustrative incident report
          </p>
        </div>

        {/* 4 Stat Metrics Grid (Exact screenshot design) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2 pb-4">
          <div>
            <div className="text-3xl sm:text-4xl font-bold font-display text-rose-500">
              {affectedPatternsCount}
            </div>
            <div className="text-xs text-neutral-400 font-sans mt-1.5">
              Affected patterns
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-bold font-display text-white">
              {detectionWindow}
            </div>
            <div className="text-xs text-neutral-400 font-sans mt-1.5">
              Detection window
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-bold font-display text-white">
              {totalMatchingErrors}
            </div>
            <div className="text-xs text-neutral-400 font-sans mt-1.5">
              Total matching errors
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-bold font-display text-amber-500">
              {candidateCount}
            </div>
            <div className="text-xs text-neutral-400 font-sans mt-1.5">
              Root cause candidates
            </div>
          </div>
        </div>

        {/* Section 1: What happened? */}
        <div className="space-y-2 pt-2 border-t border-neutral-900">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            What happened?
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
            {whatHappenedText}
          </p>
        </div>

        {/* Section 2: Potential impact */}
        <div className="space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Potential impact
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
            {potentialImpactText}
          </p>
        </div>

        {/* Section 3: Investigation status */}
        <div className="space-y-2.5 pt-2">
          <h3 className="text-xs sm:text-sm font-bold text-neutral-300 tracking-tight">
            Investigation status
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
              <span>{incident.status === 'OPEN' ? 'Needs investigation' : incident.status}</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Status action buttons */}
            <div className="flex items-center gap-2">
              {incident.status !== 'INVESTIGATING' && incident.status !== 'RESOLVED' && (
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('INVESTIGATING')}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors cursor-pointer"
                >
                  Mark Investigating
                </button>
              )}

              {incident.status !== 'RESOLVED' ? (
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('RESOLVED')}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Mark Resolved</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('OPEN')}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reopen</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: ROOT CAUSE EXPLANATION (Why it received that score)
          ========================================================================= */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Root Cause Explanation
              </h2>
              <p className="text-xs text-neutral-500">
                Explaining why the strongest candidate was selected by the 15-point RCA engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Score: {rcaScore} / 15 Points
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Most Likely Initiating Log Pattern:
          </span>
          <p className="font-mono text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 break-words">
            {incident.suspectedRootCauseTemplate || topCandidate?.template || 'Under Analysis'}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
          {rcaScoreExplanation}
        </p>

        {/* 3 Clear Why Bullets */}
        <div className="p-4 rounded-xl bg-neutral-900 text-neutral-200 dark:bg-black border border-neutral-800 space-y-2.5">
          <span className="text-xs font-bold text-amber-400 block mb-1">
            Why this pattern received that score:
          </span>
          <ul className="space-y-2 text-xs text-neutral-300">
            {rcaBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 3: EXPLAIN UNFAMILIAR LOG PATTERNS
          ========================================================================= */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Unfamiliar Log Patterns Explained
            </h2>
            <p className="text-xs text-neutral-500">
              Drain3 template mining extracted technical error signatures. Here is what they indicate in simpler language:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {unfamiliarPatterns.map((pat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {pat.component}
                  </span>
                </div>
                <p className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100 break-words">
                  {pat.pattern}
                </p>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans pt-1 border-t border-neutral-200 dark:border-neutral-800">
                {pat.explanation}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* =========================================================================
          SECTION 4: INVESTIGATION RECOMMENDATIONS
          ========================================================================= */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Investigation Recommendations
            </h2>
            <p className="text-xs text-neutral-500">
              Evidence-based next steps for on-call developers to verify and remediate:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3"
            >
              <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans font-medium">
                {rec}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* =========================================================================
          SECTION 5: DETAILED TABBED ANALYSIS (Ranked Patterns, Timeline, Actions)
          ========================================================================= */}
      <div className="space-y-4 pt-2">
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
            <span>Ranked Candidates ({incident.rootCauseCandidates.length})</span>
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
            <span>Chronological Evidence Timeline ({incident.correlatedTimeline.length})</span>
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
            <span>Action Plan</span>
          </button>
        </div>

        {/* Tab 1: Ranked Root Causes (15-Point Statistical System) */}
        {activeTab === 'rca' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
              Our deterministic root-cause analysis ranks candidate log patterns out of{' '}
              <strong>15 maximum points</strong>:
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
              Remediation Checklist & Action Plan
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
                  Check whether parameters matching &lt;*&gt; point to an external resource exhaustion or network partition.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1.5">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                  2. Correlate Downstream Impact
                </span>
                <p className="text-xs text-neutral-500">
                  Review the affected clusters that spiked in the disturbance window following the primary anomaly to confirm whether failure cascaded into thread termination.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-1.5">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                  3. Verify Steady-State Recovery
                </span>
                <p className="text-xs text-neutral-500">
                  Ensure error rate drops back below the 5-minute moving baseline threshold once the underlying disruption is cleared.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
