import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import type {
  ListenerApplication,
  ListenerProfile,
  ListenerProgress,
  ListenerPointsLedger,
  PeerSession,
  User,
} from "@shared/schema";

interface ListenerApplicationPayload {
  application: ListenerApplication | null;
  profile: ListenerProfile | null;
}

interface PeerSessionsPayload {
  sessions: (PeerSession & { otherUser: User })[];
}

interface ListenerProgressDetailsPayload {
  progress: ListenerProgress;
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsToNextLevel: number;
  averageRating: number;
  ratingCount: number;
  positiveStreak: number;
  recentLedger: ListenerPointsLedger[];
}

interface ListenerLeaderboardPayload {
  leaderboard: Array<{
    listenerId: string;
    rank: number;
    displayName: string;
    level: number;
    points: number;
    averageRating: number;
    ratingCount: number;
    positiveStreak: number;
  }>;
  myRank: number | null;
}

export default function ListenerDashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAvailable, setIsAvailable] = useState(false);

  const { data: listenerData, isLoading } = useQuery<ListenerApplicationPayload>({
    queryKey: ["/api/listener/application"],
  });

  const { data: peerSessionsData } = useQuery<PeerSessionsPayload>({
    queryKey: ["/api/peer/sessions"],
  });

  const { data: listenerProgressDetails } = useQuery<ListenerProgressDetailsPayload>({
    queryKey: ["/api/listener/progress/details"],
  });

  const { data: leaderboardPayload } = useQuery<ListenerLeaderboardPayload>({
    queryKey: ["/api/listener/leaderboard", "?limit=8"],
  });

  useEffect(() => {
    if (typeof listenerData?.profile?.isAvailable === "boolean") {
      setIsAvailable(listenerData.profile.isAvailable);
    }
  }, [listenerData?.profile?.isAvailable]);

  const availabilityMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      await apiRequest("POST", "/api/listener/availability", { isAvailable: nextValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      toast({ title: t("listener.availability_updated") });
    },
    onError: () => {
      setIsAvailable((prev) => !prev);
      toast({ title: t("listener.availability_error"), variant: "destructive" });
    },
  });

  const profile = listenerData?.profile;
  const application = listenerData?.application;
  const sessions = peerSessionsData?.sessions || [];
  const activeSessions = sessions.filter((session) => session.status === "active");
  const listenerProgress = listenerProgressDetails?.progress;
  const currentPoints = listenerProgress?.points ?? 0;
  const nextLevelThreshold = listenerProgressDetails?.nextLevelThreshold ?? null;
  const progressPct = nextLevelThreshold && nextLevelThreshold > 0
    ? Math.max(0, Math.min(100, ((nextLevelThreshold - (listenerProgressDetails?.pointsToNextLevel ?? 0)) / nextLevelThreshold) * 100))
    : 100;
  const levelNameByIndex = [
    t("listener.level_name_1"),
    t("listener.level_name_2"),
    t("listener.level_name_3"),
    t("listener.level_name_4"),
    t("listener.level_name_5"),
    t("listener.level_name_6"),
    t("listener.level_name_7"),
    t("listener.level_name_8"),
    t("listener.level_name_9"),
    t("listener.level_name_10"),
  ];
  const leaderboard = leaderboardPayload?.leaderboard || [];
  const myRank = leaderboardPayload?.myRank ?? null;

  const eventLabel = (eventType: string) => {
    switch (eventType) {
      case "session_base":
        return t("listener.event_session_base");
      case "rating_bonus":
        return t("listener.event_rating_bonus");
      case "low_rating_penalty":
        return t("listener.event_low_rating_penalty");
      case "detailed_feedback_bonus":
        return t("listener.event_detailed_feedback_bonus");
      case "streak_bonus":
        return t("listener.event_streak_bonus");
      case "report_penalty":
        return t("listener.event_report_penalty");
      default:
        return eventType;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("listener.dashboard_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("listener.loading")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {t("listener.verification")}: {profile?.verificationStatus || application?.status || "pending"}
                  </Badge>
                  <Badge variant="outline">
                    {t("listener.activation")}: {profile?.activationStatus || "inactive"}
                  </Badge>
                  <Badge variant="outline">
                    {t("listener.level")}: {listenerProgress?.level ?? 1}
                  </Badge>
                  <Badge variant="outline">
                    {t("listener.points")}: {currentPoints}
                  </Badge>
                  {user?.role && <Badge variant="outline">{t("listener.role")}: {user.role}</Badge>}
                </div>

                <div className="space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      {levelNameByIndex[Math.max(0, Math.min((listenerProgress?.level ?? 1) - 1, levelNameByIndex.length - 1))]}
                    </p>
                    {listenerProgressDetails?.nextLevel ? (
                      <p className="text-xs text-muted-foreground">
                        {t("listener.next_level")} {listenerProgressDetails.nextLevel} • {listenerProgressDetails.pointsToNextLevel} {t("listener.points_needed")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("listener.max_level_reached")}
                      </p>
                    )}
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[11px] text-muted-foreground">{t("listener.avg_rating")}</p>
                      <p className="text-sm font-semibold">{(listenerProgressDetails?.averageRating ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[11px] text-muted-foreground">{t("listener.rating_count")}</p>
                      <p className="text-sm font-semibold">{listenerProgressDetails?.ratingCount ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[11px] text-muted-foreground">{t("listener.positive_streak")}</p>
                      <p className="text-sm font-semibold">{listenerProgressDetails?.positiveStreak ?? 0}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium">{t("listener.accept_sessions")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("listener.accept_sessions_desc")}
                    </p>
                  </div>
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={(nextValue) => {
                      setIsAvailable(nextValue);
                      availabilityMutation.mutate(nextValue);
                    }}
                    disabled={availabilityMutation.isPending}
                  />
                </div>

                {(!profile || profile.verificationStatus !== "approved") && (
                  <div className="text-sm text-muted-foreground">
                    {t("listener.not_approved")}
                    <div className="mt-2">
                      <Link href="/listener/apply">
                        <Button size="sm" variant="outline">
                          {t("listener.update_application")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {listenerProgressDetails?.recentLedger && listenerProgressDetails.recentLedger.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium">{t("listener.recent_points_activity")}</p>
                    <div className="space-y-1.5">
                      {listenerProgressDetails.recentLedger.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{eventLabel(entry.eventType)}</span>
                          <span className={entry.delta >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                            {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("listener.leaderboard_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myRank && (
              <p className="text-xs text-muted-foreground">
                {t("listener.your_rank")}: #{myRank}
              </p>
            )}
            {leaderboard.length > 0 ? (
              leaderboard.map((entry) => (
                <div key={entry.listenerId} className="border rounded-md p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      #{entry.rank} {entry.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("listener.level")} {entry.level} • {entry.averageRating.toFixed(2)} ★
                    </p>
                  </div>
                  <Badge variant={entry.listenerId === user?.id ? "secondary" : "outline"}>
                    {entry.points} {t("listener.pts")}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("listener.no_leaderboard")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("listener.current_sessions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <div key={session.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {session.otherUser.firstName || t("common.client")} {session.otherUser.lastName || ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("listener.session_id")} #{session.id}</p>
                  </div>
                  <Link href={`/listen?session=${session.id}`}>
                    <Button size="sm">{t("listener.open_chat")}</Button>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("listener.no_active_sessions")}</p>
            )}

            {sessions.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                {t("listener.total_sessions")}: {sessions.length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
