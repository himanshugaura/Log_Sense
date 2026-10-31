import { Project } from '../types';
import { apiClient } from './api/client';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  organizationId?: string;
  timezone?: string;
}

export const projectService = {
  async getProjects(organizationId?: string): Promise<Project[]> {
    if (!apiClient.isBackendConnected) {
      return [];
    }

    try {
      const endpoint = organizationId
        ? `/projects?organizationId=${organizationId}`
        : '/projects';
      const response = await apiClient.fetchEndpoint<{ projects: Project[] }>(endpoint);
      if (response?.projects && Array.isArray(response.projects)) {
        return response.projects;
      }
    } catch (err: any) {
      // If 401, user is not authenticated yet
      if (err?.status === 401) {
        console.info('User not authenticated with Clerk yet.');
      } else {
        console.warn('Failed to fetch projects from backend:', err);
      }
    }
    return [];
  },

  async getProjectById(id: string): Promise<Project | null> {
    if (!apiClient.isBackendConnected || !id) return null;

    try {
      const response = await apiClient.fetchEndpoint<{ project: Project }>(`/projects/${id}`);
      return response?.project || null;
    } catch (err) {
      console.warn(`Failed to fetch project ${id} from backend:`, err);
      return null;
    }
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    let orgId = payload.organizationId;
    if (!orgId) {
      // Resolve or auto-create an organization
      try {
        const orgRes = await apiClient.fetchEndpoint<{ organizations: Array<{ id: string }> }>('/organizations');
        if (orgRes?.organizations?.[0]?.id) {
          orgId = orgRes.organizations[0].id;
        } else {
          const newOrg = await apiClient.fetchEndpoint<{ organization: { id: string } }>('/organizations', {
            method: 'POST',
            body: JSON.stringify({ name: 'Default Organization' }),
          });
          orgId = newOrg.organization.id;
        }
      } catch {
        // Fallback or proceed
      }
    }

    const res = await apiClient.fetchEndpoint<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || undefined,
        organizationId: orgId,
        timezone: payload.timezone || 'UTC',
      }),
    });

    return res.project;
  },

  async deleteProject(id: string): Promise<boolean> {
    if (apiClient.isBackendConnected) {
      await apiClient.fetchEndpoint(`/projects/${id}`, { method: 'DELETE' });
      return true;
    }
    return false;
  },
};
