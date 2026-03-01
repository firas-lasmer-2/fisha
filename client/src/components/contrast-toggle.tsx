import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Contrast } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "shifa-high-contrast";

export function useHighContrast() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabledState(next);
    const root = document.documentElement;
    if (next) {
      root.classList.add("high-contrast");
      localStorage.setItem(STORAGE_KEY, "1");
    } else {
      root.classList.remove("high-contrast");
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return { enabled, toggle };
}

export function ContrastToggle({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { enabled, toggle } = useHighContrast();
  const { isRTL } = useI18n();

  return (
    <Button
      variant={variant}
      size="icon"
      className="h-8 w-8"
      onClick={toggle}
      aria-label={isRTL ? "تبديل التباين العالي" : "Toggle high contrast"}
      aria-pressed={enabled}
      data-testid="button-contrast-toggle"
    >
      <Contrast className="h-4 w-4" />
    </Button>
  );
}
