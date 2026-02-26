import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Heart,
  Phone,
  Shield,
  Wind,
} from "lucide-react";

const groundingSteps = ["see", "touch", "hear", "smell", "taste"] as const;

const breathingPhases = [
  { key: "inhale", seconds: 4 },
  { key: "hold", seconds: 7 },
  { key: "exhale", seconds: 8 },
] as const;

export default function CrisisPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [groundingDone, setGroundingDone] = useState<number[]>([]);
  const [breathingIndex, setBreathingIndex] = useState(0);

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

  const currentBreathingPhase = breathingPhases[breathingIndex];
  const groundingProgress = Math.round((groundingDone.length / groundingSteps.length) * 100);

  const toggleGroundingStep = (index: number) => {
    setGroundingDone((prev) =>
      prev.includes(index)
        ? prev.filter((item) => item !== index)
        : [...prev, index],
    );
  };

  const advanceBreathing = () => {
    setBreathingIndex((prev) => (prev + 1) % breathingPhases.length);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--color-safe)/0.22),transparent_45%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
        <div className="text-center space-y-3 py-2">
          <div className="w-14 h-14 rounded-full safe-surface flex items-center justify-center mx-auto">
            <Shield className="h-7 w-7 text-safe" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-crisis-title">
              {t("crisis.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("crisis.subtitle")}</p>
          </div>
          <Badge variant="secondary" className="safe-muted text-safe border-transparent">
            {tr("crisis.stay_present", "Take one small step at a time")}
          </Badge>
        </div>

        <Card className="safe-surface" data-testid="section-emergency-numbers">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {t("crisis.emergency_numbers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <a
              href="tel:190"
              className="rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground transition-colors p-3"
              data-testid="link-call-samu"
            >
              <p className="font-semibold text-sm">{t("crisis.samu_label")}</p>
              <p className="text-xs opacity-90">{t("crisis.samu_desc")}</p>
              <div className="mt-2 text-xs flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {tr("crisis.call_now", "Call now")}
              </div>
            </a>
            <a
              href="tel:197"
              className="rounded-lg border border-blue-300/50 bg-blue-500/10 hover:bg-blue-500/20 transition-colors p-3"
              data-testid="link-call-police"
            >
              <p className="font-semibold text-sm">{t("crisis.police_label")}</p>
              <p className="text-xs text-muted-foreground">{t("crisis.police_desc")}</p>
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {tr("crisis.call_now", "Call now")}
              </div>
            </a>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card data-testid="section-grounding" className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="h-4 w-4 text-primary" />
                {t("crisis.grounding_title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("crisis.grounding_intro")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
                <div className="h-full gradient-safe" style={{ width: `${groundingProgress}%` }} />
              </div>
              <div className="space-y-2">
                {groundingSteps.map((sense, index) => {
                  const isDone = groundingDone.includes(index);
                  return (
                    <button
                      key={sense}
                      type="button"
                      onClick={() => toggleGroundingStep(index)}
                      className={`w-full rounded-lg border p-2.5 flex items-center gap-2 text-start transition-colors ${
                        isDone ? "bg-primary/10 border-primary/30" : "hover:bg-muted/40"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isDone ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {index + 1}
                      </span>
                      <span className="text-sm flex-1">{t(`crisis.${sense}`)}</span>
                      {isDone && <CheckCircle className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="section-breathing" className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                {t("crisis.breathing_title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t("crisis.breathing_instruction")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="w-36 h-36 rounded-full safe-surface flex flex-col items-center justify-center text-center px-4 animate-pulse-soft">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`selfcare.${currentBreathingPhase.key}`)}</p>
                  <p className="text-2xl font-semibold">{currentBreathingPhase.seconds}s</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {breathingPhases.map((phase, index) => (
                  <div
                    key={phase.key}
                    className={`rounded-md px-2 py-1.5 ${
                      index === breathingIndex ? "safe-muted text-safe" : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <p>{t(`selfcare.${phase.key}`)}</p>
                    <p>{phase.seconds}s</p>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={advanceBreathing}>
                {tr("crisis.next_breath", "Next breath step")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
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
