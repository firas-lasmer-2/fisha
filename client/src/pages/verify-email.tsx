import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Heart, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    // Supabase sets the session from the URL hash automatically when detectSessionInUrl: true
    // We just need to check the session after a short delay
    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatus("error");
      } else {
        setStatus("success");
      }
    };
    // Small delay to let Supabase process the hash params
    const timer = setTimeout(check, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <Link href="/">
            <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center mx-auto cursor-pointer">
              <Heart className="h-6 w-6 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">
            {status === "verifying"
              ? t("auth.verifying")
              : status === "success"
              ? t("auth.email_verified")
              : t("auth.verify_failed")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "verifying" && (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {status === "success" && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("auth.email_verified_desc")}</p>
              <Link href="/login">
                <Button className="w-full">{t("auth.back_to_login")}</Button>
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("auth.verify_failed_desc")}</p>
              <Link href="/login">
                <Button variant="outline" className="w-full">{t("auth.back_to_login")}</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
