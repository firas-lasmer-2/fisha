import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-primary hover:underline" data-testid="link-privacy-home">
          {tr("common.back", "Back")}
        </Link>

        <div className="mt-4 rounded-xl border bg-card p-8">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="text-2xl font-bold text-foreground">{tr("legal.privacy.title", "Privacy Policy")}</h1>
          </div>

          <p className="mb-4 text-muted-foreground">
            {tr(
              "legal.privacy.body_1",
              "Your personal data is handled with strict confidentiality and protected with secure infrastructure.",
            )}
          </p>
          <p className="text-muted-foreground">
            {tr(
              "legal.privacy.body_2",
              "Only required data is collected to provide care, bookings, and safety features.",
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

