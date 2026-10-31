import { Organization } from '../types';
import { apiClient } from './api/client';

export const organizationService = {
  async getOrganizations(): Promise<Organization[]> {
    if (!apiClient.isBackendConnected) return [];
    try {
      const res = await apiClient.fetchEndpoint<{ organizations: Organization[] }>('/organizations');
      return res?.organizations || [];
    } catch (err: any) {
      if (err?.status !== 401) {
        console.warn('Failed to fetch organizations:', err);
      }
      return [];
    }
  },

  async createOrganization(name: string): Promise<Organization> {
    const res = await apiClient.fetchEndpoint<{ organization: Organization }>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return res.organization;
  },

  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      const res = await apiClient.fetchEndpoint<{ organization: Organization }>(`/organizations/${id}`);
      return res.organization || null;
    } catch {
      return null;
    }
  },

  async deleteOrganization(id: string): Promise<boolean> {
    await apiClient.fetchEndpoint(`/organizations/${id}`, { method: 'DELETE' });
    return true;
  },
};
