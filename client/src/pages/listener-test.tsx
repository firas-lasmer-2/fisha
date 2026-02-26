import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { QUALIFICATION_QUESTIONS, PASSING_THRESHOLD_PCT } from "@shared/qualification-questions";
import type { ListenerQualificationTest } from "@shared/schema";

interface TestResult extends ListenerQualificationTest {
  total: number;
  correct: number;
}

export default function ListenerTestPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  // answers: Record<questionId, chosenOptionIndex (as string)>
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const { data: existingTest, isLoading } = useQuery<ListenerQualificationTest | null>({
    queryKey: ["/api/listener/qualification-test"],
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/listener/qualification-test", { answers });
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/listener/qualification-test"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const currentQuestion = QUALIFICATION_QUESTIONS[currentIndex];
  const totalQuestions = QUALIFICATION_QUESTIONS.length;
  const progressPct = Math.round(((currentIndex + 1) / totalQuestions) * 100);
  const allAnswered = QUALIFICATION_QUESTIONS.every((q) => answers[q.id] !== undefined);

  function handleSelect(optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: String(optionIndex) }));
  }

  function handleSubmit() {
    if (!allAnswered) {
      toast({ title: t("listener.test_unanswered"), variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  }

  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const fillTemplate = (tpl: string, vars: Record<string, string | number>) => {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  };

  // Show existing passed result
  if (!isLoading && existingTest?.passed && !submitted) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <Card>
            <CardContent className="p-6 space-y-4 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-semibold">{t("listener.test_already_passed")}</h2>
              <p className="text-muted-foreground">
                {fillTemplate(t("listener.test_score"), { score: existingTest.score })}
              </p>
              <Link href="/listener/apply">
                <Button>{t("listener.test_apply_now")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Show result screen after submission
  if (submitted && result) {
    const passed = result.passed;
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4 text-center">
              {passed ? (
                <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto" />
              ) : (
                <XCircle className="h-14 w-14 text-destructive mx-auto" />
              )}
              <h2 className="text-xl font-semibold">
                {passed ? t("listener.test_passed") : t("listener.test_failed")}
              </h2>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {fillTemplate(t("listener.test_score"), { score: result.score })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {fillTemplate(t("listener.test_correct"), { correct: result.correct, total: result.total })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fillTemplate(t("listener.test_pass_threshold"), { threshold: PASSING_THRESHOLD_PCT })}
                </p>
              </div>

              {passed ? (
                <Link href="/listener/apply">
                  <Button size="lg">{t("listener.test_apply_now")}</Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnswers({});
                    setCurrentIndex(0);
                    setSubmitted(false);
                    setResult(null);
                  }}
                >
                  {t("listener.test_retake")}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Show answer review */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tr("listener.test_review", "Answer Review")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {QUALIFICATION_QUESTIONS.map((q, i) => {
                const chosen = answers[q.id] !== undefined ? Number(answers[q.id]) : -1;
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div key={q.id} className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      )}
                      <p className="text-sm font-medium">{i + 1}. {q.text}</p>
                    </div>
                    {!isCorrect && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 ml-6">
                        ✓ {q.options[q.correctIndex]}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">{t("listener.test_loading")}</p>
        </div>
      </AppLayout>
    );
  }

  // Quiz screen
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">{t("listener.test_title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("listener.test_description")}</p>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {fillTemplate(t("listener.test_question_of"), {
                current: currentIndex + 1,
                total: totalQuestions,
              })}
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <div className="flex gap-1 flex-wrap">
            {QUALIFICATION_QUESTIONS.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                  i === currentIndex
                    ? "bg-primary text-primary-foreground"
                    : answers[q.id] !== undefined
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                {currentQuestion.category.replace("_", " ")}
              </Badge>
            </div>
            <CardTitle className="text-base leading-snug">{currentQuestion.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentQuestion.options.map((option, idx) => {
              const selected = answers[currentQuestion.id] === String(idx);
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <span className="font-semibold mr-2 text-muted-foreground">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {option}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("listener.test_prev")}
          </Button>

          {currentIndex < totalQuestions - 1 ? (
            <Button
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
            >
              {t("listener.test_next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !allAnswered}
            >
              {submitMutation.isPending
                ? tr("common.loading", "Submitting...")
                : t("listener.test_submit")}
            </Button>
          )}
        </div>

        {!allAnswered && currentIndex === totalQuestions - 1 && (
          <p className="text-xs text-muted-foreground text-center">
            {t("listener.test_unanswered")}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
