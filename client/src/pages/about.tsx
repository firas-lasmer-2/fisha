import { Link } from "wouter";
import { Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { fadeUp, usePrefersReducedMotion, safeVariants } from "@/lib/motion";

export default function AboutPage() {
  const { t } = useI18n();
  const rm = usePrefersReducedMotion();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <motion.div
        className="mx-auto max-w-3xl"
        initial="hidden"
        animate="visible"
        variants={safeVariants(fadeUp, rm)}
      >
        <Link href="/" className="text-sm text-primary hover:underline" data-testid="link-about-home">
          {tr("common.back", "Back")}
        </Link>

        <div className="mt-4 rounded-xl border bg-card p-8">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <Heart className="h-5 w-5" />
            <h1 className="text-2xl font-bold text-foreground">{tr("legal.about.title", "About Shifa")}</h1>
          </div>

          <p className="mb-4 text-muted-foreground">
            {tr(
              "legal.about.body_1",
              "Shifa helps people in Tunisia access safe, culturally-aware mental wellness support.",
            )}
          </p>
          <p className="text-muted-foreground">
            {tr(
              "legal.about.body_2",
              "We combine peer listening, therapist booking, and self-care tools in one simple experience.",
            )}
          </p>
        </div>
      </motion.div>
    </main>
  );
}
