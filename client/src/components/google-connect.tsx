import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Link2, Loader2, CheckCircle } from "lucide-react";

interface GoogleStatusResponse {
  connected: boolean;
  configured: boolean;
  connectedAt: string | null;
}

export function GoogleConnect() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();

  // Handle redirect from Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");
    if (googleStatus === "connected") {
      toast({ title: t("google.connect_success") });
      qc.invalidateQueries({ queryKey: ["/api/doctor/google/status"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (googleStatus === "error") {
      toast({ title: t("google.connect_error"), variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);

  const { data: status, isLoading } = useQuery<GoogleStatusResponse>({
    queryKey: ["/api/doctor/google/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/doctor/google/connect");
      const data = await res.json() as { authUrl?: string; message?: string };
      if (!data.authUrl) throw new Error(data.message ?? "No auth URL returned");
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? t("google.connect_error"), variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/doctor/google/disconnect");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/doctor/google/status"] });
      toast({ title: t("google.disconnect_success") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Video className="h-4 w-4" />
        <span>{t("google.not_configured")}</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-300/60">
            <Video className="h-3 w-3" />
            Google Meet
          </Badge>
        </div>
        {status.connectedAt && (
          <span className="text-xs text-muted-foreground">
            {t("google.connected_since")}: {new Date(status.connectedAt).toLocaleDateString()}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
        >
          {disconnectMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {t("google.disconnect_btn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("google.connect_desc")}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => connectMutation.mutate()}
        disabled={connectMutation.isPending}
      >
        {connectMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
        )}
        {t("google.connect_btn")}
      </Button>
    </div>
  );
}
