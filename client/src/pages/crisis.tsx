import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useEffect } from "react";
import {
  Phone, Heart, Shield, Wind, ArrowLeft, CheckCircle, AlertTriangle,
} from "lucide-react";

export default function CrisisPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const reportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/crisis/report", { severity: "high" });
    },
  });

  const safeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/crisis/safe", {});
    },
    onSuccess: () => {
      toast({ title: t("crisis.safe_confirmed") });
      window.location.href = "/dashboard";
    },
  });

  useEffect(() => {
    if (!user || reportMutation.isSuccess || reportMutation.isPending) return;
    reportMutation.mutate();
  }, [reportMutation, user]);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col justify-center space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-crisis-title">
            {t("crisis.title")}
          </h1>
          <p className="text-muted-foreground">{t("crisis.subtitle")}</p>
        </div>

        {/* Emergency Numbers */}
        <Card className="border-red-200 dark:border-red-800" data-testid="section-emergency-numbers">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-red-600" />
              {t("crisis.emergency_numbers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="tel:190"
              className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              data-testid="link-call-samu"
            >
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">SAMU - 190</p>
                <p className="text-xs text-muted-foreground">{t("crisis.samu_desc")}</p>
              </div>
              <Phone className="h-5 w-5 text-red-600" />
            </a>
            <a
              href="tel:197"
              className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              data-testid="link-call-police"
            >
              <div>
                <p className="font-semibold text-blue-700 dark:text-blue-400">Police - 197</p>
                <p className="text-xs text-muted-foreground">{t("crisis.police_desc")}</p>
              </div>
              <Phone className="h-5 w-5 text-blue-600" />
            </a>
          </CardContent>
        </Card>

        {/* Grounding Exercise */}
        <Card data-testid="section-grounding">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wind className="h-4 w-4 text-primary" />
              {t("crisis.grounding_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("crisis.grounding_intro")}</p>
              <div className="space-y-2">
                {[
                  { num: 5, sense: t("crisis.see") },
                  { num: 4, sense: t("crisis.touch") },
                  { num: 3, sense: t("crisis.hear") },
                  { num: 2, sense: t("crisis.smell") },
                  { num: 1, sense: t("crisis.taste") },
                ].map(({ num, sense }) => (
                  <div key={num} className="flex items-center gap-3 text-sm">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {num}
                    </span>
                    <span>{sense}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breathing Exercise */}
        <Card data-testid="section-breathing">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              {t("crisis.breathing_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="breathing-circle w-32 h-32 rounded-full gradient-calm flex items-center justify-center">
                <span className="text-white text-sm font-medium">{t("crisis.breathe")}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("crisis.breathing_instruction")}
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="lg"
            onClick={() => safeMutation.mutate()}
            disabled={safeMutation.isPending}
            data-testid="button-im-safe"
          >
            <CheckCircle className="h-5 w-5 me-2" />
            {t("crisis.im_safe")}
          </Button>

          <Link href="/dashboard">
            <Button variant="outline" className="w-full" size="lg" data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4 me-2" />
              {t("crisis.back_to_app")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
