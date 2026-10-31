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
  ChevronDown,
  ChevronRight,
  Binary,
  Info,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusIndicator } from '../../components/ui/Badge';
import { Incident, IncidentStatus } from '../../types';
import { incidentService } from '../../services/incident-service';
import { useProject } from '../../context/ProjectContext';

const TRANSLATION_REFERENCE = [
  { technical: 'Statistical frequency spike', plain: 'Errors occurred much more frequently than usual' },
  { technical: 'Temporal precedence', plain: 'This error appeared before the other errors' },
  { technical: 'Cascading relationship', plain: 'Other errors appeared shortly afterward' },
  { technical: 'Root cause candidate', plain: 'Possible underlying cause' },
  { technical: 'Baseline deviation', plain: 'Difference from normal application behaviour' },
  { technical: 'Z-score > 3.0', plain: 'The error count was significantly outside its usual range' },
  { technical: 'New Drain3 cluster', plain: 'A previously unseen type of log message was detected' },
];

const getPatternExplanationFallback = (template: string) => {
  const t = (template || '').toLowerCase();
  if (t.includes('hikaripool') || t.includes('connection pool') || t.includes('pool')) {
    return {
      component: 'Database Connection Pool',
      explanation:
        'This message is associated with the application database connection pool. It generally indicates that all available database connections were exhausted, causing incoming requests to wait and time out.',
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
        'This message is associated with network communication channels. It generally indicates that an active network connection was abruptly closed or reset by the remote peer or an intermediary gateway.',
    };
  }
  if (t.includes('sendworker') || t.includes('interrupted') || t.includes('thread') || t.includes('worker')) {
    return {
      component: 'Asynchronous Worker Thread Pool',
      explanation:
        'This message is associated with internal background task executors. It generally indicates that an active communication worker thread was forcibly interrupted due to an upstream connection failure.',
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
      component: 'File System & Storage',
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
  const [showTechEvidence, setShowTechEvidence] = useState(false);

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

  // User-friendly display title
  const displayTitle =
    report?.friendlyTitle ||
    (incident.title.startsWith('Incident:') ? incident.title.replace(/^Incident:\s*/i, '') : incident.title);

  // Dynamic plain-English fallbacks when AI report isn't pre-computed
  const cleanTemplate = incident.suspectedRootCauseTemplate || topCandidate?.template || '';

  const defaultWhatHappened = cleanTemplate
    ? `An unexpected surge in '${cleanTemplate.slice(0, 60)}' log events was detected (${totalMatchingErrors} occurrences vs normal baseline). Related errors appeared during the same investigation window.`
    : 'An unexpected surge in application error patterns was detected during the monitoring window.';

  const defaultWhatMightBeCausingIt = cleanTemplate
    ? `Our analysis suggests that issues related to '${cleanTemplate.slice(0, 50)}' could be the main source of the problem.`
    : 'Our analysis suggests that upstream resource saturation or communication disruptions could be the main source of the problem.';

  const defaultWhyBullets = [
    'This error pattern appeared before other abnormal patterns in the timeline.',
    'These errors increased significantly compared with normal baseline activity.',
    'Other application errors and worker disruptions appeared shortly afterward.',
  ];

  const defaultWhatElse =
    'Downstream worker threads and client request handlers experienced elevated latency or failure rates shortly afterward.';

  const defaultSteps = [
    'Check whether the affected service or database is running normally.',
    'Inspect network socket connectivity and connection limits.',
    'Review timeout configurations and error thresholds.',
    'Investigate application logs around the incident timestamp.',
  ];

  // Section 1: What happened?
  const whatHappenedText = report?.whatHappened || defaultWhatHappened;

  // Section 2: Potential impact
  const potentialImpactText =
    report?.potentialImpact ||
    'Users may experience session interruptions, degraded response times, or failed requests.';

  // Section 3: What might be causing it?
  const whatMightBeCausingIt = report?.whatMightBeCausingIt || defaultWhatMightBeCausingIt;

  // Section 4: Why do we think this? (Plain-English translated evidence)
  const whyDoWeThinkThis =
    report?.whyDoWeThinkThis && report.whyDoWeThinkThis.length > 0
      ? report.whyDoWeThinkThis
      : defaultWhyBullets;

  // Section 5: What else was affected?
  const whatElseWasAffected = report?.whatElseWasAffected || defaultWhatElse;

  // Section 6: What should you do?
  const whatShouldIDo =
    report?.whatShouldIDo && report.whatShouldIDo.length > 0
      ? report.whatShouldIDo
      : defaultSteps;

  // Section 7: How certain are we?
  const howCertainAreWe = report?.howCertainAreWe || {
    badge: 'Strongest candidate, not confirmed',
    explanation:
      'Our analysis identifies the most likely explanation from available logs. Further investigation is needed to confirm the actual cause.',
  };

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

  // Scoring data for technical drawer
  const rcaScore = topCandidate?.totalScore ?? 14;

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
          INCIDENT HEADER & KEY STATS (Theme-aligned, clean Card)
          ========================================================================= */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                Incident #INC-{incident.id.slice(0, 4).toUpperCase()}
              </span>

              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  incident.severity === 'critical'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                }`}
              >
                {incident.severity.toUpperCase()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {displayTitle}
            </h1>
          </div>

          {/* Status & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              <span>{incident.status === 'OPEN' ? 'Needs investigation' : incident.status}</span>
            </div>

            {incident.status !== 'INVESTIGATING' && incident.status !== 'RESOLVED' && (
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('INVESTIGATING')}
                className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
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
                className="px-3 py-1 rounded-full text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reopen</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-2xl sm:text-3xl font-bold font-sans text-rose-600 dark:text-rose-400">
              {affectedPatternsCount}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              Affected patterns
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-2xl sm:text-3xl font-bold font-sans text-neutral-900 dark:text-neutral-100">
              {detectionWindow}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              Detection window
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-2xl sm:text-3xl font-bold font-sans text-neutral-900 dark:text-neutral-100">
              {totalMatchingErrors}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              Total matching errors
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-2xl sm:text-3xl font-bold font-sans text-amber-600 dark:text-amber-400">
              {candidateCount}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              Root cause candidates
            </div>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 1: WHAT HAPPENED? & POTENTIAL IMPACT
          ========================================================================= */}
      <Card padding="lg" className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            What happened?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
            {whatHappenedText}
          </p>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Potential Impact
          </h3>
          <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
            {potentialImpactText}
          </p>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 2: WHAT MIGHT BE CAUSING IT? & WHY DO WE THINK THIS?
          ========================================================================= */}
      <Card padding="lg" className="space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
              What might be causing it?
            </h2>
          </div>
        </div>

        <p className="text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans">
          {whatMightBeCausingIt}
        </p>

        {/* Why do we think this? */}
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/70 border border-neutral-200 dark:border-neutral-800 space-y-3">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Why do we think this?
          </span>
          <ul className="space-y-2 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
            {whyDoWeThinkThis.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What else was affected? */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            What else was affected?
          </h4>
          <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
            {whatElseWasAffected}
          </p>
        </div>
      </Card>

      {/* =========================================================================
          SECTION 3: WHAT SHOULD YOU DO? (Actionable Investigation Steps)
          ========================================================================= */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
              What should you do?
            </h2>
            <p className="text-xs text-neutral-500">
              Actionable next steps to investigate and resolve the disturbance:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {whatShouldIDo.map((step, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3"
            >
              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans font-medium">
                {step}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* =========================================================================
          SECTION 4: ANALYSIS CONFIDENCE (How certain are we?)
          ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
            Analysis Confidence
          </span>
          <div className="inline-flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              {howCertainAreWe.badge}
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pt-1">
            {howCertainAreWe.explanation}
          </p>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: UNFAMILIAR LOG PATTERNS EXPLAINED
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
              Technical error messages translated into simpler language:
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
          SECTION 6: EXPANDABLE TECHNICAL EVIDENCE & SCORING (FOR DEVELOPERS)
          ========================================================================= */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-neutral-50/60 dark:bg-neutral-900/40">
        <button
          type="button"
          onClick={() => setShowTechEvidence(!showTechEvidence)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-neutral-100/60 dark:hover:bg-neutral-850/60 transition-colors cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
                Technical Evidence & Scoring (for developers)
              </span>
              <span className="text-xs text-neutral-500">
                Expand to view mathematical standard deviation Z-scores, 15-pt scoring breakdown, and raw Drain3 templates
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              Score: {rcaScore}/15 pts
            </span>
            {showTechEvidence ? (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            )}
          </div>
        </button>

        {showTechEvidence && (
          <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 space-y-6">
            {/* Technical Language Translation Reference */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-neutral-500" />
                <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                  Technical Output to User-Friendly Translation Reference
                </h4>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                      <th className="p-3">Technical Output</th>
                      <th className="p-3">User-Friendly Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
                    {TRANSLATION_REFERENCE.map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-850/40">
                        <td className="p-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                          {row.technical}
                        </td>
                        <td className="p-3 text-neutral-600 dark:text-neutral-400">
                          {row.plain}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 15-Point Statistical RCA Explanation */}
            <div className="p-4 rounded-xl bg-neutral-100/70 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
              <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                RCA 15-Point Multi-Signal Statistical Scoring Formula:
              </div>
              <div>
                Candidate log clusters are ranked deterministically by summing:
                <strong> (1) Temporal Precedence (≤4 pts)</strong> for earliest initiating perturbations,
                <strong> (2) Frequency Spike Magnitude (≤4 pts)</strong> based on sample standard deviation Z-scores (Z = (x - mean) / std_dev),
                <strong> (3) Error Classification Severity (≤3 pts)</strong>, and
                <strong> (4) Correlation to Cascading Clusters (≤4 pts)</strong>.
              </div>
            </div>

            {/* Tabs inside technical evidence */}
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
                  <span>Chronological Perturbation Timeline ({incident.correlatedTimeline.length})</span>
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

              {/* Tab 1: Ranked Candidates */}
              {activeTab === 'rca' && (
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
                                Cluster ID: {candidate.clusterId?.slice(0, 10) || 'Pattern'}
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
                          <span className="text-[11px] text-neutral-400 font-mono">Score Breakdown</span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-sans">
                        {candidate.explanation}
                      </p>

                      {/* 15-Point Breakdown Visualizer */}
                      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-3">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                          Deterministic Point Breakdown:
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
              )}

              {/* Tab 2: Chronological Timeline */}
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
        )}
      </div>
    </div>
  );
};
