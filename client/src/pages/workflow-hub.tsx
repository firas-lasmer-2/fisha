import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Compass,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageError } from "@/components/page-error";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { fadeUp, safeVariants, usePrefersReducedMotion } from "@/lib/motion";

type WorkflowAction = {
  id: string;
  labelKey: string;
  summaryKey: string | null;
  href: string;
  priority: "primary" | "secondary";
};

type WorkflowOverviewPayload = {
  user: {
    id: string;
    role: string;
  };
  home: {
    stage: string;
    destinationPath: string;
    labelKey: string;
    summaryKey: string | null;
  } | null;
  counts: {
    unreadMessages: number;
    upcomingAppointments: number;
    activePeerSessions: number;
    completedPeerSessions: number;
  };
  listener: {
    applicationStatus: string | null;
    verificationStatus: string | null;
    activationStatus: string | null;
    isAvailable: boolean | null;
    cooldownEndsAt: string | null;
  };
  moderation: {
    pendingListenerApplications: number;
    openPeerReports: number;
  };
  primaryActions: WorkflowAction[];
  secondaryActions: WorkflowAction[];
  localizationStatus: "approved" | "partial" | "blocked";
};

const roleBadgeKey: Record<string, string> = {
  client: "workflow.role.client",
  therapist: "workflow.role.therapist",
  listener: "workflow.role.listener",
  moderator: "workflow.role.moderator",
  admin: "workflow.role.admin",
};

const localizationBadgeClass: Record<WorkflowOverviewPayload["localizationStatus"], string> = {
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  blocked: "bg-destructive/15 text-destructive",
};

export default function WorkflowHubPage() {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data, isLoading, isError, error, refetch } = useQuery<WorkflowOverviewPayload>({
    queryKey: ["/api/workflow/overview"],
  });

  const translate = (key: string | null | undefined) => {
    if (!key) return "";
    const value = t(key);
    return value === key ? key : value;
  };

  const activeRole = data?.user.role || user?.role || "client";
  const stats = useMemo(() => ([
    {
      id: "messages",
      icon: MessageCircle,
      label: translate("workflow.stats.messages"),
      value: data?.counts.unreadMessages ?? 0,
    },
    {
      id: "appointments",
      icon: CalendarClock,
      label: translate("workflow.stats.appointments"),
      value: data?.counts.upcomingAppointments ?? 0,
    },
    {
      id: "sessions",
      icon: HeartHandshake,
      label: translate("workflow.stats.active_sessions"),
      value: data?.counts.activePeerSessions ?? 0,
    },
    {
      id: "progress",
      icon: TrendingUp,
      label: translate("workflow.stats.completed_sessions"),
      value: data?.counts.completedPeerSessions ?? 0,
    },
  ]), [
    data?.counts.activePeerSessions,
    data?.counts.completedPeerSessions,
    data?.counts.unreadMessages,
    data?.counts.upcomingAppointments,
    t,
  ]);

  const operationsSummary = useMemo(() => {
    if (activeRole === "listener") {
      return [
        {
          id: "availability",
          label: translate("workflow.listener.status.label"),
          value: data?.listener.isAvailable ? translate("workflow.listener.status.available") : translate("workflow.listener.status.focus"),
        },
        {
          id: "activation",
          label: translate("workflow.listener.activation.label"),
          value: data?.listener.activationStatus ? translate(`workflow.listener.activation.${data.listener.activationStatus}`) : translate("workflow.listener.activation.pending"),
        },
      ];
    }

    if (activeRole === "moderator" || activeRole === "admin") {
      return [
        {
          id: "applications",
          label: translate("workflow.moderation.pending_applications"),
          value: String(data?.moderation.pendingListenerApplications ?? 0),
        },
        {
          id: "reports",
          label: translate("workflow.moderation.open_reports"),
          value: String(data?.moderation.openPeerReports ?? 0),
        },
      ];
    }

    return [
      {
        id: "localization",
        label: translate("workflow.localization.label"),
        value: translate(`workflow.localization.${data?.localizationStatus || "partial"}`),
      },
      {
        id: "home",
        label: translate("workflow.home.label"),
        value: data?.home ? translate(data.home.labelKey) : translate("workflow.home.unavailable"),
      },
    ];
  }, [
    activeRole,
    data?.home,
    data?.listener.activationStatus,
    data?.listener.isAvailable,
    data?.localizationStatus,
    data?.moderation.openPeerReports,
    data?.moderation.pendingListenerApplications,
    t,
  ]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <PageSkeleton variant="dashboard" />
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
          title={translate(data.home?.labelKey) || translate("workflow.page.title")}
          subtitle={translate(data.home?.summaryKey) || translate("workflow.page.subtitle")}
          icon={Compass}
          action={(
            <Badge variant="secondary" className="px-3 py-1">
              {translate(roleBadgeKey[activeRole] || roleBadgeKey.client)}
            </Badge>
          )}
        />

        <motion.div
          className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
          initial="hidden"
          animate="visible"
          variants={safeFadeUp}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{translate("workflow.actions.primary_title")}</CardTitle>
                  <p className="text-sm text-muted-foreground">{translate("workflow.actions.primary_subtitle")}</p>
                </div>
                <Badge className={localizationBadgeClass[data.localizationStatus]}>
                  {translate(`workflow.localization.${data.localizationStatus}`)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.primaryActions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-2xl border bg-background/80 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold">{translate(action.labelKey)}</p>
                    {action.summaryKey && (
                      <p className="text-sm text-muted-foreground">{translate(action.summaryKey)}</p>
                    )}
                  </div>
                  <Link href={action.href}>
                    <Button className="gap-2 min-w-40">
                      {translate("workflow.actions.open")}
                      <Arrow className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{translate("workflow.summary.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {operationsSummary.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
              {data.listener.cooldownEndsAt && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {translate("workflow.listener.cooldown_until")}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {new Date(data.listener.cooldownEndsAt).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <motion.div key={stat.id} initial="hidden" animate="visible" variants={safeFadeUp}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={safeFadeUp}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{translate("workflow.actions.secondary_title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{translate("workflow.actions.secondary_subtitle")}</p>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.secondaryActions.map((action) => (
                <Link key={action.id} href={action.href}>
                  <button
                    type="button"
                    className="w-full rounded-2xl border bg-card p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    data-testid={`workflow-secondary-${action.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{translate(action.labelKey)}</p>
                        {action.summaryKey && (
                          <p className="text-sm text-muted-foreground">{translate(action.summaryKey)}</p>
                        )}
                      </div>
                      {action.href.includes("therapist") ? (
                        <Users className="h-4 w-4 text-primary shrink-0" />
                      ) : action.href.includes("peer") ? (
                        <HeartHandshake className="h-4 w-4 text-primary shrink-0" />
                      ) : action.href.includes("admin") ? (
                        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Compass className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
