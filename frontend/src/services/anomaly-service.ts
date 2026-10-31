import { Anomaly, SeverityLevel } from '../types';
import { apiClient } from './api/client';
import { normalizeLogTemplate } from '../utils/template-normalizer';

export interface AnomalyFilterOptions {
  severity?: string;
  status?: string;
  anomalyType?: string;
  clusterId?: string;
  page?: number;
  limit?: number;
}

export const anomalyService = {
  /**
   * Fetches statistical anomalies and new patterns for active project
   */
  async getAnomalies(projectId: string, filters?: AnomalyFilterOptions): Promise<Anomaly[]> {
    if (!apiClient.isBackendConnected || !projectId) {
      return [];
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters?.severity && filters.severity !== 'all') {
        queryParams.set('severity', filters.severity.toUpperCase());
      }
      if (filters?.status && filters.status !== 'all') {
        queryParams.set('status', filters.status.toUpperCase());
      }
      if (filters?.anomalyType && filters.anomalyType !== 'all') {
        queryParams.set('anomalyType', filters.anomalyType);
      }
      if (filters?.clusterId) {
        queryParams.set('clusterId', filters.clusterId);
      }
      queryParams.set('page', String(filters?.page || 1));
      queryParams.set('limit', String(filters?.limit || 50));

      const res = await apiClient.fetchEndpoint<{
        items: Array<{
          id: string;
          title: string;
          description?: string;
          anomalyType: string;
          severity: string;
          status: string;
          occurrenceCount: number;
          firstDetectedAt: string;
          lastDetectedAt: string;
          evidence?: any;
          cluster?: { id: string; template: string; occurrenceCount: number };
          incidentAnomalies?: Array<{
            incident?: { id: string; title: string; severity: string; status: string };
          }>;
        }>;
      }>(`/anomalies/${projectId}?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        return res.items.map((item) => {
          const ev = item.evidence || {};
          const bMean = ev.baseline?.mean ?? 0;
          const currCount = ev.currentWindow?.count ?? item.occurrenceCount ?? 1;
          const zScore = ev.detection?.zScore;
          const points = ev.scoring?.totalPoints ?? ev.scoring?.spikePoints;
          const affected = ev.affectedClusters || [];
          const rawTemplate = item.cluster?.template || ev.template || '';
          const norm = normalizeLogTemplate(rawTemplate, item.title);

          return {
            id: item.id,
            timestamp: new Date(item.firstDetectedAt).toISOString().slice(0, 19).replace('T', ' '),
            title: item.title,
            displayTitle: ev.displayTitle || norm.displayTitle,
            shortDescription: ev.shortDescription || norm.shortDescription,
            type: item.anomalyType,
            severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
            observedValue: currCount,
            expectedBaseline: bMean,
            unit: 'logs/min',
            clusterId: item.cluster?.id || ev.clusterId,
            clusterTemplate: rawTemplate,
            relatedIncidentId: item.incidentAnomalies?.[0]?.incident?.id,
            description: item.description || rawTemplate || norm.shortDescription,
            points,
            zScore,
            evidence: ev,
            affectedClusters: affected,
          };
        });
      }
    } catch (err) {
      console.warn(`Could not fetch anomalies for project ${projectId}:`, err);
    }

    return [];
  },

  async getAnomalyById(projectId: string, id: string): Promise<Anomaly | null> {
    if (!apiClient.isBackendConnected || !projectId || !id) {
      return null;
    }

    try {
      const res = await apiClient.fetchEndpoint<{
        anomaly: any;
      }>(`/anomalies/${projectId}/${id}`);
      if (res?.anomaly) {
        const item = res.anomaly;
        const ev = item.evidence || {};
        const bMean = ev.baseline?.mean ?? 0;
        const currCount = ev.currentWindow?.count ?? item.occurrenceCount ?? 1;
        const rawTemplate = item.cluster?.template || ev.template || '';
        const norm = normalizeLogTemplate(rawTemplate, item.title);

        return {
          id: item.id,
          timestamp: new Date(item.firstDetectedAt).toISOString().slice(0, 19).replace('T', ' '),
          title: item.title,
          displayTitle: ev.displayTitle || norm.displayTitle,
          shortDescription: ev.shortDescription || norm.shortDescription,
          type: item.anomalyType,
          severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
          observedValue: currCount,
          expectedBaseline: bMean,
          unit: 'logs/min',
          clusterId: item.cluster?.id || ev.clusterId,
          clusterTemplate: rawTemplate,
          relatedIncidentId: item.incidentAnomalies?.[0]?.incident?.id,
          description: item.description || rawTemplate || norm.shortDescription,
          points: ev.scoring?.totalPoints ?? ev.scoring?.spikePoints,
          zScore: ev.detection?.zScore,
          evidence: ev,
          affectedClusters: ev.affectedClusters || [],
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch anomaly ${id}:`, err);
    }
    return null;
  },
};
