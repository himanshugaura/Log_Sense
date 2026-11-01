import React, { useState, useEffect } from 'react';
import {
  Search,
  FolderTree,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusIndicator } from '../../components/ui/Badge';
import { LogCluster } from '../../types';
import { logService } from '../../services/log-service';
import { useProject } from '../../context/ProjectContext';

export const LogClustersPage: React.FC = () => {
  const { activeProjectId } = useProject();

  const [clusters, setClusters] = useState<LogCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const loadClusters = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const data = await logService.getLogClusters(activeProjectId, {
        level: selectedSeverity,
        query: searchQuery,
      });

      data.sort((a, b) =>
        sortOrder === 'desc'
          ? b.occurrenceCount - a.occurrenceCount
          : a.occurrenceCount - b.occurrenceCount
      );

      setClusters(data);
      if (data.length > 0 && !expandedClusterId) {
        setExpandedClusterId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, [activeProjectId, searchQuery, selectedSeverity, sortOrder]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(id);
    setTimeout(() => setCopiedTemplate(null), 1500);
  };

  /**
   * Highlights wildcard parameters (<*>) in parsed templates.
   */
  const renderTemplateWithWildcards = (template: string) => {
    const parts = template.split(/(<\*>)/g);
    return (
      <span className="font-mono text-xs">
        {parts.map((part, idx) =>
          part === '<*>' ? (
            <span
              key={idx}
              className="text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-400/15 px-1 py-0.5 rounded font-bold"
            >
              &lt;*&gt;
            </span>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Log Template Clusters
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Automated pattern mining groups recurring log lines into reusable structured signatures with variable parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadClusters}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <div className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
            {clusters.length} Mined Templates
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            <Input
              placeholder="Search template text or cluster ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full h-10.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
            >
              <option value="all">All Severities</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="h-10.5 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shrink-0 text-xs"
              title="Toggle sort order by occurrences"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono">{sortOrder.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Clusters List */}
      <div className="space-y-3">
        {clusters.map((cluster) => {
          const isExpanded = expandedClusterId === cluster.id;

          return (
            <Card
              key={cluster.id}
              padding="none"
              className={`transition-colors overflow-hidden ${
                isExpanded ? 'ring-1 ring-neutral-400 dark:ring-neutral-600' : ''
              }`}
            >
              {/* Cluster Item Header Bar */}
              <div
                onClick={() => setExpandedClusterId(isExpanded ? null : cluster.id)}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/60 dark:hover:bg-neutral-850/60 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-neutral-400 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {cluster.id.slice(0, 12)}
                      </span>
                      <StatusIndicator variant={cluster.severity} label={cluster.severity} />
                      {cluster.anomalyScore > 0.6 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 font-bold uppercase">
                          Anomaly Burst Tagged
                        </span>
                      )}
                    </div>

                    <div className="text-neutral-900 dark:text-neutral-100 leading-relaxed pr-2">
                      {renderTemplateWithWildcards(cluster.template)}
                    </div>
                  </div>
                </div>

                {/* Right Counts & Stats */}
                <div className="flex items-center gap-6 sm:self-center shrink-0 text-xs">
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100 block">
                      {cluster.occurrenceCount.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-neutral-500">Events Mined</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(cluster.template, cluster.id);
                    }}
                    icon={
                      copiedTemplate === cluster.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {copiedTemplate === cluster.id ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Expanded Sample Logs Accordion */}
              {isExpanded && (
                <div className="border-t border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-400 block mb-1">First Detected:</span>
                      <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                        {cluster.firstSeen}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-400 block mb-1">Last Detected:</span>
                      <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                        {cluster.lastSeen}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white dark:bg-[#121212] border border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-400 block mb-1">Anomaly Deviation Score:</span>
                      <span
                        className={`font-bold ${
                          cluster.anomalyScore > 0.6
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {cluster.anomalyScore.toFixed(2)} / 1.00 ({cluster.trend})
                      </span>
                    </div>
                  </div>

                  {/* Sample Raw Log Lines */}
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Sample Raw Log Entries Matching Pattern:
                    </h4>
                    <div className="space-y-1.5">
                      {cluster.sampleLogs.map((sample, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-neutral-900 text-neutral-200 dark:bg-black font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed"
                        >
                          {sample}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {clusters.length === 0 && !loading && (
          <Card padding="lg" className="text-center py-12 text-xs text-neutral-500">
            No clusters matched the search criteria. Upload raw logs to discover new templates.
          </Card>
        )}
      </div>
    </div>
  );
};
