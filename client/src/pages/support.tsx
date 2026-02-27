import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Check, ArrowLeft, ArrowRight, AlertTriangle, Compass } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

type SupportPath = {
  id: string;
  emoji: string;
  label: string;
  subtitle: string;
  price: string;
  priceDesc: string;
  priceBadgeClass: string;
  cardClass: string;
  features: string[];
  bestFor: string;
  ctaLabel: string;
  ctaHref: string;
  ctaClass: string;
  requiresAuth: boolean;
};

const paths: SupportPath[] = [
  {
    id: "peer",
    emoji: "💬",
    label: "Peer Support",
    subtitle: "Talk to a trained volunteer — right now",
    price: "Free",
    priceDesc: "always",
    priceBadgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0",
    cardClass: "border-primary/25 bg-primary/5",
    features: [
      "Immediate — no waiting",
      "Anonymous, no real name shown",
      "No appointment needed",
      "Trained & verified volunteers",
      "Private & end-to-end encrypted",
    ],
    bestFor: "Venting, loneliness, or when you just need someone to listen right now.",
    ctaLabel: "Start a session",
    ctaHref: "/peer-support",
    ctaClass: "",
    requiresAuth: true,
  },
  {
    id: "graduated",
    emoji: "🎓",
    label: "Graduated Therapist",
    subtitle: "Licensed professional, accessible rate",
    price: "20 TND",
    priceDesc: "per session",
    priceBadgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0",
    cardClass: "border-border",
    features: [
      "Licensed & nationally certified",
      "Book a video appointment",
      "Structured therapy sessions",
      "Anxiety, depression, stress focus",
      "Progress tracked over time",
    ],
    bestFor: "Consistent support for anxiety, mild depression, or life stress.",
    ctaLabel: "Browse therapists",
    ctaHref: "/therapists?tier=graduated_doctor",
    ctaClass: "",
    requiresAuth: false,
  },
  {
    id: "premium",
    emoji: "⭐",
    label: "Premium Therapist",
    subtitle: "Senior specialist with deep expertise",
    price: "80 – 120 TND",
    priceDesc: "per session",
    priceBadgeClass: "bg-amber-400/20 text-amber-700 dark:text-amber-400 border-0",
    cardClass: "border-amber-400/40 bg-amber-500/5",
    features: [
      "7+ years clinical experience",
      "Advanced specializations",
      "Full personalised treatment plan",
      "In-person & video sessions",
      "Complex & long-term cases",
    ],
    bestFor: "Trauma, chronic illness, relationship crises, or deep-rooted issues.",
    ctaLabel: "Browse specialists",
    ctaHref: "/therapists?tier=premium_doctor",
    ctaClass: "bg-amber-500 hover:bg-amber-600 text-white border-0",
    requiresAuth: false,
  },
];

const faqs = [
  {
    q: "Not sure which to pick?",
    a: "Start with Peer Support — it's free and immediate. You can always move to a therapist once you've had time to think.",
  },
  {
    q: "Are listeners therapists?",
    a: "No. Listeners are trained volunteers, not clinicians. For diagnosis or structured treatment, choose a Graduated or Premium Therapist.",
  },
  {
    q: "Graduated vs. Premium?",
    a: "Both are licensed professionals. Premium therapists have more experience and are better suited for complex or long-term situations.",
  },
];

type TriageUrgency = "crisis_now" | "today" | "this_week" | null;
type TriagePreference = "peer" | "therapist" | "both" | "selfcare" | null;
type TriagePriority = "free_fast" | "structured" | "specialist" | null;

type TriageRecommendation = {
  title: string;
  reason: string;
  ctaHref: string;
  ctaLabel: string;
  requiresAuth?: boolean;
  badge?: string;
};

export default function SupportPage() {
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [urgency, setUrgency] = useState<TriageUrgency>(null);
  const [preference, setPreference] = useState<TriagePreference>(null);
  const [priority, setPriority] = useState<TriagePriority>(null);

  const recommendation = useMemo<TriageRecommendation | null>(() => {
    if (!urgency || !preference || !priority) return null;

    if (urgency === "crisis_now") {
      return {
        title: "Emergency support first",
        reason: "Your answers suggest urgent risk. Start with crisis support immediately.",
        ctaHref: "/crisis",
        ctaLabel: "Open crisis support",
        badge: "Urgent",
      };
    }

    if (preference === "selfcare") {
      return {
        title: "Start with self-care tools",
        reason: "A low-pressure step can help you regulate before speaking to someone.",
        ctaHref: "/self-care",
        ctaLabel: "Open self-care",
        badge: "Gentle start",
      };
    }

    if (preference === "peer" || priority === "free_fast") {
      return {
        title: "Peer listener is your best first step",
        reason: "You prioritized immediate, free, human support.",
        ctaHref: "/peer-support",
        ctaLabel: user ? "Start peer session" : "Sign in to start peer session",
        requiresAuth: true,
        badge: "Fastest",
      };
    }

    if (priority === "specialist") {
      return {
        title: "Premium therapist is recommended",
        reason: "You asked for deeper specialist care.",
        ctaHref: "/therapists?tier=premium_doctor",
        ctaLabel: "Browse premium therapists",
        badge: "Specialist",
      };
    }

    if (preference === "both") {
      return {
        title: "Hybrid path: peer now, therapist next",
        reason: "Start with a free listener now, then book structured clinical care.",
        ctaHref: "/peer-support",
        ctaLabel: user ? "Start with peer support" : "Sign in to start",
        requiresAuth: true,
        badge: "Hybrid",
      };
    }

    return {
      title: "Graduated therapist is recommended",
      reason: "You want structured support with accessible pricing.",
      ctaHref: "/therapists?tier=graduated_doctor",
      ctaLabel: "Browse graduated therapists",
      badge: "Structured care",
    };
  }, [urgency, preference, priority, user]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-10">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center space-y-2"
        >
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-support-title">
            How can we help you today?
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Choose the level of support that fits where you are right now.
            There is no wrong answer.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl border bg-card/70 p-5 space-y-5"
          data-testid="card-support-triage"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" />
                Guided support triage
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                3 quick answers to recommend the best path for this moment.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUrgency(null);
                setPreference(null);
                setPriority(null);
              }}
            >
              Reset
            </Button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">1. How urgent is your situation?</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "crisis_now", label: "Crisis now" },
                { value: "today", label: "Need to talk today" },
                { value: "this_week", label: "Can plan this week" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setUrgency(item.value as TriageUrgency)}
                  className={`px-3 py-1.5 rounded-full border text-xs ${
                    urgency === item.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">2. What kind of support feels right?</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "peer", label: "Volunteer listener" },
                { value: "therapist", label: "Licensed therapist" },
                { value: "both", label: "Both paths" },
                { value: "selfcare", label: "Self-guided tools first" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPreference(item.value as TriagePreference)}
                  className={`px-3 py-1.5 rounded-full border text-xs ${
                    preference === item.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">3. What matters most right now?</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "free_fast", label: "Free + immediate" },
                { value: "structured", label: "Structured therapy" },
                { value: "specialist", label: "Deep specialist expertise" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setPriority(item.value as TriagePriority)}
                  className={`px-3 py-1.5 rounded-full border text-xs ${
                    priority === item.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {recommendation && (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold">{recommendation.title}</p>
                {recommendation.badge && (
                  <Badge variant="secondary">{recommendation.badge}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
              {recommendation.ctaHref === "/crisis" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  If you are in immediate danger, contact local emergency services now.
                </p>
              )}
              {recommendation.requiresAuth && !user ? (
                <Link href="/login">
                  <Button size="sm" className="gap-1.5">
                    {recommendation.ctaLabel}
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : (
                <Link href={recommendation.ctaHref}>
                  <Button size="sm" className="gap-1.5" data-testid="btn-support-recommendation">
                    {recommendation.ctaLabel}
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Three path cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {paths.map((path, i) => (
            <motion.div
              key={path.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.09 }}
              data-testid={`card-support-${path.id}`}
              className={`flex flex-col rounded-2xl border-2 p-5 space-y-4 ${path.cardClass}`}
            >
              {/* Card header */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-4xl">{path.emoji}</span>
                  <Badge className={`text-xs shrink-0 ${path.priceBadgeClass}`}>
                    {path.price}
                    <span className="opacity-60 ms-1 text-[10px]">{path.priceDesc}</span>
                  </Badge>
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{path.label}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{path.subtitle}</p>
                </div>
              </div>

              {/* Feature list */}
              <ul className="space-y-2 flex-1">
                {path.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Best for */}
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Best for
                </p>
                <p className="text-xs leading-relaxed">{path.bestFor}</p>
              </div>

              {/* CTA */}
              {path.requiresAuth && !user ? (
                <Link href="/login">
                  <Button size="sm" className="w-full gap-1.5">
                    Sign in to start
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : (
                <Link href={path.ctaHref}>
                  <Button
                    size="sm"
                    className={`w-full gap-1.5 ${path.ctaClass}`}
                    data-testid={`btn-support-${path.id}`}
                  >
                    {path.ctaLabel}
                    <Arrow className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── FAQ row ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-2xl border bg-card/60 p-5 grid sm:grid-cols-3 gap-5"
        >
          {faqs.map((faq) => (
            <div key={faq.q} className="space-y-1">
              <p className="text-sm font-semibold">{faq.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Crisis footer ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground"
        >
          In immediate danger or crisis?{" "}
          <Link href="/crisis" className="underline underline-offset-2 text-destructive hover:text-destructive/80">
            Get emergency support
          </Link>
        </motion.p>

      </div>
    </AppLayout>
  );
}
