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
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  const [headlineInput, setHeadlineInput] = useState("");
  const [aboutMeInput, setAboutMeInput] = useState("");
  const [avatarEmojiInput, setAvatarEmojiInput] = useState("🤝");
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
    if (listenerData?.profile) {
      const p = listenerData.profile;
      setHeadlineInput((p as any).headline ?? "");
      setAboutMeInput((p as any).aboutMe ?? "");
      setAvatarEmojiInput((p as any).avatarEmoji ?? "🤝");
    }
  }, [listenerData?.profile]);

  const pauseMutation = useMutation({
    mutationFn: async (pause: boolean) => {
      await apiRequest("POST", "/api/listener/availability", { isAvailable: !pause });
    },
    onSuccess: (_data, pause) => {
      setIsAvailable(!pause);
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
      toast({
        title: pause
          ? "You are now paused. You won't appear in the directory until you resume."
          : "You are back online. Clients can find you in the directory.",
      });
    },
    onError: () => {
      toast({ title: "Failed to update status.", variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/listener/profile", {
        headline: headlineInput.trim() || undefined,
        aboutMe: aboutMeInput.trim() || undefined,
        avatarEmoji: avatarEmojiInput || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
      toast({ title: "Profile updated." });
    },
    onError: () => {
      toast({ title: "Failed to update profile.", variant: "destructive" });
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

  // Session history & stats
  const completedSessions = sessions.filter((s) => s.status === "ended" || s.status === "completed");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = sessions.filter((s) => new Date((s as any).createdAt ?? 0) >= weekAgo);
  const hoursThisWeek = sessionsThisWeek.reduce((sum, s) => sum + ((s as any).durationMinutes ?? 30) / 60, 0);

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
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${activeSessions.length > 0 ? "bg-amber-500" : isAvailable ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                      {activeSessions.length > 0
                        ? "Currently in a session"
                        : isAvailable
                        ? "Available — clients can find you"
                        : "Paused — you're hidden from the directory"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeSessions.length > 0
                        ? "You'll be available again once the session ends."
                        : "Your availability updates automatically when a session starts or ends."}
                    </p>
                  </div>
                  {activeSessions.length === 0 && profile?.verificationStatus === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pauseMutation.isPending}
                      onClick={() => pauseMutation.mutate(isAvailable)}
                    >
                      {isAvailable ? "Pause" : "Resume"}
                    </Button>
                  )}
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

        {/* Public Profile Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Public Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="avatar-emoji">Avatar emoji</Label>
              <div className="flex flex-wrap gap-2">
                {["🤝", "🌱", "💙", "🌊", "🕊️", "🌸", "✨", "🌿", "💬", "🫂", "🌞", "🍀", "🌈", "🎋", "💚", "🦋", "🌻", "🪷", "🫶", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatarEmojiInput(emoji)}
                    className={`h-9 w-9 text-lg rounded-md border transition-colors ${avatarEmojiInput === emoji ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline <span className="text-muted-foreground text-xs">(shown to clients)</span></Label>
              <Input
                id="headline"
                value={headlineInput}
                onChange={(e) => setHeadlineInput(e.target.value)}
                maxLength={120}
                placeholder="e.g. Here to listen, no judgment."
              />
              <p className="text-xs text-muted-foreground text-right">{headlineInput.length}/120</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="about-me">About me <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="about-me"
                value={aboutMeInput}
                onChange={(e) => setAboutMeInput(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Share a bit about your approach and what topics you're comfortable supporting."
              />
              <p className="text-xs text-muted-foreground text-right">{aboutMeInput.length}/2000</p>
            </div>
            <Button
              onClick={() => saveProfileMutation.mutate()}
              disabled={saveProfileMutation.isPending}
            >
              {saveProfileMutation.isPending ? "Saving..." : "Save profile"}
            </Button>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("listener.current_sessions")}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {hoursThisWeek > 0 && (
                  <span className="font-medium text-foreground">{hoursThisWeek.toFixed(1)}h</span>
                )}{hoursThisWeek > 0 && " this week"}
              </div>
            </div>
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

        {/* Session history */}
        {completedSessions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {completedSessions.slice(0, 10).map((session) => (
                <div key={session.id} className="border rounded-md p-2.5 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {session.otherUser.firstName || t("common.client")} {session.otherUser.lastName || ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{session.id} · {(session as any).createdAt ? new Date((session as any).createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize shrink-0">
                    {session.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Retake listener test */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Listener assessment</p>
              <p className="text-xs text-muted-foreground">Retake the test to unlock higher levels</p>
            </div>
            <Link href="/listener/test">
              <Button variant="outline" size="sm">Retake test</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
