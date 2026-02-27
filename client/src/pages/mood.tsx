import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Smile, TrendingUp, Loader2, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MoodEntry } from "@shared/schema";

const moodOptions = [
  { score: 1, emoji: "😢", label: "Awful", color: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700" },
  { score: 2, emoji: "😔", label: "Bad", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700" },
  { score: 3, emoji: "😐", label: "Okay", color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
  { score: 4, emoji: "🙂", label: "Good", color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" },
  { score: 5, emoji: "😊", label: "Great", color: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.3, ease: "easeOut" } }),
};

export default function MoodPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

  const { data: entries, isLoading } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const sevenDayDots = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - i));
      const dateStr = day.toDateString();
      const entry = (entries || []).find(
        (m) => m.createdAt && new Date(m.createdAt).toDateString() === dateStr,
      );
      return { filled: !!entry, score: entry?.moodScore ?? null, day: day.toLocaleDateString([], { weekday: "short" }) };
    });
  }, [entries]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mood", {
        moodScore: selectedMood,
        notes: notes || undefined,
        emotions: selectedEmotions.length > 0 ? selectedEmotions : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mood"] });
      setSelectedMood(null);
      setNotes("");
      setSelectedEmotions([]);
    },
  });

  const emotionTags = isRTL
    ? ["سعيد", "حزين", "قلق", "غاضب", "متفائل", "متوتر", "هادئ", "وحيد", "ممتن", "خائف"]
    : ["Happy", "Sad", "Anxious", "Angry", "Hopeful", "Stressed", "Calm", "Lonely", "Grateful", "Fearful"];

  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  };

  const moodLabels = [
    t("mood.awful"), t("mood.bad"), t("mood.okay"), t("mood.good"), t("mood.great"),
  ];

  const todayLogged = entries?.some(
    (e) => e.createdAt && new Date(e.createdAt).toDateString() === new Date().toDateString(),
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Page hero */}
        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-5 sm:p-6 flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl gradient-calm flex items-center justify-center shrink-0">
              <Smile className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("nav.mood")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {todayLogged
                  ? "You've already checked in today. Add another if your mood changed."
                  : user?.firstName
                    ? `How are you feeling today, ${user.firstName}?`
                    : "Track your mood daily to spot patterns and measure your progress."}
              </p>
              {/* 7-day streak dots */}
              {entries && entries.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3">
                  {sevenDayDots.map((dot, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className={`h-2.5 w-6 rounded-full transition-all ${
                          dot.filled
                            ? dot.score && dot.score >= 4
                              ? "bg-emerald-500"
                              : dot.score && dot.score === 3
                                ? "bg-yellow-400"
                                : "bg-red-400"
                            : "bg-muted"
                        }`}
                      />
                      <span className="text-[9px] text-muted-foreground">{dot.day}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Mood check-in card */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={fadeUp}>
          <Card data-testid="card-mood-checkin">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("mood.how_feeling")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center gap-2 sm:gap-4">
                {moodOptions.map((opt, idx) => (
                  <motion.button
                    key={opt.score}
                    onClick={() => setSelectedMood(opt.score)}
                    whileHover={{ scale: 1.08, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    animate={selectedMood === opt.score ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      selectedMood === opt.score
                        ? opt.color
                        : "border-transparent hover:border-border/60"
                    }`}
                    data-testid={`button-mood-${opt.score}`}
                  >
                    <span className="text-3xl sm:text-4xl select-none">{opt.emoji}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {moodLabels[opt.score - 1] !== `mood.${["awful","bad","okay","good","great"][opt.score-1]}` ? moodLabels[opt.score - 1] : opt.label}
                    </span>
                  </motion.button>
                ))}
              </div>

              <AnimatePresence>
                {selectedMood && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div>
                      <p className="text-sm font-medium mb-2">{t("mood.emotions")}</p>
                      <div className="flex flex-wrap gap-2">
                        {emotionTags.map((emotion) => (
                          <motion.div key={emotion} whileTap={{ scale: 0.95 }}>
                            <Badge
                              variant={selectedEmotions.includes(emotion) ? "default" : "outline"}
                              className="cursor-pointer select-none transition-colors"
                              onClick={() => toggleEmotion(emotion)}
                              data-testid={`badge-emotion-${emotion}`}
                            >
                              {emotion}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("mood.notes")}
                      rows={3}
                      data-testid="textarea-mood-notes"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!selectedMood || saveMutation.isPending}
                className="w-full"
                data-testid="button-save-mood"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("mood.save")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* History */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={fadeUp}>
          <Card data-testid="card-mood-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                {t("mood.history")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : entries && entries.length > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {entries.slice(0, 14).map((entry, idx) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        data-testid={`mood-entry-${entry.id}`}
                      >
                        <span className="text-2xl select-none">
                          {moodOptions.find((m) => m.score === entry.moodScore)?.emoji || "😐"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt!).toLocaleDateString()} {new Date(entry.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {entry.notes && <p className="text-sm truncate mt-0.5">{entry.notes}</p>}
                          {entry.emotions && entry.emotions.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {entry.emotions.map((e) => (
                                <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Smile className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No entries yet</p>
                  <p className="text-xs mt-1">{t("mood.no_entries")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </AppLayout>
  );
}
