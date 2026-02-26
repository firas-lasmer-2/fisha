import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { triggerHaptic } from "@/lib/haptics";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Heart, LayoutDashboard, Users, MessageCircle, Smile, BookOpen,
  Calendar, Library, LogOut, Wind, UserCircle, AlertCircle,
  HeartHandshake, ShieldCheck, UserPlus, Sparkles,
} from "lucide-react";

function homeHrefForRole(role: string | null | undefined): string {
  if (role === "listener") return "/listener/dashboard";
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "moderator" || role === "admin") return "/admin/listeners";
  return "/dashboard";
}

function profileHrefForRole(role: string | null | undefined): string {
  if (role === "therapist") return "/therapist-dashboard";
  if (role === "listener") return "/listener/dashboard";
  if (role === "moderator" || role === "admin") return "/admin/listeners";
  return "/settings";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const desktopNavItems = [
    { href: "/listen", icon: HeartHandshake, label: tr("nav.peer_support", "Peer Support") },
    { href: "/therapists", icon: Users, label: t("nav.therapists") },
    { href: "/appointments", icon: Calendar, label: t("nav.appointments") },
    { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/grow", icon: Sparkles, label: tr("nav.grow", "Grow") },
    { href: "/mood", icon: Smile, label: t("nav.mood") },
    { href: "/journal", icon: BookOpen, label: t("nav.journal") },
    { href: "/self-care", icon: Wind, label: t("nav.selfcare") },
    { href: "/resources", icon: Library, label: t("nav.resources") },
    ...(user?.role === "therapist"
      ? [{ href: "/therapist-dashboard", icon: UserCircle, label: t("therapist_dash.your_page") }]
      : []),
    ...(user?.role === "listener"
      ? [{ href: "/listener/dashboard", icon: UserCircle, label: tr("nav.listener_dashboard", "Listener Dashboard") }]
      : []),
    ...(user?.role === "moderator" || user?.role === "admin"
      ? [{ href: "/admin/listeners", icon: ShieldCheck, label: tr("nav.admin_listeners", "Listener Moderation") }]
      : []),
    ...(user?.role === "client"
      ? [{ href: "/listener/apply", icon: UserPlus, label: tr("nav.listener_apply", "Become a Listener") }]
      : []),
  ];

  const homeHref = homeHrefForRole(user?.role);
  const profileHref = profileHrefForRole(user?.role);

  const bottomNavItems = [
    {
      key: "home",
      href: homeHref,
      icon: LayoutDashboard,
      label: t("nav.home"),
      active: location === homeHref || location === "/dashboard",
    },
    {
      key: "listen",
      href: "/listen",
      icon: HeartHandshake,
      label: tr("nav.listen", "Listen"),
      active: location.startsWith("/listen") || location.startsWith("/peer-support"),
    },
    {
      key: "therapists",
      href: "/therapists",
      icon: Users,
      label: t("nav.therapists"),
      active: location.startsWith("/therapists") || location.startsWith("/therapist/"),
    },
    {
      key: "wellness",
      href: "/self-care",
      icon: Wind,
      label: tr("nav.wellness", "Wellness"),
      active: ["/self-care", "/mood", "/journal", "/resources"].some((path) => location.startsWith(path)),
    },
    {
      key: "profile",
      href: profileHref,
      icon: UserCircle,
      label: t("nav.profile"),
      active: ["/settings", "/listener/dashboard", "/therapist-dashboard", "/admin/listeners"].some((path) => location.startsWith(path)),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b h-14" data-testid="app-header">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" data-testid="link-app-home">
            <div className="w-8 h-8 rounded-lg gradient-calm flex items-center justify-center">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gradient">{t("app.name")}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" data-testid="nav-desktop">
            {desktopNavItems.map((item) => (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  triggerHaptic("selection");
                  logout();
                }}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="pt-14 min-h-screen pb-20 md:pb-0">
        {children}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        data-testid="bottom-nav"
      >
        <div className="grid grid-cols-5 gap-1 px-2 py-1">
          {bottomNavItems.map((item) => (
            <Link key={item.key} href={item.href}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                }}
                className={`w-full rounded-lg py-1.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
                  item.active ? "text-primary bg-primary/10" : "text-muted-foreground"
                }`}
                data-testid={`bottom-nav-${item.key}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="leading-none">{item.label}</span>
              </button>
            </Link>
          ))}
        </div>
      </nav>

      {user && (
        <Link href="/crisis">
          <Button
            variant="outline"
            onClick={() => {
              triggerHaptic("medium");
            }}
            className="fixed bottom-24 md:bottom-6 end-4 md:end-6 z-50 rounded-full h-11 px-4 border-destructive/30 text-destructive bg-background/95 backdrop-blur shadow-lg hover:bg-destructive hover:text-destructive-foreground active:bg-destructive active:text-destructive-foreground"
            data-testid="button-sos"
          >
            <AlertCircle className="h-4 w-4 me-2" />
            {tr("nav.support", "Support")}
          </Button>
        </Link>
      )}
    </div>
  );
}
