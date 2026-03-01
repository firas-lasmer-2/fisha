import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { SmilePlus, Calendar, MessageCircle, TrendingUp, ShieldCheck, CalendarCheck, Globe, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TourRole = "client" | "therapist";

interface TourStep {
  icon: LucideIcon;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}

const CLIENT_STEPS: TourStep[] = [
  {
    icon: SmilePlus,
    titleKey: "tour.client.mood_title",
    titleFallback: "Daily Mood Check-in",
    descKey: "tour.client.mood_desc",
    descFallback: "Log how you're feeling each day. Your mood history helps you track your mental wellness journey over time.",
  },
  {
    icon: Calendar,
    titleKey: "tour.client.book_title",
    titleFallback: "Book a Session",
    descKey: "tour.client.book_desc",
    descFallback: "Browse therapists and book a session that fits your schedule. You'll receive a confirmation and meeting link.",
  },
  {
    icon: MessageCircle,
    titleKey: "tour.client.messages_title",
    titleFallback: "Encrypted Messages",
    descKey: "tour.client.messages_desc",
    descFallback: "Securely message your therapist anytime. All conversations are end-to-end encrypted — only you and your therapist can read them.",
  },
  {
    icon: TrendingUp,
    titleKey: "tour.client.progress_title",
    titleFallback: "Track Your Progress",
    descKey: "tour.client.progress_desc",
    descFallback: "View your mood trends, journal streaks, and session history in one place to celebrate how far you've come.",
  },
];

const THERAPIST_STEPS: TourStep[] = [
  {
    icon: ShieldCheck,
    titleKey: "tour.therapist.verify_title",
    titleFallback: "Get Verified",
    descKey: "tour.therapist.verify_desc",
    descFallback: "Upload your license, diploma and ID to earn the verified badge. Verified profiles build trust and attract more clients.",
  },
  {
    icon: CalendarCheck,
    titleKey: "tour.therapist.slots_title",
    titleFallback: "Add Your Availability",
    descKey: "tour.therapist.slots_desc",
    descFallback: "Add available time slots to your calendar. Clients can book directly from your schedule with instant confirmation.",
  },
  {
    icon: Globe,
    titleKey: "tour.therapist.landing_title",
    titleFallback: "Customize Your Page",
    descKey: "tour.therapist.landing_desc",
    descFallback: "Build your public profile page with your story, specializations and a photo gallery to showcase your practice.",
  },
  {
    icon: Wallet,
    titleKey: "tour.therapist.earnings_title",
    titleFallback: "Track Earnings",
    descKey: "tour.therapist.earnings_desc",
    descFallback: "View your completed sessions and payout history in the Earnings tab. Payouts are processed on a regular schedule.",
  },
];

const STORAGE_KEY: Record<TourRole, string> = {
  client: "shifa-tour-client",
  therapist: "shifa-tour-therapist",
};

export function resetTour(role: TourRole) {
  localStorage.removeItem(STORAGE_KEY[role]);
}

interface FeatureTourProps {
  role: TourRole;
  /** Delay in ms before the tour appears on first load */
  delayMs?: number;
}

export function FeatureTour({ role, delayMs = 1200 }: FeatureTourProps) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const storageKey = STORAGE_KEY[role];
  const steps = role === "client" ? CLIENT_STEPS : THERAPIST_STEPS;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const alreadySeen = localStorage.getItem(storageKey);
    if (alreadySeen) return;
    const timer = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(timer);
  }, [storageKey, delayMs]);

  function handleNext() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDone();
    }
  }

  function handleDone() {
    setOpen(false);
    localStorage.setItem(storageKey, "1");
  }

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDone(); }}>
      <DialogContent className="sm:max-w-sm" aria-describedby="tour-step-desc">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <DialogTitle className="text-base leading-snug">
              {tr(currentStep.titleKey, currentStep.titleFallback)}
            </DialogTitle>
          </div>
        </DialogHeader>

        <p id="tour-step-desc" className="text-sm text-muted-foreground leading-relaxed -mt-1">
          {tr(currentStep.descKey, currentStep.descFallback)}
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-2">
          <span className="text-xs text-muted-foreground order-2 sm:order-1">
            {step + 1} / {steps.length}
          </span>
          <div className="flex gap-2 order-1 sm:order-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                {tr("common.back", "Back")}
              </Button>
            )}
            <Button size="sm" onClick={handleNext}>
              {isLast ? tr("tour.done", "Let's go!") : tr("tour.next", "Next")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
