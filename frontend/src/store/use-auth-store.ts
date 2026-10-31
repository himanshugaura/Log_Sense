import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  id: string;
  clerkUserId: string;
  name: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  timezone: string;
  createdAt: string;
}

interface AuthState {
  user: UserProfile | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentProject: Project | null;
  isBackendSynced: boolean;
  setUser: (user: UserProfile | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrganization: (org: Organization | null) => void;
  setCurrentProject: (project: Project | null) => void;
  setBackendSynced: (synced: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      organizations: [],
      currentOrganization: null,
      currentProject: null,
      isBackendSynced: false,
      setUser: (user) => set({ user }),
      setOrganizations: (organizations) => set({ organizations }),
      setCurrentOrganization: (currentOrganization) => set({ currentOrganization }),
      setCurrentProject: (currentProject) => set({ currentProject }),
      setBackendSynced: (isBackendSynced) => set({ isBackendSynced }),
      reset: () =>
        set({
          user: null,
          organizations: [],
          currentOrganization: null,
          currentProject: null,
          isBackendSynced: false,
        }),
    }),
    {
      name: "logsense-auth-store",
      partialize: (state) => ({
        currentOrganization: state.currentOrganization,
        currentProject: state.currentProject,
      }),
    },
  ),
);
