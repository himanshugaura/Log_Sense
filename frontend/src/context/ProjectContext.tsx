import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Project, Organization } from '../types';
import { projectService } from '../services/project-service';
import { organizationService } from '../services/organization-service';

const ACTIVE_ORG_KEY = 'logsense_active_org_id';
const ACTIVE_PROJECT_KEY = 'logsense_active_project_id';

interface ProjectContextType {
  // Organizations
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeOrganizationId: string;
  selectOrganization: (id: string) => void;
  createOrganization: (name: string) => Promise<Organization>;
  deleteOrganization: (id: string) => Promise<void>;
  refreshOrganizations: () => Promise<Organization[]>;

  // Projects
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string;
  isLoading: boolean;
  selectProject: (id: string) => void;
  createProject: (name: string, description?: string, orgId?: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: (orgId?: string) => Promise<Project[]>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn } = useAuth();

  // Organization states
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_ORG_KEY) || '';
  });

  // Project states
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Refresh Organizations
  const refreshOrganizations = useCallback(async (): Promise<Organization[]> => {
    try {
      const orgs = await organizationService.getOrganizations();
      setOrganizations(orgs);

      if (orgs.length > 0) {
        const found = orgs.find((o) => o.id === activeOrganizationId);
        if (!found) {
          const firstOrgId = orgs[0].id;
          setActiveOrganizationId(firstOrgId);
          localStorage.setItem(ACTIVE_ORG_KEY, firstOrgId);
        }
      } else {
        setActiveOrganizationId('');
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
      return orgs;
    } catch (err) {
      console.warn('Failed to load organizations:', err);
      return [];
    }
  }, [activeOrganizationId]);

  // Refresh Projects
  const refreshProjects = useCallback(async (targetOrgId?: string): Promise<Project[]> => {
    setIsLoading(true);
    const orgIdToUse = targetOrgId || activeOrganizationId || undefined;
    try {
      const list = await projectService.getProjects(orgIdToUse);
      setProjects(list);

      if (list.length > 0) {
        const found = list.find((p) => p.id === activeProjectId);
        const resolvedId = found ? found.id : list[0].id;
        setActiveProjectId(resolvedId);
        localStorage.setItem(ACTIVE_PROJECT_KEY, resolvedId);
        if (list[0].organizationId && !activeOrganizationId) {
          setActiveOrganizationId(list[0].organizationId);
          localStorage.setItem(ACTIVE_ORG_KEY, list[0].organizationId);
        }
      } else {
        setActiveProjectId('');
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
      return list;
    } catch (err) {
      console.warn('Failed to load projects:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganizationId, activeProjectId]);

  // Initial load
  useEffect(() => {
    if (isSignedIn) {
      refreshOrganizations().then((orgs) => {
        const currentOrg = orgs.find((o) => o.id === activeOrganizationId) || orgs[0];
        if (currentOrg) {
          refreshProjects(currentOrg.id);
        } else {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const selectOrganization = useCallback((id: string) => {
    setActiveOrganizationId(id);
    localStorage.setItem(ACTIVE_ORG_KEY, id);
    refreshProjects(id);
  }, [refreshProjects]);

  const handleCreateOrganization = useCallback(async (name: string): Promise<Organization> => {
    const created = await organizationService.createOrganization(name);
    await refreshOrganizations();
    selectOrganization(created.id);
    return created;
  }, [refreshOrganizations, selectOrganization]);

  const handleDeleteOrganization = useCallback(async (id: string): Promise<void> => {
    await organizationService.deleteOrganization(id);
    await refreshOrganizations();
  }, [refreshOrganizations]);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    window.dispatchEvent(new CustomEvent('project-changed', { detail: { projectId: id } }));
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, description?: string, orgId?: string): Promise<Project> => {
      const resolvedOrgId = orgId || activeOrganizationId;
      const created = await projectService.createProject({
        name,
        description,
        organizationId: resolvedOrgId || undefined,
      });
      await refreshProjects(resolvedOrgId);
      selectProject(created.id);
      return created;
    },
    [activeOrganizationId, refreshProjects, selectProject]
  );

  const handleDeleteProject = useCallback(async (id: string): Promise<void> => {
    await projectService.deleteProject(id);
    await refreshProjects();
  }, [refreshProjects]);

  const activeOrganization = organizations.find((o) => o.id === activeOrganizationId) || organizations[0] || null;
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  return (
    <ProjectContext.Provider
      value={{
        organizations,
        activeOrganization,
        activeOrganizationId: activeOrganization ? activeOrganization.id : activeOrganizationId,
        selectOrganization,
        createOrganization: handleCreateOrganization,
        deleteOrganization: handleDeleteOrganization,
        refreshOrganizations,
        projects,
        activeProject,
        activeProjectId: activeProject ? activeProject.id : activeProjectId,
        isLoading,
        selectProject,
        createProject: handleCreateProject,
        deleteProject: handleDeleteProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
