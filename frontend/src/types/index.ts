export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  organizationId: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  organization?: {
    id: string;
    name: string;
  };
  _count?: {
    services?: number;
    logSources?: number;
    logEntries?: number;
    anomalies?: number;
    incidents?: number;
  };
}

export interface ProcessingJob {
  id: string;
  projectId: string;
  logSourceId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progressPercentage: number;
  processedLines: number;
  totalLines?: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  clusterId: string;
  dataset?: string;
  traceId?: string;
  spanId?: string;
  isAnomaly?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface LogCluster {
  id: string;
  template: string;
  occurrenceCount: number;
  severity: LogLevel;
  service: string;
  firstSeen: string;
  lastSeen: string;
  sampleLogs: string[];
  wildcardTokens: string[];
  anomalyScore: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export type AnomalyType = 
  | 'error_spike' 
  | 'volume_surge' 
  | 'new_template' 
  | 'timeout_cascade' 
  | 'pattern_deviation';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Anomaly {
  id: string;
  timestamp: string;
  title: string;
  type: AnomalyType;
  service: string;
  severity: SeverityLevel;
  observedValue: number | string;
  expectedBaseline: number | string;
  unit: string;
  clusterId: string;
  relatedIncidentId?: string;
  description: string;
  sampleLogs: LogEntry[];
}

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export interface RootCauseCandidate {
  service: string;
  confidenceScore: number; // 0 - 100
  reasoning: string;
  supportingEvidence: string[];
  relatedAnomalies: string[];
  relatedClusters: string[];
  suggestedRemediation: string[];
  breakdown?: {
    temporalScore?: number;
    centralityScore?: number;
    volumeScore?: number;
    noveltyScore?: number;
  };
}

export interface CorrelatedTimelineEvent {
  id: string;
  time: string;
  service: string;
  event: string;
  severity: SeverityLevel;
  evidenceType: 'anomaly' | 'cluster' | 'log' | 'metric';
  evidenceRef: string;
  description: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  category: 'triage' | 'mitigation' | 'verification';
}

export interface Incident {
  id: string;
  title: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  suspectedRootCauseService: string;
  affectedServices: string[];
  firstDetected: string;
  lastUpdated: string;
  aiSummary: string;
  rootCauseCandidates: RootCauseCandidate[];
  correlatedTimeline: CorrelatedTimelineEvent[];
  investigationChecklist: ChecklistItem[];
  evidenceLogs: LogEntry[];
}

export interface ServiceNodeData {
  id: string;
  name: string;
  category: 'gateway' | 'service' | 'database' | 'cache' | 'queue';
  status: 'healthy' | 'degraded' | 'critical';
  errorRate: number;
  p99LatencyMs: number;
  requestRps: number;
  dependencies: string[];
  activeIncidentId?: string;
  errorCount: number;
  protocol?: string;
}

export interface DependencyGraphNode {
  id: string;
  name: string;
  description?: string | null;
  anomaliesCount: number;
  logEntriesCount: number;
  createdAt: string;
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  dependencyType: string;
  isRequired: boolean;
}

export interface DependencyGraph {
  projectId: string;
  totalServices: number;
  totalDependencies: number;
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

export interface DashboardMetrics {
  totalLogEvents: number;
  errorEvents: number;
  detectedAnomalies: number;
  activeIncidents: number;
  monitoredServices: number;
  errorRatePercentage: number;
  anomalousClusterCount: number;
}

export interface PublicDataset {
  id: string;
  name: string;
  description: string;
  source: string;
  sourceUrl: string;
  format: string;
  sampleSize: string;
  totalEvents: number;
  systemType: string;
  recommendedFor: string;
}
