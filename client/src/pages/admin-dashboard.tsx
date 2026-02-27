import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Search,
  Flag,
  Activity,
  DollarSign,
  GraduationCap,
  ArrowUpCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TherapistVerification, AuditLog, DoctorPayout, TierUpgradeRequest } from "@shared/schema";

interface AdminAnalytics {
  totalUsers: number;
  activeTherapists: number;
  sessionsThisWeek: number;
  revenueThisMonth: number;
  newUsersThisWeek: number;
  pendingVerifications: number;
}

interface UserRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string | null;
}

interface ContentFlag {
  id: number;
  messageType: string;
  messageId: number;
  flagReason: string;
  severity: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);

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

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-log"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/audit-log?limit=50");
      return res.json();
    },
  });

  const { data: contentFlags = [], isLoading: flagsLoading } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/content-flags"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/content-flags?status=pending&limit=50");
      return res.json();
    },
  });

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery<{ date: string; amount: number }[]>({
    queryKey: ["/api/admin/revenue"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/revenue?days=30");
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: UserRow[]; total: number }>({
    queryKey: ["/api/admin/users", userPage, userSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(userPage), limit: "20" });
      if (userSearch) params.set("search", userSearch);
      const res = await apiRequest("GET", `/api/admin/users?${params}`);
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  const { data: allPayouts = [], isLoading: payoutsLoading } = useQuery<(DoctorPayout & { doctorName?: string })[]>({
    queryKey: ["/api/admin/doctor-payouts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/doctor-payouts");
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  const { data: tierUpgradeRequests = [], isLoading: tierUpgradesLoading } = useQuery<(TierUpgradeRequest & { doctorName?: string })[]>({
    queryKey: ["/api/admin/tier-upgrades"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/tier-upgrades");
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/doctor-payouts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctor-payouts"] });
      toast({ title: "Payout status updated" });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
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

  const flagReviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "dismiss" | "escalate" }) => {
      await apiRequest("POST", `/api/admin/content-flags/${id}/review`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-flags"] });
      toast({ title: "Flag reviewed" });
    },
  });

  const userRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userPage, userSearch] });
      toast({ title: "User role updated" });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const tierUpgradeReviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      await apiRequest("PATCH", `/api/admin/tier-upgrades/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-upgrades"] });
      toast({ title: "Tier upgrade request reviewed" });
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
            {tr("admin.dashboard_subtitle", "Platform overview and management")}
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
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="verifications">
              <ShieldCheck className="h-4 w-4 me-1.5" />
              Verifications
              {pendingVerifications.length > 0 && (
                <Badge className="ms-2" variant="destructive">{pendingVerifications.length}</Badge>
              )}
            </TabsTrigger>
            {user?.role === "admin" && (
              <>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 me-1.5" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="revenue">
                  <BarChart3 className="h-4 w-4 me-1.5" />
                  Revenue
                </TabsTrigger>
                <TabsTrigger value="payouts">
                  <DollarSign className="h-4 w-4 me-1.5" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="tier-upgrades">
                  <ArrowUpCircle className="h-4 w-4 me-1.5" />
                  Tier Upgrades
                  {tierUpgradeRequests.filter((r) => r.status === "pending").length > 0 && (
                    <Badge className="ms-2" variant="destructive">
                      {tierUpgradeRequests.filter((r) => r.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="moderation">
              <Flag className="h-4 w-4 me-1.5" />
              Moderation
              {contentFlags.filter((f) => f.status === "pending").length > 0 && (
                <Badge className="ms-2" variant="destructive">
                  {contentFlags.filter((f) => f.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Activity className="h-4 w-4 me-1.5" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Verifications Tab */}
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

          {/* Users Tab (admin only) */}
          {user?.role === "admin" && (
            <TabsContent value="users" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  />
                </div>
              </div>

              {usersLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">User</th>
                          <th className="text-left p-3 font-medium">Role</th>
                          <th className="text-left p-3 font-medium">Joined</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(usersData?.users ?? []).map((u) => (
                          <tr key={u.id} className="border-t">
                            <td className="p-3">
                              <p className="font-medium">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </td>
                            <td className="p-3">
                              <Badge variant={u.role === "admin" ? "destructive" : u.role === "therapist" ? "default" : "secondary"} className="capitalize">
                                {u.role}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="p-3">
                              {u.id !== user.id && (
                                <select
                                  className="text-xs border rounded px-1 py-0.5 bg-background"
                                  value={u.role}
                                  onChange={(e) => userRoleMutation.mutate({ id: u.id, role: e.target.value })}
                                  disabled={userRoleMutation.isPending}
                                >
                                  {["user", "client", "therapist", "moderator", "admin"].map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{usersData?.total ?? 0} total users</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(usersData?.total ?? 0) <= userPage * 20}
                        onClick={() => setUserPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          )}

          {/* Revenue + Payouts Tabs (admin only) */}
          {user?.role === "admin" && (
            <>
            <TabsContent value="revenue" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : revenueData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No revenue data yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(d) => d.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 11 }} unit=" د.ت" />
                        <Tooltip
                          formatter={(value: number) => [`${value} د.ت`, "Revenue"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payouts Tab */}
            <TabsContent value="payouts" className="space-y-4 mt-4">
              {payoutsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : allPayouts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  No payouts generated yet.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Doctor</th>
                        <th className="text-left p-3 font-medium">Period</th>
                        <th className="text-left p-3 font-medium">Sessions</th>
                        <th className="text-left p-3 font-medium">Gross</th>
                        <th className="text-left p-3 font-medium">Fee</th>
                        <th className="text-left p-3 font-medium">Net</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPayouts.map((payout) => (
                        <tr key={payout.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{payout.doctorName || `Doctor ${payout.doctorId.slice(0, 8)}`}</p>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {new Date(payout.periodStart).toLocaleDateString()} — {new Date(payout.periodEnd).toLocaleDateString()}
                          </td>
                          <td className="p-3">{payout.totalSessions}</td>
                          <td className="p-3">{payout.totalAmountDinar} د.ت</td>
                          <td className="p-3 text-red-500">-{payout.platformFeeDinar} د.ت</td>
                          <td className="p-3 font-semibold text-emerald-600">{payout.netAmountDinar} د.ت</td>
                          <td className="p-3">
                            <Badge
                              variant={payout.status === "paid" ? "default" : payout.status === "failed" ? "destructive" : "secondary"}
                              className="capitalize"
                            >
                              {payout.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {payout.status !== "paid" && (
                              <select
                                className="text-xs border rounded px-1 py-0.5 bg-background"
                                value={payout.status}
                                onChange={(e) => updatePayoutMutation.mutate({ id: payout.id, status: e.target.value })}
                                disabled={updatePayoutMutation.isPending}
                              >
                                {["pending", "processing", "paid", "failed"].map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Tier Upgrades Tab */}
            <TabsContent value="tier-upgrades" className="space-y-3 mt-4">
              {tierUpgradesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : tierUpgradeRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  No tier upgrade requests yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {tierUpgradeRequests.map((req) => (
                    <Card key={req.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-0.5">
                            <p className="font-medium flex items-center gap-1.5">
                              <GraduationCap className="h-4 w-4 text-primary" />
                              {req.doctorName || `Doctor ${req.doctorId.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.currentTier} → {req.requestedTier}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {req.status}
                          </Badge>
                        </div>
                        {req.justification && (
                          <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">{req.justification}</p>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            </>
          )}

          {/* Moderation Tab */}
          <TabsContent value="moderation" className="space-y-3 mt-4">
            {flagsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : contentFlags.filter((f) => f.status === "pending").length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                No pending content flags.
              </div>
            ) : (
              contentFlags
                .filter((f) => f.status === "pending")
                .map((flag) => (
                  <Card key={flag.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              flag.severity === "critical" || flag.severity === "high"
                                ? "destructive"
                                : "secondary"
                            }
                            className="capitalize"
                          >
                            {flag.severity}
                          </Badge>
                          <span className="text-sm font-medium capitalize">{flag.flagReason.replace("_", " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">
                          {flag.messageType} message · {new Date(flag.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => flagReviewMutation.mutate({ id: flag.id, action: "dismiss" })}
                          disabled={flagReviewMutation.isPending}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => flagReviewMutation.mutate({ id: flag.id, action: "escalate" })}
                          disabled={flagReviewMutation.isPending}
                        >
                          Escalate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="mt-4">
            {auditLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : auditLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                No audit log entries.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Resource</th>
                      <th className="text-left p-3 font-medium">Actor</th>
                      <th className="text-left p-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{log.action}</td>
                        <td className="p-3 text-muted-foreground text-xs capitalize">
                          {log.resourceType}
                          {log.resourceId && ` #${log.resourceId.slice(0, 8)}`}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {log.actorId ? log.actorId.slice(0, 8) : "system"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
