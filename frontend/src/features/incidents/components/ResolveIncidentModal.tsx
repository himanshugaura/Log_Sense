import React, { useState } from 'react';
import {
  CheckCircle2,
  X,
  Sparkles,
  Loader2,
  FileCheck2,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Incident } from '../../../types';

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  onConfirm: (resolutionNotes: string) => Promise<void>;
}

export const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = ({
  isOpen,
  onClose,
  incident,
  onConfirm,
}) => {
  const [resolutionNotes, setResolutionNotes] = useState(
    incident.resolutionNotes || ''
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Derive suggested RCA fix from incident structured report or summary
  const suggestedFix =
    incident.structuredReport?.immediateRemediationSteps ||
    incident.structuredReport?.whatMightBeCausingIt ||
    incident.aiSummary ||
    '';

  const handleAutoFill = () => {
    if (suggestedFix) {
      setResolutionNotes(
        `[Verified Resolution Based on RCA Evidence]\n${suggestedFix}\n\nActions Taken:\n- Confirmed initiating root cause with log trace evidence.\n- Applied immediate mitigation and verified service health restoration.`
      );
    }
  };

  const handleAddTag = (tagText: string) => {
    if (resolutionNotes.includes(tagText)) return;
    const prefix = resolutionNotes ? `${resolutionNotes}\n` : '';
    setResolutionNotes(`${prefix}[${tagText}] `);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(resolutionNotes.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Mark Incident as Resolved
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                {incident.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="rounded-xl p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <FileCheck2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Cross-Microservice Knowledge Graph</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
              Recording your verified resolution saves on-call engineers from re-investigating this issue when peer microservices in your organization hit similar failure patterns.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                How was this incident solved?
              </label>
              {suggestedFix && (
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Fill from RCA Fix
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Executed pg_terminate_backend on stuck PID 4821 holding deadlock lock. Increased HikariCP maxPoolSize from 20 to 50 in ConfigMap and restarted worker pods."
              className="w-full text-xs font-mono p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>

          {/* Quick Tag Pills */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Quick Resolution Tags:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Killed Stuck Process',
                'Pool Size Tuned',
                'Config / Secret Updated',
                'Service Restarted',
                'Hotfix Deployed',
                'Traffic Rerouted',
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:border-amber-500 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
              icon={
                submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )
              }
            >
              {submitting ? 'Resolving...' : 'Confirm & Mark Resolved'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
