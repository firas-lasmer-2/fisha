import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Heart, LayoutDashboard, Users, MessageCircle, Smile, BookOpen,
  Calendar, Library, LogOut, Menu, X, Wind, UserCircle, AlertTriangle,
  HeartHandshake, ShieldCheck, UserPlus,
} from "lucide-react";
import { useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, isRTL } = useI18n();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const baseNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/therapists", icon: Users, label: t("nav.therapists") },
    { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { href: "/appointments", icon: Calendar, label: t("nav.appointments") },
    { href: "/mood", icon: Smile, label: t("nav.mood") },
    { href: "/journal", icon: BookOpen, label: t("nav.journal") },
    { href: "/self-care", icon: Wind, label: t("nav.selfcare") },
    { href: "/resources", icon: Library, label: t("nav.resources") },
    { href: "/peer-support", icon: HeartHandshake, label: tr("nav.peer_support", "Peer Support") },
  ];

  const navItems = [
    ...baseNavItems,
    ...(user?.role === "therapist"
      ? [{ href: "/therapist-dashboard", icon: UserCircle, label: t("therapist_dash.your_page") }]
      : []),
    ...(user?.role === "listener"
      ? [{ href: "/listener/dashboard", icon: UserCircle, label: tr("nav.listener_dashboard", "Listener Dashboard") }]
      : []),
    ...(user?.role === "moderator" || user?.role === "admin"
      ? [{ href: "/admin/listeners", icon: ShieldCheck, label: tr("nav.admin_listeners", "Listener Moderation") }]
      : []),
    ...(user?.role !== "therapist" && user?.role !== "moderator" && user?.role !== "admin"
      ? [{ href: "/listener/apply", icon: UserPlus, label: tr("nav.listener_apply", "Become a Listener") }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b h-14" data-testid="app-header">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2" data-testid="link-app-home">
              <div className="w-8 h-8 rounded-lg gradient-calm flex items-center justify-center">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gradient hidden sm:inline">{t("app.name")}</span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-1" data-testid="nav-desktop">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  data-testid={`nav-link-${item.href.slice(1)}`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <LanguageSwitcher variant="ghost" />
            {user && (
              <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" data-testid="mobile-menu-overlay">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <nav className="absolute top-14 start-0 w-64 bg-card border-e shadow-lg p-4 space-y-1 h-[calc(100vh-3.5rem)] overflow-y-auto">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  className="w-full justify-start gap-3"
                  data-testid={`mobile-nav-${item.href.slice(1)}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="pt-14 min-h-screen">
        {children}
      </main>

      {user && (
        <Link href="/crisis">
          <Button
            className="fixed bottom-6 end-6 z-50 rounded-full h-12 px-4 bg-destructive hover:bg-destructive/90 shadow-lg"
            data-testid="button-sos"
          >
            <AlertTriangle className="h-4 w-4 me-2" />
            SOS
          </Button>
        </Link>
      )}
    </div>
  );
}
