import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken, supabase } from "@/lib/supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getFreshToken(): Promise<string | null> {
  // Attempt a silent refresh; if it fails, return whatever we have
  try {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  } catch {
    return getAccessToken();
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  // On 401, attempt one token refresh and retry
  if (res.status === 401) {
    const freshToken = await getFreshToken();
    if (freshToken && freshToken !== token) {
      const retryHeaders: Record<string, string> = { ...headers, Authorization: `Bearer ${freshToken}` };
      const retryRes = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
      });
      await throwIfResNotOk(retryRes);
      return retryRes;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(queryKey.join("/") as string, { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes — data refreshes after reconnect or explicit invalidation
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
