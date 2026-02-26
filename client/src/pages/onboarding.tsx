import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

const CONCERNS = [
  "anxiety", "depression", "stress", "relationships", "trauma",
  "self_esteem", "grief", "family", "couples", "addiction",
];

export default function OnboardingPage() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [genderPreference, setGenderPreference] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [howDidYouHear, setHowDidYouHear] = useState("");

  const ArrowNext = isRTL ? ArrowLeft : ArrowRight;
  const ArrowBack = isRTL ? ArrowRight : ArrowLeft;

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding", {
        primaryConcerns: concerns,
        preferredLanguage,
        genderPreference,
        budgetRange,
        howDidYouHear,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/dashboard";
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern]
    );
  };

  const steps = [
    // Step 0: Concerns
    <div key="concerns" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("onboarding.concerns_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("onboarding.concerns_desc")}</p>
      <div className="flex flex-wrap gap-2">
        {CONCERNS.map((c) => (
          <Badge
            key={c}
            variant={concerns.includes(c) ? "default" : "secondary"}
            className="cursor-pointer text-sm py-1.5 px-3"
            onClick={() => toggleConcern(c)}
            data-testid={`badge-concern-${c}`}
          >
            {t(`specialization.${c}`)}
          </Badge>
        ))}
      </div>
    </div>,
    // Step 1: Language
    <div key="language" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("onboarding.language_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("onboarding.language_desc")}</p>
      <RadioGroup value={preferredLanguage} onValueChange={setPreferredLanguage} className="space-y-2">
        {[
          { value: "ar", label: "العربية" },
          { value: "fr", label: "Français" },
          { value: "darija", label: "تونسي (Darija)" },
        ].map((lang) => (
          <Label
            key={lang.value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
              preferredLanguage === lang.value ? "border-primary bg-primary/5" : ""
            }`}
          >
            <RadioGroupItem value={lang.value} />
            <span>{lang.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </div>,
    // Step 2: Gender preference
    <div key="gender" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("onboarding.gender_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("onboarding.gender_desc")}</p>
      <RadioGroup value={genderPreference} onValueChange={setGenderPreference} className="space-y-2">
        {[
          { value: "female", label: t("common.female") },
          { value: "male", label: t("common.male") },
          { value: "any", label: t("onboarding.no_preference") },
        ].map((g) => (
          <Label
            key={g.value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
              genderPreference === g.value ? "border-primary bg-primary/5" : ""
            }`}
          >
            <RadioGroupItem value={g.value} />
            <span>{g.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </div>,
    // Step 3: Budget
    <div key="budget" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("onboarding.budget_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("onboarding.budget_desc")}</p>
      <RadioGroup value={budgetRange} onValueChange={setBudgetRange} className="space-y-2">
        {[
          { value: "50-80", label: `50-80 ${t("common.dinar")}` },
          { value: "80-120", label: `80-120 ${t("common.dinar")}` },
          { value: "120-200", label: `120-200 ${t("common.dinar")}` },
          { value: "200+", label: `200+ ${t("common.dinar")}` },
        ].map((b) => (
          <Label
            key={b.value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
              budgetRange === b.value ? "border-primary bg-primary/5" : ""
            }`}
          >
            <RadioGroupItem value={b.value} />
            <span>{b.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </div>,
    // Step 4: Discovery channel
    <div key="discover" className="space-y-4">
      <h2 className="text-lg font-semibold">{t("onboarding.discovery_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("onboarding.discovery_desc")}</p>
      <RadioGroup value={howDidYouHear} onValueChange={setHowDidYouHear} className="space-y-2">
        {[
          { value: "friend", label: t("onboarding.discovery_friend") },
          { value: "social", label: t("onboarding.discovery_social") },
          { value: "search", label: t("onboarding.discovery_search") },
          { value: "therapist", label: t("onboarding.discovery_therapist") },
          { value: "other", label: t("onboarding.discovery_other") },
        ].map((item) => (
          <Label
            key={item.value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
              howDidYouHear === item.value ? "border-primary bg-primary/5" : ""
            }`}
          >
            <RadioGroupItem value={item.value} />
            <span>{item.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </div>,
  ];

  const canContinue = () => {
    switch (step) {
      case 0: return concerns.length > 0;
      case 1: return !!preferredLanguage;
      case 2: return !!genderPreference;
      case 3: return !!budgetRange;
      case 4: return !!howDidYouHear;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center mx-auto">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <CardTitle>{t("onboarding.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
          {/* Progress indicator */}
          <div className="flex justify-center gap-1.5 pt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {steps[step]}

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ArrowBack className="h-4 w-4 me-1" />
                {t("common.back")}
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canContinue()}
                className="flex-1"
                data-testid="button-onboarding-next"
              >
                {t("common.next")}
                <ArrowNext className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!canContinue() || submitMutation.isPending}
                className="flex-1"
                data-testid="button-onboarding-complete"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 me-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 me-1" />
                )}
                {t("onboarding.complete")}
              </Button>
            )}
          </div>

          <button
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/onboarding", {
                  primaryConcerns: concerns,
                  preferredLanguage: preferredLanguage || null,
                  genderPreference: genderPreference || "any",
                  budgetRange: budgetRange || null,
                  howDidYouHear: howDidYouHear || "skipped",
                });
                queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                window.location.href = "/dashboard";
              } catch {
                toast({ title: t("common.error"), variant: "destructive" });
              }
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("onboarding.skip")}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
