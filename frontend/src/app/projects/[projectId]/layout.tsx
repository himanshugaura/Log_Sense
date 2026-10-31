"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import {
  Terminal,
  Cpu,
  Layers,
  AlertTriangle,
  FileText,
  Boxes,
  ArrowLeft,
  Activity,
} from "lucide-react";
import { useEffect } from "react";

import { apiClient } from "@/lib/api-client";
import { useAuthStore, type Project } from "@/store/use-auth-store";

export default function ProjectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const pathname = usePathname();
  const { user: clerkUser } = useUser();
  const { setCurrentProject, currentProject } = useAuthStore();

  // Fetch Project Details
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        project: Project;
      }>(`/projects/${projectId}`);
      return res.data.project;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  const navItems = [
    {
      name: "Services",
      href: `/projects/${projectId}/services`,
      icon: Cpu,
      description: "Microservices & Dependency Graph",
    },
    {
      name: "Overview",
      href: `/projects/${projectId}`,
      icon: Activity,
      description: "System Health & Live Metrics",
    },
    {
      name: "Incidents",
      href: `/projects/${projectId}/incidents`,
      icon: AlertTriangle,
      description: "AI RCA & Triage Feed",
    },
    {
      name: "Log Explorer",
      href: `/projects/${projectId}/logs`,
      icon: FileText,
      description: "S3 Ingestion & Live Logs",
    },
    {
      name: "Mined Templates",
      href: `/projects/${projectId}/clusters`,
      icon: Boxes,
      description: "Drain3 Pattern Clusters",
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex overflow-hidden font-sans">
      {/* Workspace Sidebar */}
      <aside className="w-64 border-r border-zinc-800/80 bg-[#0c0c0e] flex flex-col justify-between shrink-0">
        <div>
          {/* Top Brand & Workspace Switcher */}
          <div className="p-4 border-b border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors text-xs font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Workspaces</span>
              </Link>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
                PROD
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-zinc-100 truncate">
                  {project?.name || currentProject?.name || "Loading project..."}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  TZ: {project?.timezone || "UTC"}
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === `/projects/${projectId}`
                  ? pathname === `/projects/${projectId}`
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-zinc-950" : "text-zinc-400"
                    }`}
                  />
                  <div className="truncate">
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-zinc-800/80">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-zinc-200 truncate">
                {clerkUser?.firstName || "Engineer"}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono truncate">
                {clerkUser?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7 rounded border border-zinc-700",
                },
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
        {/* Top Minimal Bar */}
        <header className="h-14 border-b border-zinc-800/80 bg-[#0c0c0e] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <Link
              href="/dashboard"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Projects
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-medium text-zinc-300">
              {project?.name || "Project"}
            </span>
            <span className="text-zinc-700">/</span>
            <span className="font-semibold text-zinc-100 capitalize">
              {pathname.split("/").pop() || "Overview"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Cluster Active</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
