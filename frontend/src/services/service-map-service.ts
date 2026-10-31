import { DependencyGraph, ServiceNodeData } from '../types';
import { apiClient } from './api/client';
import { MOCK_SERVICES } from '../mocks';

export const serviceMapService = {
  async getDependencyGraph(projectId: string): Promise<DependencyGraph> {
    if (apiClient.isBackendConnected && projectId) {
      try {
        const res = await apiClient.fetchEndpoint<{ graph: DependencyGraph }>(
          `/services/graph/${projectId}`
        );
        if (res?.graph) {
          return res.graph;
        }
      } catch (err) {
        console.warn(`Failed to fetch dependency graph for project ${projectId}:`, err);
      }
    }

    // Fallback graph from mock data
    const nodes = MOCK_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      description: `Service ${s.name}`,
      createdAt: new Date().toISOString(),
      anomaliesCount: s.errorCount > 0 ? 1 : 0,
      logEntriesCount: Math.round(s.requestRps * 60),
    }));

    const edges: DependencyGraph['edges'] = [
      { id: 'e-gw-auth', source: 'api-gateway', target: 'auth-service', sourceName: 'api-gateway', targetName: 'auth-service', dependencyType: 'HTTP', isRequired: true },
      { id: 'e-gw-order', source: 'api-gateway', target: 'order-service', sourceName: 'api-gateway', targetName: 'order-service', dependencyType: 'HTTP', isRequired: true },
      { id: 'e-auth-redis', source: 'auth-service', target: 'redis-cache', sourceName: 'auth-service', targetName: 'redis-cache', dependencyType: 'TCP', isRequired: true },
      { id: 'e-order-pay', source: 'order-service', target: 'payment-service', sourceName: 'order-service', targetName: 'payment-service', dependencyType: 'HTTP', isRequired: true },
      { id: 'e-order-inv', source: 'order-service', target: 'inventory-service', sourceName: 'order-service', targetName: 'inventory-service', dependencyType: 'gRPC', isRequired: true },
      { id: 'e-pay-db', source: 'payment-service', target: 'database-service', sourceName: 'payment-service', targetName: 'database-service', dependencyType: 'TCP', isRequired: true },
      { id: 'e-inv-db', source: 'inventory-service', target: 'database-service', sourceName: 'inventory-service', targetName: 'database-service', dependencyType: 'TCP', isRequired: true },
    ];

    return {
      projectId,
      totalServices: nodes.length,
      totalDependencies: edges.length,
      nodes,
      edges,
    };
  },

  async getServices(projectId: string): Promise<ServiceNodeData[]> {
    if (apiClient.isBackendConnected && projectId) {
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
            errorRate: s._count?.anomalies > 0 ? 4.8 : 0.1,
            p99LatencyMs: s._count?.anomalies > 0 ? 340 : 42,
            requestRps: Math.max(12, (s._count?.logEntries || 10) / 10),
            dependencies: s.outgoingDependencies?.map((d: any) => d.targetServiceId) || [],
            errorCount: s._count?.anomalies || 0,
            protocol: 'HTTP',
          }));
        }
      } catch (err) {
        console.warn(`Failed to fetch services for project ${projectId}:`, err);
      }
    }
    return MOCK_SERVICES;
  },

  async createService(projectId: string, name: string, description?: string): Promise<any> {
    if (apiClient.isBackendConnected) {
      const res = await apiClient.fetchEndpoint<{ service: any }>('/services', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          description: description || undefined,
        }),
      });
      return res.service;
    }
    return { id: `svc-${Date.now()}`, name, description };
  },

  async createDependency(
    sourceServiceId: string,
    targetServiceId: string,
    dependencyType: string = 'HTTP'
  ): Promise<any> {
    if (apiClient.isBackendConnected) {
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
    }
    return { id: `dep-${Date.now()}`, sourceServiceId, targetServiceId, dependencyType };
  },

  async deleteService(serviceId: string): Promise<void> {
    if (apiClient.isBackendConnected) {
      await apiClient.fetchEndpoint(`/services/${serviceId}`, { method: 'DELETE' });
    }
  },
};
