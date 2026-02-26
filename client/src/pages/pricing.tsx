import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Entitlement, Plan, Subscription } from "@shared/schema";

interface BillingEntitlementsResponse {
  subscription: Subscription | null;
  entitlement: Entitlement | null;
}

export default function PricingPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: billing } = useQuery<BillingEntitlementsResponse>({
    queryKey: ["/api/billing/entitlements"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planCode: string) => {
      await apiRequest("POST", "/api/billing/subscribe", { planCode, provider: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/entitlements"] });
      toast({ title: t("pricing.sub_updated") });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/billing/cancel", { immediate: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/entitlements"] });
      toast({ title: t("pricing.sub_cancelled") });
    },
  });

  const currentPlanCode = billing?.entitlement?.planCode || "free";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("pricing.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{t("pricing.current_plan")}: {currentPlanCode}</Badge>
              <Badge variant="outline">
                {t("pricing.peer_minutes")}: {billing?.entitlement?.peerMinutesRemaining ?? "--"}
              </Badge>
              {billing?.subscription?.cancelAtPeriodEnd && (
                <Badge variant="destructive">{t("pricing.cancels_period")}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">{t("pricing.loading")}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const current = plan.code === currentPlanCode;
              return (
                <Card key={plan.id} className={current ? "border-primary" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-bold">
                      {plan.monthlyPriceDinar.toFixed(1)} <span className="text-sm font-normal">{t("pricing.tnd_mo")}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {plan.peerMinutesLimit} {t("pricing.peer_minutes_mo")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {plan.therapistDiscountPct}{t("pricing.therapist_discount")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("pricing.priority_level")} {plan.priorityLevel}
                    </p>
                    <Button
                      className="w-full"
                      variant={current ? "outline" : "default"}
                      onClick={() => subscribeMutation.mutate(plan.code)}
                      disabled={subscribeMutation.isPending || current}
                    >
                      {current ? t("pricing.current_plan_btn") : t("pricing.choose_plan")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("pricing.manage_sub")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || !billing?.subscription}
            >
              {t("pricing.cancel_end")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

