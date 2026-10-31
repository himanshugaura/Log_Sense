import { Incident, IncidentStatus, SeverityLevel } from '../types';
import { apiClient } from './api/client';

export interface IncidentFilterOptions {
  severity?: SeverityLevel | 'all';
  status?: IncidentStatus | 'all';
  service?: string;
  query?: string;
  page?: number;
  limit?: number;
}

export const incidentService = {
  async getIncidents(projectId: string, filters?: IncidentFilterOptions): Promise<Incident[]> {
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
      queryParams.set('page', String(filters?.page || 1));
      queryParams.set('limit', String(filters?.limit || 50));

      const res = await apiClient.fetchEndpoint<{
        items: any[];
      }>(`/incidents/${projectId}?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        return res.items.map((item) => {
          const topCandidate = item.rcaAnalyses?.[0]?.candidates?.[0];
          const summary = item.incidentSummaries?.[0];
          const affectedServices = Array.from(
            new Set(
              (item.incidentAnomalies || []).map((ia: any) => ia.anomaly?.service?.name).filter(Boolean)
            )
          ) as string[];

          return {
            id: item.id,
            title: item.title,
            severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
            status: item.status as IncidentStatus,
            suspectedRootCauseService: topCandidate?.service?.name || affectedServices[0] || 'Unknown Service',
            affectedServices: affectedServices.length > 0 ? affectedServices : ['Core Service'],
            firstDetected: new Date(item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
            lastUpdated: new Date(item.updatedAt || item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
            aiSummary:
              summary?.summaryText ||
              'Incident identified via Drain3 clustering anomaly burst. Gemini AI synthesis in progress.',
            rootCauseCandidates: (item.rcaAnalyses?.[0]?.candidates || []).map((c: any) => ({
              service: c.service?.name || 'Target Service',
              confidenceScore: Math.round(c.compositeScore * 100),
              reasoning: c.explanation || 'High multi-factor correlation score across temporal, volume, and DAG centrality metrics.',
              supportingEvidence: [
                `Temporal score: ${(c.temporalScore * 100).toFixed(0)}%`,
                `Topology centrality: ${(c.centralityScore * 100).toFixed(0)}%`,
                `Volume surge deviation: ${(c.volumeScore * 100).toFixed(0)}%`,
                `Template novelty: ${(c.noveltyScore * 100).toFixed(0)}%`,
              ],
              relatedAnomalies: [],
              relatedClusters: [],
              suggestedRemediation: summary?.recommendedActions || ['Inspect service connection pool', 'Review upstream API retry configuration'],
              breakdown: {
                temporalScore: c.temporalScore,
                centralityScore: c.centralityScore,
                volumeScore: c.volumeScore,
                noveltyScore: c.noveltyScore,
              },
            })),
            correlatedTimeline: (item.incidentAnomalies || []).map((ia: any, idx: number) => ({
              id: `tl-${idx}`,
              time: new Date(ia.anomaly?.firstDetectedAt || item.startedAt).toISOString().slice(11, 19) + ' UTC',
              service: ia.anomaly?.service?.name || 'service',
              event: `${ia.anomaly?.title || 'Anomaly'} detected`,
              severity: (ia.anomaly?.severity?.toLowerCase() as SeverityLevel) || 'high',
              evidenceType: 'anomaly' as const,
              evidenceRef: ia.anomaly?.id || '',
              description: `Statistically significant deviation in ${ia.anomaly?.service?.name || 'service'}`,
            })),
            investigationChecklist: [
              { id: 'chk-1', text: 'Confirm root cause service telemetry metrics', completed: true, category: 'triage' },
              { id: 'chk-2', text: 'Verify upstream retry storms and queue saturation', completed: item.status !== 'OPEN', category: 'triage' },
              { id: 'chk-3', text: 'Apply configuration fix or restart degraded pods', completed: item.status === 'RESOLVED', category: 'mitigation' },
              { id: 'chk-4', text: 'Post-incident Drain3 error baseline verification', completed: item.status === 'RESOLVED', category: 'verification' },
            ],
            evidenceLogs: [],
          };
        });
      }
    } catch (err) {
      console.warn(`Could not fetch incidents for project ${projectId}:`, err);
    }

    return [];
  },

  async getIncidentById(projectId: string, incidentId: string): Promise<Incident | null> {
    if (!apiClient.isBackendConnected || !projectId || !incidentId) {
      return null;
    }

    try {
      const res = await apiClient.fetchEndpoint<{ incident: any }>(
        `/incidents/${projectId}/${incidentId}`
      );
      if (res?.incident) {
        const item = res.incident;
        const topCandidate = item.rcaAnalyses?.[0]?.candidates?.[0];
        const summary = item.incidentSummaries?.[0];
        const affectedServices = Array.from(
          new Set(
            (item.incidentAnomalies || []).map((ia: any) => ia.anomaly?.service?.name).filter(Boolean)
          )
        ) as string[];

        return {
          id: item.id,
          title: item.title,
          severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
          status: item.status as IncidentStatus,
          suspectedRootCauseService: topCandidate?.service?.name || affectedServices[0] || 'Unknown Service',
          affectedServices: affectedServices.length > 0 ? affectedServices : ['Core Service'],
          firstDetected: new Date(item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
          lastUpdated: new Date(item.updatedAt || item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
          aiSummary:
            summary?.summaryText ||
            'Gemini AI Root Cause Analysis report: High severity anomaly cascade detected across microservice boundary.',
          rootCauseCandidates: (item.rcaAnalyses?.[0]?.candidates || []).map((c: any) => ({
            service: c.service?.name || 'Target Service',
            confidenceScore: Math.round(c.compositeScore * 100),
            reasoning: c.explanation || 'Deterministic 4-factor root cause algorithm score.',
            supportingEvidence: [
              `Temporal precedence score: ${(c.temporalScore * 100).toFixed(0)}%`,
              `DAG topology centrality score: ${(c.centralityScore * 100).toFixed(0)}%`,
              `Volume surge deviation: ${(c.volumeScore * 100).toFixed(0)}%`,
              `Template novelty score: ${(c.noveltyScore * 100).toFixed(0)}%`,
            ],
            relatedAnomalies: [],
            relatedClusters: [],
            suggestedRemediation: summary?.recommendedActions || ['Inspect service connection pool', 'Review upstream API retry configuration'],
            breakdown: {
              temporalScore: c.temporalScore,
              centralityScore: c.centralityScore,
              volumeScore: c.volumeScore,
              noveltyScore: c.noveltyScore,
            },
          })),
          correlatedTimeline: (item.incidentAnomalies || []).map((ia: any, idx: number) => ({
            id: `tl-${idx}`,
            time: new Date(ia.anomaly?.firstDetectedAt || item.startedAt).toISOString().slice(11, 19) + ' UTC',
            service: ia.anomaly?.service?.name || 'service',
            event: `${ia.anomaly?.title || 'Anomaly'} triggered`,
            severity: (ia.anomaly?.severity?.toLowerCase() as SeverityLevel) || 'high',
            evidenceType: 'anomaly' as const,
            evidenceRef: ia.anomaly?.id || '',
            description: ia.anomaly?.cluster?.template || `Statistically verified deviation in ${ia.anomaly?.service?.name || 'service'}`,
          })),
          investigationChecklist: [
            { id: 'chk-1', text: 'Confirm root cause service telemetry metrics', completed: true, category: 'triage' },
            { id: 'chk-2', text: 'Verify upstream retry storms and queue saturation', completed: item.status !== 'OPEN', category: 'triage' },
            { id: 'chk-3', text: 'Apply configuration fix or restart degraded pods', completed: item.status === 'RESOLVED', category: 'mitigation' },
            { id: 'chk-4', text: 'Post-incident Drain3 error baseline verification', completed: item.status === 'RESOLVED', category: 'verification' },
          ],
          evidenceLogs: [],
        };
      }
    } catch (err) {
      console.warn(`Could not fetch incident ${incidentId}:`, err);
    }
    return null;
  },

  async updateIncidentStatus(
    projectId: string,
    incidentId: string,
    status: IncidentStatus
  ): Promise<Incident | null> {
    if (apiClient.isBackendConnected && projectId) {
      try {
        const res = await apiClient.fetchEndpoint<{ incident: any }>(
          `/incidents/${projectId}/${incidentId}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          }
        );
        if (res?.incident) {
          return this.getIncidentById(projectId, incidentId);
        }
      } catch (err) {
        console.error(`Failed to update incident status for ${incidentId}:`, err);
      }
    }
    return null;
  },

  async toggleChecklistItem(incident: Incident, checklistId: string): Promise<Incident> {
    const updatedChecklist = incident.investigationChecklist.map((item) =>
      item.id === checklistId ? { ...item, completed: !item.completed } : item
    );
    return {
      ...incident,
      investigationChecklist: updatedChecklist,
      lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    };
  },
};
