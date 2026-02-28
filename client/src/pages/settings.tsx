import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAccessToken } from "@/lib/supabase";
import { Calendar, CreditCard, Receipt, UserCircle, Wallet, AtSign, Check, X, Loader2, KeyRound, ShieldCheck, Download } from "lucide-react";
import type { PaymentTransaction } from "@shared/schema";
import { wrapPrivateKeyWithPassword, unwrapPrivateKeyWithPassword } from "@/lib/e2e";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";

function formatStatus(value: string): string {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function useDisplayNameCheck(name: string, currentName: string | null | undefined) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!name || name.length < 3 || name === currentName) {
      setAvailable(null);
      return;
    }
    const pattern = /^[a-zA-Z0-9\u0600-\u06FF_]{3,30}$/;
    if (!pattern.test(name)) {
      setAvailable(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/user/display-name/check/${encodeURIComponent(name)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setAvailable(data.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [name, currentName]);

  return { available, checking };
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const isClient = user?.role === "client";

  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName || "");
  const { available, checking } = useDisplayNameCheck(displayNameInput, user?.displayName);

  const [firstNameInput, setFirstNameInput] = useState(user?.firstName || "");
  const [lastNameInput, setLastNameInput] = useState(user?.lastName || "");

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

  const saveDisplayName = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/user/profile", { displayName: displayNameInput || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: tr("settings.display_name_saved", "Display name saved") });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const canSaveDisplayName =
    displayNameInput !== (user?.displayName || "") &&
    (displayNameInput === "" || available === true);

  const saveProfileName = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/user/profile", {
        firstName: firstNameInput || undefined,
        lastName: lastNameInput || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: tr("settings.name_saved", "Name updated") });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // ---- E2E Key Backup / Recovery ----
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("");
  const [backupMode, setBackupMode] = useState<"backup" | "restore">("backup");

  const { data: existingBackup } = useQuery<{ wrappedPrivateKey: string; salt: string; iterations: number } | null>({
    queryKey: ["/api/user/key-backup"],
    retry: false,
  });

  const saveKeyBackup = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { wrappedPrivateKey, salt, iterations } = await wrapPrivateKeyWithPassword(user.id, backupPassphrase);
      await apiRequest("POST", "/api/user/key-backup", { wrappedPrivateKey, salt, iterations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/key-backup"] });
      setBackupPassphrase("");
      toast({ title: "Recovery passphrase saved — keep it somewhere safe!" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const restoreKeyBackup = useMutation({
    mutationFn: async () => {
      if (!user?.id || !existingBackup) throw new Error("No backup found");
      await unwrapPrivateKeyWithPassword(
        user.id,
        recoveryPassphrase,
        existingBackup.wrappedPrivateKey,
        existingBackup.salt,
        existingBackup.iterations,
      );
    },
    onSuccess: () => {
      setRecoveryPassphrase("");
      toast({ title: "Private key restored successfully!" });
    },
    onError: () => {
      toast({ title: "Wrong passphrase or corrupted backup.", variant: "destructive" });
    },
  });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          title={tr("settings.title", "Profile & settings")}
          subtitle={tr("settings.subtitle", "Manage your account and billing details in one place.")}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card data-testid="card-settings-account">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" />
                {tr("settings.account", "Account")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tr("settings.name", "Name")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={firstNameInput}
                    onChange={(e) => setFirstNameInput(e.target.value)}
                    placeholder={tr("settings.first_name", "First name")}
                    data-testid="input-first-name"
                  />
                  <Input
                    value={lastNameInput}
                    onChange={(e) => setLastNameInput(e.target.value)}
                    placeholder={tr("settings.last_name", "Last name")}
                    data-testid="input-last-name"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={
                    (firstNameInput === (user?.firstName || "") &&
                      lastNameInput === (user?.lastName || "")) ||
                    saveProfileName.isPending
                  }
                  onClick={() => saveProfileName.mutate()}
                  data-testid="button-save-name"
                >
                  {saveProfileName.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    tr("settings.save_name", "Save name")
                  )}
                </Button>
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

          {/* Display Name Card */}
          <Card data-testid="card-settings-display-name">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AtSign className="h-4 w-4 text-primary" />
                {tr("settings.display_name", "Display Name")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {tr(
                  "settings.display_name_hint",
                  "This name is shown instead of your real name in peer sessions and reviews."
                )}
              </p>
              <div className="relative">
                <Input
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder={tr("settings.display_name_placeholder", "e.g. نجمة_الأمل")}
                  maxLength={30}
                  className="pr-8"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!checking && available === true && displayNameInput !== (user?.displayName || "") && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!checking && available === false && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              {!checking && available === false && displayNameInput.length >= 3 && (
                <p className="text-xs text-destructive">
                  {tr("settings.display_name_taken", "This name is already taken or contains invalid characters.")}
                </p>
              )}
              {!checking && available === true && displayNameInput !== (user?.displayName || "") && (
                <p className="text-xs text-green-600">
                  {tr("settings.display_name_available", "This name is available!")}
                </p>
              )}
              <Button
                size="sm"
                className="w-full"
                disabled={!canSaveDisplayName || saveDisplayName.isPending}
                onClick={() => saveDisplayName.mutate()}
              >
                {saveDisplayName.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  tr("settings.save_display_name", "Save display name")
                )}
              </Button>
              {user?.displayName && (
                <p className="text-xs text-muted-foreground">
                  {tr("settings.current_display_name", "Current")}: <strong>{user.displayName}</strong>
                </p>
              )}
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
                    <PageSkeleton variant="list" count={3} />
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

        {/* E2E Key Backup / Recovery */}
        <Card data-testid="card-settings-key-backup">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Encryption Key Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your messages are end-to-end encrypted. Set a recovery passphrase to back up your private key
              so you can restore access on a new device. Without this, clearing your browser data will
              permanently lose your message history.
            </p>

            {existingBackup && (
              <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                <ShieldCheck className="h-4 w-4" />
                A key backup exists. You can update your passphrase or restore from it below.
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={backupMode === "backup" ? "default" : "outline"}
                onClick={() => setBackupMode("backup")}
              >
                Set / Update Passphrase
              </Button>
              <Button
                size="sm"
                variant={backupMode === "restore" ? "default" : "outline"}
                onClick={() => setBackupMode("restore")}
                disabled={!existingBackup}
              >
                Restore Key
              </Button>
            </div>

            {backupMode === "backup" && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Choose a strong recovery passphrase"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  minLength={12}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={backupPassphrase.length < 12 || saveKeyBackup.isPending}
                  onClick={() => saveKeyBackup.mutate()}
                >
                  {saveKeyBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Key Backup"}
                </Button>
              </div>
            )}

            {backupMode === "restore" && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter your recovery passphrase"
                  value={recoveryPassphrase}
                  onChange={(e) => setRecoveryPassphrase(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!recoveryPassphrase || restoreKeyBackup.isPending}
                  onClick={() => restoreKeyBackup.mutate()}
                >
                  {restoreKeyBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore Private Key"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data export */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Data & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download a copy of all your data stored on Shifa — profile, sessions, mood logs, journal entries and more.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const token = await getAccessToken();
                const res = await fetch("/api/user/data-export", {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "shifa-data-export.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4 me-2" />
              Download my data
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
