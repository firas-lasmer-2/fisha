import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { LocalizationAudit, LocalizationAuditStatus, SupportedEndUserLanguage } from "@shared/schema";
import { Globe2, Languages, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AuditResponse = {
  audits: LocalizationAudit[];
};

type AuditDraft = {
  status: LocalizationAuditStatus;
  notes: string;
};

const auditedRoutes = ["/", "/support", "/workflow", "/welcome", "/therapists", "/peer-support", "/self-care"];
const auditedLanguages: SupportedEndUserLanguage[] = ["ar", "fr"];

export function LocalizationAuditPanel() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [routeFilter, setRouteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AuditDraft>>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (routeFilter) params.set("route", routeFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `/api/admin/localization-audits?${qs}` : "/api/admin/localization-audits";
  }, [routeFilter, statusFilter]);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/localization-audits", routeFilter, statusFilter],
    queryFn: async () => {
      const response = await apiRequest("GET", queryString);
      return response.json();
    },
  });

  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/localization-audits/run", {
        routes: auditedRoutes,
        languages: auditedLanguages,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/localization-audits"] });
      toast({ title: t("admin.localization.saved") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: AuditDraft }) => {
      const response = await apiRequest("PATCH", `/api/admin/localization-audits/${id}`, draft);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/localization-audits"] });
      toast({ title: t("admin.localization.saved") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const draftForAudit = (audit: LocalizationAudit): AuditDraft => (
    drafts[audit.id] || {
      status: audit.status,
      notes: audit.notes || "",
    }
  );

  const updateDraft = (audit: LocalizationAudit, next: Partial<AuditDraft>) => {
    setDrafts((current) => ({
      ...current,
      [audit.id]: {
        ...draftForAudit(audit),
        ...next,
      },
    }));
  };

  const audits = data?.audits || [];
  const groupedCounts = audits.reduce<Record<LocalizationAuditStatus, number>>((acc, audit) => {
    acc[audit.status] += 1;
    return acc;
  }, { pending: 0, in_review: 0, approved: 0, blocked: 0 });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              {t("admin.localization.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            {(["pending", "in_review", "approved", "blocked"] as LocalizationAuditStatus[]).map((key) => (
              <div key={key} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`admin.localization.status.${key}`)}</p>
                <p className="mt-1 text-2xl font-bold">{groupedCounts[key]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              {t("admin.localization.run_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t("admin.localization.run_body")}</p>
            <Button onClick={() => runAuditMutation.mutate()} disabled={runAuditMutation.isPending} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("admin.localization.run_cta")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.localization.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} placeholder={t("admin.localization.route_placeholder")} />
          <Input value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} placeholder={t("admin.localization.status_placeholder")} />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        audits.map((audit) => {
          const draft = draftForAudit(audit);
          return (
            <Card key={audit.id}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{audit.routePath}</p>
                      <Badge variant="outline">{audit.language}</Badge>
                      <Badge>{t(`admin.localization.status.${draft.status}`)}</Badge>
                    </div>
                    <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                      <span>{t("admin.localization.count.untranslated")}: {audit.untranslatedCount}</span>
                      <span>{t("admin.localization.count.mixed")}: {audit.mixedCopyCount}</span>
                      <span>{t("admin.localization.count.fallback")}: {audit.fallbackCopyCount}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[200px_1fr]">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("admin.localization.change_status")}</span>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={draft.status}
                      onChange={(event) => updateDraft(audit, { status: event.target.value as LocalizationAuditStatus })}
                    >
                      <option value="pending">{t("admin.localization.status.pending")}</option>
                      <option value="in_review">{t("admin.localization.status.in_review")}</option>
                      <option value="approved">{t("admin.localization.status.approved")}</option>
                      <option value="blocked">{t("admin.localization.status.blocked")}</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm block">
                    <span className="text-muted-foreground">{t("admin.localization.notes_label")}</span>
                    <Textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(event) => updateDraft(audit, { notes: event.target.value })}
                      placeholder={t("admin.localization.notes_placeholder")}
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: audit.id, draft })}
                    disabled={updateMutation.isPending}
                  >
                    {t("common.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
