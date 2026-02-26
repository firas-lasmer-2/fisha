import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { ListenerApplication, ListenerProfile, PeerSession, User } from "@shared/schema";

interface ListenerApplicationPayload {
  application: ListenerApplication | null;
  profile: ListenerProfile | null;
}

interface PeerSessionsPayload {
  sessions: (PeerSession & { otherUser: User })[];
}

export default function ListenerDashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAvailable, setIsAvailable] = useState(false);

  const { data: listenerData, isLoading } = useQuery<ListenerApplicationPayload>({
    queryKey: ["/api/listener/application"],
  });

  const { data: peerSessionsData } = useQuery<PeerSessionsPayload>({
    queryKey: ["/api/peer/sessions"],
  });

  useEffect(() => {
    if (typeof listenerData?.profile?.isAvailable === "boolean") {
      setIsAvailable(listenerData.profile.isAvailable);
    }
  }, [listenerData?.profile?.isAvailable]);

  const availabilityMutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      await apiRequest("POST", "/api/listener/availability", { isAvailable: nextValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      toast({ title: t("listener.availability_updated") });
    },
    onError: () => {
      setIsAvailable((prev) => !prev);
      toast({ title: t("listener.availability_error"), variant: "destructive" });
    },
  });

  const profile = listenerData?.profile;
  const application = listenerData?.application;
  const sessions = peerSessionsData?.sessions || [];
  const activeSessions = sessions.filter((session) => session.status === "active");

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("listener.dashboard_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("listener.loading")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {t("listener.verification")}: {profile?.verificationStatus || application?.status || "pending"}
                  </Badge>
                  <Badge variant="outline">
                    {t("listener.activation")}: {profile?.activationStatus || "inactive"}
                  </Badge>
                  {user?.role && <Badge variant="outline">{t("listener.role")}: {user.role}</Badge>}
                </div>

                <div className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium">{t("listener.accept_sessions")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("listener.accept_sessions_desc")}
                    </p>
                  </div>
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={(nextValue) => {
                      setIsAvailable(nextValue);
                      availabilityMutation.mutate(nextValue);
                    }}
                    disabled={availabilityMutation.isPending}
                  />
                </div>

                {(!profile || profile.verificationStatus !== "approved") && (
                  <div className="text-sm text-muted-foreground">
                    {t("listener.not_approved")}
                    <div className="mt-2">
                      <Link href="/listener/apply">
                        <Button size="sm" variant="outline">
                          {t("listener.update_application")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("listener.current_sessions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <div key={session.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {session.otherUser.firstName || t("common.client")} {session.otherUser.lastName || ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("listener.session_id")} #{session.id}</p>
                  </div>
                  <Link href={`/peer-support?session=${session.id}`}>
                    <Button size="sm">{t("listener.open_chat")}</Button>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("listener.no_active_sessions")}</p>
            )}

            {sessions.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                {t("listener.total_sessions")}: {sessions.length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

