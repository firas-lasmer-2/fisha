import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase, getAccessToken } from "@/lib/supabase";
import { ensureUserKeyPair } from "@/lib/e2e";
import { apiRequest } from "@/lib/queryClient";
import { registerPushNotifications } from "@/lib/push";
import type { User } from "@shared/schema";

async function fetchProfile(): Promise<User | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const response = await fetch("/api/auth/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchProfile,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Refetch profile when auth state changes
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    );
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Keep the user's public key synced in profile for E2E message key exchange.
  useEffect(() => {
    let cancelled = false;

    async function syncPublicKey() {
      if (!user?.id) return;

      const { publicKeySpki } = await ensureUserKeyPair(user.id);
      if (cancelled || user.publicKey === publicKeySpki) return;

      await apiRequest("PATCH", "/api/user/profile", { publicKey: publicKeySpki });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }

    syncPublicKey().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [queryClient, user?.id, user?.publicKey]);

  useEffect(() => {
    if (!user?.id) return;
    registerPushNotifications().catch(() => undefined);
  }, [user?.id]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
