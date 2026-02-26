import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CreditCard, Receipt, UserCircle, Wallet } from "lucide-react";
import type { PaymentTransaction } from "@shared/schema";

function formatStatus(value: string): string {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const isClient = user?.role === "client";

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/payments"],
    enabled: isClient,
  });

  const sortedPayments = useMemo(() => {
    return [...(payments || [])].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  }, [payments]);

  const totalPaid = sortedPayments.reduce((sum, payment) => sum + payment.amountDinar, 0);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{tr("settings.title", "Profile & settings")}</h1>
          <p className="text-sm text-muted-foreground">
            {tr("settings.subtitle", "Manage your account and billing details in one place.")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card data-testid="card-settings-account">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" />
                {tr("settings.account", "Account")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{tr("settings.name", "Name")}</p>
                <p className="text-sm font-medium">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || tr("common.anonymous", "Anonymous")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr("settings.email", "Email")}</p>
                <p className="text-sm font-medium break-all">{user?.email || "-"}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/60 p-2.5">
                <span className="text-xs text-muted-foreground">{tr("settings.role", "Role")}</span>
                <Badge variant="secondary" className="capitalize">
                  {user?.role || "client"}
                </Badge>
              </div>
              <div className="space-y-2 pt-1">
                <Link href="/grow">
                  <Button variant="outline" size="sm" className="w-full">
                    {tr("settings.open_growth", "Open growth paths")}
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full">
                    {tr("settings.back_today", "Back to today")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2" data-testid="card-settings-payments">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                {tr("settings.payments", "Payments")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isClient && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {tr("settings.payments_client_only", "Payment history is available for client accounts.")}
                </div>
              )}

              {isClient && (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">{tr("settings.total_paid", "Total paid")}</p>
                      <p className="text-lg font-semibold">{totalPaid} {t("common.dinar")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">{tr("settings.transactions", "Transactions")}</p>
                      <p className="text-lg font-semibold">{sortedPayments.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">{tr("settings.latest_status", "Latest status")}</p>
                      <p className="text-lg font-semibold capitalize">
                        {sortedPayments[0] ? formatStatus(sortedPayments[0].status) : tr("common.none", "None")}
                      </p>
                    </div>
                  </div>

                  {paymentsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : sortedPayments.length > 0 ? (
                    <div className="space-y-2">
                      {sortedPayments.slice(0, 12).map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-lg border p-3 flex items-center justify-between gap-3"
                          data-testid={`payment-item-${payment.id}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              {payment.paymentMethod.toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "-"}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="text-sm font-semibold">{payment.amountDinar} {t("common.dinar")}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {formatStatus(payment.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4">
                      <p className="text-sm text-muted-foreground mb-2">
                        {tr("settings.no_payments", "No payments yet.")}
                      </p>
                      <Link href="/therapists">
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Receipt className="h-4 w-4" />
                          {tr("settings.book_first", "Book your first session")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
