import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  BookOpen,
  Flame,
  Calendar,
  BarChart2,
  Star,
} from "lucide-react";
import type { MoodEntry, JournalEntry, Appointment } from "@shared/schema";

const MOOD_EMOJI: Record<number, string> = { 1: "😢", 2: "😔", 3: "😐", 4: "🙂", 5: "😊" };

function MoodSparkline({ entries }: { entries: MoodEntry[] }) {
  const last7 = entries
    .slice()
    .sort((a, b) => (a.createdAt || "") > (b.createdAt || "") ? 1 : -1)
    .slice(-7);

  if (last7.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Log at least 2 moods to see your trend.
      </p>
    );
  }

  const max = 5;
  const width = 260;
  const height = 60;
  const stepX = width / (last7.length - 1);

  const points = last7
    .map((e, i) => `${i * stepX},${height - (e.moodScore / max) * height}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xs" style={{ height: 60 }}>
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {last7.map((e, i) => (
        <circle
          key={e.id}
          cx={i * stepX}
          cy={height - (e.moodScore / max) * height}
          r="3"
          fill="hsl(var(--primary))"
        />
      ))}
    </svg>
  );
}

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

export default function ProgressPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const tr = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const { data: moodEntries = [], isLoading: moodLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: journalEntries = [], isLoading: journalLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
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

  const isLoading = moodLoading || journalLoading || appointmentsLoading;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{tr("progress.title", "Your Progress")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr("progress.subtitle", "Track your mental wellness journey over time.")}
          </p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
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
          </div>
        )}

        {/* Mood sparkline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {tr("progress.mood_trend", "Mood Trend (last 7 days)")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {moodLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <MoodSparkline entries={moodEntries} />
            )}
            <div className="mt-3">
              <Link href="/mood">
                <Button variant="ghost" size="sm">
                  {tr("progress.log_mood", "Log today's mood")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
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
