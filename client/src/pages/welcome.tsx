import { useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Compass, Heart, HeartHandshake, Users, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  canonicalHomeRouteForRole,
  clearStoredWelcomeContinuation,
  getStoredWelcomePath,
  shouldShowWelcomeContinuation,
} from "@/lib/navigation";
import { fadeUp, safeVariants, usePrefersReducedMotion } from "@/lib/motion";

type StarterPath = "peer" | "therapist" | "wellness" | "support";

const starterMeta = {
  peer: { icon: HeartHandshake, href: "/peer-support", labelKey: "welcome.path.peer.label", bodyKey: "welcome.path.peer.body" },
  therapist: { icon: Users, href: "/therapists", labelKey: "welcome.path.therapist.label", bodyKey: "welcome.path.therapist.body" },
  wellness: { icon: Wind, href: "/self-care", labelKey: "welcome.path.wellness.label", bodyKey: "welcome.path.wellness.body" },
  support: { icon: Compass, href: "/support", labelKey: "welcome.path.support.label", bodyKey: "welcome.path.support.body" },
} as const;

export default function WelcomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);

  const translate = (key: string) => {
    const value = t(key);
    return value === key ? key : value;
  };

  const role = user?.role;
  if (!user || role !== "client") {
    navigate(canonicalHomeRouteForRole(role));
    return null;
  }

  if (!shouldShowWelcomeContinuation(user)) {
    navigate(canonicalHomeRouteForRole(role));
    return null;
  }

  const starterPath = useMemo<StarterPath>(() => getStoredWelcomePath() || "support", []);
  const highlightedPath = starterMeta[starterPath];
  const HighlightIcon = highlightedPath.icon;

  const continueJourney = () => {
    clearStoredWelcomeContinuation();
    navigate(highlightedPath.href);
  };

  const skipToHome = () => {
    clearStoredWelcomeContinuation();
    navigate(canonicalHomeRouteForRole(role));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={safeFadeUp}
        className="w-full max-w-3xl space-y-4"
      >
        <Card>
          <CardHeader className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl gradient-calm flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-white" />
            </div>
            <Badge variant="secondary" className="mx-auto">
              {translate("welcome.badge")}
            </Badge>
            <CardTitle>{translate("welcome.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {translate("welcome.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-background/80 flex items-center justify-center shrink-0">
                <HighlightIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{translate(highlightedPath.labelKey)}</p>
                <p className="text-sm text-muted-foreground">{translate(highlightedPath.bodyKey)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {(Object.entries(starterMeta) as Array<[StarterPath, typeof starterMeta[StarterPath]]>).map(([key, option]) => {
                const OptionIcon = option.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigate(option.href)}
                    className="rounded-2xl border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <OptionIcon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium">{translate(option.labelKey)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{translate(option.bodyKey)}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={continueJourney} data-testid="button-welcome-continue">
                {translate("welcome.continue")}
              </Button>
              <Button variant="outline" className="flex-1" onClick={skipToHome}>
                {translate("welcome.skip")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
