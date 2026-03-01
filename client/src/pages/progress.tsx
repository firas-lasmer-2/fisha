import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  TrendingUp,
  BookOpen,
  Flame,
  Calendar,
  BarChart2,
  Star,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  ClipboardList,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MoodEntry, JournalEntry, Appointment } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { motion } from "framer-motion";
import { skeletonToContent, usePrefersReducedMotion, safeVariants } from "@/lib/motion";

interface SessionHomework {
  id: number;
  summaryId: number;
  description: string;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  clientNotes: string | null;
  createdAt: string;
}

interface TreatmentGoal {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "active" | "completed" | "abandoned";
  progressPct: number;
  createdAt: string;
}

interface MoodAnalytics {
  moodTrend: { date: string; avgMood: number }[];
}

const MOOD_EMOJI: Record<number, string> = { 1: "😢", 2: "😔", 3: "😐", 4: "🙂", 5: "😊" };

function journalStreak(entries: JournalEntry[]): number {
  if (!entries.length) return 0;
  const daysSet = new Set(
    entries.map((e) => e.createdAt?.slice(0, 10)).filter((d): d is string => !!d)
  );
  const sorted = Array.from(daysSet).sort((a, b) => b > a ? 1 : -1);

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (sorted[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function GoalCard({
  goal,
  onDelete,
  onUpdate,
}: {
  goal: TreatmentGoal;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<TreatmentGoal>) => void;
}) {
  const statusColor = goal.status === "completed" ? "text-emerald-500" : goal.status === "abandoned" ? "text-muted-foreground" : "text-primary";

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${goal.status === "abandoned" ? "line-through text-muted-foreground" : ""}`}>
            {goal.title}
          </p>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
          )}
          {goal.targetDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              Target: {new Date(goal.targetDate).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {goal.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600"
              onClick={() => onUpdate(goal.id, { status: "completed", progressPct: 100 })}
              title="Mark complete"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(goal.id)}
            title="Delete goal"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{goal.progressPct}%</span>
        </div>
        <Progress value={goal.progressPct} className="h-1.5" />
        {goal.status === "active" && (
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={goal.progressPct}
            onChange={(e) => onUpdate(goal.id, { progressPct: Number(e.target.value) })}
            className="w-full h-1 accent-primary cursor-pointer mt-1"
          />
        )}
      </div>

      <Badge
        className={`text-xs ${statusColor}`}
        variant="outline"
      >
        {goal.status}
      </Badge>
    </div>
  );
}

export default function ProgressPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const rm = usePrefersReducedMotion();

  const tr = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDesc, setNewGoalDesc] = useState("");
  const [newGoalDate, setNewGoalDate] = useState("");
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  const { data: moodEntries = [], isLoading: moodLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: journalEntries = [], isLoading: journalLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<TreatmentGoal[]>({
    queryKey: ["/api/goals"],
  });

  const { data: homework = [], isLoading: homeworkLoading } = useQuery<SessionHomework[]>({
    queryKey: ["/api/homework"],
  });

  const { data: analyticsData, isLoading: analyticsLoading, isError, error, refetch } = useQuery<MoodAnalytics>({
    queryKey: ["/api/progress/analytics", analyticsDays],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/progress/analytics?days=${analyticsDays}`);
      return res.json();
    },
  });

  const avgMood = useMemo(() => {
    if (!moodEntries.length) return 0;
    return moodEntries.reduce((sum, e) => sum + e.moodScore, 0) / moodEntries.length;
  }, [moodEntries]);

  const streak = useMemo(() => journalStreak(journalEntries), [journalEntries]);

  const completedSessions = useMemo(
    () => appointments.filter((a) => a.status === "completed").length,
    [appointments]
  );

  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "pending" || a.status === "confirmed")
        .sort((a, b) => (a.scheduledAt > b.scheduledAt ? 1 : -1))[0],
    [appointments]
  );

  const createGoalMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; targetDate?: string }) => {
      const res = await apiRequest("POST", "/api/goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setNewGoalTitle("");
      setNewGoalDesc("");
      setNewGoalDate("");
      setGoalDialogOpen(false);
      toast({ title: "Goal created" });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TreatmentGoal> }) => {
      const res = await apiRequest("PATCH", `/api/goals/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Goal deleted" });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const completeHomeworkMutation = useMutation({
    mutationFn: async ({ id, completed, clientNotes }: { id: number; completed: boolean; clientNotes?: string }) => {
      await apiRequest("PATCH", `/api/homework/${id}`, { completed, clientNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homework"] });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const isLoading = moodLoading || journalLoading || appointmentsLoading;
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  if (isError) return <AppLayout><div className="max-w-4xl mx-auto p-4 sm:p-6"><PageError error={error as Error} resetFn={refetch} /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader
          title={tr("progress.title", "Your Progress")}
          subtitle={tr("progress.subtitle", "Track your mental wellness journey over time.")}
        />

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <motion.div
            className="grid sm:grid-cols-2 gap-4"
            initial="loading"
            animate="loaded"
            variants={safeVariants(skeletonToContent, rm)}
          >
            {/* Mood avg */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{tr("progress.avg_mood", "Average Mood")}</p>
                </div>
                <p className="text-3xl font-bold">
                  {MOOD_EMOJI[Math.round(avgMood)] || "—"}{" "}
                  <span className="text-xl">{avgMood ? avgMood.toFixed(1) : "—"}/5</span>
                </p>
                <p className="text-xs text-muted-foreground">{moodEntries.length} logs total</p>
              </CardContent>
            </Card>

            {/* Journal streak */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-semibold">{tr("progress.journal_streak", "Journal Streak")}</p>
                </div>
                <p className="text-3xl font-bold">{streak} <span className="text-base font-normal text-muted-foreground">days</span></p>
                <p className="text-xs text-muted-foreground">{journalEntries.length} total entries</p>
              </CardContent>
            </Card>

            {/* Sessions */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm font-semibold">{tr("progress.sessions", "Completed Sessions")}</p>
                </div>
                <p className="text-3xl font-bold">{completedSessions}</p>
                {nextAppointment && (
                  <p className="text-xs text-muted-foreground">
                    Next: {new Date(nextAppointment.scheduledAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Next appointment */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-semibold">{tr("progress.next_apt", "Next Appointment")}</p>
                </div>
                {nextAppointment ? (
                  <>
                    <p className="text-base font-semibold">
                      {new Date(nextAppointment.scheduledAt).toLocaleDateString("fr-TN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{nextAppointment.sessionType}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">No upcoming appointments</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Mood Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Mood Trend
              </CardTitle>
              <div className="flex gap-1">
                {[30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={analyticsDays === d ? "default" : "outline"}
                    className="h-6 px-2 text-xs"
                    onClick={() => setAnalyticsDays(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {analyticsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !analyticsData?.moodTrend?.length ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Log moods to see your trend chart.</p>
              </div>
            ) : (
              <div role="img" aria-label="Mood trend chart">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={analyticsData.moodTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => d.slice(5)}
                  />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} ticks={[1, 2, 3, 4, 5]} />
                  <Tooltip
                    formatter={(v: number) => [`${v} / 5`, "Avg Mood"]}
                    labelFormatter={(l) => l}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgMood"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2">
              <Link href="/mood">
                <Button variant="ghost" size="sm">
                  {tr("progress.log_mood", "Log today's mood")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Treatment Goals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-500" />
                Treatment Goals
                {activeGoals.length > 0 && (
                  <Badge variant="secondary">{activeGoals.length} active</Badge>
                )}
              </CardTitle>
              <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Add Goal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Treatment Goal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-sm font-medium">Goal Title *</label>
                      <Input
                        className="mt-1"
                        placeholder="e.g. Practice mindfulness daily"
                        value={newGoalTitle}
                        onChange={(e) => setNewGoalTitle(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description (optional)</label>
                      <Input
                        className="mt-1"
                        placeholder="More details about this goal..."
                        value={newGoalDesc}
                        onChange={(e) => setNewGoalDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Date (optional)</label>
                      <Input
                        className="mt-1"
                        type="date"
                        value={newGoalDate}
                        onChange={(e) => setNewGoalDate(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newGoalTitle.trim() || createGoalMutation.isPending}
                      onClick={() =>
                        createGoalMutation.mutate({
                          title: newGoalTitle.trim(),
                          description: newGoalDesc.trim() || undefined,
                          targetDate: newGoalDate || undefined,
                        })
                      }
                    >
                      Create Goal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {goalsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : goals.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No goals yet"
                description="Add a treatment goal to track your progress."
              />
            ) : (
              <div className="space-y-3">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={(id) => deleteGoalMutation.mutate(id)}
                    onUpdate={(id, data) => updateGoalMutation.mutate({ id, data })}
                  />
                ))}
                {completedGoals.length > 0 && (
                  <details>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {completedGoals.length} completed goal{completedGoals.length !== 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 space-y-2 opacity-60">
                      {completedGoals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onDelete={(id) => deleteGoalMutation.mutate(id)}
                          onUpdate={(id, data) => updateGoalMutation.mutate({ id, data })}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        {/* Homework from Therapist */}
        {(homework.length > 0 || homeworkLoading) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                Homework from Your Therapist
                {homework.filter((h) => !h.completed).length > 0 && (
                  <Badge variant="secondary">{homework.filter((h) => !h.completed).length} pending</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {homeworkLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                homework.map((hw) => (
                  <div
                    key={hw.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-opacity ${hw.completed ? "opacity-60" : ""}`}
                    data-testid={`homework-item-${hw.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => completeHomeworkMutation.mutate({ id: hw.id, completed: !hw.completed })}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        hw.completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-muted-foreground hover:border-primary"
                      }`}
                    >
                      {hw.completed && <CheckCircle2 className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${hw.completed ? "line-through text-muted-foreground" : ""}`}>
                        {hw.description}
                      </p>
                      {hw.dueDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          Due {new Date(hw.dueDate).toLocaleDateString()}
                        </p>
                      )}
                      {hw.completedAt && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          Completed {new Date(hw.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/journal">
            <Button variant="outline" className="w-full gap-2">
              <BookOpen className="h-4 w-4" />
              {tr("progress.open_journal", "Open Journal")}
            </Button>
          </Link>
          <Link href="/grow">
            <Button variant="outline" className="w-full gap-2">
              <TrendingUp className="h-4 w-4" />
              {tr("progress.growth_paths", "Growth Paths")}
            </Button>
          </Link>
          <Link href="/appointments">
            <Button variant="outline" className="w-full gap-2">
              <Calendar className="h-4 w-4" />
              {tr("progress.appointments", "Appointments")}
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

