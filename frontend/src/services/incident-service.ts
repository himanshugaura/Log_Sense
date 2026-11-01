import { Incident, IncidentStatus, SeverityLevel, SimilarIncident } from '../types';
import { apiClient } from './api/client';
import { normalizeLogTemplate } from '../utils/template-normalizer';

export interface IncidentFilterOptions {
  severity?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const incidentService = {
  /**
   * Fetches incidents with point-based RCA cluster rankings & AI explanations
   */
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
      queryParams.set('limit', String(filters?.limit || 20));

      const res = await apiClient.fetchEndpoint<{
        items: any[];
      }>(`/incidents/${projectId}?${queryParams.toString()}`);

      if (res?.items && Array.isArray(res.items)) {
        return res.items.map((item) => {
          const candidates = item.rcaAnalyses?.[0]?.candidates || [];
          const topCandidate = candidates[0];
          const summary = item.incidentSummaries?.[0];
          const rawRecs = summary?.recommendations;
          let structuredReport: any = undefined;

          if (rawRecs && typeof rawRecs === 'object' && ('whatHappened' in rawRecs || 'metrics' in rawRecs)) {
            structuredReport = rawRecs;
          }

          const suspectedTemplate =
            topCandidate?.template ||
            topCandidate?.cluster?.template ||
            item.rcaAnalyses?.[0]?.conclusion ||
            '';
          const norm = normalizeLogTemplate(suspectedTemplate, item.title);
          const displayTitle = norm.isMatched
            ? norm.displayTitle
            : (structuredReport?.friendlyTitle || norm.displayTitle);

          return {
            id: item.id,
            title: item.title,
            displayTitle,
            shortDescription: norm.shortDescription,
            severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
            status: item.status as IncidentStatus,
            suspectedRootCauseTemplate: suspectedTemplate || 'Evaluating pattern',
            firstDetected: new Date(item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
            lastUpdated: new Date(item.updatedAt || item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
            aiSummary:
              summary?.summary ||
              summary?.summaryText ||
              'Point-based log pattern RCA in progress.',
            structuredReport,
            rootCauseCandidates: candidates.map((c: any) => {
              const rawTmpl = c.template || c.cluster?.template || 'Unknown Pattern';
              const candNorm = normalizeLogTemplate(rawTmpl);
              return {
                clusterId: c.clusterId || c.cluster?.id,
                template: rawTmpl,
                displayTitle: candNorm.displayTitle,
                shortDescription: candNorm.shortDescription,
                totalScore: c.totalScore,
                temporalPoints: c.temporalPoints || 0,
                frequencyPoints: c.frequencyPoints || 0,
                classificationPoints: c.classificationPoints || 0,
                relationshipPoints: c.relationshipPoints || 0,
                explanation: c.explanation || `Scored ${c.totalScore}/15 pts in multi-signal statistical analysis.`,
                rank: c.rank,
                evidence: c.evidence,
              };
            }),
            correlatedTimeline: (item.incidentAnomalies || []).map((ia: any, idx: number) => ({
              id: `tl-${idx}`,
              time: new Date(ia.anomaly?.firstDetectedAt || item.startedAt).toISOString().slice(11, 19) + ' UTC',
              event: ia.anomaly?.title || 'Anomaly detected',
              severity: (ia.anomaly?.severity?.toLowerCase() as SeverityLevel) || 'high',
              description: ia.anomaly?.description || '',
            })),
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
      const res = await apiClient.fetchEndpoint<{
        incident: any;
      }>(`/incidents/${projectId}/${incidentId}`);

      if (res?.incident) {
        const item = res.incident;
        const candidates = item.rcaAnalyses?.[0]?.candidates || [];
        const topCandidate = candidates[0];
        const summary = item.incidentSummaries?.[0];
        const rawRecs = summary?.recommendations;
        let structuredReport: any = undefined;

        if (rawRecs && typeof rawRecs === 'object' && ('whatHappened' in rawRecs || 'metrics' in rawRecs)) {
          structuredReport = rawRecs;
        }

        const suspectedTemplate =
          topCandidate?.template ||
          topCandidate?.cluster?.template ||
          item.rcaAnalyses?.[0]?.conclusion ||
          '';
        const norm = normalizeLogTemplate(suspectedTemplate, item.title);
        const displayTitle = norm.isMatched
          ? norm.displayTitle
          : (structuredReport?.friendlyTitle || norm.displayTitle);

        return {
          id: item.id,
          title: item.title,
          displayTitle,
          shortDescription: norm.shortDescription,
          severity: (item.severity.toLowerCase() as SeverityLevel) || 'high',
          status: item.status as IncidentStatus,
          resolutionNotes: item.resolutionNotes || null,
          resolvedAt: item.resolvedAt ? new Date(item.resolvedAt).toISOString() : null,
          suspectedRootCauseTemplate: suspectedTemplate || 'Evaluating pattern',
          firstDetected: new Date(item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
          lastUpdated: new Date(item.updatedAt || item.startedAt).toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
          aiSummary:
            summary?.summary ||
            summary?.summaryText ||
            'Point-based log pattern RCA in progress.',
          structuredReport,
          rootCauseCandidates: candidates.map((c: any) => {
            const rawTmpl = c.template || c.cluster?.template || 'Unknown Pattern';
            const candNorm = normalizeLogTemplate(rawTmpl);
            return {
              clusterId: c.clusterId || c.cluster?.id,
              template: rawTmpl,
              displayTitle: candNorm.displayTitle,
              shortDescription: candNorm.shortDescription,
              totalScore: c.totalScore,
              temporalPoints: c.temporalPoints || 0,
              frequencyPoints: c.frequencyPoints || 0,
              classificationPoints: c.classificationPoints || 0,
              relationshipPoints: c.relationshipPoints || 0,
              explanation: c.explanation || `Scored ${c.totalScore}/15 pts.`,
              rank: c.rank,
              evidence: c.evidence,
            };
          }),
          correlatedTimeline: (item.incidentAnomalies || []).map((ia: any, idx: number) => ({
            id: `tl-${idx}`,
            time: new Date(ia.anomaly?.firstDetectedAt || item.startedAt).toISOString().slice(11, 19) + ' UTC',
            event: ia.anomaly?.title || 'Anomaly detected',
            severity: (ia.anomaly?.severity?.toLowerCase() as SeverityLevel) || 'high',
            description: ia.anomaly?.description || '',
          })),
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch incident ${incidentId}:`, err);
    }

    return null;
  },

  async updateStatus(
    projectId: string,
    incidentId: string,
    status: IncidentStatus,
    resolutionNotes?: string | null,
  ): Promise<boolean> {
    try {
      await apiClient.fetchEndpoint(`/incidents/${projectId}/${incidentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNotes }),
      });
      return true;
    } catch (err) {
      console.error(`Failed to update status for incident ${incidentId}:`, err);
      return false;
    }
  },

  async getSimilarIncidents(projectId: string, incidentId: string): Promise<SimilarIncident[]> {
    if (!apiClient.isBackendConnected || !projectId || !incidentId) {
      return [];
    }

    try {
      const res = await apiClient.fetchEndpoint<{
        similarIncidents: SimilarIncident[];
        total: number;
      }>(`/incidents/${projectId}/${incidentId}/similar`);

      if (res?.similarIncidents && Array.isArray(res.similarIncidents)) {
        return res.similarIncidents;
      }
    } catch (err) {
      console.warn(`Failed to fetch similar incidents for ${incidentId}:`, err);
    }

    return [];
  },

  async chatWithCopilot(
    projectId: string,
    incidentId: string,
    message: string,
    history?: Array<{ role: 'user' | 'model'; content: string }>
  ): Promise<{ reply: string; model: string }> {
    const res = await apiClient.fetchEndpoint<any>(
      `/incidents/${projectId}/${incidentId}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      }
    );
    if (res?.data?.reply) {
      return res.data;
    }
    return {
      reply: res?.reply || res?.message || 'No response generated from Copilot.',
      model: res?.data?.model || 'default',
    };
  },
};
