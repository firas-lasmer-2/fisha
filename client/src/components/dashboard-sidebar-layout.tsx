import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export interface DashboardNavGroup {
  label: string;
  items: DashboardNavItem[];
}

interface DashboardSidebarLayoutProps {
  items?: DashboardNavItem[]; // for backwards compatibility
  groups?: DashboardNavGroup[];
  activeId: string;
  onNavigate: (id: string) => void;
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardSidebarLayout({
  items,
  groups,
  activeId,
  onNavigate,
  title,
  subtitle,
  headerAction,
  children,
}: DashboardSidebarLayoutProps) {
  const { isRTL } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Normalize items to groups for rendering
  const displayGroups: DashboardNavGroup[] = groups || (items ? [{ label: "", items }] : []);

  const navContent = (
    <nav className="flex flex-col gap-4 p-3">
      {displayGroups.map((group, gIdx) => (
        <div key={gIdx} className="space-y-1">
          {group.label && (
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-e bg-card/50">
        <div className="p-4 pb-2">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{navContent}</div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {subtitle && <SheetDescription className="text-xs">{subtitle}</SheetDescription>}
          </SheetHeader>
          <div className="overflow-y-auto">{navContent}</div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMobileOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
          </div>
          {headerAction}
        </div>

        <div className="p-4 sm:p-6 max-w-5xl">
          {children}
        </div>
      </div>
    </div>
  );
}
