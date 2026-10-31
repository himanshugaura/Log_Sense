import React, { useState, useEffect } from 'react';
import {
  Shield,
  Sparkles,
  Server,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useProject } from '../../context/ProjectContext';

export const SettingsPage: React.FC = () => {
  const { user } = useUser();
  const { activeProject } = useProject();

  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [checking, setChecking] = useState(false);

  const checkConnectivity = async () => {
    setChecking(true);
    setBackendStatus('checking');
    setEngineStatus('checking');

    // 1. Check API gateway
    try {
      const res = await fetch('http://localhost:5000/health');
      if (res.ok) setBackendStatus('online');
      else setBackendStatus('offline');
    } catch {
      setBackendStatus('offline');
    }

    // 2. Check processing engine
    try {
      const res = await fetch('http://localhost:8000/health');
      if (res.ok) setEngineStatus('online');
      else setEngineStatus('offline');
    } catch {
      setEngineStatus('offline');
    }

    setChecking(false);
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Workspace & System Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Active project configuration, telemetry health, and account security preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkConnectivity}
            disabled={checking}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />}
          >
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Telemetry & Processing Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Core Gateway */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
              <Server className="w-4 h-4" />
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                backendStatus === 'online'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : backendStatus === 'checking'
                  ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
              }`}
            >
              {backendStatus}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Core API & Ingestion Gateway
            </h3>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Telemetry pipeline & data persistence
            </p>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            Handles project authentication, structured log persistence, and secure object storage streams.
          </p>
        </Card>

        {/* Pattern & Anomaly Engine */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
              <Cpu className="w-4 h-4" />
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                engineStatus === 'online'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : engineStatus === 'checking'
                  ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
              }`}
            >
              {engineStatus}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Pattern & Anomaly Engine
            </h3>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Real-time clustering & root cause analysis
            </p>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            Performs log pattern extraction, statistical burst detection, and topology-aware root cause scoring.
          </p>
        </Card>

        {/* AI Synthesis Engine */}
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
              ACTIVE
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              AI Synthesis Engine
            </h3>
            <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Automated executive briefings
            </p>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            Generates executive incident summaries, blast radius assessments, and suggested remediation checklists.
          </p>
        </Card>
      </div>

      {/* Active Project Details Card */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="flex items-center gap-2.5">
            <FolderKanban className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Active Project Workspace
              </h2>
              <p className="text-xs text-neutral-500">
                Monitored microservices boundary and telemetry metadata
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Project Name:</span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
              {activeProject?.name || 'Default Workspace'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Project ID:</span>
            <span className="text-neutral-700 dark:text-neutral-300 truncate block">
              {activeProject?.id || 'workspace-uuid'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Organization:</span>
            <span className="text-neutral-700 dark:text-neutral-300">
              {activeProject?.organization?.name || 'Default Organization'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
            <span className="text-neutral-400 block mb-1">Timezone:</span>
            <span className="text-neutral-700 dark:text-neutral-300">
              {activeProject?.timezone || 'UTC'}
            </span>
          </div>
        </div>
      </Card>

      {/* User Authentication Session Card */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-850">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                User & Access Profile
              </h2>
              <p className="text-xs text-neutral-500">
                Active authentication session and role access
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
              {user?.primaryEmailAddress?.emailAddress || 'Authenticated User'}
            </div>
            <div className="font-mono text-neutral-400 text-[11px] mt-0.5">
              Role: Project Administrator
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
            Active Session
          </span>
        </div>
      </Card>
    </div>
  );
};
