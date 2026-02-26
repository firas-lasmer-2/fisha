import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, HeartHandshake, Sparkles, Users, Wind } from "lucide-react";
import { motion } from "framer-motion";
import type { OnboardingResponse, TherapistProfile, User } from "@shared/schema";

function homeRouteForRole(role: string | null | undefined) {
  if (role === "listener") return "/listener/dashboard";
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "moderator" || role === "admin") return "/admin/listeners";
  return "/dashboard";
}

type TherapistRow = TherapistProfile & { user: User };
type StarterPath = "peer" | "therapist" | "wellness";

export default function WelcomePage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  if (user?.role && user.role !== "client") {
    window.location.href = homeRouteForRole(user.role);
    return null;
  }

  const starterPath = useMemo<StarterPath>(() => {
    if (typeof window === "undefined") return "peer";
    const value = localStorage.getItem("shifa-welcome-path");
    if (value === "therapist" || value === "wellness" || value === "peer") return value;
    return "peer";
  }, []);

  const { data: onboarding } = useQuery<OnboardingResponse | null>({
    queryKey: ["/api/onboarding"],
  });

  const therapistQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (onboarding?.primaryConcerns?.[0]) {
      params.set("specialization", onboarding.primaryConcerns[0]);
    }
    if (onboarding?.preferredLanguage) {
      params.set("language", onboarding.preferredLanguage);
    }
    return `?${params.toString()}`;
  }, [onboarding?.primaryConcerns, onboarding?.preferredLanguage]);

  const { data: therapists = [] } = useQuery<TherapistRow[]>({
    queryKey: ["/api/therapists", therapistQuery],
    enabled: Boolean(onboarding),
  });

  const recommendedTherapist = therapists[0];

  const continuePath = () => {
    localStorage.removeItem("shifa-show-welcome");
    if (starterPath === "therapist") {
      window.location.href = "/therapists";
      return;
    }
    if (starterPath === "wellness") {
      window.location.href = "/self-care";
      return;
    }
    window.location.href = "/listen";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl space-y-4"
      >
        <Card>
          <CardHeader className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl gradient-calm flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-white" />
            </div>
            <CardTitle>
              {tr("welcome.title", "Welcome to your support space")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {tr("welcome.subtitle", "You are not alone. We prepared a gentle starting point for you.")}
            </p>
            {user?.firstName && (
              <Badge variant="secondary" className="mx-auto">
                {tr("welcome.hello", "Hello")} {user.firstName}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="justify-start gap-2" onClick={() => (window.location.href = "/listen")}>
                <HeartHandshake className="h-4 w-4" />
                {tr("welcome.peer", "Start with peer support")}
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => (window.location.href = "/therapists")}>
                <Users className="h-4 w-4" />
                {tr("welcome.therapist", "Browse therapists")}
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => (window.location.href = "/self-care")}>
                <Wind className="h-4 w-4" />
                {tr("welcome.wellness", "Open wellness tools")}
              </Button>
            </div>

            {recommendedTherapist ? (
              <Card className="border-primary/30">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {tr("welcome.recommendation", "Recommended for your first step")}
                  </p>
                  <p className="text-sm font-semibold">
                    {recommendedTherapist.user.firstName} {recommendedTherapist.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(recommendedTherapist.specializations || []).slice(0, 2).map((spec) => t(`specialization.${spec}`)).join(" • ")}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {recommendedTherapist.rateDinar ?? "--"} {t("common.dinar")}
                    </p>
                    <Button size="sm" onClick={() => (window.location.href = `/therapist/${recommendedTherapist.userId}`)}>
                      {t("therapist.book")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                {tr("welcome.no_recommendation", "We will refine recommendations as you use Shifa.")}
              </p>
            )}

            <Button className="w-full" onClick={continuePath} data-testid="button-welcome-continue">
              {tr("welcome.continue", "Continue")}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
