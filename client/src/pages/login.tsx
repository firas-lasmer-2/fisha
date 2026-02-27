import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { postAuthRouteForUser } from "@/lib/post-auth-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Heart, Mail, Phone, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast({ title: payload.message || t("common.error"), variant: "destructive" });
        return;
      }

      if (payload.session) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        if (setSessionError) {
          toast({ title: setSessionError.message, variant: "destructive" });
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate(postAuthRouteForUser(payload?.user));
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: payload.message || t("common.error"), variant: "destructive" });
        return;
      }
      setOtpSent(true);
      toast({ title: t("auth.otp_sent") });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: otp }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: payload.message || t("common.error"), variant: "destructive" });
        return;
      }

      if (payload.session) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        if (setSessionError) {
          toast({ title: setSessionError.message, variant: "destructive" });
          return;
        }
      } else {
        toast({ title: t("common.error"), variant: "destructive" });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate(postAuthRouteForUser(payload?.user));
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/workflow` },
    });
    if (error) toast({ title: error.message, variant: "destructive" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <Link href="/">
            <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center mx-auto cursor-pointer">
              <Heart className="h-6 w-6 text-white" />
            </div>
          </Link>
          <CardTitle className="text-2xl">{t("auth.login")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("auth.login_subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t("auth.email")}
              </TabsTrigger>
              <TabsTrigger value="phone" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {t("auth.phone")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-3 pt-2">
                <Input
                  type="email"
                  placeholder={t("auth.email_placeholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-login-email"
                />
                <Input
                  type="password"
                  placeholder={t("auth.password_placeholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-login-password"
                />
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                  {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("auth.login")}
                </Button>
                <div className="text-center">
                  <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    {t("auth.forgot_password")}
                  </Link>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="phone">
              {!otpSent ? (
                <div className="space-y-3 pt-2">
                  <Input
                    type="tel"
                    placeholder={t("auth.phone_placeholder_format")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-testid="input-login-phone"
                  />
                  <Button onClick={handleSendOtp} className="w-full" disabled={loading || !phone}>
                    {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {t("auth.send_otp")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3 pt-2">
                  <Input
                    type="text"
                    placeholder={t("auth.otp_placeholder")}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    required
                    data-testid="input-login-otp"
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {t("auth.verify_otp")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setOtpSent(false)}
                  >
                    {t("common.back")}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("auth.or")}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleOAuth("google")} data-testid="button-google">
              Google
            </Button>
            <Button variant="outline" onClick={() => handleOAuth("facebook")} data-testid="button-facebook">
              Facebook
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.no_account")}{" "}
            <Link href="/signup" className="text-primary hover:underline">
              {t("auth.signup")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
