import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { ListenerApplication, ListenerProfile } from "@shared/schema";

interface ListenerApplicationPayload {
  application: ListenerApplication | null;
  profile: ListenerProfile | null;
}

export default function ListenerApplyPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [displayAlias, setDisplayAlias] = useState("");
  const [timezone, setTimezone] = useState("Africa/Tunis");
  const [languages, setLanguages] = useState("ar, fr, darija");
  const [topics, setTopics] = useState("anxiety, stress");
  const [weeklyHours, setWeeklyHours] = useState("5");
  const [motivation, setMotivation] = useState("");
  const [relevantExperience, setRelevantExperience] = useState("");

  const { data, isLoading } = useQuery<ListenerApplicationPayload>({
    queryKey: ["/api/listener/application"],
  });

  useEffect(() => {
    if (!data?.profile) return;
    if (data.profile.displayAlias) setDisplayAlias(data.profile.displayAlias);
    if (data.profile.timezone) setTimezone(data.profile.timezone);
    if (data.profile.languages?.length) setLanguages(data.profile.languages.join(", "));
    if (data.profile.topics?.length) setTopics(data.profile.topics.join(", "));
  }, [data?.profile]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/listener/apply", {
        displayAlias: displayAlias || null,
        timezone: timezone || null,
        languages,
        topics,
        weeklyHours: Number(weeklyHours) || null,
        motivation,
        relevantExperience,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      toast({ title: t("listener.submitted") });
    },
    onError: () => {
      toast({ title: t("listener.submit_error"), variant: "destructive" });
    },
  });

  const status = data?.application?.status || data?.profile?.verificationStatus || "not_submitted";
  const activationStatus = data?.profile?.activationStatus || "inactive";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("listener.become_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{t("listener.review_status")}: {status}</Badge>
              <Badge variant="outline">{t("listener.activation")}: {activationStatus}</Badge>
            </div>
            {status === "approved" && (
              <div className="text-sm text-muted-foreground">
                {t("listener.approved_msg")}
                <div className="mt-2">
                  <Link href="/listener/dashboard">
                    <Button size="sm" variant="outline">{t("listener.go_dashboard")}</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("listener.apply_form")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("listener.loading")}</p>
            ) : (
              <>
                <Input
                  value={displayAlias}
                  onChange={(e) => setDisplayAlias(e.target.value)}
                  placeholder={t("listener.alias_placeholder")}
                />
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder={t("listener.timezone_placeholder")}
                />
                <Input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder={t("listener.languages_placeholder")}
                />
                <Input
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder={t("listener.topics_placeholder")}
                />
                <Input
                  type="number"
                  min={1}
                  max={40}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(e.target.value)}
                  placeholder={t("listener.hours_placeholder")}
                />
                <Textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={4}
                  placeholder={t("listener.motivation_placeholder")}
                />
                <Textarea
                  value={relevantExperience}
                  onChange={(e) => setRelevantExperience(e.target.value)}
                  rows={4}
                  placeholder={t("listener.experience_placeholder")}
                />
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  data-testid="button-listener-apply"
                >
                  {t("listener.submit")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

