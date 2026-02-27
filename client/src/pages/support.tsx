import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, ArrowLeft, ArrowRight, MessageCircle, GraduationCap, Star } from "lucide-react";
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

export default function SupportPage() {
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

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
