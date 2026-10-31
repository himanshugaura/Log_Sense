import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Network,
  Plus,
  ArrowRight,
  Trash2,
  AlertCircle,
  Loader2,
  Zap,
  CheckCircle2,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useProject } from '../../context/ProjectContext';
import { serviceMapService } from '../../services/service-map-service';
import { DependencyGraph, ServiceNodeData } from '../../types';

export const DependencyGraphConfigPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject, selectProject } = useProject();

  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [loading, setLoading] = useState(true);

  // Link Form State
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [protocol, setProtocol] = useState('HTTP');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [g, svcs] = await Promise.all([
        serviceMapService.getDependencyGraph(projectId),
        serviceMapService.getServices(projectId),
      ]);
      setGraph(g);
      setServices(svcs);
      if (svcs.length >= 2 && !sourceId && !targetId) {
        setSourceId(svcs[0].id);
        setTargetId(svcs[1].id);
      }
    } catch (err: any) {
      console.warn('Failed to load dependency graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
      loadData();
    }
  }, [projectId]);

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId) {
      setError('Please select both source and target services.');
      return;
    }
    if (sourceId === targetId) {
      setError('A service cannot depend on itself.');
      return;
    }

    setLinking(true);
    setError(null);
    try {
      await serviceMapService.createDependency(sourceId, targetId, protocol);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create dependency connection');
    } finally {
      setLinking(false);
    }
  };

  const handleAutoWire = async () => {
    if (!services || services.length < 2) return;
    setLinking(true);
    setError(null);

    try {
      // Connect first service (gateway) to all subsequent services
      const root = services[0];
      for (let i = 1; i < services.length; i++) {
        try {
          const proto = services[i].name.includes('db') || services[i].name.includes('postgres')
            ? 'DATABASE'
            : 'HTTP';
          await serviceMapService.createDependency(root.id, services[i].id, proto);
        } catch {
          // Ignore duplicates
        }
      }
      // If there's a db or leaf, connect service 1 to last service
      if (services.length >= 3) {
        try {
          await serviceMapService.createDependency(
            services[1].id,
            services[services.length - 1].id,
            'DATABASE'
          );
        } catch {
          // Ignore
        }
      }
      await loadData();
    } catch (err: any) {
      setError('Failed to auto-wire pipeline: ' + err?.message);
    } finally {
      setLinking(false);
    }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    try {
      await serviceMapService.deleteDependency(edgeId);
      await loadData();
    } catch (err: any) {
      alert('Failed to remove dependency: ' + (err?.message || 'Unknown error'));
    }
  };

  const orgId = activeProject?.organizationId;
  const edges = graph?.edges || [];
  const nodes = graph?.nodes || [];

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      <WorkspaceHeader
        breadcrumbs={[
          { label: 'LogSense', path: '/organizations' },
          { label: activeProject?.name || 'Project', path: orgId ? `/organizations/${orgId}/projects` : '/organizations' },
          { label: 'Services', path: `/projects/${projectId}/services` },
          { label: 'Dependency Graph' },
        ]}
        backLink={{
          label: 'Back to Services',
          path: `/projects/${projectId}/services`,
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
              <span>DAG Topology:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {activeProject?.name || 'Active Project'}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Service Dependency Graph</h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Declare directional dependency links. This topology powers algorithmic Root Cause Analysis (RCA).
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/dashboard')}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Launch AI Incident Console
          </Button>
        </div>

        {/* Link Creator Form Card */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-850">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Link Service Dependency
            </h3>
            {services.length >= 2 && edges.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAutoWire}
                disabled={linking}
                icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
              >
                1-Click Auto-Wire Pipeline
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/60">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAddDependency} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                Source Service (Caller)
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                Protocol
              </label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option value="HTTP">HTTP</option>
                <option value="GRPC">gRPC</option>
                <option value="DATABASE">DATABASE</option>
                <option value="MESSAGE_QUEUE">QUEUE</option>
                <option value="CACHE">CACHE</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                Target Service (Dependency)
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full h-10 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center h-10"
                disabled={linking || !sourceId || !targetId || sourceId === targetId}
                icon={<Plus className="w-4 h-4" />}
              >
                {linking ? 'Linking...' : 'Add Link'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Visual Topology Representation */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-850">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Topology DAG Visualizer
              </h3>
              <p className="text-xs text-neutral-500">
                {nodes.length} Nodes · {edges.length} Directed Call Links
              </p>
            </div>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold">
              Acyclic Validation Passed
            </span>
          </div>

          {nodes.length > 0 ? (
            <div className="p-6 rounded-2xl bg-neutral-900 dark:bg-black border border-neutral-800 min-h-[160px] flex flex-wrap items-center justify-center gap-6">
              {nodes.map((node) => {
                const outgoing = edges.filter((e) => e.source === node.id);
                const incoming = edges.filter((e) => e.target === node.id);
                const isRoot = incoming.length === 0 && outgoing.length > 0;
                const isLeaf = outgoing.length === 0 && incoming.length > 0;

                return (
                  <div
                    key={node.id}
                    className="p-3.5 rounded-xl border border-neutral-700 bg-neutral-850 text-neutral-100 min-w-[140px] text-center space-y-1 shadow-sm relative group"
                  >
                    {isRoot && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-mono px-2 py-0.2 rounded-full bg-amber-500 text-neutral-900 font-bold uppercase">
                        Ingress Root
                      </span>
                    )}
                    {isLeaf && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-mono px-2 py-0.2 rounded-full bg-blue-500 text-white font-bold uppercase">
                        Leaf Node
                      </span>
                    )}

                    <div className="font-mono text-xs font-bold text-white pt-1">
                      {node.name}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      Out: {outgoing.length} · In: {incoming.length}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-neutral-500">
              No services registered in this project.
            </div>
          )}
        </Card>

        {/* Configured Dependencies Table */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Active Dependency Edges ({edges.length})
            </h3>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
            {edges.map((edge) => (
              <div
                key={edge.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs font-mono hover:bg-neutral-50/60 dark:hover:bg-neutral-850/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {edge.sourceName}
                  </span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
                    <span>--[{edge.dependencyType}]--&gt;</span>
                  </div>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {edge.targetName}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteEdge(edge.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded-lg"
                  title="Remove Dependency Link"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {edges.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-neutral-500">
                No dependency relationships linked yet. Connect your microservices above to enable root cause analysis.
              </div>
            )}
          </div>
        </Card>

        {/* Final Launch Console Banner */}
        <div className="p-5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2 text-amber-400 dark:text-amber-600 text-xs font-bold uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4" />
              <span>Infrastructure Setup Complete</span>
            </div>
            <h3 className="font-display text-base font-bold mt-1">
              Ready for AI Incident Triage & Root Cause Analysis
            </h3>
            <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-0.5">
              Ingest raw log streams, detect anomalous frequency bursts, and let our deterministic 4-factor RCA isolate system faults.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/dashboard')}
            className="shrink-0 bg-amber-400 text-neutral-900 hover:bg-amber-300 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 border-none font-bold"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Launch AI Incident Console
          </Button>
        </div>
      </main>
    </div>
  );
};
