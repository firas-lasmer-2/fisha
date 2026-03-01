import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  action: string;
  actionAr: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "K"], action: "Open search", actionAr: "فتح البحث" },
  { keys: ["?"], action: "Show keyboard shortcuts", actionAr: "عرض اختصارات لوحة المفاتيح" },
  { keys: ["Esc"], action: "Close dialogs / search", actionAr: "إغلاق الحوارات أو البحث" },
  { keys: ["Alt", "1"], action: "Go to Home", actionAr: "الصفحة الرئيسية" },
  { keys: ["Alt", "2"], action: "Go to Messages", actionAr: "الرسائل" },
  { keys: ["Alt", "3"], action: "Go to Appointments", actionAr: "المواعيد" },
  { keys: ["Alt", "4"], action: "Go to Settings", actionAr: "الإعدادات" },
];

export function KeyboardHelpModal() {
  const [open, setOpen] = useState(false);
  const { isRTL } = useI18n();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only fire when focus is NOT in an editable element
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;
      if (isEditable) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" aria-hidden />
            {isRTL ? "اختصارات لوحة المفاتيح" : "Keyboard Shortcuts"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mt-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.action}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-muted-foreground">
                {isRTL ? s.actionAr : s.action}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium">
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span className="text-xs text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {isRTL
            ? "اضغط ? أو Esc لإغلاق هذه النافذة"
            : "Press ? or Esc to close this dialog"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
