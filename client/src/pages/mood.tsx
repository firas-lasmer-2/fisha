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
import { Smile, TrendingUp, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import type { MoodEntry } from "@shared/schema";

const moodOptions = [
  { score: 1, emoji: "😢", color: "bg-red-100 dark:bg-red-900/30 border-red-300" },
  { score: 2, emoji: "😔", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300" },
  { score: 3, emoji: "😐", color: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300" },
  { score: 4, emoji: "🙂", color: "bg-green-100 dark:bg-green-900/30 border-green-300" },
  { score: 5, emoji: "😊", color: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300" },
];

export default function MoodPage() {
  const { t, isRTL } = useI18n();
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
      return { filled: !!entry, score: entry?.moodScore ?? null };
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-mood-title">{t("nav.mood")}</h1>

        <Card data-testid="card-mood-checkin">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5 text-chart-3" />
              {t("mood.how_feeling")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center gap-3 sm:gap-5">
              {moodOptions.map((opt) => (
                <button
                  key={opt.score}
                  onClick={() => setSelectedMood(opt.score)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    selectedMood === opt.score
                      ? `${opt.color} scale-110`
                      : "border-transparent hover:border-border"
                  }`}
                  data-testid={`button-mood-${opt.score}`}
                >
                  <span className="text-3xl sm:text-4xl">{opt.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{moodLabels[opt.score - 1]}</span>
                </button>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{t("mood.emotions")}</p>
              <div className="flex flex-wrap gap-2">
                {emotionTags.map((emotion) => (
                  <Badge
                    key={emotion}
                    variant={selectedEmotions.includes(emotion) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleEmotion(emotion)}
                    data-testid={`badge-emotion-${emotion}`}
                  >
                    {emotion}
                  </Badge>
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

        <Card data-testid="card-mood-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {t("mood.history")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries && entries.length > 0 && (
              <div className="flex items-center gap-1.5 mb-4">
                {sevenDayDots.map((dot, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-3 rounded-full ${dot.filled ? "gradient-calm" : "bg-muted"}`}
                    title={dot.filled ? `Mood: ${dot.score}` : "No entry"}
                  />
                ))}
              </div>
            )}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : entries && entries.length > 0 ? (
              <div className="space-y-2">
                {entries.slice(0, 14).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    data-testid={`mood-entry-${entry.id}`}
                  >
                    <span className="text-2xl">{moodOptions.find((m) => m.score === entry.moodScore)?.emoji || "😐"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt!).toLocaleDateString()} {new Date(entry.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {entry.notes && <p className="text-sm truncate mt-0.5">{entry.notes}</p>}
                      {entry.emotions && entry.emotions.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {entry.emotions.map((e) => (
                            <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Smile className="h-10 w-10 mx-auto mb-2 opacity-30" />
                {t("mood.no_entries")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
