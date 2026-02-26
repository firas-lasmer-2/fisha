import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Clock3,
  HeartHandshake,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { ListenerQueueEntry, PeerMessage, PeerSession, User } from "@shared/schema";

interface PeerSessionsResponse {
  sessions: (PeerSession & { otherUser: User })[];
  activeQueueEntry: ListenerQueueEntry | null;
}

interface PeerQueueStatusResponse {
  activeQueueEntry: ListenerQueueEntry | null;
  queuePosition: number | null;
  waitingCount: number;
  availableListeners: number;
  availableForYou: number;
  estimatedWaitMinutes: number | null;
}

const peerQuickTopics = ["anxiety", "stress", "relationships", "self_esteem", "grief", "depression"];

const languageOptions = [
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Francais" },
  { value: "darija", label: "Darija" },
] as const;

function readableQueueStatus(status: string, fallback: string): string {
  const value = status.trim().toLowerCase();
  if (value === "waiting") return "Waiting";
  if (value === "matched") return "Matched";
  if (value === "cancelled") return "Cancelled";
  return fallback;
}

export default function PeerSupportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("ar");
  const [quickTopics, setQuickTopics] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"sessions" | "chat">("chat");
  const [expectationsOpen, setExpectationsOpen] = useState(false);
  const [justEndedSessionId, setJustEndedSessionId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.languagePreference && ["ar", "fr", "darija"].includes(user.languagePreference)) {
      setPreferredLanguage(user.languagePreference);
    }
  }, [user?.languagePreference]);

  const { data: sessionsPayload, isLoading: sessionsLoading } = useQuery<PeerSessionsResponse>({
    queryKey: ["/api/peer/sessions"],
  });

  const { data: queueStatus } = useQuery<PeerQueueStatusResponse>({
    queryKey: ["/api/peer/queue/status"],
    refetchInterval: 15000,
  });

  const sessions = sessionsPayload?.sessions || [];
  const activeQueueEntry = sessionsPayload?.activeQueueEntry || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionParam = new URLSearchParams(window.location.search).get("session");
    const parsed = Number(sessionParam);
    if (Number.isInteger(parsed) && parsed > 0) {
      setSelectedSessionId(parsed);
      setMobilePanel("chat");
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) return;
    const activeSession = sessions.find((session) => session.status === "active");
    if (activeSession) {
      setSelectedSessionId(activeSession.id);
      return;
    }
    setSelectedSessionId(sessions[0]?.id || null);
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [selectedSessionId, sessions],
  );

  const { data: messages, isLoading: messagesLoading } = useQuery<PeerMessage[]>({
    queryKey: ["/api/peer/session", selectedSessionId, "messages"],
    enabled: !!selectedSessionId,
  });

  useEffect(() => {
    if (!selectedSessionId) return;
    const channel = supabase
      .channel(`peer-session-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "peer_messages",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["/api/peer/session", selectedSessionId, "messages"],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSessionId]);

  const joinQueueMutation = useMutation({
    mutationFn: async () => {
      const topicTags = Array.from(new Set(quickTopics));
      const response = await apiRequest("POST", "/api/peer/queue/join", {
        preferredLanguage,
        topicTags,
      });
      return response.json();
    },
    onSuccess: (payload: { matched?: boolean; session?: PeerSession | null }) => {
      setExpectationsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer/queue/status"] });
      if (payload?.session?.id) {
        setSelectedSessionId(payload.session.id);
        setMobilePanel("chat");
      }
      toast({
        title: payload?.matched ? t("peer.matched") : t("peer.joined_queue"),
        description: payload?.matched ? t("peer.matched_desc") : t("peer.queued_desc"),
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const leaveQueueMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/peer/queue/leave");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer/queue/status"] });
      toast({ title: t("peer.left_queue") });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) return;
      await apiRequest("POST", `/api/peer/session/${selectedSessionId}/messages`, {
        content: messageText,
      });
    },
    onSuccess: () => {
      if (!selectedSessionId) return;
      setMessageText("");
      queryClient.invalidateQueries({
        queryKey: ["/api/peer/session", selectedSessionId, "messages"],
      });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) return;
      await apiRequest("POST", `/api/peer/session/${selectedSessionId}/end`);
    },
    onSuccess: () => {
      setJustEndedSessionId(selectedSessionId);
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/peer/queue/status"] });
      toast({ title: t("peer.session_ended") });
    },
  });

  const rateSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) return;
      await apiRequest("POST", `/api/peer/session/${selectedSessionId}/rate`, {
        rating,
        comment: feedbackComment || null,
      });
    },
    onSuccess: () => {
      setFeedbackComment("");
      toast({ title: t("peer.feedback_submitted") });
    },
    onError: (error: Error) => {
      const message = error.message.includes("Feedback already submitted")
        ? tr("peer.feedback_already_submitted", "Feedback already submitted for this session")
        : t("peer.feedback_error");
      toast({ title: message, variant: "destructive" });
    },
  });

  const reportSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) return;
      await apiRequest("POST", `/api/peer/session/${selectedSessionId}/report`, {
        reason: reportReason,
        details: reportDetails || null,
        severity: "medium",
      });
    },
    onSuccess: () => {
      setReportReason("");
      setReportDetails("");
      toast({ title: t("peer.report_submitted") });
    },
  });

  const queueEntry = queueStatus?.activeQueueEntry || activeQueueEntry;
  const isWaitingInQueue = queueEntry?.status === "waiting";
  const queuePosition = queueStatus?.queuePosition;
  const availableListeners = queueStatus?.availableListeners || 0;
  const availableForYou = queueStatus?.availableForYou || 0;
  const estimatedWaitMinutes = queueStatus?.estimatedWaitMinutes;

  const canSend = selectedSession?.status === "active" && messageText.trim().length > 0;
  const isClientViewingEndedSession = Boolean(
    selectedSession && selectedSession.status !== "active" && user?.id === selectedSession.clientId,
  );
  const shouldHighlightClosingCard = justEndedSessionId !== null && justEndedSessionId === selectedSession?.id;

  const toggleQuickTopic = (topic: string) => {
    setQuickTopics((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic],
    );
  };

  const isJoinDisabled = joinQueueMutation.isPending || !!queueEntry;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HeartHandshake className="h-5 w-5 text-primary" />
                {t("peer.title")}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setExpectationsOpen(true)}>
                {tr("peer.what_to_expect", "What to expect")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3" data-testid="peer-availability-banner">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${availableListeners > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`}
                />
                <p className="text-sm font-medium">{tr("peer.listeners_online", "Listeners online now")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={availableListeners > 0 ? "secondary" : "outline"}>{availableListeners}</Badge>
                <Badge variant="secondary">{tr("peer.free_unlimited", "Free and unlimited peer support")}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{tr("peer.select_language", "Preferred language")}</p>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => {
                  const selected = preferredLanguage === lang.value;
                  return (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => setPreferredLanguage(lang.value)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40"
                      }`}
                      data-testid={`peer-language-${lang.value}`}
                    >
                      {lang.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{tr("peer.topics_title", "Topics you want support with")}</p>
              <div className="flex flex-wrap gap-2">
                {peerQuickTopics.map((topic) => {
                  const selected = quickTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleQuickTopic(topic)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40"
                      }`}
                      data-testid={`peer-topic-${topic}`}
                    >
                      {t(`specialization.${topic}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {isWaitingInQueue && (
              <div className="grid gap-2 sm:grid-cols-3" data-testid="peer-queue-insights">
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{tr("peer.queue_position", "Queue position")}</p>
                  <p className="text-lg font-semibold">{queuePosition || "-"}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{tr("peer.eta", "Estimated wait")}</p>
                  <p className="text-lg font-semibold">{estimatedWaitMinutes ? `${estimatedWaitMinutes} ${t("common.minutes")}` : "-"}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{tr("peer.available_for_you", "Available for you")}</p>
                  <p className="text-lg font-semibold">{availableForYou}</p>
                </div>
              </div>
            )}

            {queueEntry && (
              <Badge variant="outline" data-testid="peer-queue-status-badge">
                {t("peer.queue_status")}: {tr(`peer.status_${queueEntry.status}`, readableQueueStatus(queueEntry.status, queueEntry.status))}
              </Badge>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => setExpectationsOpen(true)}
                disabled={isJoinDisabled}
                data-testid="button-peer-join-queue"
              >
                {tr("peer.join_safe", "Join queue")}
              </Button>
              <Button
                variant="outline"
                onClick={() => leaveQueueMutation.mutate()}
                disabled={leaveQueueMutation.isPending || !queueEntry}
                data-testid="button-peer-leave-queue"
              >
                {t("peer.leave_queue")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={expectationsOpen} onOpenChange={setExpectationsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr("peer.expect_title", "Before you start")}</DialogTitle>
              <DialogDescription>
                {tr("peer.expect_desc", "Peer support is warm and human, but not a replacement for professional care.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                <p>{tr("peer.expect_anonymous", "Your conversation stays anonymous by default.")}</p>
              </div>
              <div className="flex items-start gap-2">
                <HeartHandshake className="h-4 w-4 text-primary mt-0.5" />
                <p>{tr("peer.expect_listener", "Listeners are trained volunteers who offer emotional support.")}</p>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 className="h-4 w-4 text-primary mt-0.5" />
                <p>{tr("peer.expect_wait", "You might wait a few minutes before matching.")}</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <p>{tr("peer.expect_crisis", "If you are in immediate danger, use SOS for emergency support.")}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setExpectationsOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => joinQueueMutation.mutate()}
                disabled={joinQueueMutation.isPending || !!queueEntry}
              >
                {joinQueueMutation.isPending ? tr("common.loading", "Loading...") : t("peer.join_queue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="md:hidden flex items-center gap-2">
          <Button
            size="sm"
            variant={mobilePanel === "sessions" ? "secondary" : "outline"}
            onClick={() => setMobilePanel("sessions")}
            className="flex-1"
          >
            {t("peer.sessions")}
          </Button>
          <Button
            size="sm"
            variant={mobilePanel === "chat" ? "secondary" : "outline"}
            onClick={() => setMobilePanel("chat")}
            className="flex-1"
          >
            {t("peer.conversation")}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <Card className={mobilePanel === "sessions" ? "" : "hidden md:block"}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("peer.sessions")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[460px]">
                <div className="p-3 space-y-2">
                  {sessionsLoading ? (
                    <>
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </>
                  ) : sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-4">{t("peer.no_sessions")}</p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        className={`w-full rounded-md border px-3 py-2 text-start ${selectedSessionId === session.id ? "bg-muted" : ""}`}
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          setMobilePanel("chat");
                        }}
                      >
                        <p className="text-sm font-medium">
                          {session.otherUser.firstName || t("peer.anonymous")} {session.otherUser.lastName || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tr(`peer.status_${session.status}`, readableQueueStatus(session.status, session.status))} • #{session.id}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className={mobilePanel === "chat" ? "" : "hidden md:block"}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {t("peer.conversation")}
                {selectedSession && (
                  <Badge variant={selectedSession.status === "active" ? "secondary" : "outline"}>
                    {tr(`peer.status_${selectedSession.status}`, readableQueueStatus(selectedSession.status, selectedSession.status))}
                  </Badge>
                )}
              </CardTitle>
              {selectedSession?.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => endSessionMutation.mutate()}
                  disabled={endSessionMutation.isPending}
                  data-testid="button-peer-end-session"
                >
                  {t("peer.end_session")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedSession ? (
                <>
                  <ScrollArea className="h-[320px] rounded-md border p-3">
                    {messagesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-2/3" />
                        <Skeleton className="h-10 w-1/2 ms-auto" />
                      </div>
                    ) : messages && messages.length > 0 ? (
                      <div className="space-y-2">
                        {messages.map((message) => {
                          const mine = message.senderId === user?.id;
                          return (
                            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                {message.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        <MessageCircle className="h-4 w-4 me-1" />
                        {t("peer.no_messages")}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t("messages.type")}
                      disabled={selectedSession.status !== "active"}
                    />
                    <Button
                      onClick={() => sendMessageMutation.mutate()}
                      disabled={!canSend || sendMessageMutation.isPending}
                      data-testid="button-peer-send"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  {isClientViewingEndedSession && (
                    <Card className={`border-dashed ${shouldHighlightClosingCard ? "ring-1 ring-primary/40" : ""}`} data-testid="peer-closing-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {tr("peer.not_alone_title", "You are not alone")}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {tr("peer.not_alone_desc", "If you still need support, you can reconnect with another listener or use self-care tools now.")}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpectationsOpen(true)}
                            disabled={isJoinDisabled}
                          >
                            {tr("peer.rejoin_queue", "Join queue again")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { window.location.href = "/self-care"; }}>
                            {tr("peer.open_selfcare", "Open self-care")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { window.location.href = "/crisis"; }}>
                            {tr("peer.crisis_support", "Crisis support")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedSession.status !== "active" && user?.id === selectedSession.clientId && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Card className="border-dashed">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            {t("peer.rate_session")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-1" data-testid="peer-star-rating">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setRating(score)}
                                className="rounded-md p-1 hover:bg-muted"
                                aria-label={`rate-${score}`}
                              >
                                <Star
                                  className={`h-5 w-5 ${score <= rating ? "text-amber-500 fill-amber-400" : "text-muted-foreground"}`}
                                />
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tr("peer.rating_selected", "Selected")}: {rating}/5
                          </p>
                          <Textarea
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder={t("peer.optional_comment")}
                            rows={3}
                          />
                          <Button
                            size="sm"
                            onClick={() => rateSessionMutation.mutate()}
                            disabled={rateSessionMutation.isPending}
                            data-testid="button-peer-rate"
                          >
                            {t("peer.submit_feedback")}
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="border-dashed">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {t("peer.report_session")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Input
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder={t("peer.reason")}
                          />
                          <Textarea
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            placeholder={t("peer.details_optional")}
                            rows={3}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reportSessionMutation.mutate()}
                            disabled={!reportReason.trim() || reportSessionMutation.isPending}
                            data-testid="button-peer-report"
                          >
                            {t("peer.submit_report")}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-[360px] flex items-center justify-center text-sm text-muted-foreground">
                  {t("peer.select_session")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
