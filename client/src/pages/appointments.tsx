import { useI18n } from "@/lib/i18n";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import type { Appointment, User } from "@shared/schema";

export default function AppointmentsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: appointments, isLoading } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const channelClient = supabase
      .channel(`appointments-client-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
        },
      )
      .subscribe();

    const channelTherapist = supabase
      .channel(`appointments-therapist-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `therapist_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelClient);
      supabase.removeChannel(channelTherapist);
    };
  }, [user?.id]);

  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: AlertCircle, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: t("appointment.pending") },
    confirmed: { icon: CheckCircle, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: t("appointment.confirmed") },
    completed: { icon: CheckCircle, color: "bg-primary/10 text-primary", label: t("appointment.completed") },
    cancelled: { icon: XCircle, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: t("appointment.cancel") },
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold" data-testid="text-appointments-title">{t("nav.appointments")}</h1>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const status = statusConfig[apt.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <Card key={apt.id} data-testid={`appointment-card-${apt.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center text-white font-bold shrink-0">
                        {(apt.otherUser.firstName?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">
                            {apt.otherUser.firstName} {apt.otherUser.lastName}
                          </h3>
                          <Badge className={`${status.color} text-xs`}>
                            <StatusIcon className="h-3 w-3 me-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(apt.scheduledAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(apt.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span>{apt.durationMinutes} {t("common.minutes")}</span>
                          {apt.priceDinar && (
                            <span className="font-medium text-primary">{apt.priceDinar} {t("common.dinar")}</span>
                          )}
                        </div>
                        {apt.status === "pending" && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({ id: apt.id, status: "confirmed" })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-confirm-${apt.id}`}
                            >
                              {updateStatusMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                              {t("appointment.confirm")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: apt.id, status: "cancelled" })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-cancel-${apt.id}`}
                            >
                              {updateStatusMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                              {t("appointment.cancel")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("appointments.no_appointments")}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
