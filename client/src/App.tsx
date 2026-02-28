import { Switch, Route, useLocation } from "wouter";
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
import LandingPage from "@/pages/landing";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import ContactPage from "@/pages/contact";
import DashboardPage from "@/pages/dashboard";
import TherapistsPage from "@/pages/therapists";
import MessagesPage from "@/pages/messages";
import AppointmentsPage from "@/pages/appointments";
import MoodPage from "@/pages/mood";
import JournalPage from "@/pages/journal";
import ResourcesPage from "@/pages/resources";
import SelfCarePage from "@/pages/self-care";
import GrowPage from "@/pages/grow";
import SettingsPage from "@/pages/settings";
import TherapistProfilePage from "@/pages/therapist-profile";
import TherapistDashboardPage from "@/pages/therapist-dashboard";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import OnboardingPage from "@/pages/onboarding";
import CrisisPage from "@/pages/crisis";
import ListenPage from "@/pages/listen";
import ListenerApplyPage from "@/pages/listener-apply";
import ListenerTestPage from "@/pages/listener-test";
import ListenerDashboardPage from "@/pages/listener-dashboard";
import ListenerHallOfFamePage from "@/pages/listener-hall-of-fame";
import AdminListenersPage from "@/pages/admin-listeners";
import WelcomePage from "@/pages/welcome";
import NotFound from "@/pages/not-found";
import TherapistLandingPage from "@/pages/therapist-landing";
import AdminDashboardPage from "@/pages/admin-dashboard";
import ProgressPage from "@/pages/progress";
import SupportPage from "@/pages/support";
import PeerSupportPage from "@/pages/peer-support";
import WorkflowHubPage from "@/pages/workflow-hub";

function homeRouteForRole(role: string | null | undefined) {
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "listener") return "/listener/dashboard";
  return "/workflow";
}

function effectiveRole(user: { role?: string | null } | null | undefined) {
  return user?.role;
}

function shouldShowWelcome() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("shifa-show-welcome") === "1";
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
    const role = effectiveRole(user);
    const isClient = role === "client";
    const target = isClient && !user.onboardingCompleted
      ? "/onboarding"
      : shouldShowWelcome() && isClient
        ? "/welcome"
      : homeRouteForRole(role);
    navigate(target);
    return null;
  }

  return <>{children}</>;
}

function DashboardRoute() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;

  const role = effectiveRole(user);

  if (role === "client" && shouldShowWelcome()) {
    navigate("/welcome");
    return null;
  }

  navigate(homeRouteForRole(role));
  return null;
}

function Router() {
  const [location] = useLocation();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
        exit={reducedMotion ? {} : { opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
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
            <AuthGuard><ListenPage /></AuthGuard>
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
            <AuthGuard><ListenerDashboardPage /></AuthGuard>
          </Route>
          <Route path="/hall-of-fame" component={ListenerHallOfFamePage} />
          <Route path="/admin/listeners">
            <AuthGuard><AdminListenersPage /></AuthGuard>
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
            <AuthGuard><TherapistDashboardPage /></AuthGuard>
          </Route>
          <Route path="/p/:slug" component={TherapistLandingPage} />
          <Route path="/admin/dashboard">
            <AuthGuard><AdminDashboardPage /></AuthGuard>
          </Route>
          <Route path="/progress">
            <AuthGuard><ProgressPage /></AuthGuard>
          </Route>
          <Route path="/dashboard">
            <AuthGuard><DashboardRoute /></AuthGuard>
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
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <OfflineIndicator />
            <Router />
          </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
