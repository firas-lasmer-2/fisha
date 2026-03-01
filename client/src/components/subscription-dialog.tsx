import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Loader2, PackageCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SubscriptionPlan } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { FeatureHint } from "@/components/feature-hint";

interface SubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a therapist for locked subscriptions (optional) */
  therapistId?: string;
  onPurchased?: () => void;
}

export function SubscriptionDialog({
  open,
  onClose,
  therapistId,
  onPurchased,
}: SubscriptionDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"flouci" | "konnect">("flouci");

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
    enabled: open,
  });

  const purchaseMutation = useMutation({
    mutationFn: (body: { planId: number; paymentMethod: "flouci" | "konnect"; therapistId?: string }) =>
      apiRequest("POST", "/api/subscriptions", body).then((r) => r.json() as Promise<{ paymentUrl: string | null }>),
    onSuccess: (data: { paymentUrl: string | null }) => {
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast({ title: "Subscription initiated", description: "Complete payment to activate." });
        onPurchased?.();
        onClose();
      }
    },
    onError: () => {
      toast({ title: "Purchase failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handlePurchase = () => {
    if (!selectedPlanId) return;
    purchaseMutation.mutate({ planId: selectedPlanId, paymentMethod, therapistId });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FeatureHint id="subscription-plan" content={t("hint.subscription_plan")} side="right">
              <PackageCheck className="h-5 w-5 text-primary" />
            </FeatureHint>
            Choose a subscription plan
          </DialogTitle>
          <DialogDescription>
            Buy a bundle of sessions at a reduced rate. Credits never expire before the plan period ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan selection */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : (
            <RadioGroup
              value={selectedPlanId?.toString() ?? ""}
              onValueChange={(v) => setSelectedPlanId(Number(v))}
              className="space-y-2"
            >
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedPlanId === plan.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/40"
                  }`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={plan.id.toString()} id={`plan-${plan.id}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label htmlFor={`plan-${plan.id}`} className="font-semibold cursor-pointer">
                          {plan.nameAr ?? plan.name}
                        </Label>
                        {plan.tierRestriction === "premium_doctor" && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Premium only
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.sessionsIncluded} sessions · {plan.durationDays} days validity
                      </p>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg">{plan.priceDinar} د.ت</p>
                      <p className="text-xs text-muted-foreground">
                        ≈ {(plan.priceDinar / plan.sessionsIncluded).toFixed(0)} د.ت/session
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}

          {selectedPlanId && (
            <>
              <Separator />
              {/* Payment method */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment method</p>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as "flouci" | "konnect")}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                    <RadioGroupItem value="flouci" id="sub-flouci" />
                    <Label htmlFor="sub-flouci" className="cursor-pointer">
                      <p className="font-medium text-sm">Flouci</p>
                      <p className="text-[10px] text-muted-foreground">Card, wallet</p>
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                    <RadioGroupItem value="konnect" id="sub-konnect" />
                    <Label htmlFor="sub-konnect" className="cursor-pointer">
                      <p className="font-medium text-sm">Konnect</p>
                      <p className="text-[10px] text-muted-foreground">D17, bank</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={purchaseMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              className="flex-1"
              disabled={!selectedPlanId || purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy plan
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
