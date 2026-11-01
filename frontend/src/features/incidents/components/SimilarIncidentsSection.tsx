import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitCompare,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Layers,
  Server,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { incidentService } from '../../../services/incident-service';
import { SimilarIncident } from '../../../types';

interface SimilarIncidentsSectionProps {
  projectId: string;
  incidentId: string;
}

export const SimilarIncidentsSection: React.FC<SimilarIncidentsSectionProps> = ({
  projectId,
  incidentId,
}) => {
  const navigate = useNavigate();
  const [similarIncidents, setSimilarIncidents] = useState<SimilarIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchSimilar = async () => {
      setLoading(true);
      try {
        const results = await incidentService.getSimilarIncidents(projectId, incidentId);
        if (mounted) {
          setSimilarIncidents(results);
          if (results.length > 0) {
            setExpandedId(results[0].id); // auto-expand top match
          }
        }
      } catch (err) {
        console.warn('Could not fetch similar incidents:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (projectId && incidentId) {
      fetchSimilar();
    }

    return () => {
      mounted = false;
    };
  }, [projectId, incidentId]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Card padding="lg" className="border border-neutral-200 dark:border-neutral-800 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Similar Historical Incidents Across Organization
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold uppercase">
                  Bonus Feature
                </span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Drain3 pattern match & cross-microservice verified resolution reuse
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <Layers className="w-3.5 h-3.5 text-neutral-400" />
          <span>
            {loading ? 'Scanning org...' : `${similarIncidents.length} related failure pattern${similarIncidents.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-8 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            Scanning peer microservices in your organization for matching Drain3 templates...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && similarIncidents.length === 0 && (
        <div className="py-6 px-4 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center space-y-2 bg-neutral-50/50 dark:bg-neutral-900/30">
          <AlertCircle className="w-5 h-5 text-neutral-400 mx-auto" />
          <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            No Earlier Similar Incidents Found
          </h4>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            This failure signature has not been observed in other microservices in your organization. Once resolved, this post-mortem will be indexed to assist future incidents.
          </p>
        </div>
      )}

      {/* Matches List */}
      {!loading && similarIncidents.length > 0 && (
        <div className="space-y-3">
          {similarIncidents.map((past) => {
            const isExpanded = expandedId === past.id;
            const isHighMatch = past.similarityScore >= 60;
            const isMedMatch = past.similarityScore >= 35;

            return (
              <div
                key={past.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-850/60 transition-all hover:border-neutral-300 dark:hover:border-neutral-700"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(past.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-neutral-50/40 dark:bg-neutral-900/40"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Match Score Badge */}
                    <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono shrink-0 flex items-center gap-1.5 ${
                        isHighMatch
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : isMedMatch
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20'
                      }`}
                    >
                      <span>{past.similarityScore}% Match</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Cross Service vs Same Service Badge */}
                        {past.isCrossService ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                            <Server className="w-3 h-3" />
                            Cross-Service: {past.projectName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            Same Service: {past.projectName}
                          </span>
                        )}

                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {past.title}
                        </span>

                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            past.status === 'RESOLVED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {past.status}
                        </span>
                      </div>

                      {/* Similarity Reason Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {past.similarityReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1"
                          >
                            <span className="w-1 h-1 rounded-full bg-neutral-400" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {new Date(past.startedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4 text-xs">
                    {/* Root Cause Drain3 Template */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-mono">
                        Historical Root Cause Template (Drain3)
                      </span>
                      <div className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 break-words">
                        {past.rootCauseTemplate}
                      </div>
                    </div>

                    {/* How It Was Solved (Verified Engineer Fix OR AI Fallback) */}
                    {past.resolutionNotes ? (
                      <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Verified Resolution Recorded by Engineer</span>
                          </div>
                          {past.resolvedAt && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                              Resolved {new Date(past.resolvedAt).toISOString().slice(0, 10)}
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-800 dark:text-neutral-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                          {past.resolutionNotes}
                        </p>
                      </div>
                    ) : past.recommendedRemediation ? (
                      <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-semibold text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>RCA Suggested Action Plan from Historical Outage</span>
                        </div>
                        <p className="text-neutral-700 dark:text-neutral-300 text-[11px] leading-relaxed">
                          {past.recommendedRemediation}
                        </p>
                      </div>
                    ) : null}

                    {/* Footer Nav Link */}
                    <div className="flex items-center justify-end pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/dashboard/incidents/${past.id}`)}
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                      >
                        Inspect Historical Dossier
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
