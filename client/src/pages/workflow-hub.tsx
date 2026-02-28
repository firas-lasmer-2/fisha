import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { fadeUp, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PageError } from "@/components/page-error";
import { PageSkeleton } from "@/components/page-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  HeartHandshake,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

type WorkflowOverviewPayload = {
  user: {
    id: string;
    role: string;
  };
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
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
  }>;
};

type QuickAction = {
  label: string;
  desc: string;
  href: string;
};

const roleText: Record<string, string> = {
  client: "Client",
  listener: "Listener",
  therapist: "Therapist",
  moderator: "Moderator",
  admin: "Admin",
};

export default function WorkflowHubPage() {
  const { user } = useAuth();
  const fallbackRole = user?.role || "client";
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);

  const { data, isLoading, isError, error, refetch } = useQuery<WorkflowOverviewPayload>({
    queryKey: ["/api/workflow/overview"],
  });

  const activeRole = data?.user?.role || fallbackRole;
  const counts = data?.counts || {
    unreadMessages: 0,
    upcomingAppointments: 0,
    activePeerSessions: 0,
    completedPeerSessions: 0,
  };

  const clientListenerFlowProgress = useMemo(() => {
    if (counts.completedPeerSessions > 0) return 100;
    if (counts.activePeerSessions > 0) return 75;
    if (activeRole === "listener" && data?.listener?.isAvailable) return 50;
    return 25;
  }, [activeRole, counts.activePeerSessions, counts.completedPeerSessions, data?.listener?.isAvailable]);

  const totalActivity =
    counts.unreadMessages +
    counts.upcomingAppointments +
    counts.activePeerSessions +
    counts.completedPeerSessions;

  const isNewUser = totalActivity === 0;

  type FirstStep = { label: string; desc: string; href: string };

  const firstSteps = useMemo<FirstStep[] | null>(() => {
    if (!isNewUser) return null;
    if (activeRole === "client") {
      return [
        { label: "Take the support quiz", desc: "Find out which path fits you best", href: "/support" },
        { label: "Talk to a peer listener", desc: "Free, anonymous, no appointment needed", href: "/peer-support" },
        { label: "Track your mood", desc: "Start your wellness journey", href: "/mood" },
      ];
    }
    if (activeRole === "therapist") {
      return [
        { label: "Complete your profile", desc: "Add bio, specializations, and rates", href: "/therapist-dashboard" },
        { label: "Upload your credentials", desc: "Get verified to appear in search", href: "/therapist-dashboard" },
        { label: "Set your availability", desc: "Open your first appointment slots", href: "/therapist-dashboard" },
      ];
    }
    if (activeRole === "listener" && (data?.listener?.applicationStatus === null || data?.listener?.applicationStatus === undefined)) {
      return [
        { label: "Apply to become a listener", desc: "Takes 5 minutes to apply", href: "/listener/apply" },
        { label: "Pass the qualification test", desc: "10 questions on empathic listening", href: "/listener/test" },
        { label: "Set yourself available", desc: "Start accepting peer sessions", href: "/listener/dashboard" },
      ];
    }
    return null;
  }, [isNewUser, activeRole, data?.listener?.applicationStatus]);

  const roleQuickActions = useMemo<QuickAction[]>(() => {
    if (activeRole === "listener") {
      return [
        { label: "Listener dashboard", desc: "Availability, badges, cooldown, and rank", href: "/listener/dashboard" },
        { label: "Peer support workspace", desc: "Join sessions and chat with clients", href: "/peer-support" },
        { label: "Hall of Fame", desc: "Season rankings and certificates", href: "/hall-of-fame" },
      ];
    }
    if (activeRole === "therapist") {
      return [
        { label: "Therapist dashboard", desc: "Manage slots, profile, and sessions", href: "/therapist-dashboard" },
        { label: "Appointments", desc: "Review upcoming session schedule", href: "/appointments" },
        { label: "Messages", desc: "Follow up with clients", href: "/messages" },
      ];
    }
    if (activeRole === "moderator" || activeRole === "admin") {
      return [
        { label: "Listener moderation", desc: "Review applications and risk reports", href: "/admin/listeners" },
        { label: "Admin dashboard", desc: "Platform operations overview", href: "/admin/dashboard" },
        { label: "Hall of Fame", desc: "Public quality and recognition board", href: "/hall-of-fame" },
      ];
    }
    return [
      { label: "Guided support", desc: "Find the right path in under a minute", href: "/support" },
      { label: "Peer listeners", desc: "Start a free confidential conversation", href: "/peer-support" },
      { label: "Therapists", desc: "Book structured professional support", href: "/therapists" },
    ];
  }, [activeRole]);

  if (isError) return <AppLayout><div className="max-w-6xl mx-auto p-4 sm:p-6"><PageError error={error as Error} resetFn={refetch} /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        <PageHeader title={t("nav.home")} />
        <motion.div custom={0} initial="hidden" animate="visible" variants={safeFadeUp}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workflow Center</p>
                  <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
                    <Compass className="h-5 w-5 text-primary" />
                    {user?.firstName ? `Hello, ${user.firstName}` : "Your dashboard"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Signed in as <span className="font-medium text-foreground">
                      <Badge variant="default">{roleText[activeRole] || activeRole}</Badge>
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Unread messages", value: counts.unreadMessages, icon: MessageCircle },
            { label: "Upcoming appointments", value: counts.upcomingAppointments, icon: Stethoscope },
            { label: "Active peer sessions", value: counts.activePeerSessions, icon: HeartHandshake },
            { label: "Completed peer sessions", value: counts.completedPeerSessions, icon: CheckCircle2 },
          ].map((item, idx) => (
            <motion.div key={item.label} custom={idx + 1} initial="hidden" animate="visible" variants={safeFadeUp}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {firstSteps && (
          <motion.div custom={5} initial="hidden" animate="visible" variants={safeFadeUp}>
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                First steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {firstSteps.map((step, idx) => (
                <div key={step.href + step.label} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                  <Link href={step.href}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      Go
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
          </motion.div>
        )}

        <motion.div custom={6} initial="hidden" animate="visible" variants={safeFadeUp}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Recommended next actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <PageSkeleton variant="list" count={2} />
              ) : (data?.recommendations || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No urgent actions. You are up to date.</p>
              ) : (
                (data?.recommendations || []).map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Link href={item.href}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Client ↔ Listener journey
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${clientListenerFlowProgress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  "1. Client chooses support",
                  "2. Listener goes available",
                  "3. Session starts and chat runs",
                  "4. Session feedback + recovery",
                ].map((step, idx) => (
                  <div key={step} className="rounded-md border bg-muted/30 p-2">
                    <p className="font-medium">{step}</p>
                    <p className="text-muted-foreground mt-1">
                      {idx === 1 && data?.listener?.cooldownEndsAt ? "Cooldown active" : "Ready"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                This shared workflow reduces friction: client triage, listener availability, live chat, and safe cooldown.
              </div>
            </CardContent>
          </Card>
        </div>
        </motion.div>

        <motion.div custom={7} initial="hidden" animate="visible" variants={safeFadeUp}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Role workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {roleQuickActions.map((action) => (
              <Link key={action.href + action.label} href={action.href}>
                <button
                  type="button"
                  className="w-full text-start rounded-lg border p-3 hover:bg-muted/50 hover:border-primary/30 transition-all hover:shadow-sm"
                >
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
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
