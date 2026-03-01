/**
 * useAutosave — persists form state to sessionStorage and restores on mount.
 * Prevents data loss when navigating away from forms mid-fill.
 *
 * @param key    Unique sessionStorage key (e.g. "autosave:onboarding")
 * @param initial Initial value (used when no saved state exists)
 */
import { useEffect, useState } from "react";

export function useAutosave<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) return JSON.parse(saved) as T;
    } catch {
      // ignore parse errors — fall through to initial
    }
    return initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sessionStorage unavailable or quota exceeded — no-op
    }
  }, [key, value]);

  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setValue(initial);
  };

  return [value, setValue, clear];
}
