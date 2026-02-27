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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, TrendingUp, ArrowRight, ArrowLeft, MessageCircle, GraduationCap, Star, HeartHandshake, SmilePlus, Plus } from "lucide-react";
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

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

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
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Banner: Compassionate Check-in */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-bold" data-testid="text-today-title">
              {t("dashboard.today_title")}, {user?.firstName || t("common.friend")}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 text-lg">
              <span>{suggestion.emoji}</span>
              {suggestion.text}
            </p>
          </div>
          
          <Link href="/mood">
            <Button size="lg" className="shrink-0 rounded-full px-6 shadow-md hover:shadow-lg transition-all" data-testid="btn-quick-mood">
              <Plus className="h-5 w-5 me-2" />
              {t("nav.mood")}
            </Button>
          </Link>
        </motion.div>

        {/* Next Up (Immediate Action) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <Card className="overflow-hidden border-0 ring-1 ring-primary/20 shadow-md">
            <div className="bg-primary/5 px-4 py-3 border-b flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">{t("dashboard.today_plan")}</h2>
            </div>
            <CardContent className="p-0">
              {appointmentsLoading ? (
                <div className="p-6">
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : upcomingAppointments.length > 0 ? (
                <div className="divide-y">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {new Date(appointment.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div>
                          <p className="font-semibold text-lg">
                            {t("appointment.session_with")} {appointment.otherUser.firstName} {appointment.otherUser.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(appointment.scheduledAt).toLocaleDateString()} • {appointment.durationMinutes} {t("common.minutes")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Badge variant="outline" className="text-xs">
                          {t(`appointment.${appointment.status}`)}
                        </Badge>
                        <Link href={`/appointments`} className="w-full sm:w-auto">
                          <Button className="w-full" size="sm">
                            {t("appointment.view_details")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-5 w-5 opacity-50" />
                  </div>
                  <p>{t("dashboard.no_appointments")}</p>
                  <Link href="/therapists">
                    <Button variant="outline" size="sm" className="mt-2">
                      {t("therapist.find")}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Progress Chart */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-chart-3" />
                    {t("dashboard.wellness_score")}
                  </span>
                  <Badge className={wellnessState.className}>{wellnessState.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {moodsLoading ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : (
                  <div className="space-y-6">
                    {/* Key Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t("dashboard.consistency")}</p>
                        <p className="text-2xl font-bold">{consistencyScore}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t("dashboard.week_trend")}</p>
                        <p className="text-2xl font-bold">{moodTrend > 0 ? "+" : ""}{moodTrend}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">{t("dashboard.day_streak")}</p>
                        <p className="text-2xl font-bold">{streakCount}</p>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="h-48 w-full mt-4">
                      {recentMoods.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={[...recentMoods].reverse()}>
                            <XAxis 
                              dataKey="createdAt" 
                              tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short' })}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                              dy={10}
                            />
                            <YAxis hide domain={[0, 5]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [`Score: ${value}/5`, 'Mood']}
                              labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="moodScore" 
                              stroke="hsl(var(--primary))" 
                              strokeWidth={3}
                              dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2 }}
                              activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed p-4">
                          {t("dashboard.track_mood_now")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Toolkit (Bento Grid) */}
          <motion.div
            className="grid grid-cols-2 grid-rows-2 gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Link href="/therapists" className="block w-full h-full">
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-2">
                  <div className="p-3 rounded-full bg-primary/10 group-hover:scale-110 transition-transform">
                    <HeartHandshake className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{t("therapist.find")}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/peer-support" className="block w-full h-full">
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-2">
                  <div className="p-3 rounded-full bg-emerald-500/10 group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium">{t("peer.title")}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/journal" className="block w-full h-full">
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-2">
                  <div className="p-3 rounded-full bg-amber-500/10 group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-sm font-medium">{t("nav.journal")}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/self-care" className="block w-full h-full">
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full gap-2">
                  <div className="p-3 rounded-full bg-violet-500/10 group-hover:scale-110 transition-transform">
                    <SmilePlus className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-sm font-medium">{t("nav.self_care")}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
