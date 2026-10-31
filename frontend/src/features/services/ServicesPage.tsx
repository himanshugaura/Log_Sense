import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Cpu,
  Plus,
  ArrowRight,
  Network,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Zap,
  UploadCloud,
  FileCode2,
} from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UploadLogModal } from '../../components/modals/UploadLogModal';
import { useProject } from '../../context/ProjectContext';
import { serviceMapService } from '../../services/service-map-service';
import { ServiceNodeData } from '../../types';

export const ServicesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject, selectProject } = useProject();

  const [services, setServices] = useState<ServiceNodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadModalService, setUploadModalService] = useState<{ id: string; name: string } | null>(null);

  const loadServices = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await serviceMapService.getServices(projectId);
      setServices(list);
    } catch (err: any) {
      console.warn('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
      loadServices();
    }
  }, [projectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !projectId) return;

    // Validate alphanumeric, underscores, hyphens
    const cleanName = serviceName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      setError('Service name can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await serviceMapService.createService(projectId, cleanName, serviceDesc.trim() || undefined);
      setServiceName('');
      setServiceDesc('');
      setModalOpen(false);
      await loadServices();
    } catch (err: any) {
      setError(err?.message || 'Failed to create service');
    } finally {
      setCreating(false);
    }
  };

  const handleLoadStandardArchitecture = async () => {
    if (!projectId) return;
    setCreating(true);
    setError(null);
    const standardServices = [
      { name: 'api-gateway', desc: 'Edge ingress and route reverse-proxy' },
      { name: 'auth-service', desc: 'JWT session tokens and OAuth validation' },
      { name: 'payment-service', desc: 'Billing checkout processing & webhooks' },
      { name: 'postgres-db', desc: 'Primary transactional relational database' },
    ];

    try {
      for (const s of standardServices) {
        try {
          await serviceMapService.createService(projectId, s.name, s.desc);
        } catch {
          // Ignore if already exists
        }
      }
      await loadServices();
    } catch (err: any) {
      setError('Failed to load standard services: ' + err?.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service and its dependency connections?')) return;
    try {
      await serviceMapService.deleteService(id);
      await loadServices();
    } catch (err: any) {
      alert('Failed to delete service: ' + (err?.message || 'Unknown error'));
    }
  };

  const orgId = activeProject?.organizationId;

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      <WorkspaceHeader
        breadcrumbs={[
          { label: 'LogSense', path: '/organizations' },
          { label: activeProject?.name || 'Project', path: orgId ? `/organizations/${orgId}/projects` : '/organizations' },
          { label: 'Microservices' },
        ]}
        backLink={{
          label: 'Back to Projects',
          path: orgId ? `/organizations/${orgId}/projects` : '/organizations',
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
              <span>Project:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {activeProject?.name || 'Active Project'}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Registered Microservices</h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Register the microservices and components that emit log telemetry in your architecture.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Service
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/projects/${projectId}/dependency-graph`)}
              disabled={services.length === 0}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Configure Dependency Graph
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs">Loading services...</p>
          </div>
        )}

        {/* Services List Table / Cards */}
        {!loading && services.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {services.map((svc) => (
                <Card key={svc.id} padding="md" className="flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 shrink-0 mt-0.5">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {svc.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold">
                            Active Node
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 font-mono">
                          Dependencies: {svc.dependencies?.length || 0} configured
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(svc.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded-lg shrink-0"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setUploadModalService({ id: svc.id, name: svc.name })}
                      icon={<UploadCloud className="w-3.5 h-3.5" />}
                    >
                      Upload Logs to {svc.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/dashboard/logs?service=${encodeURIComponent(svc.name)}`)}
                      icon={<FileCode2 className="w-3.5 h-3.5" />}
                    >
                      View Logs
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Next Step Banner */}
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Network className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                <span className="text-neutral-700 dark:text-neutral-300">
                  {services.length} services registered. Next step: Link upstream and downstream call relationships into the DAG.
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/dependency-graph`)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Proceed to Dependency Graph
              </Button>
            </div>
          </div>
        )}

        {/* Zero State */}
        {!loading && services.length === 0 && (
          <div className="py-12 px-6 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-850 mx-auto flex items-center justify-center text-neutral-600 dark:text-neutral-300">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Register Your Microservices
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Add microservice identifiers (e.g., api-gateway, auth-service, payment-service, postgres-db).
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setModalOpen(true)}
                className="w-full justify-center"
                icon={<Plus className="w-4 h-4" />}
              >
                Add First Microservice
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleLoadStandardArchitecture}
                disabled={creating}
                className="w-full justify-center"
                icon={<Zap className="w-4 h-4 text-amber-500" />}
              >
                {creating ? 'Registering...' : '1-Click Quickstart: Load Standard 4 Services'}
              </Button>
            </div>
          </div>
        )}

        {/* Modal for Creating Service */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
            <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-6 shadow-xl">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute right-4 top-4 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">Register Microservice</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Service names should be lowercase alphanumeric identifiers (e.g. auth-service).
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/60">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Service Identifier
                  </label>
                  <Input
                    placeholder="e.g., auth-service, order-processor"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    autoFocus
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Alphanumeric, hyphens, and underscores only.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Description (Optional)
                  </label>
                  <Input
                    placeholder="e.g., Handles JWT verification and user logins"
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-850">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={creating || !serviceName.trim()}>
                    {creating ? 'Registering...' : 'Register Service'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload Log Modal for Specific Service */}
        <UploadLogModal
          isOpen={!!uploadModalService}
          onClose={() => setUploadModalService(null)}
          projectId={projectId || ''}
          targetService={uploadModalService}
          onSuccess={loadServices}
        />
      </main>
    </div>
  );
};
