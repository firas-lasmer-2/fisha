import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

type PresencePayload = {
  user_id?: string;
  role?: string;
};

export function useOnlineTherapists() {
  const { user } = useAuth();
  const [onlineTherapists, setOnlineTherapists] = useState<Set<string>>(new Set());

  useEffect(() => {
    const presenceKey = user?.id ?? `anon-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel("online-users", {
      config: {
        presence: { key: presenceKey },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresencePayload>();
      const onlineIds = new Set<string>();

      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry.user_id && entry.role === "therapist") {
            onlineIds.add(entry.user_id);
          }
        });
      });

      setOnlineTherapists(onlineIds);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && user) {
        await channel.track({
          user_id: user.id,
          role: user.role,
          online_at: new Date().toISOString(),
        });
      }
    });

    // Heartbeat: re-track every 30s so presence doesn't go stale
    let heartbeatRef: ReturnType<typeof setInterval> | null = null;
    if (user) {
      heartbeatRef = setInterval(() => {
        channel.track({
          user_id: user.id,
          role: user.role,
          online_at: new Date().toISOString(),
        }).catch(() => undefined);
      }, 30_000);
    }

    return () => {
      if (heartbeatRef) clearInterval(heartbeatRef);
      channel.untrack().catch(() => undefined);
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);

  return onlineTherapists;
}

