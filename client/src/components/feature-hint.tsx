import { useState, useEffect, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface FeatureHintProps {
  id: string;
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
}

const STORAGE_PREFIX = "shifa-hint-";

export function FeatureHint({ id, content, children, side = "bottom", delayMs = 1000 }: FeatureHintProps) {
  const storageKey = `${STORAGE_PREFIX}${id}`;
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const gotIt = t("common.got_it") === "common.got_it" ? "Got it" : t("common.got_it");

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) return;

    const timer = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(timer);
  }, [storageKey, delayMs]);

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    localStorage.setItem(storageKey, "1");
  };

  // If already dismissed on mount, skip rendering the tooltip entirely
  const alreadyDismissed =
    typeof window !== "undefined" && !!localStorage.getItem(storageKey);
  if (alreadyDismissed) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className="safe-surface border border-primary/30 text-foreground max-w-[220px] p-3 space-y-2 shadow-lg"
        >
          <p className="text-xs leading-relaxed">{content}</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 py-0 text-xs text-primary hover:text-primary/80 w-full justify-start"
            onClick={dismiss}
          >
            <X className="h-3 w-3 me-1" aria-hidden />
            {gotIt}
          </Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
