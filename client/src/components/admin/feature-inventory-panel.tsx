import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FeatureInventoryItem, FeatureStatus } from "@shared/schema";
import { BarChart3, Compass, Route, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";

type FeatureInventoryResponse = {
  items: FeatureInventoryItem[];
  totals: Record<FeatureStatus, number>;
};

type FeatureDraft = {
  status: FeatureStatus;
  reviewNotes: string;
  replacementRoute: string;
};

const reviewCriteriaKeys = [
  "admin.feature_inventory.criteria_value",
  "admin.feature_inventory.criteria_audience",
  "admin.feature_inventory.criteria_duplication",
  "admin.feature_inventory.criteria_language",
];

export function FeatureInventoryPanel() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [surface, setSurface] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [drafts, setDrafts] = useState<Record<string, FeatureDraft>>({});

  const translate = (key: string | null | undefined) => {
    if (!key) return "";
    const value = t(key);
    return value === key ? key : value;
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (surface) params.set("surface", surface);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/api/admin/feature-inventory?${qs}` : "/api/admin/feature-inventory";
  }, [role, status, surface]);

  const { data, isLoading } = useQuery<FeatureInventoryResponse>({
    queryKey: ["/api/admin/feature-inventory", surface, role, status],
    queryFn: async () => {
      const response = await apiRequest("GET", queryString);
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: FeatureDraft }) => {
      const response = await apiRequest("PATCH", `/api/admin/feature-inventory/${id}`, draft);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-inventory"] });
      toast({ title: t("admin.feature_inventory.saved") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const items = data?.items || [];
  const totals = data?.totals || { primary: 0, secondary: 0, experimental: 0, retired: 0 };

  const draftForItem = (item: FeatureInventoryItem): FeatureDraft => (
    drafts[item.id] || {
      status: item.status,
      reviewNotes: item.reviewNotes || "",
      replacementRoute: item.replacementRoute || "",
    }
  );

  const updateDraft = (item: FeatureInventoryItem, next: Partial<FeatureDraft>) => {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        ...draftForItem(item),
        ...next,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("admin.feature_inventory.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            {(["primary", "secondary", "experimental", "retired"] as FeatureStatus[]).map((key) => (
              <div key={key} className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t(`admin.feature_inventory.status.${key}`)}
                </p>
                <p className="mt-1 text-2xl font-bold">{totals[key] || 0}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("admin.feature_inventory.criteria_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {reviewCriteriaKeys.map((key) => (
              <div key={key} className="rounded-xl border bg-muted/20 p-3">
                {t(key)}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.feature_inventory.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={surface} onChange={(event) => setSurface(event.target.value)} placeholder={t("admin.feature_inventory.surface_placeholder")} />
          <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder={t("admin.feature_inventory.role_placeholder")} />
          <Input value={status} onChange={(event) => setStatus(event.target.value)} placeholder={t("admin.feature_inventory.status_placeholder")} />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        items.map((item) => {
          const draft = draftForItem(item);
          return (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{translate(item.labelKey)}</p>
                      <Badge variant="secondary">{item.surface}</Badge>
                      {item.roleScope.map((scope) => (
                        <Badge key={scope} variant="outline">{scope}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{translate(item.summaryKey)}</p>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Compass className="h-3.5 w-3.5" />
                        {item.routePath}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Route className="h-3.5 w-3.5" />
                        {item.destinationPath || item.replacementRoute || "—"}
                      </span>
                    </div>
                  </div>
                  <Badge>{t(`admin.feature_inventory.status.${draft.status}`)}</Badge>
                </div>

                <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("admin.feature_inventory.change_status")}</span>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={draft.status}
                      onChange={(event) => updateDraft(item, { status: event.target.value as FeatureStatus })}
                    >
                      <option value="primary">{t("admin.feature_inventory.status.primary")}</option>
                      <option value="secondary">{t("admin.feature_inventory.status.secondary")}</option>
                      <option value="experimental">{t("admin.feature_inventory.status.experimental")}</option>
                      <option value="retired">{t("admin.feature_inventory.status.retired")}</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("admin.feature_inventory.replacement_label")}</span>
                    <Input
                      value={draft.replacementRoute}
                      onChange={(event) => updateDraft(item, { replacementRoute: event.target.value })}
                      placeholder={t("admin.feature_inventory.replacement_placeholder")}
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm block">
                  <span className="text-muted-foreground">{t("admin.feature_inventory.notes_label")}</span>
                  <Textarea
                    rows={3}
                    value={draft.reviewNotes}
                    onChange={(event) => updateDraft(item, { reviewNotes: event.target.value })}
                    placeholder={t("admin.feature_inventory.notes_placeholder")}
                  />
                </label>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: item.id, draft })}
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
