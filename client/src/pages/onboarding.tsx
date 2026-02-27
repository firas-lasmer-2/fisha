import { useMemo, useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Heart, ArrowRight, ArrowLeft, Check, Loader2, AtSign, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/supabase";
import { motion } from "framer-motion";

const CONCERNS = [
  "anxiety",
  "depression",
  "stress",
  "relationships",
  "trauma",
  "self_esteem",
  "grief",
  "family",
  "couples",
  "addiction",
] as const;

const CONCERN_EMOJI: Record<string, string> = {
  anxiety: "😟",
  depression: "🌧️",
  stress: "🔥",
  relationships: "🤝",
  trauma: "🫂",
  self_esteem: "🌱",
  grief: "🕊️",
  family: "🏠",
  couples: "💞",
  addiction: "🛡️",
};

type StarterPath = "peer" | "therapist" | "wellness";

const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;

export default function OnboardingPage() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, ] = useLocation();

  const role = user?.role ?? "client";

  const [step, setStep] = useState(0);
  // Client state
  const [concerns, setConcerns] = useState<string[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [genderPreference, setGenderPreference] = useState("");
  const [starterPath, setStarterPath] = useState<StarterPath>("peer");
  // Shared state
  const [displayName, setDisplayName] = useState("");
  const [displayNameAvailable, setDisplayNameAvailable] = useState<boolean | null>(null);
  const [displayNameChecking, setDisplayNameChecking] = useState(false);
  const displayNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Listener state
  const [motivation, setMotivation] = useState("");
  // Therapist state
  const [credentialsNote, setCredentialsNote] = useState("");

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const ArrowNext = isRTL ? ArrowLeft : ArrowRight;
  const ArrowBack = isRTL ? ArrowRight : ArrowLeft;

  // Steps per role
  const totalSteps = role === "client" ? 4 : 2;
  const progressRatio = (step + 1) / totalSteps;

  useEffect(() => {
    if (displayNameTimerRef.current) clearTimeout(displayNameTimerRef.current);
    if (!displayName) {
      setDisplayNameAvailable(null);
      setDisplayNameChecking(false);
      return;
    }
    if (!DISPLAY_NAME_REGEX.test(displayName)) {
      setDisplayNameAvailable(false);
      setDisplayNameChecking(false);
      return;
    }
    setDisplayNameChecking(true);
    displayNameTimerRef.current = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/user/display-name/check/${encodeURIComponent(displayName)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDisplayNameAvailable(data.available);
        }
      } catch {
        setDisplayNameAvailable(null);
      } finally {
        setDisplayNameChecking(false);
      }
    }, 500);
  }, [displayName]);

  // Client onboarding mutation
  const completeClientOnboardingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/quick-start", {
        primaryConcerns: concerns,
        preferredLanguage,
        genderPreference: genderPreference || null,
      });

      if (displayName && displayNameAvailable) {
        await apiRequest("PATCH", "/api/user/profile", { displayName });
      }

      localStorage.setItem("shifa-show-welcome", "1");
      localStorage.setItem("shifa-welcome-path", starterPath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      window.location.href = "/therapists";
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  // Listener onboarding mutation
  const completeListenerOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (displayName && displayNameAvailable) {
        await apiRequest("PATCH", "/api/user/profile", { displayName });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/listener/test";
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  // Therapist onboarding mutation
  const completeTherapistOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (displayName && displayNameAvailable) {
        await apiRequest("PATCH", "/api/user/profile", { displayName });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/therapist-dashboard";
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const completeMutation =
    role === "listener"
      ? completeListenerOnboardingMutation
      : role === "therapist"
        ? completeTherapistOnboardingMutation
        : completeClientOnboardingMutation;

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern],
    );
  };

  const canContinue = useMemo(() => {
    if (role === "client") {
      if (step === 0) return concerns.length > 0;
      if (step === 1) return preferredLanguage.length > 0;
      return true;
    }
    // listener/therapist: step 0 = display name (optional), step 1 = motivation/credentials
    return true;
  }, [role, step, concerns.length, preferredLanguage]);

  const blockedHelperText = useMemo(() => {
    if (role === "client") {
      if (step === 0 && concerns.length === 0) {
        return tr("onboarding.select_concern_required", "Choose at least one concern to continue.");
      }
      if (step === 1 && preferredLanguage.length === 0) {
        return tr("onboarding.select_language_required", "Pick your preferred language to continue.");
      }
    }
    return "";
  }, [role, step, concerns.length, preferredLanguage, tr]);

  const isLastStep = step === totalSteps - 1;

  // Display name step (shared across roles, but different step index)
  const displayNameStep = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{tr("onboarding.display_name_title", "Choose a display name")}</h2>
      <p className="text-sm text-muted-foreground">
        {tr(
          "onboarding.display_name_desc",
          "This name is shown instead of your real name in peer support sessions and reviews. You can skip this and set it later in settings.",
        )}
      </p>
      <div className="space-y-2">
        <div className="relative">
          <AtSign className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9 pe-9"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.replace(/\s/g, ""))}
            placeholder={tr("onboarding.display_name_placeholder", "e.g. calm_soul or أمل")}
            maxLength={30}
            data-testid="input-display-name-onboarding"
          />
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            {displayNameChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!displayNameChecking && displayName && displayNameAvailable === true && (
              <Check className="h-4 w-4 text-emerald-500" />
            )}
            {!displayNameChecking && displayName && displayNameAvailable === false && (
              <X className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        {displayName && displayNameAvailable === false && (
          <p className="text-xs text-destructive">
            {DISPLAY_NAME_REGEX.test(displayName)
              ? tr("onboarding.display_name_taken", "This name is already taken. Try another.")
              : tr("onboarding.display_name_invalid", "3–30 characters: letters, numbers, Arabic, or underscores only.")}
          </p>
        )}
        {displayName && displayNameAvailable === true && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {tr("onboarding.display_name_available", "This name is available!")}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center space-y-3">
          {step === 0 && role === "client" ? (
            <div className="breathing-circle mx-auto" aria-hidden />
          ) : (
            <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center mx-auto">
              <Heart className="h-6 w-6 text-white" />
            </div>
          )}
          <CardTitle>{t("onboarding.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>

          <div className="pt-2 space-y-2">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${progressRatio * 100}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("onboarding.step_of", "Step")} {step + 1}/{totalSteps}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── CLIENT FLOW ── */}
          {role === "client" && step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t("onboarding.concerns_title")}</h2>
              <p className="text-sm text-muted-foreground">{tr("onboarding.concerns_desc", "Choose what's been weighing on your mind. There's no wrong answer.")}</p>
              <div className="flex flex-wrap gap-2">
                {CONCERNS.map((concern) => {
                  const selected = concerns.includes(concern);
                  return (
                    <motion.button
                      key={concern}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      animate={selected ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => toggleConcern(concern)}
                    >
                      <Badge
                        variant={selected ? "default" : "secondary"}
                        className="cursor-pointer text-sm py-1.5 px-3"
                        data-testid={`badge-concern-${concern}`}
                      >
                        <span className="me-1">{CONCERN_EMOJI[concern] || "✨"}</span>
                        {t(`specialization.${concern}`)}
                      </Badge>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                🔒 {tr("onboarding.privacy_note", "Your choices are private. We never share your information without your consent.")}
              </p>
            </div>
          )}

          {role === "client" && step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t("onboarding.language_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("onboarding.language_desc")}</p>
              <RadioGroup value={preferredLanguage} onValueChange={setPreferredLanguage} className="space-y-2">
                {[
                  { value: "ar", label: "العربية" },
                  { value: "fr", label: "Français" },
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
            </div>
          )}

          {role === "client" && step === 2 && displayNameStep}

          {role === "client" && step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{tr("onboarding.optional_title", "One last thing (optional)")}</h2>
                <p className="text-sm text-muted-foreground">
                  {tr("onboarding.optional_desc", "This helps us suggest the right therapist. You can skip and change it later.")}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">{t("onboarding.gender_title")}</p>
                <RadioGroup value={genderPreference} onValueChange={setGenderPreference} className="space-y-2">
                  {[
                    { value: "female", label: t("common.female") },
                    { value: "male", label: t("common.male") },
                    { value: "any", label: t("onboarding.no_preference") },
                  ].map((item) => (
                    <Label
                      key={item.value}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${
                        genderPreference === item.value ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <RadioGroupItem value={item.value} />
                      <span>{item.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {/* ── LISTENER FLOW ── */}
          {role === "listener" && step === 0 && displayNameStep}

          {role === "listener" && step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Why do you want to be a listener?</h2>
              <p className="text-sm text-muted-foreground">
                Tell us briefly what motivates you to support others. This will be reviewed as part of your application.
              </p>
              <Textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="e.g. I've gone through my own mental health journey and want to give back..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{motivation.length}/500</p>
            </div>
          )}

          {/* ── THERAPIST FLOW ── */}
          {role === "therapist" && step === 0 && displayNameStep}

          {role === "therapist" && step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your professional credentials</h2>
              <p className="text-sm text-muted-foreground">
                You'll upload your credentials in your dashboard. You can add a brief note here, or skip and go straight to your dashboard.
              </p>
              <Textarea
                value={credentialsNote}
                onChange={(e) => setCredentialsNote(e.target.value)}
                placeholder="e.g. Licensed psychologist since 2018, specializing in CBT..."
                rows={3}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-amber-600 dark:text-amber-400">
                Your profile will be reviewed before you appear in the therapist directory.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  <ArrowBack className="h-4 w-4 me-1" />
                  {t("common.back")}
                </Button>
              )}

              {!isLastStep ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={!canContinue}
                  className="flex-1"
                  data-testid="button-onboarding-next"
                >
                  {t("common.next")}
                  <ArrowNext className="h-4 w-4 ms-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="flex-1"
                  data-testid="button-onboarding-complete"
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 me-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 me-1" />
                  )}
                  {t("onboarding.complete")}
                </Button>
              )}
            </div>

            {blockedHelperText && !canContinue && (
              <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-onboarding-helper">
                {blockedHelperText}
              </p>
            )}

            {isLastStep && (
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {tr("onboarding.skip_optional", "I'll add this later")}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
