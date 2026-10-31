import { Anomaly, SeverityLevel, AnomalyType } from '../types';
import { apiClient } from './api/client';

export interface AnomalyFilterOptions {
  service?: string;
  severity?: SeverityLevel | 'all';
  type?: AnomalyType | 'all';
  query?: string;
  page?: number;
  limit?: number;
}

export const anomalyService = {
  async getAnomalies(projectId: string, filters?: AnomalyFilterOptions): Promise<Anomaly[]> {
    if (!apiClient.isBackendConnected || !projectId) {
      return [];
    }

    try {
      const queryParams = new URLSearchParams();
      if (filters?.service && filters.service !== 'all') {
        queryParams.set('serviceId', filters.service);
      }
      if (filters?.severity && filters.severity !== 'all') {
        queryParams.set('severity', filters.severity.toUpperCase());
      }
      if (filters?.type && filters.type !== 'all') {
        queryParams.set('anomalyType', filters.type);
      }
      queryParams.set('page', String(filters?.page || 1));
      queryParams.set('limit', String(filters?.limit || 50));

      const res = await apiClient.fetchEndpoint<{
        items: Array<{
          id: string;
          firstDetectedAt: string;
          anomalyType: string;
          severity: string;
          score: number;
          expectedBaseline: number;
          observedValue: number;
          service?: { id: string; name: string };
          cluster?: { id: string; template: string };
          incidentAnomalies?: Array<{
            incident?: { id: string; title: string };
          }>;
        }>;
      }>(`/anomalies/${projectId}?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        return res.items.map((item) => ({
          id: item.id,
          timestamp: new Date(item.firstDetectedAt).toISOString().slice(0, 19).replace('T', ' '),
          title: `${item.anomalyType.replace(/_/g, ' ').toUpperCase()} in ${item.service?.name || 'Service'}`,
          type: (item.anomalyType.toLowerCase() as AnomalyType) || 'error_spike',
          service: item.service?.name || 'unknown-service',
          severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
          observedValue: item.observedValue || item.score,
          expectedBaseline: item.expectedBaseline || 1.0,
          unit: 'events/min',
          clusterId: item.cluster?.id || 'CLU-GEN',
          relatedIncidentId: item.incidentAnomalies?.[0]?.incident?.id,
          description: item.cluster?.template || `Anomaly detected with score ${item.score.toFixed(2)}`,
          sampleLogs: [],
        }));
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
        const a = res.anomaly;
        return {
          id: a.id,
          timestamp: new Date(a.firstDetectedAt).toISOString().slice(0, 19).replace('T', ' '),
          title: `${a.anomalyType.replace(/_/g, ' ').toUpperCase()} in ${a.service?.name || 'Service'}`,
          type: (a.anomalyType.toLowerCase() as AnomalyType) || 'error_spike',
          service: a.service?.name || 'unknown-service',
          severity: (a.severity.toLowerCase() as SeverityLevel) || 'high',
          observedValue: a.observedValue || a.score,
          expectedBaseline: a.expectedBaseline || 1.0,
          unit: 'events/min',
          clusterId: a.cluster?.id || 'CLU-GEN',
          relatedIncidentId: a.incidentAnomalies?.[0]?.incident?.id,
          description: a.cluster?.template || `Anomaly detected with score ${a.score}`,
          sampleLogs: [],
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch anomaly ${id}:`, err);
    }
    return null;
  },
};
