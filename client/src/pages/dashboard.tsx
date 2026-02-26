import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, MessageCircle, Smile, BookOpen, Heart, Calendar,
  Frown, Meh, SmilePlus, Sparkles, Wind, ArrowRight, ArrowLeft,
  TrendingUp, Brain, HandHeart, ChevronRight,
  Wallet,
} from "lucide-react";
import type { Appointment, MoodEntry, PaymentTransaction, User } from "@shared/schema";

const moodIcons = [
  { icon: Frown, label: "mood.awful", color: "text-destructive" },
  { icon: Meh, label: "mood.bad", color: "text-chart-4" },
  { icon: Smile, label: "mood.okay", color: "text-chart-3" },
  { icon: SmilePlus, label: "mood.good", color: "text-chart-2" },
  { icon: Heart, label: "mood.great", color: "text-primary" },
];

const growthPaths = [
  { key: "anxiety", icon: Brain, titleKey: "growth.anxiety_path", steps: 7, color: "bg-chart-2/10 text-chart-2" },
  { key: "self_esteem", icon: Sparkles, titleKey: "growth.self_esteem_path", steps: 6, color: "bg-chart-4/10 text-chart-4" },
  { key: "stress", icon: Wind, titleKey: "growth.stress_path", steps: 5, color: "bg-chart-3/10 text-chart-3" },
  { key: "relationships", icon: HandHeart, titleKey: "growth.relationships_path", steps: 8, color: "bg-chart-5/10 text-chart-5" },
];

const affirmationKeys = [
  "dashboard.affirmation_1",
  "dashboard.affirmation_2",
  "dashboard.affirmation_3",
  "dashboard.affirmation_4",
  "dashboard.affirmation_5",
];

export default function DashboardPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data: appointments, isLoading: aptsLoading } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: moods, isLoading: moodsLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/unread-count"],
  });

  const { data: payments } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/payments"],
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

  const handleMoodSubmit = useCallback((score: number) => {
    setSelectedMood(score);
    moodMutation.mutate(score);
  }, [moodMutation]);

  const upcomingAppointments = appointments?.filter(
    (a) => a.status !== "completed" && a.status !== "cancelled" && new Date(a.scheduledAt) > new Date()
  ).slice(0, 3);

  const wellnessScore = moods && moods.length > 0
    ? Math.round((moods.slice(0, 7).reduce((sum, m) => sum + m.moodScore, 0) / Math.min(moods.length, 7)) * 20)
    : 0;

  const todayDate = new Date().toLocaleDateString(
    isRTL ? "ar-TN" : "fr-TN",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const dailyAffirmation = t(affirmationKeys[new Date().getDay() % affirmationKeys.length]);

  const quickActions = [
    { icon: Users, label: t("therapist.find"), href: "/therapists", color: "bg-primary/10 text-primary" },
    { icon: MessageCircle, label: t("nav.messages"), href: "/messages", color: "bg-chart-2/10 text-chart-2", badge: unread?.count },
    { icon: Smile, label: t("nav.mood"), href: "/mood", color: "bg-chart-3/10 text-chart-3" },
    { icon: BookOpen, label: t("nav.journal"), href: "/journal", color: "bg-chart-4/10 text-chart-4" },
    { icon: Wind, label: t("nav.selfcare"), href: "/self-care", color: "bg-chart-5/10 text-chart-5" },
    { icon: TrendingUp, label: t("nav.resources"), href: "/resources", color: "bg-chart-1/10 text-chart-1" },
  ];

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-welcome">
              {t("dashboard.welcome")} {user?.firstName || ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{todayDate}</p>
          </div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          <motion.div variants={fadeUp} className="lg:col-span-2">
            <Card data-testid="card-daily-checkin">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smile className="h-4 w-4 text-primary" />
                  {t("dashboard.daily_checkin")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moodSubmitted ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-4"
                  >
                    <div className="w-14 h-14 rounded-full gradient-calm flex items-center justify-center mx-auto mb-3">
                      <Heart className="h-7 w-7 text-white" />
                    </div>
                    <p className="font-medium text-sm">{t("dashboard.checkin_thanks")}</p>
                  </motion.div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">{t("mood.how_feeling")}</p>
                    <div className="flex items-center justify-center gap-3 sm:gap-5">
                      {moodIcons.map((mood, i) => {
                        const score = i + 1;
                        const isSelected = selectedMood === score;
                        return (
                          <button
                            key={score}
                            onClick={() => handleMoodSubmit(score)}
                            disabled={moodMutation.isPending}
                            className={`mood-btn flex flex-col items-center gap-1.5 p-2 rounded-xl ${isSelected ? "selected" : ""}`}
                            data-testid={`button-mood-${score}`}
                          >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? "gradient-calm" : "bg-muted"}`}>
                              <mood.icon className={`h-6 w-6 ${isSelected ? "text-white" : mood.color}`} />
                            </div>
                            <span className="text-xs text-muted-foreground">{t(mood.label)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card data-testid="card-wellness-score" className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                  {t("dashboard.wellness_score")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                {moodsLoading ? (
                  <Skeleton className="h-28 w-28 rounded-full" />
                ) : (
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="absolute inset-0" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-muted" />
                      <circle
                        cx="50" cy="50" r="42"
                        fill="none" strokeWidth="8"
                        className="stroke-primary"
                        strokeLinecap="round"
                        strokeDasharray={`${wellnessScore * 2.64} 264`}
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dasharray 1s ease" }}
                      />
                    </svg>
                    <div className="text-center">
                      <span className="text-2xl font-bold" data-testid="text-wellness-score">{wellnessScore}</span>
                      <span className="text-xs text-muted-foreground block">/ 100</span>
                    </div>
                  </div>
                )}
                {moods && moods.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {t("dashboard.based_on_checkins").replace("{count}", String(Math.min(moods.length, 7)))}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          data-testid="section-quick-actions"
        >
          {quickActions.map((action, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Link href={action.href}>
                <Card className="hover-elevate cursor-pointer relative">
                  <CardContent className="p-4 text-center">
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mx-auto mb-2`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium">{action.label}</span>
                    {action.badge && action.badge > 0 && (
                      <span className="absolute top-2 end-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center" data-testid="badge-unread">
                        {action.badge}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-2 gap-4"
        >
          <motion.div variants={fadeUp}>
            <Card data-testid="card-growth-paths">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-chart-4" />
                  {t("dashboard.your_growth")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t("growth.subtitle")}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedPath ? (
                  (() => {
                    const path = growthPaths.find(p => p.key === selectedPath)!;
                    const completed = Math.min(moods?.length ?? 0, path.steps);
                    const progress = Math.round((completed / path.steps) * 100);
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${path.color} flex items-center justify-center`}>
                            <path.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{t(path.titleKey)}</p>
                            <p className="text-xs text-muted-foreground">
                              {completed} / {path.steps} {t("growth.steps_completed")}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs" data-testid="badge-progress">
                            {progress}%
                          </Badge>
                        </div>
                        <Progress value={progress} className="h-2" data-testid="progress-growth" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full gap-1"
                          onClick={() => setSelectedPath(null)}
                          data-testid="button-change-path"
                        >
                          {t("dashboard.change_path")}
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {growthPaths.map((path) => (
                      <button
                        key={path.key}
                        onClick={() => setSelectedPath(path.key)}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover-elevate text-start"
                        data-testid={`button-path-${path.key}`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${path.color} flex items-center justify-center shrink-0`}>
                          <path.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{t(path.titleKey)}</p>
                          <p className="text-[10px] text-muted-foreground">{path.steps} {t("growth.steps")}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card data-testid="card-payments-history">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                {t("dashboard.payments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.slice(0, 4).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                      <div>
                        <p className="font-medium">{payment.paymentMethod.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-semibold">{payment.amountDinar} {t("common.dinar")}</p>
                        <p className="text-xs text-muted-foreground">{payment.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">{t("dashboard.no_payments")}</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card data-testid="card-upcoming-appointments">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {t("dashboard.upcoming")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aptsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid={`appointment-item-${apt.id}`}>
                        <div className="w-10 h-10 rounded-full gradient-calm flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {(apt.otherUser.firstName?.[0] || "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {apt.otherUser.firstName} {apt.otherUser.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                            <Calendar className="h-3 w-3" />
                            {new Date(apt.scheduledAt).toLocaleDateString()} - {apt.durationMinutes} {t("common.minutes")}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {t(`appointment.${apt.status}`)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {t("dashboard.no_appointments")}
                  </div>
                )}
                <Link href="/appointments">
                  <Button variant="ghost" size="sm" className="w-full mt-3 gap-1" data-testid="link-view-all-appointments">
                    <span className="text-xs">{t("nav.appointments")}</span>
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="gradient-feature" data-testid="card-daily-affirmation">
            <CardContent className="p-6 text-center">
              <div className="w-10 h-10 rounded-full gradient-calm flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{t("daily.affirmation")}</p>
              <p className="text-base font-medium leading-relaxed max-w-lg mx-auto" data-testid="text-affirmation">
                {dailyAffirmation}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-2 gap-4"
        >
          <motion.div variants={fadeUp}>
            <Card data-testid="card-mood-overview">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                  {t("dashboard.mood_trend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moodsLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : moods && moods.length > 0 ? (
                  <div>
                    <div className="flex items-end justify-center gap-1.5 h-24 mb-3">
                      {moods.slice(0, 7).reverse().map((m) => {
                        const MoodIcon = moodIcons[m.moodScore - 1]?.icon || Smile;
                        return (
                          <div key={m.id} className="flex flex-col items-center gap-1 flex-1 max-w-12">
                            <MoodIcon className={`h-3.5 w-3.5 ${moodIcons[m.moodScore - 1]?.color || "text-muted-foreground"}`} />
                            <div
                              className="w-full bg-primary/20 rounded-t-sm min-h-2"
                              style={{ height: `${(m.moodScore / 5) * 100}%` }}
                            />
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(m.createdAt!).toLocaleDateString(undefined, { day: "numeric" })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Smile className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {t("dashboard.track_mood_now")}
                  </div>
                )}
                <Link href="/mood">
                  <Button variant="ghost" size="sm" className="w-full mt-2 gap-1" data-testid="link-view-mood">
                    <span className="text-xs">{t("nav.mood")}</span>
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card data-testid="card-self-care-preview">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wind className="h-4 w-4 text-chart-5" />
                  {t("nav.selfcare")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("selfcare.breathing.desc")}
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-soft">
                    <Wind className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t("selfcare.breathing")}</p>
                    <p className="text-xs text-muted-foreground">{t("selfcare.meditation.desc")}</p>
                  </div>
                </div>
                <Link href="/self-care">
                  <Button variant="ghost" size="sm" className="w-full gap-1" data-testid="link-self-care">
                    <span className="text-xs">{t("dashboard.continue_path")}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
