import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ListenerApplication, PeerReport } from "@shared/schema";

interface AdminListenersPayload {
  applications: ListenerApplication[];
  reports: PeerReport[];
}

export default function AdminListenersPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AdminListenersPayload>({
    queryKey: ["/api/admin/listeners"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      applicationId,
      status,
    }: {
      applicationId: number;
      status: "approved" | "rejected" | "changes_requested";
    }) => {
      await apiRequest("POST", `/api/admin/listener/${applicationId}/review`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listeners"] });
      toast({ title: t("admin.reviewed") });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ userId, mode }: { userId: string; mode: "trial" | "live" }) => {
      await apiRequest("POST", `/api/admin/listener/${userId}/activate-${mode}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listeners"] });
      toast({ title: t("admin.activation_updated") });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      await apiRequest("POST", `/api/admin/reports/${reportId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/listeners"] });
      toast({ title: t("admin.report_resolved") });
    },
  });

  const applications = data?.applications || [];
  const reports = data?.reports || [];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("admin.listeners_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
            ) : applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.no_applications")}</p>
            ) : (
              applications.map((application) => (
                <div key={application.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{t("admin.user_id")}: {application.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        {application.languages?.join(", ") || t("admin.no_languages")}
                      </p>
                    </div>
                    <Badge variant="secondary">{application.status}</Badge>
                  </div>

                  {application.motivation && (
                    <p className="text-sm text-muted-foreground">{application.motivation}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        reviewMutation.mutate({ applicationId: application.id, status: "approved" })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      {t("admin.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reviewMutation.mutate({ applicationId: application.id, status: "changes_requested" })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      {t("admin.request_changes")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        reviewMutation.mutate({ applicationId: application.id, status: "rejected" })
                      }
                      disabled={reviewMutation.isPending}
                    >
                      {t("admin.reject")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        activateMutation.mutate({ userId: application.userId, mode: "trial" })
                      }
                      disabled={activateMutation.isPending}
                    >
                      {t("admin.activate_trial")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        activateMutation.mutate({ userId: application.userId, mode: "live" })
                      }
                      disabled={activateMutation.isPending}
                    >
                      {t("admin.activate_live")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.open_reports")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.no_reports")}</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="border rounded-md p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{report.reason}</p>
                    <Badge variant="outline">{report.severity}</Badge>
                  </div>
                  {report.details && (
                    <p className="text-sm text-muted-foreground">{report.details}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveReportMutation.mutate(report.id)}
                    disabled={resolveReportMutation.isPending}
                  >
                    {t("admin.resolve")}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

