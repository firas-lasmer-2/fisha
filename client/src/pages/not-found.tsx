import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Heart, Home, RefreshCw, RouteOff } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { canonicalHomeRouteForRole, fetchNavigationResolution } from "@/lib/navigation";

export default function NotFound() {
  const rm = usePrefersReducedMotion();
  const { user } = useAuth();
  const { t } = useI18n();
  const [location, navigate] = useLocation();

  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const { data } = useQuery({
    queryKey: ["/api/navigation/resolve", location, user?.role || "visitor"],
    queryFn: () => fetchNavigationResolution(location, (user?.role as any) || "visitor"),
  });

  useEffect(() => {
    const targetPath = data?.targetPath;
    if (data?.status === "redirect" && targetPath) {
      const timer = window.setTimeout(() => navigate(targetPath), 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [data?.status, data?.targetPath, navigate]);

  const homeHref = user ? canonicalHomeRouteForRole(user.role) : "/";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={safeVariants(fadeUp, rm)}
        className="w-full max-w-lg"
      >
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl gradient-calm flex items-center justify-center mx-auto">
              {data?.status === "redirect" ? (
                <RefreshCw className="h-8 w-8 text-white" />
              ) : (
                <Heart className="h-8 w-8 text-white" />
              )}
            </div>

            {data?.status === "redirect" ? (
              <>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">{translate("not_found.redirect.title", "We moved this page")}</h1>
                  <p className="text-muted-foreground">
                    {translate("not_found.redirect.body", "We found a clearer path for this destination and are taking you there now.")}
                  </p>
                </div>
                {data.messageKey && (
                  <p className="text-sm text-muted-foreground">{translate(data.messageKey, data.messageKey)}</p>
                )}
                <Link href={data.targetPath || homeHref}>
                  <Button className="gap-2" data-testid="button-go-redirect-target">
                    <RefreshCw className="h-4 w-4" />
                    {translate("not_found.redirect.cta", "Open the updated page")}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-gradient">404</h1>
                  <p className="text-muted-foreground">
                    {translate("not_found.body", "This page is no longer available from the current journey.")}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3 text-left">
                  <RouteOff className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{translate("not_found.hint", "Use the main navigation or return to your home area to continue.")}</span>
                </div>
                <Link href={homeHref}>
                  <Button className="gap-2" data-testid="button-go-home">
                    <Home className="h-4 w-4" />
                    {translate("not_found.cta", "Go to the main path")}
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
