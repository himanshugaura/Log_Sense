import { Project } from '../types';
import { apiClient } from './api/client';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  organizationId?: string;
  timezone?: string;
}

const FALLBACK_PROJECTS: Project[] = [
  {
    id: 'demo-production-project',
    name: 'Production Cluster',
    description: 'Active microservices cloud deployment',
    organizationId: 'demo-org-1',
    timezone: 'UTC',
    createdAt: new Date().toISOString(),
    organization: {
      id: 'demo-org-1',
      name: 'Default Organization',
    },
    _count: {
      services: 7,
      logSources: 3,
      logEntries: 18429,
      anomalies: 4,
      incidents: 2,
    },
  },
];

export const projectService = {
  async getProjects(): Promise<Project[]> {
    if (apiClient.isBackendConnected) {
      try {
        const response = await apiClient.fetchEndpoint<{ projects: Project[] }>('/projects');
        if (response?.projects && Array.isArray(response.projects) && response.projects.length > 0) {
          return response.projects;
        }
      } catch (err) {
        console.warn('Backend /projects returned error or empty, using default fallback project:', err);
      }
    }
    return FALLBACK_PROJECTS;
  },

  async getProjectById(id: string): Promise<Project | null> {
    if (apiClient.isBackendConnected) {
      try {
        const response = await apiClient.fetchEndpoint<{ project: Project }>(`/projects/${id}`);
        return response?.project || null;
      } catch (err) {
        console.warn(`Failed to fetch project ${id} from backend:`, err);
      }
    }
    const found = FALLBACK_PROJECTS.find((p) => p.id === id);
    return found || null;
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    if (apiClient.isBackendConnected) {
      try {
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
            // Ignore org resolution error if org already known
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
      } catch (err) {
        console.error('Failed to create project on backend:', err);
        throw err;
      }
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: payload.name,
      description: payload.description || null,
      organizationId: 'demo-org-1',
      timezone: payload.timezone || 'UTC',
      createdAt: new Date().toISOString(),
      organization: {
        id: 'demo-org-1',
        name: 'Default Organization',
      },
      _count: {
        services: 0,
        logSources: 0,
        logEntries: 0,
        anomalies: 0,
        incidents: 0,
      },
    };
    FALLBACK_PROJECTS.push(newProject);
    return newProject;
  },

  async deleteProject(id: string): Promise<boolean> {
    if (apiClient.isBackendConnected) {
      try {
        await apiClient.fetchEndpoint(`/projects/${id}`, { method: 'DELETE' });
        return true;
      } catch (err) {
        console.error(`Failed to delete project ${id}:`, err);
        throw err;
      }
    }
    return true;
  },
};
