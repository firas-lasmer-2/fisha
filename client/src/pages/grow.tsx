import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import type { MoodEntry, OnboardingResponse, JournalEntry } from "@shared/schema";
import { Brain, HandHeart, Sparkles, Wind } from "lucide-react";
import { Link } from "wouter";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";

const paths = [
  { key: "anxiety", titleKey: "growth.anxiety_path", icon: Brain, steps: 7, href: "/self-care" },
  { key: "self_esteem", titleKey: "growth.self_esteem_path", icon: Sparkles, steps: 6, href: "/journal" },
  { key: "stress", titleKey: "growth.stress_path", icon: Wind, steps: 5, href: "/self-care" },
  { key: "relationships", titleKey: "growth.relationships_path", icon: HandHeart, steps: 8, href: "/therapists?specialization=relationships" },
] as const;

export default function GrowPage() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const { data: moods = [] } = useQuery<MoodEntry[]>({
    queryKey: ["/api/mood"],
  });

  const { data: journalEntries = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const { data: onboarding, isLoading } = useQuery<OnboardingResponse | null>({
    queryKey: ["/api/onboarding"],
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <PageSkeleton variant="grid" count={4} />
        </div>
      </AppLayout>
    );
  }

  const primaryConcerns = onboarding?.primaryConcerns || [];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          title={tr("grow.page_title", "Growth Paths")}
          subtitle={t("growth.subtitle")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {paths.map((path) => {
            const isRecommended = primaryConcerns.includes(path.key);
            const moodUnits = Math.min(path.steps, moods.length);
            const journalUnits = Math.min(path.steps, journalEntries.length);
            const rawCompleted =
              path.key === "anxiety" || path.key === "stress"
                ? Math.floor(moodUnits / 2) + (isRecommended ? 1 : 0)
                : Math.floor(journalUnits / 2) + (isRecommended ? 1 : 0);
            const completed = Math.max(1, Math.min(path.steps, rawCompleted));
            const progress = Math.round((completed / path.steps) * 100);
            const Icon = path.icon;

            return (
              <Card key={path.key} className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {t(path.titleKey)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isRecommended && (
                      <Badge variant="secondary">{tr("grow.recommended", "Recommended")}</Badge>
                    )}
                    <Badge variant="outline">{completed}/{path.steps}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {tr("grow.progress_hint", "Small daily steps build lasting progress.")}
                  </p>
                  <Link href={path.href}>
                    <Button size="sm" className="w-full">
                      {tr("grow.continue", "Continue path")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
