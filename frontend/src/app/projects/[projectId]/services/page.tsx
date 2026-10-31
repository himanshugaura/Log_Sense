"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Cpu,
  Search,
  Network,
  LayoutGrid,
  RefreshCw,
  FolderGit2,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { CreateServiceModal } from "@/components/services/create-service-modal";
import {
  AddDependencyModal,
  type ServiceItem,
} from "@/components/services/add-dependency-modal";
import { ServiceCard } from "@/components/services/service-card";
import { ServiceTopologyView } from "@/components/services/service-topology-view";

export default function ServicesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"grid" | "topology">("grid");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSourceForDep, setSelectedSourceForDep] = useState<ServiceItem | null>(null);

  // Fetch Services for this Project
  const {
    data: servicesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["services", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        services: ServiceItem[];
      }>(`/services?projectId=${projectId}`);
      return res.data.services || [];
    },
    enabled: !!projectId,
  });

  const services = servicesData || [];

  const filteredServices = services.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">
              Services & Topology
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {services.length} Registered
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Define microservice identities and dependencies for incident correlation and root cause analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher (Grid vs Topology) */}
          <div className="p-1 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center text-xs">
            <button
              onClick={() => setActiveTab("grid")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                activeTab === "grid"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setActiveTab("topology")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                activeTab === "topology"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>DAG Topology</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Service</span>
          </button>
        </div>
      </div>

      {/* Topology Map View (Always visible in topology tab) */}
      {activeTab === "topology" && (
        <ServiceTopologyView projectId={projectId} />
      )}

      {/* Grid Controls (Search & Filters) */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter services by identifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 transition-colors"
          title="Refresh Services"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="h-64 border border-zinc-800/80 rounded-xl bg-[#0c0c0e] flex items-center justify-center text-xs text-zinc-500 font-mono">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          Loading registered microservices...
        </div>
      ) : services.length === 0 ? (
        /* Empty State */
        <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center space-y-4 bg-zinc-950/40">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="font-semibold text-sm text-zinc-200">
              No services registered yet
            </h3>
            <p className="text-xs text-zinc-500">
              Register microservices (e.g. <code className="text-zinc-400 font-mono">auth-service</code>, <code className="text-zinc-400 font-mono">database-service</code>) to associate log files and map caller dependencies.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register First Service</span>
          </button>
        </div>
      ) : filteredServices.length === 0 ? (
        /* No Search Matches */
        <div className="p-8 border border-zinc-800 rounded-xl text-center text-xs text-zinc-500 font-mono">
          No services matching &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        /* Services Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              projectId={projectId}
              allServices={services}
              onAddDependency={(src) => setSelectedSourceForDep(src)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateServiceModal
        projectId={projectId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <AddDependencyModal
        projectId={projectId}
        sourceService={selectedSourceForDep}
        services={services}
        isOpen={!!selectedSourceForDep}
        onClose={() => setSelectedSourceForDep(null)}
      />
    </div>
  );
}
