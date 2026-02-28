import { useI18n } from "@/lib/i18n";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookOpen, Plus, Trash2, Pencil, Calendar, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import type { JournalEntry } from "@shared/schema";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { FeatureHint } from "@/components/feature-hint";

export default function JournalPage() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const { data: entries, isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/journal", { title, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setTitle("");
      setContent("");
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/journal/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingEntry) return;
      const res = await apiRequest("PATCH", `/api/journal/${editingEntry.id}`, { title, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setTitle("");
      setContent("");
      setEditingEntry(null);
      setDialogOpen(false);
    },
  });

  const prompts = [
    t("journal.prompt_1"),
    t("journal.prompt_2"),
    t("journal.prompt_3"),
    t("journal.prompt_4"),
    t("journal.prompt_5"),
  ];

  const FALLBACK_PROMPTS = [
    "What made you feel safe today?",
    "Describe one thing you're grateful for right now.",
    "What emotion are you carrying, and where do you feel it in your body?",
    "What would you tell a friend going through what you're facing?",
    "What's one small thing that brought you comfort this week?",
  ];

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayPrompt = prompts[dayOfYear % prompts.length] || FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader
          title={t("nav.journal")}
          testId="text-journal-title"
          action={
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingEntry(null); setTitle(""); setContent(""); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-new-journal">
                <Plus className="h-4 w-4" />
                {t("journal.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit entry" : t("journal.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t("common.prompts")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prompts.map((prompt, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => { setTitle(prompt); setContent(""); }}
                      >
                        {prompt.slice(0, 30)}...
                      </Button>
                    ))}
                  </div>
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("journal.title")}
                  data-testid="input-journal-title"
                />
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("journal.write")}
                  rows={8}
                  data-testid="textarea-journal-content"
                />
                <Button
                  onClick={() => editingEntry ? editMutation.mutate() : createMutation.mutate()}
                  disabled={!content.trim() || createMutation.isPending || editMutation.isPending}
                  className="w-full"
                  data-testid="button-save-journal"
                >
                  {(createMutation.isPending || editMutation.isPending) && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {editingEntry ? "Save changes" : t("journal.save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          }
        />

        {/* Today's prompt — inline, visible without clicking */}
        <FeatureHint id="journal-prompt" content={t("hint.journal_prompt")} side="bottom" delayMs={1500}>
          <button
            type="button"
            className="w-full text-start safe-surface rounded-xl p-4 space-y-1 hover:opacity-90 transition-opacity"
            onClick={() => { setTitle(todayPrompt); setDialogOpen(true); }}
            data-testid="card-daily-prompt"
          >
            <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Today's prompt
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{todayPrompt}</p>
            <p className="text-xs text-primary/70 mt-1">Tap to start writing →</p>
          </button>
        </FeatureHint>

        {isLoading ? (
          <PageSkeleton variant="list" count={3} />
        ) : entries && entries.length > 0 ? (
          <div className="space-y-4">
            {entries.map((entry) => (
              <Card key={entry.id} className="hover-elevate" data-testid={`journal-entry-${entry.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {entry.title && (
                        <h3 className="font-semibold mb-1">{entry.title}</h3>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {entry.content}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(entry.createdAt!).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingEntry(entry);
                          setTitle(entry.title || "");
                          setContent(entry.content);
                          setDialogOpen(true);
                        }}
                        data-testid={`button-edit-journal-${entry.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        data-testid={`button-delete-journal-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={t("journal.no_entries")}
            description={t("journal.start_writing")}
          />
        )}
      </div>
    </AppLayout>
  );
}
