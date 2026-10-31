import { DependencyGraph, ServiceNodeData } from '../types';
import { apiClient } from './api/client';

export const serviceMapService = {
  async getDependencyGraph(projectId: string): Promise<DependencyGraph> {
    if (!apiClient.isBackendConnected || !projectId) {
      return {
        projectId: projectId || '',
        totalServices: 0,
        totalDependencies: 0,
        nodes: [],
        edges: [],
      };
    }

    try {
      const res = await apiClient.fetchEndpoint<{ graph: DependencyGraph }>(
        `/services/graph/${projectId}`
      );
      if (res?.graph) {
        return res.graph;
      }
    } catch (err) {
      console.warn(`Could not fetch dependency graph for project ${projectId}:`, err);
    }

    return {
      projectId,
      totalServices: 0,
      totalDependencies: 0,
      nodes: [],
      edges: [],
    };
  },

  async getServices(projectId: string): Promise<ServiceNodeData[]> {
    if (!apiClient.isBackendConnected || !projectId) {
      return [];
    }

    try {
      const res = await apiClient.fetchEndpoint<{ services: any[] }>(
        `/services?projectId=${projectId}`
      );
      if (res?.services && Array.isArray(res.services)) {
        return res.services.map((s) => ({
          id: s.id,
          name: s.name,
          category: 'service' as const,
          status: (s._count?.anomalies > 0 ? 'critical' : 'healthy') as any,
          errorRate: s._count?.anomalies > 0 ? 4.8 : 0.0,
          p99LatencyMs: s._count?.anomalies > 0 ? 340 : 42,
          requestRps: Math.max(0, (s._count?.logEntries || 0) / 10),
          dependencies: s.outgoingDependencies?.map((d: any) => d.targetServiceId) || [],
          errorCount: s._count?.anomalies || 0,
          protocol: 'HTTP',
        }));
      }
    } catch (err) {
      console.warn(`Could not fetch services for project ${projectId}:`, err);
    }

    return [];
  },

  async createService(projectId: string, name: string, description?: string): Promise<any> {
    if (!apiClient.isBackendConnected) {
      throw new Error('Backend not connected');
    }
    const res = await apiClient.fetchEndpoint<{ service: any }>('/services', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        name,
        description: description || undefined,
      }),
    });
    return res.service;
  },

  async createDependency(
    sourceServiceId: string,
    targetServiceId: string,
    dependencyType: string = 'HTTP'
  ): Promise<any> {
    if (!apiClient.isBackendConnected) {
      throw new Error('Backend not connected');
    }
    const res = await apiClient.fetchEndpoint<{ dependency: any }>('/services/dependencies', {
      method: 'POST',
      body: JSON.stringify({
        sourceServiceId,
        targetServiceId,
        dependencyType,
        isRequired: true,
      }),
    });
    return res.dependency;
  },

  async deleteService(serviceId: string): Promise<void> {
    if (apiClient.isBackendConnected) {
      await apiClient.fetchEndpoint(`/services/${serviceId}`, { method: 'DELETE' });
    }
  },
};
