/**
 * E2E key error recovery banner.
 * Shown in messages.tsx when conversationKey is null but encrypted messages exist —
 * meaning the user's private key is missing from localStorage (e.g. new device, cleared storage).
 */

import { Link } from "wouter";
import { ShieldAlert, Key, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface E2EErrorBannerProps {
  /** Called when the user wants to re-generate keys (data-loss path) */
  onRegenerate?: () => void;
}

export function E2EErrorBanner({ onRegenerate }: E2EErrorBannerProps) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  return (
    <div
      role="alert"
      className="mx-4 my-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">
            {tr("e2e.key_missing_title", "Encryption keys not found")}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {tr(
              "e2e.key_missing_desc",
              "Your private key is missing from this device. Messages appear encrypted until you restore your keys.",
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Link href="/settings#key-backup">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Key className="h-3 w-3" />
                {tr("e2e.restore_keys", "Restore from backup")}
              </Button>
            </Link>
            {onRegenerate && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-3 w-3" />
                {tr("e2e.regenerate_keys", "Re-generate keys")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
