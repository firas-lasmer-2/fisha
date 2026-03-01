import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { getRecentSearches, pushRecentSearch, clearRecentSearches } from "@/lib/recent-searches";
import type { TherapistProfile, Resource, User } from "@shared/schema";
import {
  Search, Clock, Users, BookOpen, Compass, LayoutDashboard,
  MessageCircle, Calendar, TrendingUp, Settings, Heart,
  HeartHandshake, Trophy, ShieldCheck, LifeBuoy, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchResults, type SearchResultItem } from "@/components/search-results";

// ---- Keyboard shortcut registration ----

let globalOpenHandler: (() => void) | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      globalOpenHandler?.();
    }
  });
}

// ---- Nav items per role ----

function navItemsForRole(role: string | null | undefined) {
  if (role === "therapist") {
    return [
      { href: "/therapist-dashboard", icon: LayoutDashboard, label: "My Dashboard" },
      { href: "/appointments", icon: Calendar, label: "Appointments" },
      { href: "/messages", icon: MessageCircle, label: "Messages" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ];
  }
  if (role === "listener") {
    return [
      { href: "/listener/dashboard", icon: LayoutDashboard, label: "My Dashboard" },
      { href: "/peer-support", icon: HeartHandshake, label: "Peer Sessions" },
      { href: "/hall-of-fame", icon: Trophy, label: "Hall of Fame" },
      { href: "/messages", icon: MessageCircle, label: "Messages" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ];
  }
  if (role === "moderator" || role === "admin") {
    return [
      { href: "/admin/listeners", icon: ShieldCheck, label: "Listener Moderation" },
      { href: "/admin/dashboard", icon: LayoutDashboard, label: "Admin Dashboard" },
      { href: "/messages", icon: MessageCircle, label: "Messages" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ];
  }
  // client / guest
  return [
    { href: "/workflow", icon: Compass, label: "Home" },
    { href: "/support", icon: LifeBuoy, label: "Find Support" },
    { href: "/therapists", icon: Users, label: "Therapists" },
    { href: "/appointments", icon: Calendar, label: "Appointments" },
    { href: "/messages", icon: MessageCircle, label: "Messages" },
    { href: "/progress", icon: TrendingUp, label: "Progress" },
    { href: "/mood", icon: Heart, label: "Mood" },
    { href: "/resources", icon: BookOpen, label: "Resources" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];
}

// ---- Component ----

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Register global open handler
  useEffect(() => {
    globalOpenHandler = () => setOpen((v) => !v);
    return () => {
      globalOpenHandler = null;
    };
  }, []);

  // Load recent searches when opening
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  }, []);

  // Therapist search — enabled when query length >= 2
  const { data: therapists } = useQuery<(TherapistProfile & { user: User })[]>({
    queryKey: ["/api/therapists", { search: debouncedQuery }],
    queryFn: async () => {
      const url = debouncedQuery.length >= 2
        ? `/api/therapists?search=${encodeURIComponent(debouncedQuery)}`
        : "/api/therapists";
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Resources — use cached list, client-side filter
  const { data: allResources } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
    enabled: open,
    staleTime: 60_000,
  });

  const navItems = navItemsForRole(user?.role);

  const filteredNavItems = query.length === 0
    ? navItems
    : navItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );

  const filteredTherapists = (therapists ?? [])
    .filter((tp) => {
      if (query.length < 2) return false;
      const name = [tp.user?.firstName, tp.user?.lastName].filter(Boolean).join(" ").toLowerCase();
      const headline = (tp.headline ?? "").toLowerCase();
      const q = query.toLowerCase();
      return name.includes(q) || headline.includes(q) || (tp.specializations ?? []).some((s) => s.toLowerCase().includes(q));
    })
    .slice(0, 5);

  const filteredResources = (allResources ?? [])
    .filter((r) => {
      if (query.length < 2) return false;
      const q = query.toLowerCase();
      return r.titleAr.toLowerCase().includes(q) || r.titleFr.toLowerCase().includes(q);
    })
    .slice(0, 4);

  const handleSelect = useCallback(
    (href: string, saveQuery?: string) => {
      if (saveQuery && saveQuery.trim().length >= 2) {
        pushRecentSearch(saveQuery.trim());
      }
      setOpen(false);
      setQuery("");
      setDebouncedQuery("");
      navigate(href);
    },
    [navigate]
  );

  const handleClearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentSearches();
    setRecentSearches([]);
  };

  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showTherapists = filteredTherapists.length > 0;
  const showResources = filteredResources.length > 0;
  const hasResults = filteredNavItems.length > 0 || showTherapists || showResources;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={isRTL ? "ابحث أو انتقل إلى..." : "Search or navigate to..."}
        value={query}
        onValueChange={handleQueryChange}
        dir={isRTL ? "rtl" : "ltr"}
      />
      <CommandList>
        {/* Recent searches (shown only when input is empty) */}
        {showRecent && (
          <CommandGroup
            heading={
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {isRTL ? "بحث سابق" : "Recent"}
                </span>
                <button
                  onClick={handleClearRecent}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isRTL ? "مسح السجل" : "Clear recent"}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            }
          >
            {recentSearches.map((term) => (
              <CommandItem
                key={term}
                value={`recent-${term}`}
                onSelect={() => handleQueryChange(term)}
                className="gap-2"
              >
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{term}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        {filteredNavItems.length > 0 && (
          <CommandGroup heading={isRTL ? "التنقل" : "Navigation"}>
            {filteredNavItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`nav-${item.href}-${item.label}`}
                onSelect={() => handleSelect(item.href)}
                className="gap-2"
              >
                <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Therapists */}
        {showTherapists && (
          <>
            <CommandSeparator />
            <CommandGroup heading={isRTL ? "المعالجون" : "Therapists"}>
              {filteredTherapists.map((tp) => {
                const name = [tp.user?.firstName, tp.user?.lastName].filter(Boolean).join(" ") || "—";
                return (
                  <CommandItem
                    key={tp.userId}
                    value={`therapist-${tp.userId}-${name}`}
                    onSelect={() => handleSelect(`/therapist/${tp.userId}`, query)}
                    className="p-0"
                  >
                    <SearchResults
                      items={[{ type: "therapist", data: tp } satisfies SearchResultItem]}
                      mode="compact"
                      isRTL={isRTL}
                      onSelect={() => handleSelect(`/therapist/${tp.userId}`, query)}
                      className="w-full"
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Resources */}
        {showResources && (
          <>
            <CommandSeparator />
            <CommandGroup heading={isRTL ? "المقالات" : "Resources"}>
              {filteredResources.map((r) => {
                const title = isRTL ? r.titleAr : r.titleFr;
                return (
                  <CommandItem
                    key={r.id}
                    value={`resource-${r.id}-${title}`}
                    onSelect={() => handleSelect("/resources", query)}
                    className="p-0"
                  >
                    <SearchResults
                      items={[{ type: "resource", data: r } satisfies SearchResultItem]}
                      mode="compact"
                      isRTL={isRTL}
                      onSelect={() => handleSelect("/resources", query)}
                      className="w-full"
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Empty state */}
        {!hasResults && !showRecent && (
          <CommandEmpty>
            {isRTL ? "لا توجد نتائج." : "No results found."}
          </CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Trigger button to mount in the header — shows ⌘K hint
export function CommandPaletteTrigger() {
  const { isRTL } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => globalOpenHandler?.()}
      className="hidden lg:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-2"
      aria-label={isRTL ? "فتح البحث" : "Open search (Ctrl+K)"}
      data-testid="command-palette-trigger"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="text-xs hidden xl:inline">{isRTL ? "بحث" : "Search"}</span>
      <kbd className="pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
  );
}
