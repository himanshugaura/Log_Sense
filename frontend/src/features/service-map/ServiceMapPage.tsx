import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  BackgroundVariant,
} from '@xyflow/react';
import {
  Network,
  AlertTriangle,
  Flame,
  ArrowRight,
  Plus,
  RefreshCw,
  Layers,
  Activity,
  Filter,
  CheckCircle2,
  X,
  FileCode2,
  AlertCircle,
  UploadCloud,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusIndicator } from '../../components/ui/Badge';
import { UploadLogModal } from '../../components/modals/UploadLogModal';
import { ServiceNode } from './ServiceNode';
import { DependencyGraph, DependencyGraphNode } from '../../types';
import { serviceMapService } from '../../services/service-map-service';
import { useTheme } from '../../context/ThemeContext';
import { useProject } from '../../context/ProjectContext';

const nodeTypes = {
  serviceNode: ServiceNode,
};

export const ServiceMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { activeProjectId, projects, selectProject, isLoading: projectLoading } = useProject();

  const [graphData, setGraphData] = useState<DependencyGraph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals for creating service & dependency
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [creatingService, setCreatingService] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkType, setLinkType] = useState('HTTP');
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [uploadLogModalOpen, setUploadLogModalOpen] = useState(false);
  const [uploadTargetService, setUploadTargetService] = useState<{ id: string; name: string } | null>(null);

  const isDark = theme === 'dark';

  const loadGraph = useCallback(async () => {
    if (!activeProjectId) {
      setNodes([]);
      setEdges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const graph = await serviceMapService.getDependencyGraph(activeProjectId);
      setGraphData(graph);

      // Hierarchical layout positioning algorithm
      const incomingCounts = new Map<string, number>();
      graph.nodes.forEach((n) => incomingCounts.set(n.id, 0));
      graph.edges.forEach((e) => {
        incomingCounts.set(e.target, (incomingCounts.get(e.target) || 0) + 1);
      });

      // Group nodes into tiers
      const tiers: DependencyGraphNode[][] = [[], [], [], []];
      graph.nodes.forEach((n) => {
        const inCount = incomingCounts.get(n.id) || 0;
        const nameLower = n.name.toLowerCase();
        if (inCount === 0 || nameLower.includes('gateway') || nameLower.includes('ingress')) {
          tiers[0].push(n);
        } else if (nameLower.includes('db') || nameLower.includes('database') || nameLower.includes('redis') || nameLower.includes('cache')) {
          tiers[3].push(n);
        } else if (inCount === 1) {
          tiers[1].push(n);
        } else {
          tiers[2].push(n);
        }
      });

      const flowNodes: Node[] = [];
      tiers.forEach((tierNodes, tierIdx) => {
        const y = 40 + tierIdx * 140;
        const totalInTier = tierNodes.length;
        tierNodes.forEach((node, nodeIdx) => {
          const spacing = 220;
          const startX = Math.max(40, 400 - (totalInTier * spacing) / 2);
          const x = startX + nodeIdx * spacing;

          flowNodes.push({
            id: node.id,
            type: 'serviceNode',
            position: { x, y },
            data: {
              ...node,
              category:
                tierIdx === 0
                  ? 'gateway'
                  : tierIdx === 3
                  ? 'database'
                  : 'service',
            },
          });
        });
      });

      const flowEdges: Edge[] = graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: {
          stroke: isDark ? '#737373' : '#a3a3a3',
          strokeWidth: 2,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);

      if (graph.nodes.length > 0 && !selectedServiceId) {
        setSelectedServiceId(graph.nodes[0].id);
      }
    } catch (err) {
      console.warn('Failed to load dependency graph:', err);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, isDark]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [activeProjectId, projects, selectProject]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    if (!activeProjectId) {
      setRegisterError('No active project found. Please select or create a project first.');
      return;
    }
    const cleanName = newServiceName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      setRegisterError('Service name can only contain alphanumeric characters, underscores, and hyphens (e.g., auth-service).');
      return;
    }

    setCreatingService(true);
    setRegisterError(null);
    try {
      await serviceMapService.createService(
        activeProjectId,
        cleanName,
        newServiceDesc.trim() || undefined
      );
      setNewServiceName('');
      setNewServiceDesc('');
      setRegisterModalOpen(false);
      await loadGraph();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already exists') || msg.includes('409')) {
        setRegisterError(`Service "${cleanName}" already exists in this project.`);
      } else {
        setRegisterError(msg || 'Failed to register service.');
      }
    } finally {
      setCreatingService(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSourceId || !linkTargetId) return;
    if (linkSourceId === linkTargetId) {
      setLinkError('A service cannot declare a dependency on itself.');
      return;
    }
    setCreatingLink(true);
    setLinkError(null);
    try {
      await serviceMapService.createDependency(linkSourceId, linkTargetId, linkType);
      setLinkModalOpen(false);
      await loadGraph();
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to connect dependency.');
    } finally {
      setCreatingLink(false);
    }
  };

  const selectedNodeData = graphData?.nodes.find((n) => n.id === selectedServiceId);
  const outgoingLinks = graphData?.edges.filter((e) => e.source === selectedServiceId) || [];
  const incomingLinks = graphData?.edges.filter((e) => e.target === selectedServiceId) || [];

  if (projects.length === 0 && !projectLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-4">
        <Network className="w-12 h-12 text-neutral-400" />
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            No Projects Available
          </h2>
          <p className="text-xs text-neutral-500 max-w-sm mt-1">
            Please create an organization and project first before configuring microservices and topology DAGs.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/organizations')}>
          Go to Workspaces
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Service Topology & Dependency DAG
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Directed Acyclic Graph (DAG) visualizing upstream and downstream service calls, failure blast radius, and traffic dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadGraph}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {nodes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const found = graphData?.nodes.find((n) => n.id === selectedServiceId) || graphData?.nodes[0];
                if (found) {
                  setUploadTargetService({ id: found.id, name: found.name });
                }
                setUploadLogModalOpen(true);
              }}
              icon={<UploadCloud className="w-3.5 h-3.5" />}
            >
              Upload Service Logs
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLinkError(null);
              setLinkModalOpen(true);
            }}
            icon={<Network className="w-3.5 h-3.5" />}
          >
            Link Dependency
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setRegisterError(null);
              setRegisterModalOpen(true);
            }}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Register Service
          </Button>
        </div>
      </div>

      {/* Main Interactive Flow Canvas & Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-8">
          <Card padding="none" className="h-[560px] overflow-hidden relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedServiceId(node.id)}
              fitView
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1}
                color={isDark ? '#262626' : '#d4d4d4'}
              />
              <Controls className="!bg-white dark:!bg-[#171717] !border-neutral-200 dark:border-neutral-800 !rounded-xl !shadow-xs" />
            </ReactFlow>

            {/* Empty State Overlay */}
            {nodes.length === 0 && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-xs">
                <Network className="w-10 h-10 text-neutral-400" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    No Services in DAG Topology
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    Register your microservices to start mapping upstream and downstream traffic dependencies.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setRegisterError(null);
                    setRegisterModalOpen(true);
                  }}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Register First Service
                </Button>
              </div>
            )}

            {/* Legend / Status Overlay */}
            <div className="absolute top-4 left-4 p-2.5 rounded-xl bg-white/90 dark:bg-[#121212]/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5 shadow-sm">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 block text-[11px]">
                Topology Nodes: {nodes.length}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Nominal</span>
                <span className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                <span>Anomalous</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Selected Service Inspection Panel */}
        <div className="lg:col-span-4">
          {selectedNodeData ? (
            <Card padding="lg" className="space-y-5">
              <div className="pb-3 border-b border-neutral-100 dark:border-neutral-850">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-neutral-400">
                    Node ID: {selectedNodeData.id}
                  </span>
                  <StatusIndicator
                    status={selectedNodeData.anomaliesCount > 0 ? 'critical' : 'healthy'}
                  />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedNodeData.name}
                </h3>
                {selectedNodeData.description && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {selectedNodeData.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Active Alerts:</span>
                  <span
                    className={`font-bold text-sm ${
                      selectedNodeData.anomaliesCount > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {selectedNodeData.anomaliesCount} Anomalies
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-neutral-400 block mb-1">Logged Events:</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                    {selectedNodeData.logEntriesCount}
                  </span>
                </div>
              </div>

              {/* Dependencies List */}
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Outgoing Downstream Calls ({outgoingLinks.length}):
                  </span>
                  {outgoingLinks.length > 0 ? (
                    <div className="space-y-1">
                      {outgoingLinks.map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 text-xs font-mono text-neutral-700 dark:text-neutral-300 flex items-center justify-between"
                        >
                          <span>→ {l.targetName}</span>
                          <span className="text-[10px] text-neutral-400 uppercase">{l.dependencyType}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400 font-mono">Terminal sink node (no outgoing calls)</span>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    Incoming Upstream Callers ({incomingLinks.length}):
                  </span>
                  {incomingLinks.length > 0 ? (
                    <div className="space-y-1">
                      {incomingLinks.map((l) => (
                        <div
                          key={l.id}
                          className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-850 text-xs font-mono text-neutral-700 dark:text-neutral-300 flex items-center justify-between"
                        >
                          <span>← {l.sourceName}</span>
                          <span className="text-[10px] text-neutral-400 uppercase">{l.dependencyType}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-400 font-mono">Ingress / root entry node</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-850 space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setUploadTargetService({ id: selectedNodeData.id, name: selectedNodeData.name });
                    setUploadLogModalOpen(true);
                  }}
                  icon={<UploadCloud className="w-3.5 h-3.5" />}
                >
                  Upload Logs for {selectedNodeData.name}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => navigate(`/dashboard/logs?service=${encodeURIComponent(selectedNodeData.name)}`)}
                  icon={<FileCode2 className="w-3.5 h-3.5" />}
                >
                  Query Logs for {selectedNodeData.name}
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="lg" className="text-center py-16 text-xs text-neutral-500">
              Click a node in the DAG topology canvas to inspect telemetry and blast radius.
            </Card>
          )}
        </div>
      </div>

      {/* Register Service Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setRegisterModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-6 shadow-xl text-neutral-900 dark:text-neutral-100">
            <button
              onClick={() => setRegisterModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display text-lg font-bold tracking-tight">Register Service Node</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Add a microservice to this project topology for log parsing and root cause tracking.
            </p>

            {registerError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/60">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterService} className="mt-4 space-y-4">
              <Input
                label="Service Name"
                placeholder="e.g. auth-service, payment-gateway"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                required
              />
              <Input
                label="Description (Optional)"
                placeholder="Primary role in system architecture"
                value={newServiceDesc}
                onChange={(e) => setNewServiceDesc(e.target.value)}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setRegisterModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={creatingService || !newServiceName.trim()}>
                  {creatingService ? 'Registering...' : 'Register Service'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Dependency Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setLinkModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-6 shadow-xl text-neutral-900 dark:text-neutral-100">
            <button
              onClick={() => setLinkModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display text-lg font-bold tracking-tight">Link Service Dependency</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Establish directed call graph edge between services (Source → Target).
            </p>

            {linkError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/60">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{linkError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLink} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                  Source Service (Caller)
                </label>
                <select
                  value={linkSourceId}
                  onChange={(e) => setLinkSourceId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  required
                >
                  <option value="">Select caller service...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                  Target Service (Callee)
                </label>
                <select
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                  required
                >
                  <option value="">Select target service...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                  Dependency Protocol
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="w-full text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  <option value="HTTP">HTTP / REST</option>
                  <option value="gRPC">gRPC</option>
                  <option value="TCP">TCP / Socket</option>
                  <option value="QUEUE">Message Queue / PubSub</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setLinkModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={creatingLink || !linkSourceId || !linkTargetId || linkSourceId === linkTargetId}
                >
                  {creatingLink ? 'Connecting...' : 'Connect Dependency'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Log Modal for Specific Service */}
      <UploadLogModal
        isOpen={uploadLogModalOpen}
        onClose={() => {
          setUploadLogModalOpen(false);
          setUploadTargetService(null);
        }}
        projectId={activeProjectId}
        targetService={uploadTargetService}
        availableServices={graphData?.nodes.map((n) => ({ id: n.id, name: n.name })) || []}
        onSuccess={loadGraph}
      />
    </div>
  );
};
