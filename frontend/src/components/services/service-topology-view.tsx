"use client";

import { useQuery } from "@tanstack/react-query";
import { Network, RefreshCw, Layers } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ServiceTopologyViewProps {
  projectId: string;
}

interface GraphNode {
  id: string;
  name: string;
  description: string | null;
  incomingCount: number;
  outgoingCount: number;
}

interface GraphEdge {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  dependencyType: string;
  isRequired: boolean;
}

export function ServiceTopologyView({ projectId }: ServiceTopologyViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["services-graph", projectId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        nodes: GraphNode[];
        edges: GraphEdge[];
      }>(`/services/graph/${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  if (isLoading) {
    return (
      <div className="h-64 border border-zinc-800 rounded-xl bg-zinc-950 flex items-center justify-center text-xs text-zinc-500 font-mono">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Calculating DAG topology...
      </div>
    );
  }

  if (nodes.length === 0) {
    return null;
  }

  // Calculate layout coordinates for SVG visualization
  // Distribute nodes across columns: Entrypoints (incoming=0) -> Intermediate -> Leaves (outgoing=0)
  const entrypoints = nodes.filter((n) => n.incomingCount === 0);
  const leaves = nodes.filter((n) => n.outgoingCount === 0 && n.incomingCount > 0);
  const intermediate = nodes.filter(
    (n) => n.incomingCount > 0 && n.outgoingCount > 0,
  );

  // Group columns
  const columns: GraphNode[][] = [];
  if (entrypoints.length > 0) columns.push(entrypoints);
  if (intermediate.length > 0) columns.push(intermediate);
  if (leaves.length > 0) columns.push(leaves);
  if (columns.length === 0) columns.push(nodes);

  const colWidth = 260;
  const rowHeight = 90;
  const canvasWidth = Math.max(700, columns.length * colWidth + 100);
  const maxRows = Math.max(...columns.map((c) => c.length), 1);
  const canvasHeight = Math.max(280, maxRows * rowHeight + 80);

  // Map node positions: { [id]: { x, y } }
  const nodePositions: Record<string, { x: number; y: number }> = {};
  columns.forEach((col, colIdx) => {
    const x = 50 + colIdx * colWidth;
    const yOffset = (canvasHeight - col.length * rowHeight) / 2;
    col.forEach((node, rowIdx) => {
      nodePositions[node.id] = {
        x,
        y: yOffset + rowIdx * rowHeight,
      };
    });
  });

  return (
    <div className="border border-zinc-800 rounded-xl bg-[#0e0e11] p-5 shadow-sm space-y-4">
      {/* Topology Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-zinc-100">
              Architecture Dependency DAG
            </h3>
            <p className="text-[11px] text-zinc-500">
              Deterministic call hierarchy evaluated during cascading failure RCA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
            {nodes.length} Nodes
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
            {edges.length} Directed Edges
          </span>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="border border-zinc-800/80 rounded-lg bg-zinc-950 overflow-x-auto relative p-4 flex justify-center">
        <svg
          width={canvasWidth}
          height={canvasHeight}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          className="select-none"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#71717a" />
            </marker>
          </defs>

          {/* Render Directed Edges */}
          {edges.map((edge) => {
            const src = nodePositions[edge.sourceServiceId];
            const dst = nodePositions[edge.targetServiceId];
            if (!src || !dst) return null;

            const startX = src.x + 160;
            const startY = src.y + 24;
            const endX = dst.x;
            const endY = dst.y + 24;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="1.5"
                  strokeDasharray={edge.isRequired ? "none" : "4"}
                  markerEnd="url(#arrowhead)"
                />
                <rect
                  x={midX - 25}
                  y={midY - 9}
                  width="50"
                  height="16"
                  rx="3"
                  fill="#18181b"
                  stroke="#27272a"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fill="#a1a1aa"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {edge.dependencyType}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer group"
              >
                <rect
                  width="160"
                  height="48"
                  rx="6"
                  fill="#111113"
                  stroke="#27272a"
                  strokeWidth="1.5"
                  className="transition-colors group-hover:stroke-zinc-500"
                />
                <circle cx="16" cy="24" r="3" fill="#10b981" />
                <text
                  x="28"
                  y="22"
                  fill="#fafafa"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {node.name.length > 15
                    ? `${node.name.slice(0, 14)}…`
                    : node.name}
                </text>
                <text
                  x="28"
                  y="35"
                  fill="#71717a"
                  fontSize="9"
                  fontFamily="sans-serif"
                >
                  in: {node.incomingCount} | out: {node.outgoingCount}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
