"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Terminal,
  Plus,
  FolderGit2,
  Building2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import {
  useAuthStore,
  type Organization,
  type Project,
} from "@/store/use-auth-store";

export default function DashboardPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const {
    currentOrganization,
    setCurrentOrganization,
    isBackendSynced,
  } = useAuthStore();

  const [newOrgName, setNewOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [isCreatingProj, setIsCreatingProj] = useState(false);

  // 1. Fetch Organizations
  const {
    data: orgsData,
    isLoading: isLoadingOrgs,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        organizations: Organization[];
      }>("/organizations");
      return res.data.organizations || [];
    },
    enabled: isLoaded && !!clerkUser,
  });

  const organizations = orgsData || [];
  const activeOrg = currentOrganization || organizations[0] || null;

  // 2. Fetch Projects for active Organization
  const {
    data: projectsData,
    isLoading: isLoadingProjects,
  } = useQuery({
    queryKey: ["projects", activeOrg?.id],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const res = await apiClient.get<{
        success: boolean;
        projects: Project[];
      }>(`/projects?organizationId=${activeOrg.id}`);
      return res.data.projects || [];
    },
    enabled: !!activeOrg?.id,
  });

  const projects = projectsData || [];

  // Create Org Mutation
  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.post<{
        success: boolean;
        organization: Organization;
      }>("/organizations", { name });
      return res.data.organization;
    },
    onSuccess: (newOrg) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setCurrentOrganization(newOrg);
      setNewOrgName("");
      setIsCreatingOrg(false);
    },
  });

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async ({
      name,
      orgId,
    }: {
      name: string;
      orgId: string;
    }) => {
      const res = await apiClient.post<{
        success: boolean;
        project: Project;
      }>("/projects", {
        organizationId: orgId,
        name,
        timezone: "UTC",
      });
      return res.data.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", activeOrg?.id] });
      setNewProjName("");
      setIsCreatingProj(false);
    },
  });

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 font-mono text-xs">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Authenticating session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800/80 bg-[#0c0c0e] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-zinc-100">
              LogSense
            </span>
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-xs font-mono text-zinc-400">
            {activeOrg?.name || "Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Backend Sync Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900/60 text-[11px] font-mono text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendSynced ? "bg-emerald-500" : "bg-amber-500"
              }`}
            ></span>
            <span>{isBackendSynced ? "PostgreSQL Synced" : "Syncing DB..."}</span>
          </div>

          {/* User Button */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200">
                {clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {clerkUser?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8 rounded-md border border-zinc-700",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Welcome back, {clerkUser?.firstName || "Engineer"}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Select an organization workspace to monitor microservices and triage incidents.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreatingOrg(true)}
              className="px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>New Organization</span>
            </button>
          </div>
        </div>

        {/* Modal / Inline Creator for Org */}
        {isCreatingOrg && (
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3 max-w-md">
            <div className="text-xs font-semibold text-zinc-200">
              Create New Organization
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Acme Cloud Corp"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <button
                disabled={!newOrgName.trim() || createOrgMutation.isPending}
                onClick={() => createOrgMutation.mutate(newOrgName.trim())}
                className="px-3 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-medium text-xs transition-colors"
              >
                {createOrgMutation.isPending ? "Creating..." : "Save"}
              </button>
              <button
                onClick={() => setIsCreatingOrg(false)}
                className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Organizations Selector Bar (if multiple exist) */}
        {organizations.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => setCurrentOrganization(org)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  activeOrg?.id === org.id
                    ? "bg-zinc-100 text-zinc-950 font-semibold"
                    : "border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}

        {/* Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">
                Monitored Projects
              </h2>
              <p className="text-xs text-zinc-500">
                {activeOrg
                  ? `Projects registered under ${activeOrg.name}`
                  : "No organization selected"}
              </p>
            </div>

            {activeOrg && (
              <button
                onClick={() => setIsCreatingProj(true)}
                className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            )}
          </div>

          {/* Inline Project Creator */}
          {isCreatingProj && activeOrg && (
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3 max-w-md">
              <div className="text-xs font-semibold text-zinc-200">
                Create Monitored Project
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. E-Commerce Production"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                />
                <button
                  disabled={!newProjName.trim() || createProjectMutation.isPending}
                  onClick={() =>
                    createProjectMutation.mutate({
                      name: newProjName.trim(),
                      orgId: activeOrg.id,
                    })
                  }
                  className="px-3 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-medium text-xs transition-colors"
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => setIsCreatingProj(false)}
                  className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Projects Grid */}
          {isLoadingOrgs || isLoadingProjects ? (
            <div className="p-8 border border-zinc-800/80 rounded-lg bg-zinc-900/20 text-center text-xs text-zinc-500 font-mono">
              Loading workspace projects...
            </div>
          ) : !activeOrg ? (
            <div className="p-10 border border-dashed border-zinc-800 rounded-lg text-center space-y-3">
              <Building2 className="w-8 h-8 text-zinc-600 mx-auto" />
              <div>
                <div className="text-sm font-medium text-zinc-300">
                  No organization yet
                </div>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Create your first organization to organize cloud projects and microservices.
                </p>
              </div>
              <button
                onClick={() => setIsCreatingOrg(true)}
                className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Organization</span>
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-10 border border-dashed border-zinc-800 rounded-lg text-center space-y-3">
              <FolderGit2 className="w-8 h-8 text-zinc-600 mx-auto" />
              <div>
                <div className="text-sm font-medium text-zinc-300">
                  No projects in this organization
                </div>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Register an application or environment to start streaming logs and running Drain3 RCA.
                </p>
              </div>
              <button
                onClick={() => setIsCreatingProj(true)}
                className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 rounded-lg border border-zinc-800 bg-[#0e0e11] hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-white transition-colors">
                          {proj.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {proj.timezone}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {proj.description || "Production cloud microservices cluster."}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 text-[11px] font-mono">
                      ID: {proj.id.slice(0, 8)}...
                    </span>
                    <Link
                      href={`/projects/${proj.id}`}
                      className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open Workspace</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
