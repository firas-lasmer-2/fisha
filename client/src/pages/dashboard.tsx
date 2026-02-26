import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Frown,
  Heart,
  HeartHandshake,
  Meh,
  Smile,
  SmilePlus,
  Sparkles,
  TrendingUp,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Appointment, MoodEntry, OnboardingResponse, User } from "@shared/schema";

const moodIcons = [
  { icon: Frown, label: "mood.awful", color: "text-destructive" },
  { icon: Meh, label: "mood.bad", color: "text-chart-4" },
  { icon: Smile, label: "mood.okay", color: "text-chart-3" },
  { icon: SmilePlus, label: "mood.good", color: "text-chart-2" },
  { icon: Heart, label: "mood.great", color: "text-primary" },
] as const;

type RecommendationBlueprint = {
  concern: string;
  href: string;
  icon: LucideIcon;
  color: string;
  titleKey: string;
  descKey: string;
  fallbackTitle: string;
  fallbackDesc: string;
};

type DailyWellnessSuggestion = {
  titleKey: string;
  descKey: string;
  fallbackTitle: string;
  fallbackDesc: string;
  href: string;
  icon: LucideIcon;
  colorClass: string;
};

const recommendationBlueprints: RecommendationBlueprint[] = [
  {
    concern: "anxiety",
    href: "/grow",
    icon: Sparkles,
    color: "bg-primary/10 text-primary",
    titleKey: "growth.anxiety_path",
    descKey: "dashboard.reco_anxiety_desc",
    fallbackTitle: "Anxiety path",
    fallbackDesc: "Start with short calming exercises and daily grounding.",
  },
  {
    concern: "depression",
    href: "/journal",
    icon: BookOpen,
    color: "bg-chart-4/10 text-chart-4",
    titleKey: "dashboard.reco_reflect_title",
    descKey: "dashboard.reco_reflect_desc",
    fallbackTitle: "Daily reflection",
    fallbackDesc: "A short journal check-in can make patterns easier to spot.",
  },
  {
    concern: "stress",
    href: "/self-care",
    icon: Wind,
    color: "bg-chart-3/10 text-chart-3",
    titleKey: "growth.stress_path",
    descKey: "dashboard.reco_stress_desc",
    fallbackTitle: "Stress reset",
    fallbackDesc: "Use the breathing flow to lower physical tension quickly.",
  },
  {
    concern: "relationships",
    href: "/therapists?specialization=relationships",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    titleKey: "growth.relationships_path",
    descKey: "dashboard.reco_relationships_desc",
    fallbackTitle: "Relationship support",
    fallbackDesc: "Explore therapists experienced in relationship challenges.",
  },
  {
    concern: "trauma",
    href: "/therapists?specialization=trauma",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    titleKey: "specialization.trauma",
    descKey: "dashboard.reco_trauma_desc",
    fallbackTitle: "Trauma-informed care",
    fallbackDesc: "Connect with therapists trained in trauma recovery.",
  },
  {
    concern: "self_esteem",
    href: "/grow",
    icon: Sparkles,
    color: "bg-chart-2/10 text-chart-2",
    titleKey: "growth.self_esteem_path",
    descKey: "dashboard.reco_self_esteem_desc",
    fallbackTitle: "Self-esteem path",
    fallbackDesc: "Build confidence with small daily wins and reflection.",
  },
  {
    concern: "grief",
    href: "/journal",
    icon: BookOpen,
    color: "bg-chart-4/10 text-chart-4",
    titleKey: "specialization.grief",
    descKey: "dashboard.reco_grief_desc",
    fallbackTitle: "Grief support",
    fallbackDesc: "Gentle writing prompts can help process difficult emotions.",
  },
  {
    concern: "family",
    href: "/therapists?specialization=family",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    titleKey: "specialization.family",
    descKey: "dashboard.reco_family_desc",
    fallbackTitle: "Family support",
    fallbackDesc: "Match with therapists who focus on family dynamics.",
  },
  {
    concern: "couples",
    href: "/therapists?specialization=couples",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    titleKey: "specialization.couples",
    descKey: "dashboard.reco_couples_desc",
    fallbackTitle: "Couples support",
    fallbackDesc: "Find specialists for communication and partnership issues.",
  },
  {
    concern: "addiction",
    href: "/therapists?specialization=addiction",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    titleKey: "specialization.addiction",
    descKey: "dashboard.reco_addiction_desc",
    fallbackTitle: "Addiction support",
    fallbackDesc: "Get structured support from addiction specialists.",
  },
];

const defaultRecommendationConcerns = ["anxiety", "stress", "relationships"];

const dailyWellnessSuggestions: DailyWellnessSuggestion[] = [
  {
    titleKey: "dashboard.wellness_breathe_title",
    descKey: "dashboard.wellness_breathe_desc",
    fallbackTitle: "2-minute breathing reset",
    fallbackDesc: "Lower tension with a short guided breathing cycle.",
    href: "/self-care",
    icon: Wind,
    colorClass: "bg-primary/10 text-primary",
  },
  {
    titleKey: "dashboard.wellness_journal_title",
    descKey: "dashboard.wellness_journal_desc",
    fallbackTitle: "Short reflection",
    fallbackDesc: "Write one sentence about how your day feels right now.",
    href: "/journal",
    icon: BookOpen,
    colorClass: "bg-chart-4/10 text-chart-4",
  },
  {
    titleKey: "dashboard.wellness_path_title",
    descKey: "dashboard.wellness_path_desc",
    fallbackTitle: "Continue your wellness path",
    fallbackDesc: "Take one small next step to keep your progress moving.",
    href: "/grow",
    icon: Sparkles,
    colorClass: "bg-chart-3/10 text-chart-3",
  },
];

const affirmationKeys = [
  "dashboard.affirmation_1",
  "dashboard.affirmation_2",
  "dashboard.affirmation_3",
  "dashboard.affirmation_4",
  "dashboard.affirmation_5",
] as const;

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function DashboardPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodSubmitted, setMoodSubmitted] = useState(false);

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: moods, isLoading: moodsLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: onboarding } = useQuery<OnboardingResponse | null>({
    queryKey: ["/api/onboarding"],
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/unread-count"],
  });

  const moodMutation = useMutation({
    mutationFn: async (score: number) => {
      await apiRequest("POST", "/api/mood", { moodScore: score });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mood"] });
      setMoodSubmitted(true);
    },
  });

  const handleMoodSubmit = (score: number) => {
    setSelectedMood(score);
    moodMutation.mutate(score);
  };

  const sortedMoods = useMemo(() => {
    if (!moods) return [];
    return [...moods].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  }, [moods]);

  const recentMoods = sortedMoods.slice(0, 7);
  const wellnessScore = recentMoods.length > 0
    ? Math.round((recentMoods.reduce((sum, mood) => sum + mood.moodScore, 0) / recentMoods.length) * 20)
    : 0;

  const consistencyScore = Math.round((recentMoods.length / 7) * 100);
  const latestMood = recentMoods[0] ?? null;
  const moodTrend = recentMoods.length >= 2
    ? recentMoods[0].moodScore - recentMoods[recentMoods.length - 1].moodScore
    : 0;

  const now = new Date();
  const moodLoggedToday = recentMoods.some((entry) => {
    if (!entry.createdAt) return false;
    const entryDate = new Date(entry.createdAt);
    return entryDate.toDateString() === now.toDateString();
  });

  const upcomingAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter((appointment) => {
        const appointmentTime = toTimestamp(appointment.scheduledAt);
        return appointmentTime > Date.now() && appointment.status !== "cancelled" && appointment.status !== "completed";
      })
      .sort((a, b) => toTimestamp(a.scheduledAt) - toTimestamp(b.scheduledAt))
      .slice(0, 3);
  }, [appointments]);

  const recommendationMap = useMemo(() => {
    return recommendationBlueprints.reduce<Record<string, RecommendationBlueprint>>((acc, blueprint) => {
      acc[blueprint.concern] = blueprint;
      return acc;
    }, {});
  }, []);

  const recommendedForYou = useMemo(() => {
    const picked = new Set<string>();
    const concerns = onboarding?.primaryConcerns || [];
    const allConcerns = [...concerns, ...defaultRecommendationConcerns];

    const items: Array<RecommendationBlueprint> = [];
    for (const concern of allConcerns) {
      if (picked.has(concern)) continue;
      const blueprint = recommendationMap[concern];
      if (!blueprint) continue;
      items.push(blueprint);
      picked.add(concern);
      if (items.length === 3) break;
    }

    return items;
  }, [onboarding?.primaryConcerns, recommendationMap]);

  const dailyAffirmation = t(affirmationKeys[now.getDay() % affirmationKeys.length]);
  const dailyWellnessSuggestion = dailyWellnessSuggestions[now.getDay() % dailyWellnessSuggestions.length];
  const todayDate = now.toLocaleDateString(isRTL ? "ar-TN" : "fr-TN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const wellnessState =
    wellnessScore >= 80
      ? {
          label: tr("dashboard.wellness_thriving", "Thriving"),
          className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        }
      : wellnessScore >= 60
        ? {
            label: tr("dashboard.wellness_steady", "Steady"),
            className: "bg-primary/10 text-primary",
          }
        : wellnessScore >= 40
          ? {
              label: tr("dashboard.wellness_watch", "Needs care"),
              className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            }
          : {
              label: tr("dashboard.wellness_low", "Rough patch"),
              className: "bg-destructive/10 text-destructive",
            };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-1"
        >
          <h1 className="text-2xl font-bold" data-testid="text-today-title">
            {tr("dashboard.today_title", "Today")}, {user?.firstName || tr("common.friend", "friend")}
          </h1>
          <p className="text-sm text-muted-foreground">{todayDate}</p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-2"
          >
            <Card className="gradient-feature" data-testid="card-featured-today">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {tr("dashboard.featured_title", "Your focus for today")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {moodLoggedToday || moodSubmitted ? (
                  <div className="space-y-3">
                    <Badge variant="secondary" className="text-xs">
                      {tr("dashboard.checkin_done", "Mood check-in completed")}
                    </Badge>
                    <p className="text-lg font-medium leading-relaxed" data-testid="text-affirmation">
                      {dailyAffirmation}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/journal">
                        <Button size="sm" className="gap-1">
                          <BookOpen className="h-4 w-4" />
                          {tr("dashboard.reflect_now", "Reflect in journal")}
                        </Button>
                      </Link>
                      <Link href="/self-care">
                        <Button size="sm" variant="outline" className="gap-1">
                          <Wind className="h-4 w-4" />
                          {tr("dashboard.take_breath", "Take a breathing break")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="section-daily-checkin">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">{t("mood.how_feeling")}</p>
                      <div className="flex items-center justify-center sm:justify-start gap-3">
                        {moodIcons.map((mood, index) => {
                          const score = index + 1;
                          const selected = selectedMood === score;
                          return (
                            <button
                              key={score}
                              type="button"
                              disabled={moodMutation.isPending}
                              onClick={() => handleMoodSubmit(score)}
                              className={`mood-btn flex flex-col items-center gap-1.5 p-2 rounded-xl ${selected ? "selected" : ""}`}
                              data-testid={`button-mood-${score}`}
                            >
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${selected ? "gradient-calm" : "bg-muted"}`}>
                                <mood.icon className={`h-5 w-5 ${selected ? "text-white" : mood.color}`} />
                              </div>
                              <span className="text-[11px] text-muted-foreground">{t(mood.label)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{dailyAffirmation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Card data-testid="card-wellness-insight" className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                  {t("dashboard.wellness_score")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {moodsLoading ? (
                  <Skeleton className="h-28 w-full rounded-xl" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold" data-testid="text-wellness-score">{wellnessScore}</p>
                        <p className="text-xs text-muted-foreground">/ 100</p>
                      </div>
                      <Badge className={wellnessState.className}>{wellnessState.label}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-chart-4 via-primary to-chart-2"
                          style={{ width: `${wellnessScore}%`, transition: "width 400ms ease" }}
                        />
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {recentMoods.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-sm bg-primary/20"
                            style={{ height: `${Math.max(8, entry.moodScore * 9)}px` }}
                            title={entry.createdAt || ""}
                          />
                        ))}
                      </div>
                      {recentMoods.length === 0 && (
                        <p className="text-xs text-muted-foreground">{tr("dashboard.track_mood_now", "Log your mood to see your trend.")}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">{tr("dashboard.consistency", "Consistency")}</p>
                        <p className="font-semibold">{consistencyScore}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">{tr("dashboard.week_trend", "Week trend")}</p>
                        <p className="font-semibold">{moodTrend > 0 ? "+" : ""}{moodTrend}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <Card className="safe-surface" data-testid="card-wellness-suggestion">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${dailyWellnessSuggestion.colorClass} flex items-center justify-center`}>
                <dailyWellnessSuggestion.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {tr(dailyWellnessSuggestion.titleKey, dailyWellnessSuggestion.fallbackTitle)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr(dailyWellnessSuggestion.descKey, dailyWellnessSuggestion.fallbackDesc)}
                </p>
              </div>
              <Link href={dailyWellnessSuggestion.href}>
                <Button size="sm" variant="outline" className="gap-1">
                  {tr("dashboard.open_wellness", "Open")}
                  <Arrow className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <Card data-testid="card-recommended">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-primary" />
                  {tr("dashboard.recommended", "Recommended for you")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendedForYou.map((item) => (
                  <Link key={`${item.concern}-${item.href}`} href={item.href}>
                    <div className="rounded-xl border p-3 hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`recommended-${item.concern}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {tr(item.titleKey, item.fallbackTitle)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tr(item.descKey, item.fallbackDesc)}
                          </p>
                        </div>
                        <Arrow className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))}
                <Link href="/grow">
                  <Button variant="ghost" size="sm" className="w-full mt-1 gap-1" data-testid="button-open-grow">
                    {tr("dashboard.view_all_paths", "View all growth paths")}
                    <Arrow className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
          >
            <Card data-testid="card-today-plan" className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {tr("dashboard.today_plan", "Today plan")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/60 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t("nav.messages")}</p>
                    <p className="text-xs text-muted-foreground">{tr("dashboard.unread_messages", "Unread messages")}</p>
                  </div>
                  <Badge variant="secondary" data-testid="badge-unread-count">{unread?.count || 0}</Badge>
                </div>

                {appointmentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="rounded-lg border p-3 flex items-center justify-between gap-2"
                        data-testid={`appointment-item-${appointment.id}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {appointment.otherUser.firstName} {appointment.otherUser.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(appointment.scheduledAt).toLocaleDateString()} • {appointment.durationMinutes} {t("common.minutes")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`appointment.${appointment.status}`)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {t("dashboard.no_appointments")}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Link href="/appointments">
                    <Button variant="outline" size="sm" className="w-full">{t("nav.appointments")}</Button>
                  </Link>
                  <Link href="/messages">
                    <Button variant="outline" size="sm" className="w-full">{t("nav.messages")}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="grid gap-3 sm:grid-cols-3"
        >
          <Link href="/listen">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="quick-peer-support">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <HeartHandshake className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{tr("nav.peer_support", "Peer Support")}</p>
                  <p className="text-xs text-muted-foreground">{tr("dashboard.quick_peer_desc", "Talk to a trained listener now.")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/therapists">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="quick-therapists">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("therapist.find")}</p>
                  <p className="text-xs text-muted-foreground">{tr("dashboard.quick_therapist_desc", "Book student or professional sessions.")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/self-care">
            <Card className="hover-elevate cursor-pointer h-full" data-testid="quick-selfcare">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-chart-5/10 text-chart-5 flex items-center justify-center">
                  <Wind className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("nav.selfcare")}</p>
                  <p className="text-xs text-muted-foreground">{tr("dashboard.quick_selfcare_desc", "Reset with breathing and grounding tools.")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {latestMood && (
          <p className="text-xs text-muted-foreground text-center" data-testid="text-last-checkin">
            {tr("dashboard.last_checkin", "Last check-in score")}: {latestMood.moodScore}/5
          </p>
        )}
      </div>
    </AppLayout>
  );
}
