import { Link } from "wouter";
import { Mail, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";
import { fadeUp, usePrefersReducedMotion, safeVariants } from "@/lib/motion";

export default function ContactPage() {
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
        <Link href="/" className="text-sm text-primary hover:underline" data-testid="link-contact-home">
          {tr("common.back", "Back")}
        </Link>

        <div className="mt-4 rounded-xl border bg-card p-8">
          <h1 className="mb-4 text-2xl font-bold text-foreground">{tr("legal.contact.title", "Contact Us")}</h1>
          <p className="mb-6 text-muted-foreground">
            {tr(
              "legal.contact.body_1",
              "Need help with your account or platform usage? Reach our team through the channels below.",
            )}
          </p>

          <div className="space-y-3 text-sm">
            <a
              href="mailto:support@shifa.tn"
              className="flex items-center gap-2 text-primary hover:underline"
              data-testid="link-contact-email"
            >
              <Mail className="h-4 w-4" />
              support@shifa.tn
            </a>
            <a
              href="tel:190"
              className="flex items-center gap-2 text-destructive hover:underline"
              data-testid="link-contact-crisis"
            >
              <Phone className="h-4 w-4" />
              {tr("legal.contact.crisis", "Emergency in Tunisia: SAMU 190")}
            </a>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

