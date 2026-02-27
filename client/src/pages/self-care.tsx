import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Wind, Hand, Sparkles, Timer, Play, Pause, RotateCcw, Check, ChevronRight, Moon, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const affirmationKeys = [
  "selfcare.affirmation_1",
  "selfcare.affirmation_2",
  "selfcare.affirmation_3",
  "selfcare.affirmation_4",
  "selfcare.affirmation_5",
  "selfcare.affirmation_6",
  "selfcare.affirmation_7",
  "selfcare.affirmation_8",
];

function BreathingExercise({ t }: { t: (key: string) => string }) {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale">("idle");
  const [round, setRound] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runCycle = useCallback((currentRound: number) => {
    setPhase("inhale");
    timerRef.current = setTimeout(() => {
      setPhase("hold");
      timerRef.current = setTimeout(() => {
        setPhase("exhale");
        timerRef.current = setTimeout(() => {
          const nextRound = currentRound + 1;
          setRound(nextRound);
          runCycle(nextRound);
        }, 8000);
      }, 7000);
    }, 4000);
  }, []);

  const start = useCallback(() => {
    setIsActive(true);
    setRound(0);
    runCycle(0);
  }, [runCycle]);

  const stop = useCallback(() => {
    clearTimers();
    setIsActive(false);
    setPhase("idle");
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const phaseLabel = phase === "inhale" ? t("selfcare.inhale") : phase === "hold" ? t("selfcare.hold") : phase === "exhale" ? t("selfcare.exhale") : "";

  return (
    <Card data-testid="card-breathing-exercise">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md gradient-calm flex items-center justify-center">
            <Wind className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t("selfcare.breathing")}</h3>
            <p className="text-sm text-muted-foreground">{t("selfcare.breathing.desc")}</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-8">
          <div className={`breathing-circle ${phase !== "idle" ? phase : ""}`} data-testid="breathing-circle">
            <motion.span
              key={phase}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-sm font-semibold text-primary"
            >
              {phaseLabel}
            </motion.span>
          </div>

          {isActive && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary" data-testid="badge-round-counter">
                {t("selfcare.round")} {round + 1}
              </Badge>
              {round > 0 && (
                <Badge variant="outline" data-testid="badge-rounds-complete">
                  {round} {t("selfcare.rounds_complete")}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3">
          {!isActive ? (
            <Button onClick={start} data-testid="button-breathing-start">
              <Play className="h-4 w-4 me-2" />
              {t("selfcare.start")}
            </Button>
          ) : (
            <Button variant="destructive" onClick={stop} data-testid="button-breathing-stop">
              <Pause className="h-4 w-4 me-2" />
              {t("selfcare.stop")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const groundingSteps = [
  { count: 5, sense: "see" },
  { count: 4, sense: "touch" },
  { count: 3, sense: "hear" },
  { count: 2, sense: "smell" },
  { count: 1, sense: "taste" },
] as const;

function GroundingExercise({ t }: { t: (key: string) => string }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [completed, setCompleted] = useState(false);

  const isActive = currentStep >= 0 && !completed;
  const progressPercent = completed ? 100 : currentStep < 0 ? 0 : (currentStep / groundingSteps.length) * 100;

  const startExercise = () => {
    setCurrentStep(0);
    setCompleted(false);
  };

  const nextStep = () => {
    if (currentStep < groundingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCompleted(true);
    }
  };

  const reset = () => {
    setCurrentStep(-1);
    setCompleted(false);
  };

  return (
    <Card data-testid="card-grounding-exercise">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md gradient-warm flex items-center justify-center">
            <Hand className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t("selfcare.grounding")}</h3>
            <p className="text-sm text-muted-foreground">{t("selfcare.grounding.desc")}</p>
          </div>
        </div>

        <Progress value={progressPercent} className="mb-6" data-testid="progress-grounding" />

        <div className="min-h-[120px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!isActive && !completed && (
              <motion.div
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <Button onClick={startExercise} data-testid="button-grounding-start">
                  <Play className="h-4 w-4 me-2" />
                  {t("selfcare.start")}
                </Button>
              </motion.div>
            )}

            {isActive && (
              <motion.div
                key={`step-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center w-full"
              >
                <div className="mb-2">
                  <Badge variant="secondary" className="text-lg px-4 py-1" data-testid={`badge-grounding-step-${currentStep}`}>
                    {groundingSteps[currentStep].count}
                  </Badge>
                </div>
                <p className="text-lg font-medium mb-4" data-testid="text-grounding-instruction">
                  {t(`selfcare.${groundingSteps[currentStep].sense}`)}
                </p>
                <Button onClick={nextStep} data-testid="button-grounding-next">
                  {currentStep < groundingSteps.length - 1 ? (
                    <>
                      <ChevronRight className="h-4 w-4 me-2" />
                      {t("common.next")}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 me-2" />
                      {t("common.submit")}
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {completed && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <p className="text-lg font-medium mb-4" data-testid="text-grounding-complete">
                  {t("selfcare.grounding_complete")}
                </p>
                <Button variant="outline" onClick={reset} data-testid="button-grounding-reset">
                  <RotateCcw className="h-4 w-4 me-2" />
                  {t("selfcare.start")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

function AffirmationsCard({ t }: { t: (key: string) => string }) {
  const [index, setIndex] = useState(0);
  const affirmations = affirmationKeys.map((key) => t(key));

  const nextAffirmation = useCallback(() => {
    setIndex((prev) => (prev + 1) % affirmations.length);
  }, [affirmations.length]);

  useEffect(() => {
    const interval = setInterval(nextAffirmation, 8000);
    return () => clearInterval(interval);
  }, [nextAffirmation]);

  return (
    <Card data-testid="card-affirmations">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-amber-500 dark:bg-amber-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t("selfcare.affirmations")}</h3>
            <p className="text-sm text-muted-foreground">{t("selfcare.affirmations.desc")}</p>
          </div>
        </div>

        <div className="min-h-[140px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="rounded-md gradient-calm p-6 w-full text-center"
            >
              <p className="text-lg font-medium text-white" data-testid="text-affirmation-current">
                {affirmations[index]}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={nextAffirmation} data-testid="button-affirmation-next">
            <ChevronRight className="h-4 w-4 me-2" />
            {t("common.next")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const TIMER_OPTIONS = [5, 10, 15, 20];

function MeditationTimer({ t }: { t: (key: string) => string }) {
  const [selectedMinutes, setSelectedMinutes] = useState(5);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    setSecondsLeft(selectedMinutes * 60);
    setIsRunning(true);
  }, [selectedMinutes]);

  const stopTimer = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setSecondsLeft(0);
  }, [clearTimer]);

  const togglePause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearTimer();
  }, [isRunning, clearTimer]);

  const displayMinutes = Math.floor(secondsLeft / 60);
  const displaySeconds = secondsLeft % 60;
  const progressPercent = selectedMinutes > 0 ? ((selectedMinutes * 60 - secondsLeft) / (selectedMinutes * 60)) * 100 : 0;
  const isTimerActive = secondsLeft > 0 || isRunning;

  return (
    <Card data-testid="card-meditation-timer">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-violet-500 dark:bg-violet-600 flex items-center justify-center">
            <Timer className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t("selfcare.meditation")}</h3>
            <p className="text-sm text-muted-foreground">{t("selfcare.meditation.desc")}</p>
          </div>
        </div>

        {!isTimerActive ? (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {TIMER_OPTIONS.map((min) => (
                <Button
                  key={min}
                  variant={selectedMinutes === min ? "default" : "outline"}
                  onClick={() => setSelectedMinutes(min)}
                  data-testid={`button-timer-${min}`}
                  className="toggle-elevate"
                >
                  {min} {t("selfcare.minutes")}
                </Button>
              ))}
            </div>
            <div className="flex justify-center">
              <Button onClick={startTimer} data-testid="button-meditation-start">
                <Play className="h-4 w-4 me-2" />
                {t("selfcare.start")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle
                    cx="80" cy="80" r="70"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 70}
                    strokeDashoffset={2 * Math.PI * 70 * (1 - progressPercent / 100)}
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="text-3xl font-bold tabular-nums" data-testid="text-timer-display">
                  {String(displayMinutes).padStart(2, "0")}:{String(displaySeconds).padStart(2, "0")}
                </span>
              </div>
            </div>

            <Progress value={progressPercent} className="h-1" data-testid="progress-meditation" />

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={togglePause} data-testid="button-meditation-pause">
                {isRunning ? <Pause className="h-4 w-4 me-2" /> : <Play className="h-4 w-4 me-2" />}
                {isRunning ? t("selfcare.stop") : t("selfcare.start")}
              </Button>
              <Button variant="destructive" onClick={stopTimer} data-testid="button-meditation-reset">
                <RotateCcw className="h-4 w-4 me-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const BODY_SCAN_STEPS = [
  "body_scan_step_1",
  "body_scan_step_2",
  "body_scan_step_3",
  "body_scan_step_4",
  "body_scan_step_5",
] as const;

function BodyScanCard({
  t,
  tr,
}: {
  t: (key: string) => string;
  tr: (key: string, fallback: string) => string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const progressValue = started ? ((stepIndex + 1) / BODY_SCAN_STEPS.length) * 100 : 0;
  const done = started && stepIndex >= BODY_SCAN_STEPS.length - 1;

  const start = () => {
    setStarted(true);
    setStepIndex(0);
  };

  const next = () => {
    setStepIndex((prev) => Math.min(BODY_SCAN_STEPS.length - 1, prev + 1));
  };

  const reset = () => {
    setStarted(false);
    setStepIndex(0);
  };

  return (
    <Card data-testid="card-body-scan">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md safe-surface flex items-center justify-center">
            <Hand className="h-5 w-5 text-safe" />
          </div>
          <div>
            <h3 className="font-semibold">{tr("selfcare.body_scan", "Body scan")}</h3>
            <p className="text-sm text-muted-foreground">
              {tr("selfcare.body_scan.desc", "Gently check in with each part of your body.")}
            </p>
          </div>
        </div>

        <Progress value={progressValue} className="mb-4" />

        {!started ? (
          <Button onClick={start} data-testid="button-body-scan-start">
            <Play className="h-4 w-4 me-2" />
            {t("selfcare.start")}
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {tr(
                `selfcare.${BODY_SCAN_STEPS[stepIndex]}`,
                [
                  "Notice your breath and unclench your jaw.",
                  "Relax your shoulders and arms.",
                  "Soften your chest and stomach.",
                  "Release tension in hips and legs.",
                  "Feel your feet and reconnect to the room.",
                ][stepIndex],
              )}
            </p>
            <div className="flex gap-2">
              {!done ? (
                <Button onClick={next} data-testid="button-body-scan-next">
                  <ChevronRight className="h-4 w-4 me-2" />
                  {t("common.next")}
                </Button>
              ) : (
                <Badge variant="secondary">{tr("selfcare.completed", "Completed")}</Badge>
              )}
              <Button variant="outline" onClick={reset} data-testid="button-body-scan-reset">
                <RotateCcw className="h-4 w-4 me-2" />
                {tr("common.restart", "Restart")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SleepMeditationCard({
  tr,
}: {
  tr: (key: string, fallback: string) => string;
}) {
  const steps = [
    tr("selfcare.sleep_step_1", "Dim lights and put your phone on silent."),
    tr("selfcare.sleep_step_2", "Take 3 slow breaths with a longer exhale."),
    tr("selfcare.sleep_step_3", "Relax your body from head to toe."),
    tr("selfcare.sleep_step_4", "Repeat: I can rest safely tonight."),
  ];

  const [step, setStep] = useState(0);
  const done = step >= steps.length - 1;

  return (
    <Card data-testid="card-sleep-meditation">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-indigo-500/15 flex items-center justify-center">
            <Moon className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="font-semibold">{tr("selfcare.sleep_meditation", "Sleep wind-down")}</h3>
            <p className="text-sm text-muted-foreground">
              {tr("selfcare.sleep_meditation.desc", "A short routine to help your mind settle before sleep.")}
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/60 p-3 mb-3">
          <p className="text-sm">{steps[step]}</p>
        </div>

        <div className="flex gap-2">
          {!done ? (
            <Button size="sm" onClick={() => setStep((prev) => prev + 1)} data-testid="button-sleep-next">
              <ChevronRight className="h-4 w-4 me-2" />
              {tr("selfcare.next_step", "Next step")}
            </Button>
          ) : (
            <Badge variant="secondary">{tr("selfcare.ready_for_sleep", "Ready for sleep")}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setStep(0)} data-testid="button-sleep-reset">
            <RotateCcw className="h-4 w-4 me-2" />
            {tr("common.restart", "Restart")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GratitudePracticeCard({
  tr,
}: {
  tr: (key: string, fallback: string) => string;
}) {
  const prompts = [
    tr("selfcare.gratitude_prompt_1", "What gave you even 1% relief today?"),
    tr("selfcare.gratitude_prompt_2", "Who made your day easier today?"),
    tr("selfcare.gratitude_prompt_3", "Name one thing your body helped you do today."),
  ];

  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("shifa-gratitude-entries");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setEntries(parsed.filter((item) => typeof item === "string"));
      }
    } catch {
      // ignore local cache parsing issues
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("shifa-gratitude-entries", JSON.stringify(entries));
  }, [entries]);

  const prompt = prompts[new Date().getDay() % prompts.length];

  const saveEntry = () => {
    const value = draft.trim();
    if (!value) return;
    setEntries((prev) => [value, ...prev].slice(0, 6));
    setDraft("");
  };

  return (
    <Card data-testid="card-gratitude-practice">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-rose-500/15 flex items-center justify-center">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-semibold">{tr("selfcare.gratitude", "Gratitude practice")}</h3>
            <p className="text-sm text-muted-foreground">
              {tr("selfcare.gratitude.desc", "Write one small thing you appreciate today.")}
            </p>
          </div>
        </div>

        <p className="text-sm mb-2">{prompt}</p>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={tr("selfcare.gratitude.placeholder", "Type your gratitude note...")}
          rows={3}
        />
        <Button size="sm" className="mt-2" onClick={saveEntry} data-testid="button-gratitude-save">
          {tr("selfcare.save_note", "Save note")}
        </Button>

        {entries.length > 0 && (
          <div className="mt-4 space-y-2">
            {entries.slice(0, 3).map((entry, index) => (
              <div key={`${entry}-${index}`} className="rounded-lg bg-muted/60 p-2.5 text-sm">
                {entry}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SelfCarePage() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const sectionLinks = [
    {
      id: "breathing",
      label: t("selfcare.breathing"),
      desc: tr("selfcare.breathing.desc", "4-7-8 breathing for instant calm."),
      icon: Wind,
    },
    {
      id: "grounding",
      label: t("selfcare.grounding"),
      desc: tr("selfcare.grounding.desc", "Reconnect with your surroundings."),
      icon: Hand,
    },
    {
      id: "affirmations",
      label: t("selfcare.affirmations"),
      desc: tr("selfcare.affirmations.desc", "Supportive thoughts for your day."),
      icon: Sparkles,
    },
    {
      id: "meditation",
      label: t("selfcare.meditation"),
      desc: tr("selfcare.meditation.desc", "A short guided timer."),
      icon: Timer,
    },
    {
      id: "body-scan",
      label: tr("selfcare.body_scan", "Body scan"),
      desc: tr("selfcare.body_scan.desc", "Release tension step by step."),
      icon: Hand,
    },
    {
      id: "sleep",
      label: tr("selfcare.sleep_meditation", "Sleep wind-down"),
      desc: tr("selfcare.sleep_meditation.desc", "Settle your mind before bed."),
      icon: Moon,
    },
    {
      id: "gratitude",
      label: tr("selfcare.gratitude", "Gratitude practice"),
      desc: tr("selfcare.gratitude.desc", "Save one small positive note."),
      icon: Heart,
    },
  ];

  const dailySuggestions = [
    {
      title: tr("selfcare.daily_breathing", "Breathing reset"),
      desc: tr("selfcare.daily_breathing.desc", "Two calm minutes can reset your nervous system."),
      target: "breathing",
    },
    {
      title: tr("selfcare.daily_grounding", "5-4-3-2-1 grounding"),
      desc: tr("selfcare.daily_grounding.desc", "Bring attention back to the present moment."),
      target: "grounding",
    },
    {
      title: tr("selfcare.daily_gratitude", "One gratitude note"),
      desc: tr("selfcare.daily_gratitude.desc", "Small gratitude habits improve emotional resilience."),
      target: "gratitude",
    },
  ];
  const todaySuggestion = dailySuggestions[new Date().getDay() % dailySuggestions.length];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border gradient-feature p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -top-12 -end-16 h-40 w-40 rounded-full bg-primary/15 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-10 -start-10 h-36 w-36 rounded-full bg-sky-400/10 blur-2xl" aria-hidden />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/60 px-3 py-1 text-xs text-muted-foreground mb-3">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {tr("selfcare.start_here", "Start with one small reset")}
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2" data-testid="text-selfcare-title">
              {t("selfcare.title")}
            </h1>
            <p className="text-muted-foreground max-w-2xl" data-testid="text-selfcare-subtitle">
              {t("selfcare.subtitle")}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr("selfcare.modules", "Modules")}</p>
                <p className="text-lg font-semibold">{sectionLinks.length}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr("selfcare.today_focus", "Today's focus")}</p>
                <p className="text-sm font-medium">{todaySuggestion.title}</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tr("selfcare.tip", "Tip")}</p>
                <p className="text-sm">{tr("selfcare.tip_line", "Done is better than perfect. Start with 2 minutes.")}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            id="breathing"
            className="flex"
          >
            <div className="w-full h-full"><BreathingExercise t={t} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            id="grounding"
            className="flex"
          >
            <div className="w-full h-full"><GroundingExercise t={t} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="flex"
          >
            <div className="w-full h-full"><AffirmationsCard t={t} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="flex"
          >
            <div className="w-full h-full"><MeditationTimer t={t} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="flex"
          >
            <div className="w-full h-full"><BodyScanCard t={t} tr={tr} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="flex"
          >
            <div className="w-full h-full"><SleepMeditationCard tr={tr} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            id="gratitude"
            className="flex md:col-span-2 lg:col-span-3"
          >
            <div className="w-full h-full"><GratitudePracticeCard tr={tr} /></div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
