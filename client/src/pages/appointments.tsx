import { useI18n } from "@/lib/i18n";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Loader2, CreditCard, Video, ClipboardList, SmilePlus, Copy, Check, Ban, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, User, PaymentTransaction, TherapistSlot } from "@shared/schema";

function isNearSessionTime(scheduledAt: string): boolean {
  const sessionTime = new Date(scheduledAt).getTime();
  const now = Date.now();
  const fifteenMin = 15 * 60_000;
  const thirtyMin = 30 * 60_000;
  // Show button from 15 min before until 30 min after start
  return now >= sessionTime - fifteenMin && now <= sessionTime + thirtyMin;
}

const MOOD_EMOJIS = ["😢", "😔", "😐", "🙂", "😊"];

function ConsultationPrepPanel({ appointmentId }: { appointmentId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [whatsOnMind, setWhatsOnMind] = useState("");
  const [goals, setGoals] = useState("");
  const [mood, setMood] = useState<number | null>(null);

  const { data: existing } = useQuery<any>({
    queryKey: [`/api/appointments/${appointmentId}/prep`],
    enabled: open,
  });

  useEffect(() => {
    if (existing) {
      setWhatsOnMind(existing.whatsOnMind || "");
      setGoals(existing.goalsForSession || "");
      setMood(existing.currentMood ?? null);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/appointments/${appointmentId}/prep`, {
        whatsOnMind,
        goalsForSession: goals || null,
        currentMood: mood,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}/prep`] });
      toast({ title: "Prep saved" });
      setOpen(false);
    },
    onError: () => toast({ title: "Error saving prep", variant: "destructive" }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
      >
        <ClipboardList className="h-3.5 w-3.5" />
        {existing ? "Update session prep" : "Fill in session prep"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border p-3 space-y-3 bg-muted/30">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" />
        Before your session — What's on your mind?
      </p>
      <Textarea
        value={whatsOnMind}
        onChange={(e) => setWhatsOnMind(e.target.value)}
        placeholder="Share what you'd like to talk about..."
        rows={3}
        maxLength={2000}
        className="text-sm"
      />
      <Textarea
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        placeholder="Goals for this session (optional)..."
        rows={2}
        maxLength={1000}
        className="text-sm"
      />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">How are you feeling right now?</p>
        <div className="flex gap-2">
          {MOOD_EMOJIS.map((emoji, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setMood(i + 1)}
              className={`text-xl rounded-full p-1 transition-all ${mood === i + 1 ? "bg-primary/20 ring-2 ring-primary scale-110" : "hover:bg-muted"}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!whatsOnMind || saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function MoodRatingPanel({ appointmentId }: { appointmentId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [postMood, setPostMood] = useState<number | null>(null);

  const { data: existing } = useQuery<any>({
    queryKey: [`/api/appointments/${appointmentId}/mood-rating`],
    enabled: open,
  });

  useEffect(() => {
    if (existing) setPostMood(existing.postSessionMood ?? null);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/appointments/${appointmentId}/mood-rating`, {
        postSessionMood: postMood,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/appointments/${appointmentId}/mood-rating`] });
      toast({ title: "Mood saved — thanks for sharing!" });
      setOpen(false);
    },
    onError: () => toast({ title: "Error saving", variant: "destructive" }),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
      >
        <SmilePlus className="h-3.5 w-3.5" />
        {existing?.postSessionMood ? `Post-session mood: ${MOOD_EMOJIS[existing.postSessionMood - 1]}` : "Rate how you feel after this session"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border p-3 space-y-3 bg-muted/30">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <SmilePlus className="h-3.5 w-3.5" />
        How do you feel after the session?
      </p>
      <div className="flex gap-2">
        {MOOD_EMOJIS.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPostMood(i + 1)}
            className={`text-xl rounded-full p-1 transition-all ${postMood === i + 1 ? "bg-primary/20 ring-2 ring-primary scale-110" : "hover:bg-muted"}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!postMood || saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function MeetLinkCard({ meetLink, showJoinBtn }: { meetLink: string; showJoinBtn: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(meetLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Video className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Jitsi Meet link</span>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-700 dark:text-emerald-400 underline underline-offset-2 truncate flex-1 hover:text-emerald-900"
        >
          {meetLink}
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-400 transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {!showJoinBtn && (
          <a href={meetLink} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              Open
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [now, setNow] = useState(() => Date.now());
  // Cancel dialog state
  const [cancelDialogApt, setCancelDialogApt] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  // Reschedule dialog state
  const [rescheduleDialogApt, setRescheduleDialogApt] = useState<Appointment & { otherUser: User } | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  // Tick every minute to re-evaluate "Join Meeting" eligibility
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: appointments, isLoading } = useQuery<(Appointment & { otherUser: User })[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: payments = [] } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/payments"],
    enabled: user?.role === "client",
  });

  // Show toast for payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") {
      toast({ title: "Payment successful", description: "Your session is confirmed." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (paymentStatus === "failed") {
      toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/appointments/${id}/cancel`, { reason });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to cancel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setCancelDialogApt(null);
      setCancelReason("");
      toast({ title: "Appointment cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, slotId }: { id: number; slotId: number }) => {
      const res = await apiRequest("POST", `/api/appointments/${id}/reschedule`, { slotId });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to reschedule");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setRescheduleDialogApt(null);
      setSelectedSlotId(null);
      toast({ title: "Appointment rescheduled" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // Fetch available slots for reschedule dialog
  const { data: availableSlots = [] } = useQuery<TherapistSlot[]>({
    queryKey: [`/api/therapists/${rescheduleDialogApt?.therapistId}/slots`],
    enabled: !!rescheduleDialogApt,
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
    completed: { icon: CheckCircle, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: t("appointment.completed") },
    cancelled: { icon: XCircle, color: "bg-muted text-muted-foreground", label: t("appointment.cancel") },
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
              const aptPayment = payments.find((p) => p.appointmentId === apt.id);
              const showJoinBtn = Boolean(apt.meetLink) && isNearSessionTime(apt.scheduledAt);
              return (
                <Card key={apt.id} data-testid={`appointment-card-${apt.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl gradient-calm flex items-center justify-center text-white font-bold shrink-0">
                        {(apt.otherUser.firstName?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold">
                            {apt.otherUser.firstName} {apt.otherUser.lastName}
                          </h3>
                          <Badge className={`${status.color} text-xs`}>
                            <StatusIcon className="h-3 w-3 me-1" />
                            {status.label}
                          </Badge>
                          {aptPayment && (
                            <Badge
                              variant={aptPayment.status === "completed" || aptPayment.status === "paid" ? "default" : "secondary"}
                              className="text-xs gap-1"
                            >
                              <CreditCard className="h-3 w-3" />
                              {aptPayment.status === "completed" || aptPayment.status === "paid" ? "Paid" : aptPayment.status}
                            </Badge>
                          )}
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
                        {/* Join Meeting button — shown 15 min before until 30 min after */}
                        {showJoinBtn && (
                          <div className="mt-3">
                            <a href={apt.meetLink!} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Video className="h-3.5 w-3.5" />
                                {t("google.join_meeting")}
                              </Button>
                            </a>
                          </div>
                        )}

                        {/* Jitsi link card — always visible for non-cancelled appointments with a link */}
                        {apt.meetLink && apt.status !== "cancelled" && (
                          <MeetLinkCard meetLink={apt.meetLink} showJoinBtn={showJoinBtn} />
                        )}

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
                              onClick={() => setCancelDialogApt(apt.id)}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-${apt.id}`}
                            >
                              <Ban className="h-3.5 w-3.5 me-1" />
                              {t("appointment.cancel")}
                            </Button>
                            {user?.role === "client" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRescheduleDialogApt(apt); setSelectedSlotId(null); }}
                              >
                                <RefreshCw className="h-3.5 w-3.5 me-1" />
                                Reschedule
                              </Button>
                            )}
                          </div>
                        )}

                        {apt.status === "confirmed" && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCancelDialogApt(apt.id)}
                              disabled={cancelMutation.isPending}
                            >
                              <Ban className="h-3.5 w-3.5 me-1" />
                              {t("appointment.cancel")}
                            </Button>
                            {user?.role === "client" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRescheduleDialogApt(apt); setSelectedSlotId(null); }}
                              >
                                <RefreshCw className="h-3.5 w-3.5 me-1" />
                                Reschedule
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Client-only: consultation prep (before session) */}
                        {user?.role === "client" && (apt.status === "confirmed" || apt.status === "pending") && (
                          <ConsultationPrepPanel appointmentId={apt.id} />
                        )}

                        {/* Client-only: post-session mood rating (after completed) */}
                        {user?.role === "client" && apt.status === "completed" && (
                          <MoodRatingPanel appointmentId={apt.id} />
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

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogApt !== null} onOpenChange={(open) => { if (!open) { setCancelDialogApt(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? Clients must cancel at least 24 hours in advance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Reason for cancellation (optional)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialogApt(null); setCancelReason(""); }}>
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelDialogApt !== null && cancelMutation.mutate({ id: cancelDialogApt, reason: cancelReason })}
            >
              {cancelMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              Cancel appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleDialogApt !== null} onOpenChange={(open) => { if (!open) { setRescheduleDialogApt(null); setSelectedSlotId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              Choose a new available slot with {rescheduleDialogApt?.otherUser.firstName} {rescheduleDialogApt?.otherUser.lastName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableSlots.filter((s) => s.status === "open" && new Date(s.startsAt) > new Date()).map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${selectedSlotId === slot.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <span className="font-medium">{new Date(slot.startsAt).toLocaleDateString()}</span>
                {" — "}
                {new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {slot.durationMinutes} min
                {slot.priceDinar ? ` · ${slot.priceDinar} TND` : ""}
              </button>
            ))}
            {availableSlots.filter((s) => s.status === "open" && new Date(s.startsAt) > new Date()).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No available slots found.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleDialogApt(null); setSelectedSlotId(null); }}>
              Cancel
            </Button>
            <Button
              disabled={!selectedSlotId || rescheduleMutation.isPending}
              onClick={() => rescheduleDialogApt && selectedSlotId && rescheduleMutation.mutate({ id: rescheduleDialogApt.id, slotId: selectedSlotId })}
            >
              {rescheduleMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              Confirm reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
