import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/offline-indicator";
import { CommandPalette } from "@/components/command-palette";
import { useRouteFocus } from "@/hooks/use-route-focus";
import { KeyboardHelpModal } from "@/components/keyboard-help-modal";
import { useQuery } from "@tanstack/react-query";
import { fetchNavigationResolution, postAuthRouteForUser } from "@/lib/navigation";
import { RoleGuard } from "@/components/role-guard";
const LandingPage = lazy(() => import("@/pages/landing"));
const AboutPage = lazy(() => import("@/pages/about"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ContactPage = lazy(() => import("@/pages/contact"));
const TherapistsPage = lazy(() => import("@/pages/therapists"));
const MessagesPage = lazy(() => import("@/pages/messages"));
const AppointmentsPage = lazy(() => import("@/pages/appointments"));
const MoodPage = lazy(() => import("@/pages/mood"));
const JournalPage = lazy(() => import("@/pages/journal"));
const ResourcesPage = lazy(() => import("@/pages/resources"));
const SelfCarePage = lazy(() => import("@/pages/self-care"));
const GrowPage = lazy(() => import("@/pages/grow"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const TherapistProfilePage = lazy(() => import("@/pages/therapist-profile"));
const TherapistDashboardPage = lazy(() => import("@/pages/therapist-dashboard"));
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const CrisisPage = lazy(() => import("@/pages/crisis"));
const ListenerApplyPage = lazy(() => import("@/pages/listener-apply"));
const ListenerTestPage = lazy(() => import("@/pages/listener-test"));
const ListenerDashboardPage = lazy(() => import("@/pages/listener-dashboard"));
const ListenerHallOfFamePage = lazy(() => import("@/pages/listener-hall-of-fame"));
const AdminListenersPage = lazy(() => import("@/pages/admin-listeners"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const NotFound = lazy(() => import("@/pages/not-found"));
const TherapistLandingPage = lazy(() => import("@/pages/therapist-landing"));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard"));
const ProgressPage = lazy(() => import("@/pages/progress"));
const SupportPage = lazy(() => import("@/pages/support"));
const PeerSupportPage = lazy(() => import("@/pages/peer-support"));
const WorkflowHubPage = lazy(() => import("@/pages/workflow-hub"));

function effectiveRole(user: { role?: string | null } | null | undefined) {
  return user?.role;
}

function AuthGuard({
  children,
  allowIncompleteOnboarding = false,
}: {
  children: React.ReactNode;
  allowIncompleteOnboarding?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  const role = effectiveRole(user);
  const requiresOnboarding = role === "client";
  if (!allowIncompleteOnboarding && requiresOnboarding && !user.onboardingCompleted) {
    navigate("/onboarding");
    return null;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    navigate(postAuthRouteForUser(user));
    return null;
  }

  return <>{children}</>;
}

function DashboardRoute() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;

  navigate(postAuthRouteForUser(user));
  return null;
}

function LegacyRedirectRoute({ path }: { path: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data } = useQuery({
    queryKey: ["/api/navigation/resolve", path, user?.role || "visitor"],
    queryFn: () => fetchNavigationResolution(path, (user?.role as any) || "visitor"),
  });

  if (data?.status === "redirect" && data.targetPath) {
    navigate(data.targetPath);
    return null;
  }

  return <NotFound />;
}

function Router() {
  const [location] = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  useRouteFocus();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
        exit={reducedMotion ? {} : { opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
        <Switch location={location}>
          <Route path="/" component={LandingPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/login">
            <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
          </Route>
          <Route path="/signup">
            <PublicOnlyRoute><SignupPage /></PublicOnlyRoute>
          </Route>
          <Route path="/forgot-password">
            <PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>
          </Route>
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/onboarding">
            <AuthGuard allowIncompleteOnboarding><OnboardingPage /></AuthGuard>
          </Route>
          <Route path="/welcome">
            <AuthGuard><WelcomePage /></AuthGuard>
          </Route>
          <Route path="/crisis">
            <AuthGuard allowIncompleteOnboarding><CrisisPage /></AuthGuard>
          </Route>
          <Route path="/listen">
            <AuthGuard><PeerSupportPage /></AuthGuard>
          </Route>
          <Route path="/peer-support">
            <AuthGuard><PeerSupportPage /></AuthGuard>
          </Route>
          <Route path="/listener/test">
            <AuthGuard allowIncompleteOnboarding><ListenerTestPage /></AuthGuard>
          </Route>
          <Route path="/listener/apply">
            <AuthGuard allowIncompleteOnboarding><ListenerApplyPage /></AuthGuard>
          </Route>
          <Route path="/listener/dashboard">
            <AuthGuard><RoleGuard roles={["listener"]}><ListenerDashboardPage /></RoleGuard></AuthGuard>
          </Route>
          <Route path="/hall-of-fame" component={ListenerHallOfFamePage} />
          <Route path="/admin/listeners">
            <AuthGuard><RoleGuard roles={["admin", "moderator"]}><AdminListenersPage /></RoleGuard></AuthGuard>
          </Route>
          <Route path="/support" component={SupportPage} />
          <Route path="/workflow">
            <AuthGuard><WorkflowHubPage /></AuthGuard>
          </Route>
          <Route path="/therapists" component={TherapistsPage} />
          <Route path="/resources" component={ResourcesPage} />
          <Route path="/self-care" component={SelfCarePage} />
          <Route path="/grow">
            <AuthGuard><GrowPage /></AuthGuard>
          </Route>
          <Route path="/settings">
            <AuthGuard><SettingsPage /></AuthGuard>
          </Route>
          <Route path="/therapist/:userId" component={TherapistProfilePage} />
          <Route path="/therapist-dashboard">
            <AuthGuard><RoleGuard roles={["therapist"]}><TherapistDashboardPage /></RoleGuard></AuthGuard>
          </Route>
          <Route path="/p/:slug" component={TherapistLandingPage} />
          <Route path="/admin/dashboard">
            <AuthGuard><RoleGuard roles={["admin", "moderator"]}><AdminDashboardPage /></RoleGuard></AuthGuard>
          </Route>
          <Route path="/progress">
            <AuthGuard><ProgressPage /></AuthGuard>
          </Route>
          <Route path="/dashboard">
            <AuthGuard><DashboardRoute /></AuthGuard>
          </Route>
          <Route path="/home">
            <LegacyRedirectRoute path="/home" />
          </Route>
          <Route path="/start">
            <LegacyRedirectRoute path="/start" />
          </Route>
          <Route path="/listener">
            <LegacyRedirectRoute path="/listener" />
          </Route>
          <Route path="/admin">
            <LegacyRedirectRoute path="/admin" />
          </Route>
          <Route path="/messages">
            <AuthGuard><MessagesPage /></AuthGuard>
          </Route>
          <Route path="/appointments">
            <AuthGuard><AppointmentsPage /></AuthGuard>
          </Route>
          <Route path="/mood">
            <AuthGuard><MoodPage /></AuthGuard>
          </Route>
          <Route path="/journal">
            <AuthGuard><JournalPage /></AuthGuard>
          </Route>
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <OfflineIndicator />
            <CommandPalette />
            <KeyboardHelpModal />
            <Router />
          </TooltipProvider>
        </ErrorBoundary>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
