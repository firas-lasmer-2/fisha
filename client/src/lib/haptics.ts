let lastPulseAt = 0;

export type HapticImpact = "light" | "medium" | "heavy" | "selection";

function canPulse(): boolean {
  const now = Date.now();
  if (now - lastPulseAt < 35) return false;
  lastPulseAt = now;
  return true;
}

async function tryCapacitorHaptics(impact: HapticImpact): Promise<boolean> {
  // Avoid static imports so web builds still work when Capacitor plugins are not installed.
  const capModuleName = "@capacitor/core";
  const hapticsModuleName = "@capacitor/haptics";

  try {
    const cap = await import(/* @vite-ignore */ capModuleName);
    if (!cap?.Capacitor?.isNativePlatform?.()) return false;

    const haptics = await import(/* @vite-ignore */ hapticsModuleName);
    if (!haptics?.Haptics) return false;

    if (impact === "selection" && haptics.Haptics.selectionChanged) {
      await haptics.Haptics.selectionChanged();
      return true;
    }

    if (!haptics.ImpactStyle || !haptics.Haptics.impact) return false;
    const style =
      impact === "heavy"
        ? haptics.ImpactStyle.Heavy
        : impact === "medium"
          ? haptics.ImpactStyle.Medium
          : haptics.ImpactStyle.Light;
    await haptics.Haptics.impact({ style });
    return true;
  } catch {
    return false;
  }
}

export async function triggerHaptic(impact: HapticImpact = "light"): Promise<void> {
  if (typeof window === "undefined") return;
  if (!canPulse()) return;

  const usedNative = await tryCapacitorHaptics(impact);
  if (usedNative) return;

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    const pulse = impact === "heavy" ? 20 : impact === "medium" ? 14 : 8;
    navigator.vibrate(pulse);
  }
}
