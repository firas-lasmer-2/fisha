import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, ShieldAlert, UserRoundCog, ArrowUpCircle, Heart } from "lucide-react";
import type { ListenerApplication, ListenerQualificationTest, PeerReport, TherapistProfile, TierUpgradeRequest, User } from "@shared/schema";

interface AdminListenersPayload {
  applications: ListenerApplication[];
  reports: PeerReport[];
  riskSnapshots: ListenerRiskSnapshot[];
  qualificationTests: Record<string, ListenerQualificationTest>;
}

type TherapistRow = TherapistProfile & { user: User };
type ListenerRiskSnapshot = {
  listenerId: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  openReports: number;
  severeOpenReports: number;
  recentLowRatings: number;
  averageRating: number;
  ratingCount: number;
  penaltyPoints: number;
};

export default function AdminListenersPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const { data, isLoading } = useQuery<AdminListenersPayload>({
    queryKey: ["/api/admin/listeners"],
  });

  const { data: therapists = [] } = useQuery<TherapistRow[]>({
    queryKey: ["/api/therapists"],
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

  const tierMutation = useMutation({
    mutationFn: async ({
      therapistId,
      tier,
    }: {
      therapistId: string;
      tier: "graduated_doctor" | "premium_doctor";
    }) => {
      await apiRequest("PATCH", `/api/admin/therapists/${therapistId}/tier`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/therapists"] });
      toast({ title: t("admin.tier_updated") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const { data: tierUpgradeRequests = [] } = useQuery<(TierUpgradeRequest & { doctorName?: string })[]>({
    queryKey: ["/api/admin/tier-upgrades"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/tier-upgrades");
      return res.json();
    },
  });

  type WellbeingAggregate = {
    listenerId: string;
    displayName: string | null;
    checkInCount: number;
    avgStress: number | null;
    avgEmotionalLoad: number | null;
    latestCheckIn: string | null;
    suggestCooldown: boolean;
  };

  const { data: wellbeingData = [] } = useQuery<WellbeingAggregate[]>({
    queryKey: ["/api/admin/listeners/wellbeing"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/listeners/wellbeing");
      return res.json();
    },
  });

  const tierUpgradeReviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      await apiRequest("PATCH", `/api/admin/tier-upgrades/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-upgrades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/therapists"] });
      toast({ title: "Tier upgrade reviewed" });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const applications = data?.applications || [];
  const reports = data?.reports || [];
  const riskSnapshots = data?.riskSnapshots || [];
  const qualificationTests = data?.qualificationTests || {};
  const riskByListenerId = new Map(riskSnapshots.map((risk) => [risk.listenerId, risk]));
  const highRiskCount = riskSnapshots.filter((risk) => risk.riskLevel === "high").length;
  const openApplications = applications.filter((application) =>
    application.status === "pending" || application.status === "changes_requested",
  );
  const sortedApplications = [...applications].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t("admin.listeners_title")}</p>
                <p className="text-lg font-semibold">{openApplications.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">{t("admin.open_reports")}</p>
                <p className="text-lg font-semibold">{reports.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <UserRoundCog className="h-5 w-5 text-chart-2" />
              <div>
                <p className="text-xs text-muted-foreground">{t("admin.therapist_tiers")}</p>
                <p className="text-lg font-semibold">{therapists.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">{tr("admin.high_risk", "High risk listeners")}</p>
                <p className="text-lg font-semibold">{highRiskCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="applications" className="space-y-4">
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="applications">{t("admin.listeners_title")}</TabsTrigger>
            <TabsTrigger value="reports">{t("admin.open_reports")}</TabsTrigger>
            <TabsTrigger value="tiers">{t("admin.therapist_tiers")}</TabsTrigger>
            <TabsTrigger value="tier-upgrades">
              <ArrowUpCircle className="h-3.5 w-3.5 me-1" />
              Upgrades
              {tierUpgradeRequests.filter((r) => r.status === "pending").length > 0 && (
                <Badge className="ms-1.5" variant="destructive">
                  {tierUpgradeRequests.filter((r) => r.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="wellbeing">
              <Heart className="h-3.5 w-3.5 me-1" />
              Wellbeing
              {wellbeingData.filter((w) => w.suggestCooldown).length > 0 && (
                <Badge className="ms-1.5" variant="destructive">
                  {wellbeingData.filter((w) => w.suggestCooldown).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("admin.listeners_title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
                ) : sortedApplications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.no_applications")}</p>
                ) : (
                  sortedApplications.map((application) => {
                    const canReview =
                      application.status === "pending" || application.status === "changes_requested";
                    const canActivate = application.status === "approved";
                    const risk = riskByListenerId.get(application.userId);
                    const riskVariant = risk?.riskLevel === "high"
                      ? "destructive"
                      : risk?.riskLevel === "medium"
                        ? "secondary"
                        : "outline";

                    const qualTest = qualificationTests[application.userId];

                    return (
                      <div key={application.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">{t("admin.user_id")}: {application.userId}</p>
                            <p className="text-xs text-muted-foreground">
                              {application.languages?.join(", ") || t("admin.no_languages")}
                            </p>
                            {application.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(application.createdAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {qualTest ? (
                              <Badge variant={qualTest.passed ? "default" : "destructive"}>
                                {t("admin.qual_test_score")}: {qualTest.score}%
                                {qualTest.passed ? ` ✓` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline">{t("admin.qual_test_not_taken")}</Badge>
                            )}
                            {risk && (
                              <Badge variant={riskVariant}>
                                {tr("admin.risk", "Risk")}: {risk.riskLevel} ({risk.riskScore})
                              </Badge>
                            )}
                            <Badge variant="secondary">{application.status}</Badge>
                          </div>
                        </div>
                        {risk && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>
                              {tr("admin.risk_details", "Open reports")} {risk.openReports} • {tr("admin.low_ratings", "Low ratings (30d)")} {risk.recentLowRatings} • {tr("admin.penalty_points", "Penalty points")} {risk.penaltyPoints}
                            </p>
                            {risk.ratingCount > 0 && (
                              <p>
                                Avg rating: <span className="font-medium">{risk.averageRating.toFixed(1)}</span> ({risk.ratingCount} sessions)
                              </p>
                            )}
                          </div>
                        )}

                        {application.motivation && (
                          <p className="text-sm text-muted-foreground">{application.motivation}</p>
                        )}
                        {application.relevantExperience && (
                          <p className="text-xs text-muted-foreground">{application.relevantExperience}</p>
                        )}
                        {application.moderationNotes && (
                          <p className="text-xs text-muted-foreground">{application.moderationNotes}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {canReview && (
                            <>
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
                            </>
                          )}
                          {canActivate && (
                            <>
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
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("admin.open_reports")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {riskSnapshots.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium">{tr("admin.risk_watchlist", "Risk watchlist")}</p>
                    <div className="space-y-1.5">
                      {riskSnapshots.slice(0, 5).map((risk) => (
                        <div key={risk.listenerId} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{risk.listenerId}</span>
                          <Badge variant={risk.riskLevel === "high" ? "destructive" : risk.riskLevel === "medium" ? "secondary" : "outline"}>
                            {risk.riskLevel} ({risk.riskScore})
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.no_reports")}</p>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="border rounded-md p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">{report.reason}</p>
                        <Badge variant={report.severity === "high" ? "destructive" : "outline"}>
                          {report.severity}
                        </Badge>
                      </div>
                      {report.details && (
                        <p className="text-sm text-muted-foreground">{report.details}</p>
                      )}
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span>#{report.id}</span>
                        {report.createdAt && <span>{new Date(report.createdAt).toLocaleString()}</span>}
                      </div>
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
          </TabsContent>

          <TabsContent value="tiers">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("admin.therapist_tiers")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {therapists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.no_therapists")}</p>
                ) : (
                  therapists.map((therapist) => (
                    <div key={therapist.userId} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-medium">
                            {therapist.user.firstName} {therapist.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {therapist.rateDinar ?? "--"} {t("common.dinar")}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {therapist.tier === "graduated_doctor" ? t("tier.graduated_doctor") : t("tier.premium_doctor")}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            tierMutation.mutate({ therapistId: therapist.userId, tier: "graduated_doctor" })
                          }
                          disabled={tierMutation.isPending}
                        >
                          {t("admin.set_graduated_doctor")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            tierMutation.mutate({ therapistId: therapist.userId, tier: "premium_doctor" })
                          }
                          disabled={tierMutation.isPending}
                        >
                          {t("admin.set_premium_doctor")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tier-upgrades" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-primary" />
                  Doctor Tier Upgrade Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tierUpgradeRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upgrade requests yet.</p>
                ) : (
                  tierUpgradeRequests.map((req) => (
                    <div key={req.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-medium">{req.doctorName || `Doctor ${req.doctorId.slice(0, 8)}`}</p>
                          <p className="text-xs text-muted-foreground">{req.currentTier} → {req.requestedTier}</p>
                          <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Badge
                          variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {req.status}
                        </Badge>
                      </div>
                      {req.justification && (
                        <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{req.justification}</p>
                      )}
                      {req.portfolioUrl && (
                        <a
                          href={req.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          View Portfolio
                        </a>
                      )}
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => tierUpgradeReviewMutation.mutate({ id: req.id, status: "approved" })}
                            disabled={tierUpgradeReviewMutation.isPending}
                          >
                            Approve & Upgrade
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => tierUpgradeReviewMutation.mutate({ id: req.id, status: "rejected" })}
                            disabled={tierUpgradeReviewMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wellbeing Tab — Phase 4 */}
          <TabsContent value="wellbeing">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Listener Wellbeing Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {wellbeingData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wellbeing check-ins recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {wellbeingData
                      .sort((a, b) => (b.suggestCooldown ? 1 : 0) - (a.suggestCooldown ? 1 : 0))
                      .map((w) => (
                        <div
                          key={w.listenerId}
                          className={`rounded-lg border p-3 text-sm ${w.suggestCooldown ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium">{w.displayName || w.listenerId.slice(0, 8)}</span>
                            <div className="flex items-center gap-2">
                              {w.suggestCooldown && (
                                <Badge variant="outline" className="text-amber-700 border-amber-400 text-xs">
                                  Suggest cooldown
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {w.checkInCount} check-in{w.checkInCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                            {w.avgStress !== null && (
                              <span>Avg stress: <span className="font-medium text-foreground">{w.avgStress.toFixed(1)}/5</span></span>
                            )}
                            {w.avgEmotionalLoad !== null && (
                              <span>Emotional load: <span className="font-medium text-foreground">{w.avgEmotionalLoad.toFixed(1)}/5</span></span>
                            )}
                            {w.latestCheckIn && (
                              <span>Last check-in: <span className="font-medium text-foreground">{new Date(w.latestCheckIn).toLocaleDateString()}</span></span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}