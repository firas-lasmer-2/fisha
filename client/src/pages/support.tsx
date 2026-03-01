import { Link } from "wouter";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Star,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavigationManifestEntry } from "@shared/schema";
import { AppLayout } from "@/components/app-layout";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useNavigationManifest } from "@/hooks/use-navigation-manifest";
import { useI18n } from "@/lib/i18n";
import { fadeUp, safeVariants, usePrefersReducedMotion } from "@/lib/motion";

type SupportCardMeta = {
  icon: LucideIcon;
  badgeKey: string;
  ctaKey: string;
  toneClass: string;
};

const supportCardMeta: Record<string, SupportCardMeta> = {
  "support-peer": {
    icon: HeartHandshake,
    badgeKey: "support.badge.peer",
    ctaKey: "support.cta.peer",
    toneClass: "border-primary/25 bg-primary/5",
  },
  "support-therapist-graduated": {
    icon: GraduationCap,
    badgeKey: "support.badge.structured",
    ctaKey: "support.cta.graduated",
    toneClass: "border-sky-500/25 bg-sky-500/5",
  },
  "support-therapist-premium": {
    icon: Star,
    badgeKey: "support.badge.specialist",
    ctaKey: "support.cta.premium",
    toneClass: "border-amber-500/25 bg-amber-500/5",
  },
  "support-self-care": {
    icon: Wind,
    badgeKey: "support.badge.gentle",
    ctaKey: "support.cta.selfcare",
    toneClass: "border-emerald-500/25 bg-emerald-500/5",
  },
};

function resolveSupportHref(entry: NavigationManifestEntry, isAuthenticated: boolean) {
  if (entry.featureKey === "support-peer" && !isAuthenticated) {
    return "/login";
  }
  return entry.href;
}

export default function SupportPage() {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data, isLoading, isError, error, refetch } = useNavigationManifest({
    surface: "support",
    role: user ? "client" : "visitor",
    routePath: "/support",
  });

  const translate = (key: string | null | undefined) => {
    if (!key) return "";
    const value = t(key);
    return value === key ? key : value;
  };

  const primaryCards = useMemo(() => data?.primaryPaths || [], [data?.primaryPaths]);
  const secondaryCards = useMemo(() => data?.secondaryPaths || [], [data?.secondaryPaths]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <PageSkeleton variant="grid" count={4} />
        </div>
      </AppLayout>
    );
  }

  if (isError || !data) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <PageError error={error as Error} resetFn={refetch} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <PageHeader
          title={translate("support.page.title")}
          subtitle={translate("support.page.subtitle")}
          icon={Compass}
        />

        <motion.div initial="hidden" animate="visible" variants={safeFadeUp}>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {translate("support.crisis.title")}
                </p>
                <p className="text-sm text-muted-foreground">{translate("support.crisis.body")}</p>
              </div>
              <Link href={user ? "/crisis" : "/login"}>
                <Button variant="destructive" className="gap-2">
                  {translate("support.crisis.cta")}
                  <Arrow className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          {primaryCards.map((entry) => {
            const meta = supportCardMeta[entry.featureKey];
            const Icon = meta?.icon || Compass;
            return (
              <motion.div key={entry.id} initial="hidden" animate="visible" variants={safeFadeUp}>
                <Card className={`h-full ${meta?.toneClass || ""}`}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-background/70 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      {meta?.badgeKey && (
                        <Badge variant="secondary">{translate(meta.badgeKey)}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{translate(entry.labelKey)}</CardTitle>
                      <p className="text-sm text-muted-foreground">{translate(entry.summaryKey)}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl bg-background/70 p-3 text-sm text-muted-foreground">
                      {translate(`support.goal.${entry.featureKey}`)}
                    </div>
                    <Link href={resolveSupportHref(entry, Boolean(user))}>
                      <Button className="w-full gap-2">
                        {translate(meta?.ctaKey || "support.cta.default")}
                        <Arrow className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {secondaryCards.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={safeFadeUp}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>{translate("support.secondary.title")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {secondaryCards.map((entry) => {
                  const meta = supportCardMeta[entry.featureKey];
                  const Icon = meta?.icon || Compass;
                  return (
                    <Link key={entry.id} href={resolveSupportHref(entry, Boolean(user))}>
                      <button
                        type="button"
                        className="w-full rounded-2xl border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                        data-testid={`support-secondary-${entry.featureKey}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium">{translate(entry.labelKey)}</p>
                            <p className="text-sm text-muted-foreground">{translate(entry.summaryKey)}</p>
                          </div>
                        </div>
                      </button>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { key: "support.note.peer", icon: HeartHandshake },
            { key: "support.note.therapist", icon: ShieldCheck },
            { key: "support.note.language", icon: Sparkles },
          ].map((item) => (
            <motion.div key={item.key} initial="hidden" animate="visible" variants={safeFadeUp}>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{translate(item.key)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
