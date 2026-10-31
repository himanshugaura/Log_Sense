import { LogEntry, LogCluster, ProcessingJob } from '../types';
import { apiClient } from './api/client';

export interface LogFilterOptions {
  level?: string;
  query?: string;
  clusterId?: string;
  serviceName?: string;
  page?: number;
  limit?: number;
}

export interface ClusterFilterOptions {
  query?: string;
  level?: string;
  page?: number;
  limit?: number;
}

export interface UploadLogResponse {
  logSource: {
    id: string;
    name: string;
    sourceType: string;
    createdAt: string;
  };
  processingJob: ProcessingJob;
}

export const logService = {
  /**
   * Fetches parsed structured log entries from backend for active project
   */
  async getLogs(projectId: string, filters?: LogFilterOptions): Promise<{ logs: LogEntry[]; total: number }> {
    if (!apiClient.isBackendConnected || !projectId) {
      return { logs: [], total: 0 };
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters?.level && filters.level !== 'all') {
        queryParams.set('level', filters.level.toUpperCase());
      }
      if (filters?.query && filters.query.trim()) {
        queryParams.set('search', filters.query.trim());
      }
      if (filters?.clusterId) {
        queryParams.set('clusterId', filters.clusterId);
      }
      if (filters?.serviceName) {
        queryParams.set('serviceName', filters.serviceName);
      }
      queryParams.set('page', String(filters?.page || 1));
      queryParams.set('limit', String(filters?.limit || 50));

      const res = await apiClient.fetchEndpoint<{
        items: Array<{
          id: string;
          timestamp: string;
          level: string;
          serviceName?: string;
          normalizedMessage: string;
          rawMessage: string;
          cluster?: { id: string; template: string };
          metadata?: any;
        }>;
        pagination: { total: number };
      }>(`/logs/${projectId}/entries?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        const mapped: LogEntry[] = res.items.map((entry) => ({
          id: entry.id,
          timestamp: new Date(entry.timestamp).toISOString().slice(0, 19).replace('T', ' '),
          serviceName: entry.serviceName || undefined,
          level: (entry.level?.toUpperCase() as any) || 'INFO',
          message: entry.normalizedMessage || entry.rawMessage,
          clusterId: entry.cluster?.id || 'cluster-gen',
          clusterTemplate: entry.cluster?.template,
          isAnomaly: entry.level?.toUpperCase() === 'ERROR',
          metadata: entry.metadata || undefined,
        }));
        return { logs: mapped, total: res.pagination?.total || mapped.length };
      }
    } catch (err) {
      console.warn(`Could not fetch logs for project ${projectId}:`, err);
    }

    return { logs: [], total: 0 };
  },

  /**
   * Fetches mined Drain3 template clusters from backend
   */
  async getLogClusters(projectId: string, filters?: ClusterFilterOptions): Promise<LogCluster[]> {
    if (!apiClient.isBackendConnected || !projectId) {
      return [];
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters?.query && filters.query.trim()) {
        queryParams.set('search', filters.query.trim());
      }
      queryParams.set('page', String(filters?.page || 1));
      queryParams.set('limit', String(filters?.limit || 50));

      const res = await apiClient.fetchEndpoint<{
        items: Array<{
          id: string;
          template: string;
          occurrenceCount: number;
          firstSeenAt: string;
          lastSeenAt: string;
          _count?: { logEntries?: number; anomalies?: number };
        }>;
      }>(`/logs/${projectId}/clusters?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        return res.items.map((c) => ({
          id: c.id,
          template: c.template,
          occurrenceCount: c.occurrenceCount,
          severity: c.template.includes('ERROR') ? 'ERROR' : c.template.includes('WARN') ? 'WARN' : 'INFO',
          firstSeen: new Date(c.firstSeenAt).toISOString().slice(0, 19).replace('T', ' '),
          lastSeen: new Date(c.lastSeenAt).toISOString().slice(0, 19).replace('T', ' '),
          sampleLogs: [c.template],
          wildcardTokens: ['<*>'],
          anomalyScore: (c._count?.anomalies ?? 0) > 0 ? 0.85 : 0.05,
          trend: (c._count?.anomalies ?? 0) > 0 ? 'increasing' : 'stable',
        }));
      }
    } catch (err) {
      console.warn(`Could not fetch log clusters for project ${projectId}:`, err);
    }

    return [];
  },

  async getClusterById(projectId: string, clusterId: string): Promise<LogCluster | null> {
    if (!apiClient.isBackendConnected || !projectId || !clusterId) {
      return null;
    }

    try {
      const res = await apiClient.fetchEndpoint<{
        cluster: {
          id: string;
          template: string;
          occurrenceCount: number;
          firstSeenAt: string;
          lastSeenAt: string;
          logEntries?: Array<{ rawMessage: string }>;
        };
      }>(`/logs/${projectId}/clusters/${clusterId}`);

      if (res?.cluster) {
        const c = res.cluster;
        return {
          id: c.id,
          template: c.template,
          occurrenceCount: c.occurrenceCount,
          severity: c.template.includes('ERROR') ? 'ERROR' : c.template.includes('WARN') ? 'WARN' : 'INFO',
          firstSeen: new Date(c.firstSeenAt).toISOString().slice(0, 19).replace('T', ' '),
          lastSeen: new Date(c.lastSeenAt).toISOString().slice(0, 19).replace('T', ' '),
          sampleLogs: c.logEntries?.map((e) => e.rawMessage) || [c.template],
          wildcardTokens: ['<*>'],
          anomalyScore: 0.2,
          trend: 'stable',
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch cluster ${clusterId}:`, err);
    }
    return null;
  },

  /**
   * Real multipart file upload directly to backend object storage
   */
  async uploadLogFile(projectId: string, file: File): Promise<UploadLogResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', 'FILE_UPLOAD');

    const res = await apiClient.uploadFile<UploadLogResponse>(
      `/logs/${projectId}/upload`,
      formData
    );
    return res;
  },

  /**
   * Polls live ingestion/processing job status
   */
  async getProcessingJobs(projectId: string): Promise<ProcessingJob[]> {
    if (!apiClient.isBackendConnected || !projectId) {
      return [];
    }

    try {
      const res = await apiClient.fetchEndpoint<{ items: ProcessingJob[] }>(
        `/logs/${projectId}/jobs?limit=10`
      );
      return res?.items || [];
    } catch (err) {
      console.warn(`Failed to fetch processing jobs for ${projectId}:`, err);
      return [];
    }
  },
};
