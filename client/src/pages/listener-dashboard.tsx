import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { fadeUp, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { DashboardSidebarLayout } from "@/components/dashboard-sidebar-layout";
import type { DashboardNavGroup } from "@/components/dashboard-sidebar-layout";
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
  ListenerBadge,
  ListenerCooldown,
  ListenerEndorsement,
  ListenerHallOfFameEntry,
  ListenerProfile,
  ListenerProgress,
  ListenerPointsLedger,
  ListenerWellbeingCheckIn,
  PeerSession,
  User,
} from "@shared/schema";
import {
  LayoutDashboard,
  TrendingUp,
  Heart,
  UserCircle,
  Trophy,
  MessageCircle,
} from "lucide-react";

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
  longestStreak: number;
  endorsementsCount: number;
  recentLedger: ListenerPointsLedger[];
  badges: ListenerBadge[];
  endorsements: ListenerEndorsement[];
  wellbeing: {
    latestCheckIn: ListenerWellbeingCheckIn | null;
    checkInCount: number;
    averageStressLevel: number | null;
    averageEmotionalLoad: number | null;
    suggestedCooldown: boolean;
  };
  cooldown: ListenerCooldown | null;
}

interface ListenerLeaderboardPayload {
  seasonKey: string;
  leaderboard: Array<{
    listenerId: string;
    rank: number;
    displayName: string;
    level: number;
    points: number;
    averageRating: number;
    ratingCount: number;
    positiveStreak: number;
    trophyTier: "gold" | "silver" | "bronze" | null;
    certificationTitle: string | null;
  }>;
  myRank: number | null;
  myCertificationTitle: string | null;
  hallOfFame: ListenerHallOfFameEntry[];
}

export default function ListenerDashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);
  const [activeSection, setActiveSection] = useState("status");
  const [isAvailable, setIsAvailable] = useState(false);
  const [headlineInput, setHeadlineInput] = useState("");
  const [aboutMeInput, setAboutMeInput] = useState("");
  const [avatarEmojiInput, setAvatarEmojiInput] = useState("🤝");
  const [stressLevel, setStressLevel] = useState(3);
  const [emotionalLoad, setEmotionalLoad] = useState(3);
  const [needsBreak, setNeedsBreak] = useState(false);
  const [checkInNotes, setCheckInNotes] = useState("");
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const [selectedLeaderboardSeason, setSelectedLeaderboardSeason] = useState("");
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
    queryKey: ["/api/listener/leaderboard", selectedLeaderboardSeason],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "8");
      if (selectedLeaderboardSeason) params.set("season", selectedLeaderboardSeason);
      const res = await apiRequest("GET", `/api/listener/leaderboard?${params.toString()}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!selectedLeaderboardSeason && leaderboardPayload?.seasonKey) {
      setSelectedLeaderboardSeason(leaderboardPayload.seasonKey);
    }
  }, [leaderboardPayload?.seasonKey, selectedLeaderboardSeason]);

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

  const wellbeingCheckInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/listener/wellbeing/checkin", {
        stressLevel,
        emotionalLoad,
        needsBreak,
        notes: checkInNotes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setCheckInNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/listener/progress/details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
      toast({
        title: needsBreak
          ? "Check-in saved. Cooldown started."
          : "Check-in saved. Thanks for taking care of yourself.",
      });
    },
    onError: () => {
      toast({ title: "Failed to save check-in.", variant: "destructive" });
    },
  });

  const downloadCertificateMutation = useMutation({
    mutationFn: async (requestedSeason?: string) => {
      const targetSeason = requestedSeason || seasonKey || new Date().toISOString().slice(0, 7);
      const res = await apiRequest(
        "GET",
        `/api/listener/leaderboard/certificate?season=${encodeURIComponent(targetSeason)}`,
      );
      return {
        blob: await res.blob(),
        season: targetSeason,
      };
    },
    onSuccess: ({ blob, season }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shifa-listener-certificate-${season}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Certificate downloaded." });
    },
    onError: (error: Error) => {
      toast({
        title: error.message.includes("Certificate is available")
          ? "Certificate unlocks after top certified rank."
          : "Failed to download certificate.",
        variant: "destructive",
      });
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
  const seasonKey = leaderboardPayload?.seasonKey || "";
  const myCertificationTitle = leaderboardPayload?.myCertificationTitle ?? null;
  const hallOfFame = leaderboardPayload?.hallOfFame || [];
  const myHallOfFameCertificates = hallOfFame.filter(
    (entry) => entry.listenerId === user?.id && !!entry.certificationTitle,
  );
  const leaderboardSeasonOptions = useMemo(() => {
    const keys = new Set<string>();
    if (seasonKey) keys.add(seasonKey);
    for (const entry of hallOfFame) keys.add(entry.seasonKey);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [hallOfFame, seasonKey]);
  const podium = leaderboard.slice(0, 3);
  const topPoints = leaderboard[0]?.points ?? 1;
  const badges = listenerProgressDetails?.badges || [];
  const endorsements = listenerProgressDetails?.endorsements || [];
  const wellbeing = listenerProgressDetails?.wellbeing;
  const cooldown = listenerProgressDetails?.cooldown || null;

  useEffect(() => {
    if (!cooldown?.endsAt) return;
    const timer = window.setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown?.endsAt]);

  const cooldownSecondsRemaining = useMemo(() => {
    if (!cooldown?.endsAt) return 0;
    const diff = new Date(cooldown.endsAt).getTime() - cooldownNow;
    return Math.max(0, Math.floor(diff / 1000));
  }, [cooldown?.endsAt, cooldownNow]);
  const inCooldown = cooldownSecondsRemaining > 0;
  const cooldownCountdownLabel = useMemo(() => {
    if (!inCooldown) return null;
    const mins = Math.floor(cooldownSecondsRemaining / 60);
    const secs = cooldownSecondsRemaining % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [cooldownSecondsRemaining, inCooldown]);

  const trophyIcon = (tier: "gold" | "silver" | "bronze" | null) => {
    if (tier === "gold") return "🏆";
    if (tier === "silver") return "🥈";
    if (tier === "bronze") return "🥉";
    return "🎖️";
  };
  const trophyCardClass = (tier: "gold" | "silver" | "bronze" | null) => {
    if (tier === "gold") return "from-amber-200/90 to-amber-50 dark:from-amber-500/20 dark:to-amber-950/20 border-amber-300/80";
    if (tier === "silver") return "from-slate-200/90 to-slate-50 dark:from-slate-500/20 dark:to-slate-950/20 border-slate-300/80";
    if (tier === "bronze") return "from-orange-200/90 to-orange-50 dark:from-orange-500/20 dark:to-orange-950/20 border-orange-300/80";
    return "from-muted/40 to-transparent border-border";
  };

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

  const navGroups: DashboardNavGroup[] = useMemo(() => [
    {
      label: "Overview",
      items: [
        { id: "status", label: "Status", icon: LayoutDashboard },
        { id: "sessions", label: "Sessions", icon: MessageCircle, badge: activeSessions.length || undefined },
      ],
    },
    {
      label: "Growth",
      items: [
        { id: "progress", label: "Progress", icon: TrendingUp },
        { id: "leaderboard", label: "Leaderboard", icon: Trophy },
      ],
    },
    {
      label: "My Account",
      items: [
        { id: "wellbeing", label: "Wellbeing", icon: Heart },
        { id: "profile", label: "Profile", icon: UserCircle },
      ],
    },
  ], [activeSessions.length]);

  return (
    <AppLayout>
      <DashboardSidebarLayout
        groups={navGroups}
        activeId={activeSection}
        onNavigate={setActiveSection}
        title={t("listener.dashboard_title")}
        subtitle={
          profile?.verificationStatus === "approved"
            ? isAvailable
              ? "You're online — clients can find you right now."
              : "You're paused — toggle available to start accepting sessions."
            : "Complete your application to start supporting others."
        }
        headerAction={
          profile?.verificationStatus === "approved" && activeSessions.length === 0 ? (
            <Button
              size="sm"
              variant={isAvailable ? "outline" : "default"}
              disabled={pauseMutation.isPending || inCooldown}
              onClick={() => pauseMutation.mutate(isAvailable)}
            >
              {isAvailable ? "Pause" : "Go online"}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">

        {/* ---- STATUS tab ---- */}
        {activeSection === "status" && (
          <motion.div custom={1} initial="hidden" animate="visible" variants={safeFadeUp}>
          <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("listener.dashboard_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("listener.loading")}</p>
            ) : (
              <>
                {/* Unified status flow */}
                {(() => {
                  const verif = profile?.verificationStatus;
                  const activ = profile?.activationStatus;
                  const appStatus = application?.status;

                  if (!application && !profile) {
                    return (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 space-y-2">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Step 1 of 3 — Apply to become a listener</p>
                        <p className="text-xs text-blue-800 dark:text-blue-300">Pass the qualification test, then submit your application to get started.</p>
                        <Link href="/listener/apply"><Button size="sm">Apply now</Button></Link>
                      </div>
                    );
                  }

                  if (appStatus === "pending" || verif === "pending") {
                    return (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Step 2 of 3 — Application under review</p>
                        <p className="text-xs text-amber-800 dark:text-amber-300">Our moderation team reviews each application carefully. You'll be notified by email once approved.</p>
                      </div>
                    );
                  }

                  if (appStatus === "changes_requested") {
                    return (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-2">
                        <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">Changes requested — update your application</p>
                        <p className="text-xs text-orange-800 dark:text-orange-300">A moderator left feedback on your application. Please review and resubmit.</p>
                        <Link href="/listener/apply"><Button size="sm" variant="outline">Update application</Button></Link>
                      </div>
                    );
                  }

                  if (verif === "approved" && (!activ || activ === "inactive")) {
                    return (
                      <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 p-3 space-y-1">
                        <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">Step 3 of 3 — Waiting for activation</p>
                        <p className="text-xs text-purple-800 dark:text-purple-300">Your application was approved! An admin will activate your account for trial or live sessions shortly.</p>
                      </div>
                    );
                  }

                  if (verif === "approved" && activ === "trial") {
                    return (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Active — Trial mode</p>
                        </div>
                        <p className="text-xs text-emerald-800 dark:text-emerald-300">You can accept sessions. After a successful trial period you'll be upgraded to live status.</p>
                      </div>
                    );
                  }

                  if (verif === "approved" && activ === "live") {
                    return (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Active — Live listener</p>
                        </div>
                      </div>
                    );
                  }

                  if (verif === "rejected" || appStatus === "rejected") {
                    return (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                        <p className="text-sm font-semibold text-destructive">Application not approved</p>
                        <p className="text-xs text-muted-foreground">Unfortunately your application was not accepted at this time. You may reapply after improving your qualification test score.</p>
                        <Link href="/listener/test"><Button size="sm" variant="outline">Retake qualification test</Button></Link>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{t("listener.verification")}: {verif || appStatus || "pending"}</Badge>
                      <Badge variant="outline">{t("listener.activation")}: {activ || "inactive"}</Badge>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline">{t("listener.level")}: {listenerProgress?.level ?? 1}</Badge>
                  <Badge variant="outline">{t("listener.points")}: {currentPoints}</Badge>
                  <Badge variant="outline">Streak: {listenerProgressDetails?.positiveStreak ?? 0}</Badge>
                  {myRank && <Badge variant="outline">Rank: #{myRank}</Badge>}
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
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
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
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[11px] text-muted-foreground">Longest streak</p>
                      <p className="text-sm font-semibold">{listenerProgressDetails?.longestStreak ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-[11px] text-muted-foreground">Endorsements</p>
                      <p className="text-sm font-semibold">{listenerProgressDetails?.endorsementsCount ?? 0}</p>
                    </div>
                  </div>
                </div>

                {inCooldown && (
                  <div className="border border-amber-300/80 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏸️</span>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                        Recovery cooldown — {cooldownCountdownLabel} remaining
                      </p>
                    </div>
                    <p className="text-xs text-amber-800/90 dark:text-amber-400/90">
                      <strong>Why:</strong> After an emotionally demanding session, you are automatically hidden from the directory to give you time to recover. This protects both you and future clients.
                    </p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-400/90">
                      <strong>How to exit early:</strong> Complete the wellbeing check-in below. If your stress levels are low enough, you'll come back online right away.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${activeSessions.length > 0 ? "bg-amber-500" : isAvailable ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                      {activeSessions.length > 0
                        ? "Currently in a session"
                        : inCooldown
                        ? "Cooling down after a difficult session"
                        : isAvailable
                        ? "Available — clients can find you"
                        : "Paused — you're hidden from the directory"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeSessions.length > 0
                        ? "You'll be available again once the session ends."
                        : inCooldown
                        ? "Complete the wellbeing check-in below to exit cooldown early, or wait for the timer to expire."
                        : "You appear in the listener directory when available. Toggle pause to hide yourself."}
                    </p>
                  </div>
                  {activeSessions.length === 0 && profile?.verificationStatus === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pauseMutation.isPending || inCooldown}
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
        </motion.div>
        )} {/* end status section */}

        {/* ---- PROGRESS tab ---- */}
        {activeSection === "progress" && (
        <div className="space-y-4">
        <motion.div custom={2} initial="hidden" animate="visible" variants={safeFadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to earn points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {[
                { icon: "💬", label: "Complete a session", pts: "+10 pts" },
                { icon: "⭐", label: "High rating (4-5 stars)", pts: "+5 pts" },
                { icon: "📝", label: "Client leaves detailed feedback", pts: "+3 pts" },
                { icon: "🔥", label: "Positive session streak", pts: "+2 pts/session" },
                { icon: "❤️", label: "Client endorsement", pts: "+8 pts" },
                { icon: "⚠️", label: "Low rating (<3 stars)", pts: "−3 pts" },
                { icon: "🚩", label: "Session report resolved against you", pts: "−10 pts" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <span className={`font-semibold shrink-0 ${item.pts.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {item.pts}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Points reset each month (season). Your best seasons are saved in the Hall of Fame.</p>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={safeFadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recognition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Unlocked badges</p>
              {badges.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {badges.map((badge) => (
                    <div key={`${badge.listenerId}-${badge.badgeKey}`} className="border rounded-md p-2.5 bg-gradient-to-r from-amber-100/60 to-transparent dark:from-amber-900/20">
                      <p className="text-sm font-semibold">{badge.title}</p>
                      {badge.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Complete sessions to unlock your first badge.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Anonymous endorsements</p>
              {endorsements.length > 0 ? (
                <div className="space-y-2">
                  {endorsements.slice(0, 4).map((endorsement) => (
                    <div key={endorsement.id} className="border rounded-md p-3 bg-gradient-to-r from-primary/10 to-transparent">
                      <p className="text-sm leading-relaxed">“{endorsement.quote}”</p>
                      <p className="text-xs text-muted-foreground mt-1">Client endorsement</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Great feedback comments will appear here.</p>
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>
        </div>
        )} {/* end progress section */}

        {/* ---- WELLBEING tab ---- */}
        {activeSection === "wellbeing" && (
        <motion.div custom={4} initial="hidden" animate="visible" variants={safeFadeUp}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wellbeing Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stress level (1-5)</Label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={`stress-${value}`}
                      type="button"
                      size="sm"
                      variant={stressLevel === value ? "default" : "outline"}
                      onClick={() => setStressLevel(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Emotional load (1-5)</Label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={`load-${value}`}
                      type="button"
                      size="sm"
                      variant={emotionalLoad === value ? "default" : "outline"}
                      onClick={() => setEmotionalLoad(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={needsBreak ? "default" : "outline"}
                onClick={() => setNeedsBreak((prev) => !prev)}
              >
                {needsBreak ? "Break requested" : "Request a cooldown break"}
              </Button>
              {wellbeing?.averageStressLevel != null && (
                <p className="text-xs text-muted-foreground">
                  Last check-ins avg: stress {wellbeing.averageStressLevel.toFixed(1)} / load {(wellbeing.averageEmotionalLoad ?? 0).toFixed(1)}
                </p>
              )}
            </div>
            <Textarea
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
              placeholder="Optional: how are you feeling after recent sessions?"
              rows={3}
              maxLength={1200}
            />
            <Button
              onClick={() => wellbeingCheckInMutation.mutate()}
              disabled={wellbeingCheckInMutation.isPending}
            >
              {wellbeingCheckInMutation.isPending ? "Saving..." : "Submit wellbeing check-in"}
            </Button>
          </CardContent>
        </Card>
        </motion.div>
        )} {/* end wellbeing section */}

        {/* ---- PROFILE tab ---- */}
        {activeSection === "profile" && (
        <>
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
        </>
        )} {/* end profile section */}

        {/* ---- LEADERBOARD tab ---- */}
        {activeSection === "leaderboard" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("listener.leaderboard_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Season:
                </p>
                <select
                  value={selectedLeaderboardSeason}
                  onChange={(e) => setSelectedLeaderboardSeason(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                >
                  {leaderboardSeasonOptions.length === 0 ? (
                    <option value={selectedLeaderboardSeason || ""}>{selectedLeaderboardSeason || "current"}</option>
                  ) : (
                    leaderboardSeasonOptions.map((season) => (
                      <option key={season} value={season}>{season}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex items-center gap-2">
                {myCertificationTitle && (
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
                    {myCertificationTitle}
                  </Badge>
                )}
                <Link href="/hall-of-fame">
                  <Button size="sm" variant="outline">
                    Hall of Fame
                  </Button>
                </Link>
              </div>
            </div>
            {/* Certification thresholds */}
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
              <p className="font-medium">Season certification tiers</p>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1">🏆 <strong>Gold</strong> — Top 3 listeners</span>
                <span className="flex items-center gap-1">🥈 <strong>Silver</strong> — Rank 4–10</span>
                <span className="flex items-center gap-1">🥉 <strong>Bronze</strong> — Rank 11–25</span>
              </div>
              <p className="text-muted-foreground">Certificates are issued at the end of each monthly season to certified listeners.</p>
            </div>
            {myRank && (
              <p className="text-xs text-muted-foreground">
                {t("listener.your_rank")}: #{myRank}
                {myRank <= 3 ? " 🏆 Gold certification — certificate available!" :
                 myRank <= 10 ? " 🥈 Silver certification — certificate available!" :
                 myRank <= 25 ? " 🥉 Bronze certification — certificate available!" :
                 ` — reach top 25 to earn a certificate`}
              </p>
            )}
            {myCertificationTitle && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadCertificateMutation.mutate(seasonKey)}
                disabled={downloadCertificateMutation.isPending}
              >
                {downloadCertificateMutation.isPending ? "Preparing certificate..." : "Download certificate (PDF)"}
              </Button>
            )}
            {leaderboard.length > 0 ? (
              <>
                {podium.length > 0 && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    {podium.map((entry) => (
                      <div
                        key={`podium-${entry.listenerId}`}
                        className={`border rounded-xl p-3 bg-gradient-to-br ${trophyCardClass(entry.trophyTier)}`}
                      >
                        <p className="text-2xl leading-none">{trophyIcon(entry.trophyTier)}</p>
                        <p className="text-xs mt-1 text-muted-foreground">#{entry.rank}</p>
                        <p className="text-sm font-semibold mt-1 truncate">{entry.displayName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.points} pts • {entry.averageRating.toFixed(2)} ★
                        </p>
                        {entry.certificationTitle && (
                          <Badge className="mt-2 bg-amber-600 hover:bg-amber-600 text-white">
                            {entry.certificationTitle}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div key={entry.listenerId} className="border rounded-md p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1.5">
                            <span>{trophyIcon(entry.trophyTier)}</span>
                            <span>#{entry.rank} {entry.displayName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("listener.level")} {entry.level} • {entry.averageRating.toFixed(2)} ★ • streak {entry.positiveStreak}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {entry.certificationTitle && (
                            <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
                              Certified
                            </Badge>
                          )}
                          <Badge variant={entry.listenerId === user?.id ? "secondary" : "outline"}>
                            {entry.points} {t("listener.pts")}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={Math.max(3, Math.min(100, (entry.points / topPoints) * 100))} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>

                {hallOfFame.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">Hall of Fame</p>
                    <div className="space-y-1.5">
                      {hallOfFame.slice(0, 9).map((entry) => (
                        <div key={`${entry.seasonKey}-${entry.listenerId}-${entry.rank}`} className="text-xs flex items-center justify-between border rounded-md px-2 py-1.5">
                          <span className="text-muted-foreground">
                            {entry.seasonKey} · #{entry.rank} {entry.displayName}
                          </span>
                          <span className="font-medium">{entry.points} pts</span>
                        </div>
                      ))}
                    </div>
                    {myHallOfFameCertificates.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {myHallOfFameCertificates.map((entry) => (
                          <Button
                            key={`cert-${entry.seasonKey}`}
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCertificateMutation.mutate(entry.seasonKey)}
                            disabled={downloadCertificateMutation.isPending}
                          >
                            Certificate {entry.seasonKey}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("listener.no_leaderboard")}</p>
            )}
          </CardContent>
        </Card>
        )} {/* end leaderboard section */}

        {/* ---- SESSIONS tab ---- */}
        {activeSection === "sessions" && (
        <>
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
        </>
        )} {/* end sessions section */}

        </div>
      </DashboardSidebarLayout>
    </AppLayout>
  );
}
