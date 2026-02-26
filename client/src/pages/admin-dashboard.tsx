import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  BarChart3,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  FileText,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import type { TherapistVerification } from "@shared/schema";

interface AdminAnalytics {
  totalUsers: number;
  activeTherapists: number;
  sessionsThisWeek: number;
  revenueThisMonth: number;
  newUsersThisWeek: number;
  pendingVerifications: number;
}

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const tr = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  if (user?.role !== "admin" && user?.role !== "moderator") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied.</p>
        </div>
      </AppLayout>
    );
  }

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: verifications = [], isLoading: verificationsLoading } = useQuery<
    (TherapistVerification & { therapistName?: string })[]
  >({
    queryKey: ["/api/admin/verifications"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: number;
      status: "approved" | "rejected";
      notes: string;
    }) => {
      await apiRequest("POST", `/api/admin/verifications/${id}/review`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: tr("admin.verification_updated", "Verification updated") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const pendingVerifications = verifications.filter((v) => v.status === "pending");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{tr("admin.dashboard_title", "Admin Dashboard")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr("admin.dashboard_subtitle", "Platform overview and verification management")}
          </p>
        </div>

        {/* Analytics row */}
        {analyticsLoading ? (
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: Users, label: "Total Users", value: analytics?.totalUsers ?? 0, color: "text-primary" },
              { icon: ShieldCheck, label: "Active Therapists", value: analytics?.activeTherapists ?? 0, color: "text-blue-500" },
              { icon: Calendar, label: "Sessions This Week", value: analytics?.sessionsThisWeek ?? 0, color: "text-emerald-500" },
              { icon: TrendingUp, label: "Revenue (month)", value: `${analytics?.revenueThisMonth ?? 0} د.ت`, color: "text-yellow-500" },
              { icon: Users, label: "New Users (week)", value: analytics?.newUsersThisWeek ?? 0, color: "text-violet-500" },
              { icon: FileText, label: "Pending Verif.", value: analytics?.pendingVerifications ?? 0, color: "text-orange-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                  <div>
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="verifications">
          <TabsList>
            <TabsTrigger value="verifications">
              <ShieldCheck className="h-4 w-4 me-1.5" />
              {tr("admin.verifications", "Verifications")}
              {pendingVerifications.length > 0 && (
                <Badge className="ms-2" variant="destructive">{pendingVerifications.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              <BarChart3 className="h-4 w-4 me-1.5" />
              {tr("admin.all_verifications", "All")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verifications" className="space-y-3 mt-4">
            {verificationsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {tr("admin.no_pending", "No pending verifications.")}
              </div>
            ) : (
              pendingVerifications.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-medium">{v.therapistName || `Therapist ${v.therapistId.slice(0, 8)}`}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {v.documentType.replace("_", " ")} document
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge variant="secondary">Pending</Badge>
                        <a href={v.documentUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 me-1" />
                            View Doc
                          </Button>
                        </a>
                      </div>
                    </div>
                    <Textarea
                      placeholder={tr("admin.reviewer_notes", "Reviewer notes (optional)")}
                      value={reviewNotes[v.id] || ""}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          reviewMutation.mutate({
                            id: v.id,
                            status: "approved",
                            notes: reviewNotes[v.id] || "",
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        onClick={() =>
                          reviewMutation.mutate({
                            id: v.id,
                            status: "rejected",
                            notes: reviewNotes[v.id] || "",
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-3 mt-4">
            {verificationsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : verifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {tr("admin.no_verifications", "No verification submissions yet.")}
              </div>
            ) : (
              verifications.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{v.documentType.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.therapistName || v.therapistId.slice(0, 8)} ·{" "}
                      {v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      v.status === "approved"
                        ? "default"
                        : v.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                    className="capitalize"
                  >
                    {v.status}
                  </Badge>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
