import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Additional class names for the wrapper */
  className?: string;
}

/**
 * Reusable empty state component.
 * Uses the safe-surface wellness background for a calm, on-brand look.
 *
 * Usage:
 *   <EmptyState icon={BookOpen} title="No entries yet" description="Start writing" action={{ label: "New entry", onClick: openDialog }} />
 *   <EmptyState emoji="🔍" title="No results" description="Try adjusting your filters" />
 */
export function EmptyState({ icon: Icon, emoji, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`safe-surface rounded-2xl p-8 text-center space-y-3 ${className ?? ""}`}>
      {emoji ? (
        <span className="text-4xl block" aria-hidden="true">
          {emoji}
        </span>
      ) : Icon ? (
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
      ) : null}

      <p className="font-semibold text-sm">{title}</p>

      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
      )}

      {action && (
        <div className="pt-1">
          {action.href ? (
            <Link href={action.href}>
              <Button size="sm" variant="outline">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
