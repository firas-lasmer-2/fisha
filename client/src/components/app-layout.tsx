import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useNavigationManifest } from "@/hooks/use-navigation-manifest";
import { triggerHaptic } from "@/lib/haptics";
import {
  canonicalHomeRouteForRole,
  normalizeNavigationPath,
} from "@/lib/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FeatureHint } from "@/components/feature-hint";
import { CommandPaletteTrigger } from "@/components/command-palette";
import { ContrastToggle } from "@/components/contrast-toggle";
import type { LucideIcon } from "lucide-react";
import {
  Heart, HeartHandshake, LayoutDashboard, Users, MessageCircle,
  CalendarDays, LogOut, UserCircle, AlertCircle,
  ShieldCheck, Settings, LifeBuoy, Trophy, Compass, TrendingUp,
} from "lucide-react";
import type { NavigationManifestEntry } from "@shared/schema";

type DisplayNavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge: boolean;
};

function iconForEntry(entry: NavigationManifestEntry): LucideIcon {
  const href = normalizeNavigationPath(entry.href);
  if (href === "/support") return LifeBuoy;
  if (href === "/workflow") return Compass;
  if (href === "/appointments") return CalendarDays;
  if (href === "/messages") return MessageCircle;
  if (href === "/progress") return TrendingUp;
  if (href === "/therapists") return Users;
  if (href === "/listener/dashboard") return LayoutDashboard;
  if (href === "/peer-support") return HeartHandshake;
  if (href === "/hall-of-fame") return Trophy;
  if (href === "/admin/listeners") return ShieldCheck;
  if (href === "/admin/dashboard") return LayoutDashboard;
  if (href === "/resources") return Compass;
  return LayoutDashboard;
}

function isActivePath(currentPath: string, href: string): boolean {
  const current = normalizeNavigationPath(currentPath);
  const target = normalizeNavigationPath(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

function fallbackEntriesForRole(role: string | null | undefined) {
  if (role === "therapist") {
    return [
      { featureKey: "therapist-nav-dashboard", href: "/therapist-dashboard", labelKey: "nav.my_dashboard" },
      { featureKey: "therapist-nav-appointments", href: "/appointments", labelKey: "nav.appointments" },
      { featureKey: "therapist-nav-messages", href: "/messages", labelKey: "nav.messages" },
    ];
  }

  if (role === "listener") {
    return [
      { featureKey: "listener-nav-dashboard", href: "/listener/dashboard", labelKey: "nav.my_dashboard" },
      { featureKey: "listener-nav-peer", href: "/peer-support", labelKey: "nav.peer_sessions" },
      { featureKey: "listener-nav-messages", href: "/messages", labelKey: "nav.messages" },
    ];
  }

  if (role === "moderator") {
    return [
      { featureKey: "moderator-nav-moderation", href: "/admin/listeners", labelKey: "nav.moderation" },
      { featureKey: "moderator-nav-messages", href: "/messages", labelKey: "nav.messages" },
    ];
  }

  if (role === "admin") {
    return [
      { featureKey: "admin-nav-dashboard", href: "/admin/dashboard", labelKey: "nav.admin_dashboard" },
      { featureKey: "admin-nav-moderation", href: "/admin/listeners", labelKey: "nav.admin_listeners" },
      { featureKey: "admin-nav-messages", href: "/messages", labelKey: "nav.messages" },
    ];
  }

  if (role === "client") {
    return [
      { featureKey: "client-nav-support", href: "/support", labelKey: "nav.support_hub" },
      { featureKey: "client-nav-appointments", href: "/appointments", labelKey: "nav.appointments" },
      { featureKey: "client-nav-messages", href: "/messages", labelKey: "nav.messages" },
      { featureKey: "client-nav-progress", href: "/progress", labelKey: "nav.progress" },
    ];
  }

  return [
    { featureKey: "guest-nav-support", href: "/support", labelKey: "nav.support_hub" },
    { featureKey: "guest-nav-therapists", href: "/therapists", labelKey: "nav.therapists" },
    { featureKey: "guest-nav-resources", href: "/resources", labelKey: "nav.resources" },
  ];
}


export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const currentRole = user?.role || null;
  const navRoutePath = user ? canonicalHomeRouteForRole(currentRole) : "/";

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/unread-count"],
    enabled: !!user,
  });

  const { primaryPaths, secondaryPaths } = useNavigationManifest({
    surface: "nav",
    role: (currentRole as any) || "visitor",
    routePath: navRoutePath,
  });

  const translateLabel = (key: string) => {
    const value = t(key);
    return value === key ? key : value;
  };
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const manifestEntries = [...primaryPaths, ...secondaryPaths];
  const rawNavItems = (manifestEntries.length > 0
    ? manifestEntries
    : fallbackEntriesForRole(currentRole).map((entry) => ({
        ...entry,
        id: entry.featureKey,
        summaryKey: null,
        goalKey: entry.featureKey,
        status: "primary",
      })))
    .map((entry) => ({
      key: entry.featureKey,
      href: entry.href,
      icon: iconForEntry(entry as NavigationManifestEntry),
      label: translateLabel(entry.labelKey),
      active: isActivePath(location, entry.href),
      badge: entry.href === "/messages" && (unread?.count ?? 0) > 0,
    }));

  const desktopNavItems = rawNavItems;
  const bottomNavItems: DisplayNavItem[] = user
    ? [
        ...rawNavItems.slice(0, 4),
        {
          key: "settings",
          href: "/settings",
          icon: UserCircle,
          label: translateLabel("nav.profile"),
          active: isActivePath(location, "/settings"),
          badge: false,
        },
      ].slice(0, 5)
    : rawNavItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* Skip-to-content link — visible only on focus (keyboard users / screen readers) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-[60] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
      >
        {tr("a11y.skip_to_content", "Skip to main content")}
      </a>

      <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b h-14" data-testid="app-header">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <Link
            href={user ? canonicalHomeRouteForRole(currentRole) : "/"}
            className="flex items-center gap-2"
            data-testid="link-app-home"
          >
            <div className="w-8 h-8 rounded-lg gradient-calm flex items-center justify-center">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gradient">{t("app.name")}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label={tr("a11y.main_nav", "Main navigation")} data-testid="nav-desktop">
            {desktopNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5 text-xs"
                  data-testid={`nav-link-${item.key}`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <CommandPaletteTrigger />
            <ThemeToggle />
            <ContrastToggle />
            <LanguageSwitcher variant="ghost" />
            {user && <NotificationBell />}
            {user && (
              <Link href="/settings">
                <Button
                  variant={location.startsWith("/settings") ? "secondary" : "ghost"}
                  size="sm"
                  data-testid="nav-link-settings"
                  className="gap-1.5 text-xs hidden lg:flex"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {t("nav.settings")}
                </Button>
              </Link>
            )}
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

      <main id="main-content" className="pt-14 min-h-screen pb-20 md:pb-0">
        {user && <AnnouncementBanner />}
        {children}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        aria-label={tr("a11y.main_nav", "Main navigation")}
        data-testid="bottom-nav"
      >
        <div
          className="grid gap-1 px-2 py-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(bottomNavItems.length, 1)}, minmax(0, 1fr))` }}
        >
          {bottomNavItems.map((item) => (
            <Link key={item.key} href={item.href}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                }}
                aria-label={item.label}
                aria-current={item.active ? "page" : undefined}
                className={`w-full rounded-lg py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] ${
                  item.active ? "text-primary bg-primary/20 font-medium" : "text-muted-foreground"
                }`}
                data-testid={`bottom-nav-${item.key}`}
              >
                <span className="relative">
                  <item.icon className="h-4 w-4" />
                  {item.badge && (
                    <span className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </span>
                <span className="leading-none">{item.label}</span>
              </button>
            </Link>
          ))}
        </div>
      </nav>

      {user && (
        <FeatureHint id="sos-button" content={t("hint.sos_button")} side="top">
          <Link href="/crisis">
            <Button
              variant="outline"
              onClick={() => {
                triggerHaptic("medium");
              }}
              aria-label={tr("a11y.sos_crisis", "SOS — Crisis support")}
              className="fixed bottom-24 md:bottom-6 end-4 md:end-6 z-50 rounded-full h-11 px-4 border-destructive/30 text-destructive bg-background/95 backdrop-blur shadow-lg hover:bg-destructive hover:text-destructive-foreground active:bg-destructive active:text-destructive-foreground"
              data-testid="button-sos"
            >
              <AlertCircle className="h-4 w-4 me-2" />
              SOS
            </Button>
          </Link>
        </FeatureHint>
      )}
    </div>
  );
}
