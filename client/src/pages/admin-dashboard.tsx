import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { DashboardSidebarLayout } from "@/components/dashboard-sidebar-layout";
import type { DashboardNavItem } from "@/components/dashboard-sidebar-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Download,
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
import type { TherapistVerification, AuditLog, DoctorPayout, TierUpgradeRequest, UserSubscription } from "@shared/schema";
import { PackageCheck, Clock, AlertTriangle, LayoutDashboard } from "lucide-react";

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

  const [activeSection, setActiveSection] = useState("overview");

  if (user?.role !== "admin" && user?.role !== "moderator") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t("admin.access_denied")}</p>
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

  const { data: allSubscriptions = [], isLoading: subsLoading } = useQuery<UserSubscription[]>({
    queryKey: ["/api/admin/subscriptions"],
    enabled: user?.role === "admin",
  });

  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/doctor-payouts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctor-payouts"] });
      toast({ title: t("admin.payout_status_updated") });
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
      toast({ title: t("admin.verification_updated") });
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
      toast({ title: t("admin.flag_reviewed") });
    },
  });

  const userRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userPage, userSearch] });
      toast({ title: t("admin.user_role_updated") });
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
      toast({ title: t("admin.tier_upgrade_reviewed") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const pendingVerifications = verifications
    .filter((v) => v.status === "pending")
    .sort((a, b) => {
      // Overdue first, then closest deadline first
      const aDeadline = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
      const bDeadline = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
      return aDeadline - bDeadline;
    });

  const getSlaInfo = (slaDeadline: string | null | undefined) => {
    if (!slaDeadline) return null;
    const deadline = new Date(slaDeadline);
    const now = new Date();
    const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft < 0) return { label: "Overdue", color: "text-destructive font-semibold", icon: "🔴" };
    if (hoursLeft < 24) return { label: `${Math.ceil(hoursLeft)}h left`, color: "text-orange-600 dark:text-orange-400 font-medium", icon: "🟠" };
    if (hoursLeft < 48) return { label: `${Math.ceil(hoursLeft)}h left`, color: "text-yellow-600 dark:text-yellow-400", icon: "🟡" };
    return { label: deadline.toLocaleDateString(), color: "text-muted-foreground", icon: "🟢" };
  };

  const exportUsersCsv = () => {
    const rows = usersData?.users ?? [];
    if (rows.length === 0) return;
    const header = ["id", "email", "firstName", "lastName", "role", "createdAt"];
    const lines = [
      header.join(","),
      ...rows.map((u) =>
        [u.id, u.email ?? "", u.firstName ?? "", u.lastName ?? "", u.role, u.createdAt ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shifa-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navItems: DashboardNavItem[] = useMemo(() => {
    const items: DashboardNavItem[] = [
      { id: "overview", label: t("admin.overview"), icon: LayoutDashboard },
      { id: "verifications", label: t("admin.verifications_tab"), icon: ShieldCheck, badge: pendingVerifications.length },
    ];
    if (user?.role === "admin") {
      items.push(
        { id: "users", label: t("admin.users_tab"), icon: Users },
        { id: "revenue", label: t("admin.revenue_tab"), icon: BarChart3 },
        { id: "payouts", label: t("admin.payouts_tab"), icon: DollarSign },
        { id: "tier-upgrades", label: t("admin.tier_upgrades_tab"), icon: ArrowUpCircle, badge: tierUpgradeRequests.filter((r) => r.status === "pending").length },
        { id: "subscriptions", label: t("admin.subscriptions_tab"), icon: PackageCheck },
      );
    }
    items.push(
      { id: "moderation", label: t("admin.moderation_tab"), icon: Flag, badge: contentFlags.filter((f) => f.status === "pending").length },
      { id: "audit", label: t("admin.audit_tab"), icon: Activity },
    );
    return items;
  }, [t, pendingVerifications.length, tierUpgradeRequests, contentFlags, user?.role]);

  return (
    <AppLayout>
      <DashboardSidebarLayout
        items={navItems}
        activeId={activeSection}
        onNavigate={setActiveSection}
        title={t("admin.dashboard_title")}
        subtitle={t("admin.dashboard_subtitle")}
      >
        <div className="space-y-6">

        {/* Overview — Analytics row */}
        {activeSection === "overview" && (
          <>
            {analyticsLoading ? (
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { icon: Users, label: t("admin.total_users"), value: analytics?.totalUsers ?? 0, color: "text-primary" },
                  { icon: ShieldCheck, label: t("admin.active_therapists"), value: analytics?.activeTherapists ?? 0, color: "text-blue-500" },
                  { icon: Calendar, label: t("admin.sessions_this_week"), value: analytics?.sessionsThisWeek ?? 0, color: "text-emerald-500" },
                  { icon: TrendingUp, label: t("admin.revenue_month"), value: `${analytics?.revenueThisMonth ?? 0} د.ت`, color: "text-yellow-500" },
                  { icon: Users, label: t("admin.new_users_week"), value: analytics?.newUsersThisWeek ?? 0, color: "text-violet-500" },
                  { icon: FileText, label: t("admin.pending_verif"), value: analytics?.pendingVerifications ?? 0, color: "text-orange-500" },
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
          </>
        )}

        {/* Verifications Section */}
        {activeSection === "verifications" && (
          <div className="space-y-3">
            {verificationsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {t("admin.no_pending")}
              </div>
            ) : (
              pendingVerifications.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-medium">{v.therapistName || `Therapist ${v.therapistId.slice(0, 8)}`}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {t("admin.document_label").replace("{type}", v.documentType.replace("_", " "))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("admin.submitted_date").replace("{date}", v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : "—")}
                        </p>
                        {v.slaDeadline && (() => {
                          const sla = getSlaInfo(v.slaDeadline);
                          return sla ? (
                            <p className={`text-xs flex items-center gap-1 mt-0.5 ${sla.color}`}>
                              <span>{sla.icon}</span>
                              <span>SLA: {sla.label}</span>
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        {v.priority === "urgent" && <Badge variant="destructive" className="text-xs">{t("admin.urgent_badge")}</Badge>}
                        <Badge variant="secondary">{t("admin.pending_badge")}</Badge>
                        <a href={v.documentUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 me-1" />
                            {t("admin.view_doc")}
                          </Button>
                        </a>
                      </div>
                    </div>
                    <Textarea
                      placeholder={t("admin.reviewer_notes")}
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
                        {t("admin.approve")}
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
                        {t("admin.reject")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Users Section */}
        {activeSection === "users" && user?.role === "admin" && (
          <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("admin.search_placeholder")}
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportUsersCsv} disabled={!usersData?.users?.length}>
                  <Download className="h-4 w-4 me-1.5" />
                  Export CSV
                </Button>
              </div>

              {usersLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">{t("admin.table_user")}</th>
                          <th className="text-left p-3 font-medium">{t("admin.table_role")}</th>
                          <th className="text-left p-3 font-medium">{t("admin.table_joined")}</th>
                          <th className="text-left p-3 font-medium">{t("admin.table_actions")}</th>
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
                    <span>{usersData?.total ?? 0} {t("admin.total_users_count")}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage((p) => p - 1)}>
                        {t("admin.previous")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(usersData?.total ?? 0) <= userPage * 20}
                        onClick={() => setUserPage((p) => p + 1)}
                      >
                        {t("admin.next")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
          </div>
        )}

        {/* Revenue Section */}
        {activeSection === "revenue" && user?.role === "admin" && (
          <div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">{t("admin.revenue_30_days")}</CardTitle>
                    <div className="flex gap-2">
                      {(["users", "therapists", "appointments"] as const).map((type) => (
                        <a
                          key={type}
                          href={`/api/admin/export/${type}`}
                          download
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors font-medium"
                        >
                          <Download className="h-3 w-3" />
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </a>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : revenueData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t("admin.no_revenue_data")}</p>
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
          </div>
        )}

        {/* Payouts Section */}
        {activeSection === "payouts" && user?.role === "admin" && (
          <div className="space-y-4">
              {payoutsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : allPayouts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  {t("admin.no_payouts")}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">{t("admin.table_doctor")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_period")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_sessions")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_gross")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_fee")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_net")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_status")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_actions")}</th>
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
          </div>
        )}

        {/* Tier Upgrades Section */}
        {activeSection === "tier-upgrades" && user?.role === "admin" && (
          <div className="space-y-3">
              {tierUpgradesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : tierUpgradeRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  {t("admin.no_tier_upgrades")}
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
                            {t("admin.view_portfolio")}
                          </a>
                        )}
                        {req.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => tierUpgradeReviewMutation.mutate({ id: req.id, status: "approved" })}
                              disabled={tierUpgradeReviewMutation.isPending}
                            >
                              {t("admin.approve_upgrade")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => tierUpgradeReviewMutation.mutate({ id: req.id, status: "rejected" })}
                              disabled={tierUpgradeReviewMutation.isPending}
                            >
                              {t("admin.reject")}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Subscriptions Section */}
        {activeSection === "subscriptions" && user?.role === "admin" && (
          <div>
              {subsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : allSubscriptions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  {t("admin.no_subscriptions")}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">{t("admin.table_user")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_plan")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_sessions_left")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_expires")}</th>
                        <th className="text-left p-3 font-medium">{t("admin.table_status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSubscriptions.map((sub) => (
                        <tr key={sub.id} className="border-t">
                          <td className="p-3 text-xs text-muted-foreground">{sub.userId.slice(0, 8)}…</td>
                          <td className="p-3 font-medium">{sub.plan?.nameAr ?? sub.plan?.name ?? `Plan ${sub.planId}`}</td>
                          <td className="p-3">{sub.sessionsRemaining}</td>
                          <td className="p-3 text-xs text-muted-foreground">{new Date(sub.expiresAt).toLocaleDateString()}</td>
                          <td className="p-3">
                            <Badge
                              variant={sub.status === "active" ? "default" : sub.status === "cancelled" ? "destructive" : "secondary"}
                              className="capitalize"
                            >
                              {sub.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        {/* Moderation Section */}
        {activeSection === "moderation" && (
          <div className="space-y-3">
            {flagsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : contentFlags.filter((f) => f.status === "pending").length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {t("admin.no_pending_flags")}
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
                          {flag.messageType} · {new Date(flag.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => flagReviewMutation.mutate({ id: flag.id, action: "dismiss" })}
                          disabled={flagReviewMutation.isPending}
                        >
                          {t("admin.dismiss")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => flagReviewMutation.mutate({ id: flag.id, action: "escalate" })}
                          disabled={flagReviewMutation.isPending}
                        >
                          {t("admin.escalate")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        )}

        {/* Audit Log Section */}
        {activeSection === "audit" && (
          <div>
            {auditLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : auditLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {t("admin.no_audit_logs")}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">{t("admin.table_action")}</th>
                      <th className="text-left p-3 font-medium">{t("admin.table_resource")}</th>
                      <th className="text-left p-3 font-medium">{t("admin.table_actor")}</th>
                      <th className="text-left p-3 font-medium">{t("admin.table_time")}</th>
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
          </div>
        )}

        </div>
      </DashboardSidebarLayout>
    </AppLayout>
  );
}
