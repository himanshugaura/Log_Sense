import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Project } from '../types';
import { projectService } from '../services/project-service';

const ACTIVE_PROJECT_KEY = 'logsense_active_project_id';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string;
  isLoading: boolean;
  selectProject: (id: string) => void;
  createProject: (name: string, description?: string) => Promise<Project>;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await projectService.getProjects();
      setProjects(list);

      if (list.length > 0) {
        const found = list.find((p) => p.id === activeProjectId);
        if (!found) {
          const firstId = list[0].id;
          setActiveProjectId(firstId);
          localStorage.setItem(ACTIVE_PROJECT_KEY, firstId);
        }
      } else {
        setActiveProjectId('');
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch (err) {
      console.warn('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    refreshProjects();
  }, [isSignedIn]);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    window.dispatchEvent(new CustomEvent('project-changed', { detail: { projectId: id } }));
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, description?: string): Promise<Project> => {
      const created = await projectService.createProject({ name, description });
      await refreshProjects();
      selectProject(created.id);
      return created;
    },
    [refreshProjects, selectProject]
  );

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId: activeProject ? activeProject.id : activeProjectId,
        isLoading,
        selectProject,
        createProject: handleCreateProject,
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
