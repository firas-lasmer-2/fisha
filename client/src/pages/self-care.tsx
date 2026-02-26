import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wind, Hand, Sparkles, Timer, Play, Pause, RotateCcw, Check, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const affirmationsAr = [
  "أنا أستحق الحب والاحترام",
  "أنا قادر على التغلب على التحديات",
  "كل يوم أصبح أفضل",
  "أنا أتقبل نفسي كما أنا",
  "لدي القوة لتحقيق أهدافي",
  "أنا جدير بالسعادة",
  "أفكاري لا تعرفني، أنا أختار مساري",
  "أنا ممتن لكل ما لدي",
];

const affirmationsFr = [
  "Je mérite l'amour et le respect",
  "Je suis capable de surmonter les défis",
  "Chaque jour, je deviens meilleur",
  "Je m'accepte tel que je suis",
  "J'ai la force d'atteindre mes objectifs",
  "Je mérite le bonheur",
  "Mes pensées ne me définissent pas",
  "Je suis reconnaissant pour tout ce que j'ai",
];

const affirmationsDarija = [
  "أنا نستاهل الحب والاحترام",
  "أنا نقدر نتغلب على الصعوبات",
  "كل نهار نولي أحسن",
  "أنا نقبل روحي كيما أنا",
  "عندي القوة باش نحقق أهدافي",
  "أنا نستاهل السعادة",
  "أفكاري ما تعرفنيش، أنا نختار طريقي",
  "أنا شاكر على كل شي عندي",
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

function AffirmationsCard({ t, language }: { t: (key: string) => string; language: string }) {
  const [index, setIndex] = useState(0);

  const affirmations = language === "fr" ? affirmationsFr : language === "darija" ? affirmationsDarija : affirmationsAr;

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

export default function SelfCarePage() {
  const { t, language } = useI18n();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl font-bold text-gradient mb-2" data-testid="text-selfcare-title">
            {t("selfcare.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-selfcare-subtitle">
            {t("selfcare.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <BreathingExercise t={t} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GroundingExercise t={t} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <AffirmationsCard t={t} language={language} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <MeditationTimer t={t} />
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}