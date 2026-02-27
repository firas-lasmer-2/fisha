import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { postAuthRouteForUser } from "@/lib/post-auth-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Heart, Loader2, Users, UserCircle, Headphones } from "lucide-react";

export default function SignupPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role,
        }),
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
      const nextPath = postAuthRouteForUser(payload?.user) || (role === "therapist" ? "/therapist-dashboard" : role === "listener" ? "/onboarding" : "/onboarding");
      window.location.href = nextPath;
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
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
          <CardTitle className="text-2xl">{t("auth.signup")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("auth.signup_subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={t("auth.first_name")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                data-testid="input-signup-firstname"
              />
              <Input
                placeholder={t("auth.last_name")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                data-testid="input-signup-lastname"
              />
            </div>
            <Input
              type="email"
              placeholder={t("auth.email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-signup-email"
            />
            <Input
              type="password"
              placeholder={t("auth.password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              data-testid="input-signup-password"
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("auth.select_role")}</Label>
              <RadioGroup value={role} onValueChange={setRole} className="grid grid-cols-1 gap-3">
                <Label
                  htmlFor="role-client"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    role === "client" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="client" id="role-client" />
                  <Users className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("auth.role_client")}</p>
                    <p className="text-xs text-muted-foreground">I need support</p>
                  </div>
                </Label>
                <Label
                  htmlFor="role-listener"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    role === "listener" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="listener" id="role-listener" />
                  <Headphones className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Listener</p>
                    <p className="text-xs text-muted-foreground">I want to help</p>
                  </div>
                </Label>
                <Label
                  htmlFor="role-therapist"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    role === "therapist" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value="therapist" id="role-therapist" />
                  <UserCircle className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t("auth.role_therapist")}</p>
                    <p className="text-xs text-muted-foreground">I'm a professional</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
              {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("auth.signup")}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("auth.or")}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => handleOAuth("google")} data-testid="button-google-signup">
              Google
            </Button>
            <Button variant="outline" onClick={() => handleOAuth("facebook")} data-testid="button-facebook-signup">
              Facebook
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {t("auth.have_account")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.login")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
