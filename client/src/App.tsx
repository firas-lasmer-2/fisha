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
import NotFound from "@/pages/not-found";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/api/login";
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
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
