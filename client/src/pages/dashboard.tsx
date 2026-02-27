import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, TrendingUp } from "lucide-react";
import type { Appointment, MoodEntry, User } from "@shared/schema";

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const timeOfDaySuggestion = (): { emoji: string; text: string } => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12)
    return { emoji: "🌅", text: "A good morning starts with checking in. How are you feeling?" };
  if (hour >= 12 && hour < 18)
    return { emoji: "🌿", text: "Take a breath. A short mindful pause can reset your afternoon." };
  if (hour >= 18 && hour < 23)
    return { emoji: "🌙", text: "How did today go? Reflecting before sleep helps you process and heal." };
  return { emoji: "💙", text: "Late nights can feel heavy. You're not alone — help is always here." };
};

export default function DashboardPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();

  const suggestion = timeOfDaySuggestion();

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: moods, isLoading: moodsLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/unread-count"],
  });

  const sortedMoods = useMemo(() => {
    if (!moods) return [];
    return [...moods].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  }, [moods]);

  const recentMoods = sortedMoods.slice(0, 7);
  const wellnessScore = recentMoods.length > 0
    ? Math.round((recentMoods.reduce((sum, mood) => sum + mood.moodScore, 0) / recentMoods.length) * 20)
    : 0;

  const consistencyScore = Math.round((recentMoods.length / 7) * 100);
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

  const sevenDayDots = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      const dateStr = day.toDateString();
      return sortedMoods.some((m) => m.createdAt && new Date(m.createdAt).toDateString() === dateStr);
    });
  }, [sortedMoods]);

  const streakCount = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dateStr = day.toDateString();
      if (sortedMoods.some((m) => m.createdAt && new Date(m.createdAt).toDateString() === dateStr)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [sortedMoods]);

  const todayDate = now.toLocaleDateString(isRTL ? "ar-TN" : "fr-TN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const wellnessState =
    wellnessScore >= 80
      ? {
          label: t("dashboard.wellness_thriving"),
          className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        }
      : wellnessScore >= 60
        ? {
            label: t("dashboard.wellness_steady"),
            className: "bg-primary/10 text-primary",
          }
        : wellnessScore >= 40
          ? {
              label: t("dashboard.wellness_watch"),
              className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            }
          : {
              label: t("dashboard.wellness_low"),
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
            {t("dashboard.today_title")}, {user?.firstName || t("common.friend")}
          </h1>
          <p className="text-sm text-muted-foreground">{todayDate}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.02 }}
          className="rounded-xl border bg-card/60 px-4 py-3 flex items-center gap-3"
          data-testid="card-time-suggestion"
        >
          <span className="text-2xl shrink-0">{suggestion.emoji}</span>
          <p className="text-sm text-muted-foreground">{suggestion.text}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="flex items-center gap-1.5 justify-between">
                        {sevenDayDots.map((filled, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-3 rounded-full ${filled ? "gradient-calm" : "bg-muted"}`}
                            title={filled ? "Logged" : "No entry"}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {streakCount > 0
                          ? streakCount === 1 && moodLoggedToday
                            ? t("dashboard.showed_up_today")
                            : `${streakCount}-${t("dashboard.day_streak")}`
                          : t("dashboard.track_mood_now")}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">{t("dashboard.consistency")}</p>
                        <p className="font-semibold">{consistencyScore}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/60 p-2">
                        <p className="text-muted-foreground">{t("dashboard.week_trend")}</p>
                        <p className="font-semibold">{moodTrend > 0 ? "+" : ""}{moodTrend}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <Card data-testid="card-today-plan" className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {t("dashboard.today_plan")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/60 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{t("nav.messages")}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard.unread_messages")}</p>
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
      </div>
    </AppLayout>
  );
}
