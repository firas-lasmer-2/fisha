import { Link } from "wouter";
import { FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useI18n();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-primary hover:underline" data-testid="link-terms-home">
          {tr("common.back", "Back")}
        </Link>

        <div className="mt-4 rounded-xl border bg-card p-8">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <h1 className="text-2xl font-bold text-foreground">{tr("legal.terms.title", "Terms of Use")}</h1>
          </div>

          <p className="mb-4 text-muted-foreground">
            {tr(
              "legal.terms.body_1",
              "By using Shifa, you agree to respectful behavior and responsible use of peer and therapist services.",
            )}
          </p>
          <p className="text-muted-foreground">
            {tr(
              "legal.terms.body_2",
              "Shifa supports wellbeing but does not replace emergency services in life-threatening situations.",
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

