import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import TherapistsPage from "@/pages/therapists";
import MessagesPage from "@/pages/messages";
import AppointmentsPage from "@/pages/appointments";
import MoodPage from "@/pages/mood";
import JournalPage from "@/pages/journal";
import ResourcesPage from "@/pages/resources";
import SelfCarePage from "@/pages/self-care";
import TherapistProfilePage from "@/pages/therapist-profile";
import TherapistDashboardPage from "@/pages/therapist-dashboard";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import OnboardingPage from "@/pages/onboarding";
import CrisisPage from "@/pages/crisis";
import PeerSupportPage from "@/pages/peer-support";
import ListenerApplyPage from "@/pages/listener-apply";
import ListenerDashboardPage from "@/pages/listener-dashboard";
import AdminListenersPage from "@/pages/admin-listeners";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";

function AuthGuard({
  children,
  allowIncompleteOnboarding = false,
}: {
  children: React.ReactNode;
  allowIncompleteOnboarding?: boolean;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (!allowIncompleteOnboarding && !user.onboardingCompleted) {
    window.location.href = "/onboarding";
    return null;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    window.location.href = user.onboardingCompleted ? "/dashboard" : "/onboarding";
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
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
      <Route path="/crisis">
        <AuthGuard allowIncompleteOnboarding><CrisisPage /></AuthGuard>
      </Route>
      <Route path="/peer-support">
        <AuthGuard><PeerSupportPage /></AuthGuard>
      </Route>
      <Route path="/listener/apply">
        <AuthGuard allowIncompleteOnboarding><ListenerApplyPage /></AuthGuard>
      </Route>
      <Route path="/listener/dashboard">
        <AuthGuard><ListenerDashboardPage /></AuthGuard>
      </Route>
      <Route path="/admin/listeners">
        <AuthGuard><AdminListenersPage /></AuthGuard>
      </Route>
      <Route path="/pricing">
        <AuthGuard allowIncompleteOnboarding><PricingPage /></AuthGuard>
      </Route>
      <Route path="/therapists" component={TherapistsPage} />
      <Route path="/resources" component={ResourcesPage} />
      <Route path="/self-care" component={SelfCarePage} />
      <Route path="/therapist/:userId" component={TherapistProfilePage} />
      <Route path="/therapist-dashboard">
        <AuthGuard><TherapistDashboardPage /></AuthGuard>
      </Route>
      <Route path="/dashboard">
        <AuthGuard><DashboardPage /></AuthGuard>
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
