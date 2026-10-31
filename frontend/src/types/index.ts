export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface Organization {
  id: string;
  name: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    projects?: number;
  };
}

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
    logSources?: number;
    logEntries?: number;
    anomalies?: number;
    incidents?: number;
    services?: number;
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
  level: LogLevel;
  message: string;
  serviceName?: string;
  service?: string;
  clusterId?: string;
  clusterTemplate?: string;
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
  service?: string;
  serviceName?: string;
  firstSeen: string;
  lastSeen: string;
  sampleLogs: string[];
  wildcardTokens: string[];
  anomalyScore: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export type AnomalyType = 
  | 'SPIKE' 
  | 'NEW_PATTERN' 
  | 'error_spike' 
  | 'volume_surge' 
  | 'new_template';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Anomaly {
  id: string;
  timestamp: string;
  title: string;
  type: string;
  severity: SeverityLevel;
  observedValue: number | string;
  expectedBaseline: number | string;
  unit: string;
  service?: string;
  serviceName?: string;
  clusterId?: string;
  clusterTemplate?: string;
  relatedIncidentId?: string;
  description: string;
  points?: number;
  zScore?: number;
  sampleLogs?: any[];
  evidence?: any;
  affectedClusters?: Array<{
    clusterId: string;
    template: string;
    baselineMean: number;
    currentCount: number;
    zScore: number;
    firstAbnormalAt: string;
  }>;
}

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export interface RootCauseCandidate {
  clusterId?: string;
  template?: string;
  service?: string;
  totalScore?: number; // 0 - 15 points
  temporalPoints?: number; // 0 - 4
  frequencyPoints?: number; // 0 - 4
  classificationPoints?: number; // 0 - 3
  relationshipPoints?: number; // 0 - 4
  explanation?: string;
  reasoning?: string;
  confidenceScore?: number;
  supportingEvidence?: string[];
  suggestedRemediation?: string[];
  relatedAnomalies?: any[];
  relatedClusters?: any[];
  rank?: number;
  evidence?: any;
}

export interface CorrelatedTimelineEvent {
  id: string;
  time: string;
  event: string;
  severity: SeverityLevel;
  description: string;
  service?: string;
  evidenceType?: string;
  evidenceRef?: string;
}

export interface StructuredIncidentReport {
  friendlyTitle?: string;
  whatHappened?: string;
  whatMightBeCausingIt?: string;
  whyDoWeThinkThis?: string[];
  whatElseWasAffected?: string;
  whatShouldIDo?: string[];
  howCertainAreWe?: {
    badge: string;
    explanation: string;
  };
  potentialImpact?: string;
  rootCauseExplanation?: string;
  rcaBullets?: string[];
  unfamiliarPatterns?: Array<{
    pattern: string;
    component: string;
    explanation: string;
  }>;
  investigationRecommendations?: string[];
  metrics?: {
    affectedPatterns?: number;
    detectionWindow?: string;
    totalMatchingErrors?: number;
    candidateCount?: number;
  };
  technicalEvidence?: {
    primaryTemplate?: string;
    totalScore?: number;
    temporalPoints?: number;
    frequencyPoints?: number;
    classificationPoints?: number;
    relationshipPoints?: number;
    maxOccurrence?: number;
    maxZScore?: number;
    baselineMean?: number;
    confidence?: number;
    candidates?: any[];
    rawSamples?: string[];
  };
}

export interface Incident {
  id: string;
  title: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  suspectedRootCauseTemplate?: string;
  suspectedRootCauseService?: string;
  affectedServices?: string[];
  firstDetected: string;
  lastUpdated: string;
  aiSummary: string;
  structuredReport?: StructuredIncidentReport;
  rootCauseCandidates: RootCauseCandidate[];
  correlatedTimeline: CorrelatedTimelineEvent[];
  evidenceLogs?: any[];
  investigationChecklist?: Array<{
    id: string;
    text: string;
    completed: boolean;
    category?: string;
  }>;
}

export interface DashboardMetrics {
  totalLogEvents: number;
  errorEvents: number;
  detectedAnomalies: number;
  activeIncidents: number;
  monitoredServices?: number;
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

export interface ServiceNodeData {
  id: string;
  name: string;
  description?: string;
  status?: string;
  health?: string;
  errorRate?: number;
  category?: string;
  anomalyCount?: number;
  logCount?: number;
  [key: string]: any;
}
