import { useEffect, useMemo, useRef, useState } from "react";
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
  HeartHandshake,
  MessageCircle,
  Send,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { BrowsableListener, PeerMessage, PeerSession, User } from "@shared/schema";

interface PeerSessionsResponse {
  sessions: (PeerSession & { otherUser: User })[];
  activeQueueEntry: null;
}

const peerQuickTopics = ["anxiety", "stress", "relationships", "self_esteem", "grief", "depression"];

const languageOptions = [
  { value: "", label: "All languages" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Francais" },
] as const;

function readableQueueStatus(status: string, fallback: string): string {
  const value = status.trim().toLowerCase();
  if (value === "waiting") return "Waiting";
  if (value === "matched") return "Matched";
  if (value === "cancelled") return "Cancelled";
  if (value === "active") return "Active";
  if (value === "ended") return "Ended";
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
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"directory" | "sessions" | "chat">("directory");
  const [justEndedSessionId, setJustEndedSessionId] = useState<number | null>(null);
  const messageListEndRef = useRef<HTMLDivElement | null>(null);

  // Directory filters
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterAvailable, setFilterAvailable] = useState(false);

  // Confirm dialog before starting a direct session
  const [confirmListener, setConfirmListener] = useState<BrowsableListener | null>(null);

  const { data: sessionsPayload, isLoading: sessionsLoading } = useQuery<PeerSessionsResponse>({
    queryKey: ["/api/peer/sessions"],
  });

  const { data: listeners = [], isLoading: listenersLoading } = useQuery<BrowsableListener[]>({
    queryKey: ["/api/listeners/browse", filterLanguage, filterTopic, filterAvailable],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterLanguage) params.set("language", filterLanguage);
      if (filterTopic) params.set("topic", filterTopic);
      if (filterAvailable) params.set("available", "1");
      const res = await fetch(`/api/listeners/browse?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch listeners");
      return res.json();
    },
  });

  const sessions = sessionsPayload?.sessions || [];

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
      setMobilePanel("chat");
      return;
    }
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
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
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      messageListEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages?.length, selectedSessionId]);

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

  const startDirectSessionMutation = useMutation({
    mutationFn: async (listenerId: string) => {
      const res = await apiRequest("POST", "/api/peer/session/direct", { listenerId });
      return res.json();
    },
    onSuccess: (session: PeerSession) => {
      setConfirmListener(null);
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
      setSelectedSessionId(session.id);
      setMobilePanel("chat");
      toast({ title: tr("peer.session_started", "Session started! Say hello.") });
    },
    onError: (error: Error) => {
      setConfirmListener(null);
      const msg = error.message.includes("busy")
        ? tr("peer.listener_busy", "This listener just became unavailable. Please choose another.")
        : error.message;
      toast({ title: msg, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
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

  const canSend = selectedSession?.status === "active" && messageText.trim().length > 0;
  const isClientViewingEndedSession = Boolean(
    selectedSession && selectedSession.status !== "active" && user?.id === selectedSession.clientId,
  );
  const shouldHighlightClosingCard = justEndedSessionId !== null && justEndedSessionId === selectedSession?.id;

  const availableCount = listeners.filter((l) => l.isAvailable).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" />
            {tr("peer.directory_title", "Peer Listeners")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr("peer.directory_subtitle", "Choose a listener and start a private, free conversation.")}
          </p>
        </div>

        {/* Mobile tab bar */}
        <div className="md:hidden grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant={mobilePanel === "directory" ? "secondary" : "outline"}
            onClick={() => setMobilePanel("directory")}
          >
            {tr("peer.browse", "Browse")}
          </Button>
          <Button
            size="sm"
            variant={mobilePanel === "sessions" ? "secondary" : "outline"}
            onClick={() => setMobilePanel("sessions")}
          >
            {t("peer.sessions")}
          </Button>
          <Button
            size="sm"
            variant={mobilePanel === "chat" ? "secondary" : "outline"}
            onClick={() => setMobilePanel("chat")}
          >
            {t("peer.conversation")}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_280px_minmax(0,1fr)]">
          {/* ── Listener Directory ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={mobilePanel === "directory" ? "" : "hidden md:block"}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {tr("peer.listeners_title", "Available Listeners")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${availableCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                    {availableCount} {tr("peer.online", "online")}
                  </span>
                </CardTitle>

                {/* Filters */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {languageOptions.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => setFilterLanguage(lang.value)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          filterLanguage === lang.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 hover:bg-muted"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterTopic("")}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        filterTopic === ""
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 hover:bg-muted"
                      }`}
                    >
                      {tr("peer.all_topics", "All topics")}
                    </button>
                    {peerQuickTopics.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setFilterTopic(topic === filterTopic ? "" : topic)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          filterTopic === topic
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 hover:bg-muted"
                        }`}
                      >
                        {t(`specialization.${topic}`)}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterAvailable}
                      onChange={(e) => setFilterAvailable(e.target.checked)}
                      className="rounded"
                    />
                    {tr("peer.available_only", "Available now only")}
                  </label>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-3 space-y-2">
                    {listenersLoading ? (
                      <>
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </>
                    ) : listeners.length === 0 ? (
                      <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                        <Users className="h-8 w-8 mx-auto text-muted-foreground/40" />
                        <p>{tr("peer.no_listeners", "No listeners match your filters right now.")}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFilterLanguage("");
                            setFilterTopic("");
                            setFilterAvailable(false);
                          }}
                        >
                          {tr("peer.clear_filters", "Clear filters")}
                        </Button>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {listeners.map((listener, index) => (
                          <motion.div
                            key={listener.userId}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="rounded-lg border bg-card p-3 space-y-2 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xl select-none">
                                  {listener.avatarEmoji}
                                </div>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                    listener.isAvailable ? "bg-emerald-500" : "bg-muted-foreground/40"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium">
                                    {listener.displayAlias || tr("peer.anonymous_listener", "Anonymous Listener")}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {tr("peer.level", "Lvl")} {listener.level}
                                  </Badge>
                                  {listener.isAvailable ? (
                                    <Badge className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                                      {tr("peer.available", "Available")}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      {tr("peer.busy", "Busy")}
                                    </Badge>
                                  )}
                                </div>
                                {listener.headline && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{listener.headline}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  {listener.totalSessions > 0 && (
                                    <span>{listener.totalSessions} {tr("peer.sessions_count", "sessions")}</span>
                                  )}
                                  {listener.averageRating !== null && listener.averageRating !== undefined && (
                                    <span className="flex items-center gap-0.5">
                                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                      {listener.averageRating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={!listener.isAvailable || startDirectSessionMutation.isPending}
                              onClick={() => setConfirmListener(listener)}
                            >
                              {listener.isAvailable
                                ? tr("peer.start_session", "Start session")
                                : tr("peer.listener_unavailable", "Unavailable")}
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Session List Sidebar ── */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className={mobilePanel === "sessions" ? "" : "hidden md:block"}
          >
            <Card>
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
                      sessions.map((session, index) => (
                        <motion.button
                          key={session.id}
                          type="button"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`w-full rounded-md border px-3 py-2 text-start transition-colors ${selectedSessionId === session.id ? "bg-muted" : "hover:bg-muted/40"}`}
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
                        </motion.button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Chat Panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className={mobilePanel === "chat" ? "" : "hidden md:block"}
          >
            <Card>
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
                          <AnimatePresence initial={false}>
                            {messages.map((message) => {
                              const mine = message.senderId === user?.id;
                              return (
                                <motion.div
                                  key={message.id}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                                >
                                  <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                    {message.content}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                          <div ref={messageListEndRef} />
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
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (!canSend || sendMessageMutation.isPending) return;
                          sendMessageMutation.mutate();
                        }}
                        placeholder={tr("peer.type_message", "Type your message...")}
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
                      <Card className={`safe-surface border-0 ${shouldHighlightClosingCard ? "ring-1 ring-primary/40" : ""}`} data-testid="peer-closing-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <HeartHandshake className="h-4 w-4 text-primary" />
                            {tr("peer.not_alone_title", "You are not alone")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {tr("peer.ended_help", "You did something brave today. If you need more structured support, therapists are available.")}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setMobilePanel("directory")}
                            >
                              {tr("peer.browse_more", "Browse more listeners")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { window.location.href = "/self-care"; }}>
                              {tr("peer.open_selfcare", "Open self-care")}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { window.location.href = "/crisis"; }}>
                              {tr("peer.crisis_support", "Crisis support")}
                            </Button>
                            <Button size="sm" className="gap-1.5" onClick={() => { window.location.href = "/therapists"; }}>
                              <HeartHandshake className="h-3.5 w-3.5" />
                              {tr("peer.find_therapist", "Talk to a therapist")}
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
                  <div className="h-[360px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
                    <p>{tr("peer.pick_listener", "Pick a listener from the directory to start a private session.")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Confirm start session dialog */}
        <Dialog open={!!confirmListener} onOpenChange={(open) => { if (!open) setConfirmListener(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr("peer.confirm_title", "Start a session?")}</DialogTitle>
              <DialogDescription>
                {tr("peer.confirm_desc", "You'll be connected to this listener. The conversation is private and free.")}
              </DialogDescription>
            </DialogHeader>
            {confirmListener && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  {confirmListener.avatarEmoji}
                </div>
                <div>
                  <p className="font-medium">{confirmListener.displayAlias || tr("peer.anonymous_listener", "Anonymous Listener")}</p>
                  {confirmListener.headline && (
                    <p className="text-sm text-muted-foreground">{confirmListener.headline}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>{tr("peer.privacy_note", "Your real name is never shown. Listeners are trained volunteers verified by our team.")}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmListener(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => confirmListener && startDirectSessionMutation.mutate(confirmListener.userId)}
                disabled={startDirectSessionMutation.isPending}
              >
                {startDirectSessionMutation.isPending
                  ? tr("common.loading", "Starting...")
                  : tr("peer.start_session", "Start session")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
