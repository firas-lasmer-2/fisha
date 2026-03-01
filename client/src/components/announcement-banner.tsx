/**
 * Announcement banner rendered at the top of AppLayout.
 * Fetches active announcements from GET /api/announcements and shows the
 * highest-priority one that hasn't been dismissed this session.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { X, Info, AlertTriangle, Megaphone } from "lucide-react";
import { useState } from "react";
import type { Announcement } from "@shared/schema";

const PRIORITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  urgent: Megaphone,
} as const;

const PRIORITY_STYLE = {
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100",
  warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100",
  urgent: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100",
} as const;

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (!announcements || announcements.length === 0) return null;

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  // Show only the highest-priority undismissed announcement
  const top = visible[0];
  const Icon = PRIORITY_ICON[top.priority] ?? Info;
  const style = PRIORITY_STYLE[top.priority] ?? PRIORITY_STYLE.info;

  return (
    <div className={`border-b px-4 py-2 flex items-start gap-2 text-sm ${style}`} role="status">
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{top.title}</span>
        {" — "}
        <span>{top.body}</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed((prev) => new Set(Array.from(prev).concat(top.id)))}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
