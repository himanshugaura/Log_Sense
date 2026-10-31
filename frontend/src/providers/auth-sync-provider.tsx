"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, type ReactNode } from "react";

import { apiClient, setTokenProvider } from "@/lib/api-client";
import { useAuthStore, type UserProfile, type Organization } from "@/store/use-auth-store";

export function AuthSyncProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { setUser, setOrganizations, setBackendSynced, reset } = useAuthStore();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      setTokenProvider(() => getToken());

      const syncWithBackend = async () => {
        try {
          const res = await apiClient.get<{
            success: boolean;
            user: UserProfile;
            organizations: Organization[];
          }>("/auth/me");

          if (res.data?.user) {
            setUser(res.data.user);
            setOrganizations(res.data.organizations || []);
            setBackendSynced(true);
          }
        } catch {
          // If the database user was not yet created, attempt a sync call
          try {
            const syncRes = await apiClient.post<{
              success: boolean;
              user: UserProfile;
            }>("/auth/sync", {
              email: clerkUser?.primaryEmailAddress?.emailAddress,
              name: clerkUser?.fullName || clerkUser?.username || undefined,
            });
            if (syncRes.data?.user) {
              setUser(syncRes.data.user);
              setBackendSynced(true);
            }
          } catch {
            setBackendSynced(false);
          }
        }
      };

      syncWithBackend();
    } else {
      setTokenProvider(null as unknown as () => Promise<string | null>);
      reset();
    }
  }, [isLoaded, isSignedIn, clerkUser, getToken, setUser, setOrganizations, setBackendSynced, reset]);

  return <>{children}</>;
}
