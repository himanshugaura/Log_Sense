import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  ArrowRight,
  FolderKanban,
  Trash2,
  Calendar,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';
import { SetupStepper } from '../../components/shared/SetupStepper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../context/ProjectContext';
import { Organization } from '../../types';

export const OrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    organizations,
    selectOrganization,
    createOrganization,
    deleteOrganization,
    refreshOrganizations,
  } = useProject();

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshOrganizations().finally(() => setLoading(false));
  }, []);

  const handleSelectOrg = (org: Organization) => {
    selectOrganization(org.id);
    navigate(`/organizations/${org.id}/projects`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createOrganization(newOrgName.trim());
      setNewOrgName('');
      setModalOpen(false);
      navigate(`/organizations/${created.id}/projects`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this organization and its projects?')) return;
    try {
      await deleteOrganization(id);
    } catch (err: any) {
      alert('Failed to delete organization: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'LogSense' }, { label: 'Organizations' }]}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <SetupStepper currentStep={1} />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Organizations</h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Select or create an organization to manage your microservices and telemetry boundaries.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Organization
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs">Loading organizations...</p>
          </div>
        )}

        {/* Organizations Grid */}
        {!loading && organizations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {organizations.map((org) => {
              const projectCount = org._count?.projects ?? 0;
              return (
                <Card
                  key={org.id}
                  padding="md"
                  onClick={() => handleSelectOrg(org)}
                  className="cursor-pointer group hover:border-neutral-400 dark:hover:border-neutral-600 transition-all space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 transition-colors">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {org.name}
                        </h3>
                        <span className="font-mono text-[11px] text-neutral-400 block truncate max-w-[200px]">
                          ID: {org.id.slice(0, 13)}...
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, org.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors rounded-lg"
                      title="Delete Organization"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      <FolderKanban className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{projectCount} {projectCount === 1 ? 'Project' : 'Projects'}</span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100 group-hover:translate-x-0.5 transition-transform">
                      <span>Select Projects</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Zero State */}
        {!loading && organizations.length === 0 && (
          <div className="py-12 px-6 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-850 mx-auto flex items-center justify-center text-neutral-600 dark:text-neutral-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Create Your First Organization
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Organizations hold your projects, microservices, and incident triage records.
              </p>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 pt-2 text-left">
              <Input
                placeholder="Organization name (e.g., Acme Cloud, Production Ops)"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                autoFocus
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center"
                disabled={creating || !newOrgName.trim()}
              >
                {creating ? 'Creating...' : 'Create Organization & Continue'}
              </Button>
            </form>
          </div>
        )}

        {/* Modal for Creating Organization */}
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
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">New Organization</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-4">
                Define the top-level organization boundary for your telemetry stack.
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
                    Organization Name
                  </label>
                  <Input
                    placeholder="e.g., Core SRE Platform"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-850">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={creating || !newOrgName.trim()}>
                    {creating ? 'Creating...' : 'Create Organization'}
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
