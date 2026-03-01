/**
 * search-results.tsx
 * Unified typed search result renderer.
 * Used by CommandPalette (compact) and any future full-page search.
 */
import type { LucideIcon } from "lucide-react";
import type { TherapistProfile, Resource, User } from "@shared/schema";
import { Users, BookOpen, Compass, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchResultItem =
  | { type: "therapist"; data: TherapistProfile & { user: User } }
  | { type: "resource"; data: Resource }
  | { type: "page"; data: { href: string; label: string; icon: LucideIcon } };

interface SearchResultsProps {
  items: SearchResultItem[];
  /** compact — small rows for palette/dropdown; full — richer card rows */
  mode?: "compact" | "full";
  onSelect: (item: SearchResultItem) => void;
  isRTL?: boolean;
  className?: string;
  /** Optional heading shown above the list */
  heading?: string;
}

// ── Row renderers ─────────────────────────────────────────────────────────────

function TherapistRow({
  tp,
  mode,
  isRTL,
  onClick,
}: {
  tp: TherapistProfile & { user: User };
  mode: "compact" | "full";
  isRTL: boolean;
  onClick: () => void;
}) {
  const name = [tp.user?.firstName, tp.user?.lastName].filter(Boolean).join(" ") || "—";
  const initials = (tp.user?.firstName?.[0] ?? "?").toUpperCase();

  if (mode === "compact") {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-start"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <Avatar className="h-7 w-7 rounded-lg shrink-0">
          {tp.user?.profileImageUrl && (
            <AvatarImage src={tp.user.profileImageUrl} alt={name} loading="lazy" />
          )}
          <AvatarFallback className="rounded-lg text-xs gradient-calm text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          {tp.headline && (
            <p className="text-xs text-muted-foreground truncate">{tp.headline}</p>
          )}
        </div>
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
    );
  }

  // full mode
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-start"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Avatar className="h-10 w-10 rounded-xl shrink-0">
        {tp.user?.profileImageUrl && (
          <AvatarImage src={tp.user.profileImageUrl} alt={name} loading="lazy" />
        )}
        <AvatarFallback className="rounded-xl gradient-calm text-white font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">{name}</p>
          {tp.rating != null && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {tp.rating.toFixed(1)}
            </span>
          )}
        </div>
        {tp.headline && (
          <p className="text-xs text-muted-foreground line-clamp-1">{tp.headline}</p>
        )}
        {(tp.specializations ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(tp.specializations ?? []).slice(0, 3).map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function ResourceRow({
  resource,
  mode,
  isRTL,
  onClick,
}: {
  resource: Resource;
  mode: "compact" | "full";
  isRTL: boolean;
  onClick: () => void;
}) {
  const title = isRTL ? resource.titleAr : resource.titleFr;

  if (mode === "compact") {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-start"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm truncate">{title}</p>
        {resource.category && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{resource.category}</Badge>
        )}
      </button>
    );
  }

  // full mode
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-start"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <BookOpen className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium line-clamp-1">{title}</p>
        {resource.category && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">{resource.category}</Badge>
        )}
      </div>
    </button>
  );
}

function PageRow({
  item,
  mode,
  isRTL,
  onClick,
}: {
  item: { href: string; label: string; icon: LucideIcon };
  mode: "compact" | "full";
  isRTL: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  if (mode === "compact") {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-start"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm">{item.label}</p>
        <Compass className="h-3 w-3 text-muted-foreground shrink-0 ms-auto" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-start"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{item.label}</p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchResults({
  items,
  mode = "compact",
  onSelect,
  isRTL = false,
  className,
  heading,
}: SearchResultsProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      {heading && (
        <p className="text-xs font-medium text-muted-foreground px-1 mb-1">{heading}</p>
      )}
      {items.map((item, i) => {
        const key = item.type === "therapist"
          ? `t-${item.data.userId}`
          : item.type === "resource"
          ? `r-${item.data.id}`
          : `p-${item.data.href}`;

        return (
          <div key={`${key}-${i}`}>
            {item.type === "therapist" && (
              <TherapistRow tp={item.data} mode={mode} isRTL={isRTL} onClick={() => onSelect(item)} />
            )}
            {item.type === "resource" && (
              <ResourceRow resource={item.data} mode={mode} isRTL={isRTL} onClick={() => onSelect(item)} />
            )}
            {item.type === "page" && (
              <PageRow item={item.data} mode={mode} isRTL={isRTL} onClick={() => onSelect(item)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
