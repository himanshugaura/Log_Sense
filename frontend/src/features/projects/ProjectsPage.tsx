import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  ArrowRight,
  Cpu,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../context/ProjectContext';
import { Project } from '../../types';

export const ProjectsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const {
    organizations,
    activeOrganization,
    selectOrganization,
    projects,
    selectProject,
    createProject,
    deleteProject,
    refreshProjects,
  } = useProject();

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      selectOrganization(orgId);
      refreshProjects(orgId).finally(() => setLoading(false));
    }
  }, [orgId]);

  const currentOrg = organizations.find((o) => o.id === orgId) || activeOrganization;

  const displayedProjects = orgId
    ? projects.filter((p) => !p.organizationId || p.organizationId === orgId)
    : projects;

  const handleSelectProject = (project: Project) => {
    selectProject(project.id);
    navigate('/dashboard');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !orgId) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createProject(projectName.trim(), projectDesc.trim() || undefined, orgId);
      setProjectName('');
      setProjectDesc('');
      setModalOpen(false);
      selectProject(created.id);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this microservice project and its log telemetry?')) return;
    try {
      await deleteProject(id);
    } catch (err: any) {
      alert('Failed to delete project: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      <WorkspaceHeader
        breadcrumbs={[
          { label: 'LogSense', path: '/organizations' },
          { label: currentOrg?.name || 'Organization', path: '/organizations' },
          { label: 'Projects' },
        ]}
        backLink={{ label: 'Back to Organizations', path: '/organizations' }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
              <span>Organization:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {currentOrg?.name || 'Active Organization'}
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Projects</h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Each project represents an isolated microservice application and its single log telemetry stream.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs">Loading projects...</p>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && displayedProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedProjects.map((proj) => {
              return (
                <Card
                  key={proj.id}
                  padding="md"
                  onClick={() => handleSelectProject(proj)}
                  className="cursor-pointer group hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 transition-colors">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {proj.name}
                        </h3>
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                          {proj.description || 'No description provided'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, proj.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded-lg"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{proj._count?.logEntries ?? 0} Logs</span>
                      <span>·</span>
                      <span>{proj._count?.anomalies ?? 0} Anomalies</span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100 group-hover:translate-x-0.5 transition-transform">
                      <span>Launch Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Zero State */}
        {!loading && displayedProjects.length === 0 && (
          <div className="py-12 px-6 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-850 mx-auto flex items-center justify-center text-neutral-600 dark:text-neutral-300">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                No Projects Yet
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Create a project workspace to ingest logs, run statistical spike detection, and generate point-based RCA.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 pt-2 text-left">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                  Project Name
                </label>
                <Input
                  placeholder="e.g., Production Core, Billing Dataset"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                  Description (Optional)
                </label>
                <Input
                  placeholder="e.g., Primary application log stream"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center"
                disabled={creating || !projectName.trim()}
              >
                {creating ? 'Creating...' : 'Create Project & Launch Dashboard'}
              </Button>
            </form>
          </div>
        )}

        {/* Modal for Creating Project */}
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
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">New Project</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Create a project to host services and ingest telemetry streams.
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
                    Project Name
                  </label>
                  <Input
                    placeholder="e.g., Production Kubernetes Cluster"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Description (Optional)
                  </label>
                  <Input
                    placeholder="e.g., E-commerce backend microservices stack"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-850">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={creating || !projectName.trim()}>
                    {creating ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
