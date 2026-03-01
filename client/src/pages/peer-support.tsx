import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-error";
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
  ArrowLeft,
  HeartHandshake,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeUp, cardStagger, usePrefersReducedMotion, safeVariants } from "@/lib/motion";
import type { BrowsableListener, ListenerCooldown, PeerMessage, PeerSession, User } from "@shared/schema";
import { Link } from "wouter";
import { FeatureHint } from "@/components/feature-hint";
import { StatusDot } from "@/components/status-dot";

interface PeerSessionsResponse {
  sessions: (PeerSession & { otherUser: User })[];
  activeQueueEntry: null;
}

interface ListenerProgressDetailsPayload {
  cooldown: ListenerCooldown | null;
}

interface EndSessionPayload {
  session: PeerSession;
  durationMinutes: number;
  difficultSession?: boolean;
  cooldown: ListenerCooldown | null;
}

const peerQuickTopics = ["anxiety", "stress", "relationships", "self_esteem", "grief", "depression"];

const languageOptions = [
  { value: "", label: "All" },
  { value: "ar", label: "عربية" },
  { value: "fr", label: "FR" },
] as const;

export default function PeerSupportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const rm = usePrefersReducedMotion();
  const safeFadeUp = safeVariants(fadeUp, rm);
  const safeCardStagger = safeVariants(cardStagger, rm);

  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  // View state: "browse" | "chat"
  const [view, setView] = useState<"browse" | "chat">("browse");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [justEndedSessionId, setJustEndedSessionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messageListEndRef = useRef<HTMLDivElement | null>(null);

  // Filters — synced with URL params for persistence and shareability
  const [filterLanguage, setFilterLanguage] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("language") ?? "";
  });
  const [filterTopic, setFilterTopic] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("topic") ?? "";
  });
  const [filterAvailable, setFilterAvailable] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("available") === "1";
  });

  // Keep URL params in sync with filter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filterLanguage) params.set("language", filterLanguage); else params.delete("language");
    if (filterTopic) params.set("topic", filterTopic); else params.delete("topic");
    if (filterAvailable) params.set("available", "1"); else params.delete("available");
    const newSearch = params.toString();
    const newUrl = newSearch ? `${window.location.pathname}?${newSearch}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [filterLanguage, filterTopic, filterAvailable]);

  // Confirm dialog
  const [confirmListener, setConfirmListener] = useState<BrowsableListener | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showCooldownDialog, setShowCooldownDialog] = useState(false);
  const [checkinRequired, setCheckinRequired] = useState(false);
  const [checkinStress, setCheckinStress] = useState(3);
  const [checkinLoad, setCheckinLoad] = useState(3);
  const [checkinNeedsBreak, setCheckinNeedsBreak] = useState(false);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [activeCooldown, setActiveCooldown] = useState<ListenerCooldown | null>(null);
  const [cooldownNow, setCooldownNow] = useState(Date.now());

  const { data: sessionsPayload, isLoading: sessionsLoading } = useQuery<PeerSessionsResponse>({
    queryKey: ["/api/peer/sessions"],
  });

  const { data: listenerProgressDetails } = useQuery<ListenerProgressDetailsPayload>({
    queryKey: ["/api/listener/progress/details"],
    enabled: user?.role === "listener",
  });

  const { data: listeners = [], isLoading: listenersLoading, isError: listenersError, error: listenersErrorObj, refetch: refetchListeners } = useQuery<BrowsableListener[]>({
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

  // Auto-select active session
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionParam = new URLSearchParams(window.location.search).get("session");
    const parsed = Number(sessionParam);
    if (Number.isInteger(parsed) && parsed > 0) {
      setSelectedSessionId(parsed);
      setView("chat");
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) return;
    const active = sessions.find((s) => s.status === "active");
    if (active) {
      setSelectedSessionId(active.id);
      setView("chat");
    } else if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [selectedSessionId, sessions],
  );

  const { data: messages, isLoading: messagesLoading } = useQuery<PeerMessage[]>({
    queryKey: ["/api/peer/session", selectedSessionId, "messages"],
    enabled: !!selectedSessionId,
  });

  useEffect(() => {
    if (!selectedSessionId) return;
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
        { event: "*", schema: "public", table: "peer_messages", filter: `session_id=eq.${selectedSessionId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["/api/peer/session", selectedSessionId, "messages"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSessionId]);

  useEffect(() => {
    if (user?.role !== "listener") return;
    const cooldown = listenerProgressDetails?.cooldown ?? null;
    setActiveCooldown(cooldown);
    if (cooldown) {
      setShowCooldownDialog(true);
    }
  }, [listenerProgressDetails?.cooldown, user?.role]);

  useEffect(() => {
    if (!activeCooldown?.endsAt) return;
    const timer = window.setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeCooldown?.endsAt]);

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
      setView("chat");
      toast({ title: tr("peer.session_started", "Session started! Say hello 👋") });
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
      await apiRequest("POST", `/api/peer/session/${selectedSessionId}/messages`, { content: messageText });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/peer/session", selectedSessionId, "messages"] });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) return;
      const res = await apiRequest("POST", `/api/peer/session/${selectedSessionId}/end`);
      return (await res.json()) as EndSessionPayload;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/peer/sessions"] });
      const previous = queryClient.getQueryData<PeerSessionsResponse>(["/api/peer/sessions"]);
      if (selectedSessionId) {
        queryClient.setQueryData<PeerSessionsResponse>(["/api/peer/sessions"], (old) => {
          if (!old) return old;
          return {
            ...old,
            sessions: old.sessions.filter((s) => s.id !== selectedSessionId),
          };
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["/api/peer/sessions"], context.previous);
      }
    },
    onSuccess: (payload) => {
      setJustEndedSessionId(selectedSessionId);
      if (user?.role === "listener" && payload?.cooldown) {
        setActiveCooldown(payload.cooldown);
        setCheckinRequired(true);
        setShowCooldownDialog(true);
        queryClient.invalidateQueries({ queryKey: ["/api/listener/progress/details"] });
      }
      toast({ title: t("peer.session_ended") });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
    },
  });

  const listenerCheckinMutation = useMutation({
    mutationFn: async () => {
      if (!user || user.role !== "listener") return null;
      const res = await apiRequest("POST", "/api/listener/wellbeing/checkin", {
        sessionId: selectedSessionId ?? null,
        stressLevel: checkinStress,
        emotionalLoad: checkinLoad,
        needsBreak: checkinNeedsBreak,
        notes: checkinNotes.trim() || null,
      });
      return res.json();
    },
    onSuccess: (payload: any) => {
      setCheckinRequired(false);
      setShowCooldownDialog(false);
      setCheckinNotes("");
      if (payload?.cooldown) setActiveCooldown(payload.cooldown);
      queryClient.invalidateQueries({ queryKey: ["/api/listener/progress/details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listener/application"] });
      queryClient.invalidateQueries({ queryKey: ["/api/listeners/browse"] });
      toast({ title: "Wellbeing check-in saved." });
    },
    onError: () => {
      toast({ title: "Failed to submit wellbeing check-in.", variant: "destructive" });
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
        ? tr("peer.feedback_already_submitted", "Feedback already submitted")
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
      setShowReportDialog(false);
      toast({ title: t("peer.report_submitted") });
    },
  });

  const canSend = selectedSession?.status === "active" && messageText.trim().length > 0;
  const isEnded = Boolean(selectedSession && selectedSession.status !== "active" && user?.id === selectedSession.clientId);
  const shouldHighlight = justEndedSessionId !== null && justEndedSessionId === selectedSession?.id;
  const cooldownSecondsRemaining = activeCooldown?.endsAt
    ? Math.max(0, Math.floor((new Date(activeCooldown.endsAt).getTime() - cooldownNow) / 1000))
    : 0;
  const inCooldown = user?.role === "listener" && cooldownSecondsRemaining > 0;
  const cooldownLabel = inCooldown
    ? `${Math.floor(cooldownSecondsRemaining / 60)}:${(cooldownSecondsRemaining % 60).toString().padStart(2, "0")}`
    : null;

  const availableCount = listeners.filter((l) => l.isAvailable).length;

  const filteredListeners = useMemo(() => {
    if (!searchQuery) return listeners;
    const q = searchQuery.toLowerCase();
    return listeners.filter(
      (l) =>
        (l.displayAlias || "").toLowerCase().includes(q) ||
        (l.headline || "").toLowerCase().includes(q) ||
        (l.topics || []).some((tp) => tp.includes(q)),
    );
  }, [listeners, searchQuery]);
  const trophyIconForTier = (tier: "gold" | "silver" | "bronze" | null) => {
    if (tier === "gold") return "🏆";
    if (tier === "silver") return "🥈";
    if (tier === "bronze") return "🥉";
    return "";
  };

  // ─── Browse view ─────────────────────────────────────────────────────────────
  const browseView = (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <HeartHandshake className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              <FeatureHint id="peer-support" content={t("hint.peer_support")} side="bottom" delayMs={1500}>
                <span>{tr("peer.directory_title", "Peer Listeners")}</span>
              </FeatureHint>
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr("peer.directory_subtitle", "Free, private conversations with trained volunteers")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StatusDot size="md" variant={availableCount > 0 ? "online" : "offline"} label={availableCount > 0 ? "listeners online" : "no listeners online"} />
          <span>
            {availableCount > 0
              ? `${availableCount} listener${availableCount === 1 ? "" : "s"} available now`
              : "No listeners online right now"}
          </span>
          {sessions.length > 0 && (
            <>
              <span className="mx-1">·</span>
              <button
                onClick={() => { setView("chat"); }}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {sessions.length} active session{sessions.length === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      </div>

      {inCooldown && (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            Cooldown active: {cooldownLabel}
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-1">
            You are temporarily hidden from matching while you recover from a difficult session.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCooldownDialog(true)}>
            Open wellbeing check-in
          </Button>
        </div>
      )}

      {/* Filters row */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listeners by name or topic…"
            className="ps-9"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Language */}
          <div className="flex gap-1">
            {languageOptions.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setFilterLanguage(lang.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filterLanguage === lang.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Available toggle */}
          <button
            onClick={() => setFilterAvailable(!filterAvailable)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
              filterAvailable
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <StatusDot variant="available" label="available" />
            Available now
          </button>

          {/* Topics */}
          <div className="flex flex-wrap gap-1">
            {peerQuickTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => setFilterTopic(topic === filterTopic ? "" : topic)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                  filterTopic === topic
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 border-transparent hover:border-border text-muted-foreground"
                }`}
              >
                {t(`specialization.${topic}`)}
              </button>
            ))}
          </div>

          {(filterLanguage || filterTopic || filterAvailable || searchQuery) && (
            <button
              onClick={() => { setFilterLanguage(""); setFilterTopic(""); setFilterAvailable(false); setSearchQuery(""); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Listener grid */}
      {listenersLoading ? (
        <PageSkeleton variant="grid" count={6} />
      ) : filteredListeners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No listeners match your filters right now."
          action={{ label: "Clear all filters", onClick: () => { setFilterLanguage(""); setFilterTopic(""); setFilterAvailable(false); setSearchQuery(""); } }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence initial={false}>
            {filteredListeners.map((listener, index) => (
              <motion.div
                key={listener.userId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: index * 0.04 }}
                className={`group relative rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all hover:shadow-md hover:border-primary/30 ${
                  !listener.isAvailable ? "opacity-70" : ""
                }`}
              >
                {/* Available dot */}
                <span
                  className={`absolute top-3.5 end-3.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                    listener.isAvailable ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />

                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl select-none shrink-0">
                    {listener.avatarEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold leading-tight">
                        {listener.displayAlias || tr("peer.anonymous_listener", "Anonymous Listener")}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        Lvl {listener.level}
                      </Badge>
                      {listener.trophyTier && (
                        <Badge
                          className={`text-[10px] px-1.5 ${
                            listener.trophyTier === "gold"
                              ? "bg-amber-600 hover:bg-amber-600 text-white"
                              : listener.trophyTier === "silver"
                                ? "bg-slate-600 hover:bg-slate-600 text-white"
                                : "bg-orange-600 hover:bg-orange-600 text-white"
                          }`}
                        >
                          {trophyIconForTier(listener.trophyTier)} {listener.trophyTier}
                        </Badge>
                      )}
                    </div>
                    {listener.certificationTitle && (
                      <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                        {listener.certificationTitle}
                      </p>
                    )}
                    {listener.headline && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {listener.headline}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {listener.totalSessions > 0 && (
                    <span>{listener.totalSessions} sessions</span>
                  )}
                  {listener.averageRating != null && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {listener.averageRating.toFixed(1)}
                    </span>
                  )}
                  {(listener.languages || []).length > 0 && (
                    <span className="text-muted-foreground/70">
                      {(listener.languages || []).join(" · ").toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Topics */}
                {(listener.topics || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(listener.topics || []).slice(0, 3).map((tp) => (
                      <span key={tp} className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px]">
                        {t(`specialization.${tp}`)}
                      </span>
                    ))}
                  </div>
                )}

                {/* About me */}
                {listener.aboutMe && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 border-t pt-2">
                    {listener.aboutMe}
                  </p>
                )}

                {/* CTA */}
                <FeatureHint id="peer-support-queue" content={t("hint.peer_support_queue")} side="top">
                  <Button
                    size="sm"
                    className="w-full mt-auto"
                    variant={listener.isAvailable ? "default" : "outline"}
                    disabled={!listener.isAvailable || startDirectSessionMutation.isPending}
                    onClick={() => setConfirmListener(listener)}
                  >
                    {listener.isAvailable ? "Start conversation" : "Currently busy"}
                  </Button>
                </FeatureHint>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ─── Chat view ────────────────────────────────────────────────────────────────
  const chatView = (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[780px]">
      {/* Chat header */}
      <div className="flex items-center gap-3 pb-3 border-b mb-0">
        <button
          onClick={() => setView("browse")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All listeners</span>
        </button>

        {selectedSession && (
          <div className="flex items-center gap-2 ms-auto">
            <span className="text-sm font-medium">
              {selectedSession.otherUser.firstName || tr("peer.anonymous", "Listener")}
            </span>
            <Badge
              variant={selectedSession.status === "active" ? "secondary" : "outline"}
              className={selectedSession.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : ""}
            >
              {selectedSession.status === "active" ? "Active" : selectedSession.status}
            </Badge>
            {selectedSession.status === "active" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive h-7 px-2"
                onClick={() => endSessionMutation.mutate()}
                disabled={endSessionMutation.isPending}
              >
                End
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Session picker if multiple */}
      {sessions.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto py-2 border-b">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                selectedSessionId === s.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {s.otherUser.firstName || `Session #${s.id}`}
              {s.status === "active" && <StatusDot variant="online" label="active session" className="ms-1 inline-flex" />}
            </button>
          ))}
        </div>
      )}

      {selectedSession ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 px-1">
            {messagesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-10 w-1/2 ms-auto" />
                <Skeleton className="h-10 w-3/5" />
              </div>
            ) : messages && messages.length > 0 ? (
              <>
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const mine = message.senderId === user?.id;
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        {!mine && (
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-sm me-2 shrink-0 self-end mb-1">
                            {selectedSession.otherUser.firstName?.[0]?.toUpperCase() || "L"}
                          </div>
                        )}
                        <div
                          className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            mine
                              ? "bg-primary text-primary-foreground rounded-ee-sm"
                              : "bg-muted rounded-es-sm"
                          }`}
                        >
                          {message.content}
                          <div className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(message.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messageListEndRef} />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-12">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-7 w-7 text-primary/60" />
                </div>
                <p className="text-sm">Session started — say hello! 👋</p>
              </div>
            )}
          </div>

          {/* Post-session card */}
          {isEnded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border p-4 space-y-4 mb-3 ${shouldHighlight ? "border-primary/40 bg-primary/5" : "bg-muted/30"}`}
            >
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{tr("peer.not_alone_title", "You did something brave today.")}</p>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <p className="text-xs font-medium">{t("peer.rate_session")}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      onClick={() => setRating(score)}
                      className="rounded p-0.5 hover:bg-muted transition-colors"
                    >
                      <Star className={`h-5 w-5 ${score <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder={t("peer.optional_comment")}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => rateSessionMutation.mutate()} disabled={rateSessionMutation.isPending}>
                    {t("peer.submit_feedback")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowReportDialog(true)}>
                    <AlertTriangle className="h-3.5 w-3.5 me-1.5" />
                    {t("peer.report_session")}
                  </Button>
                </div>
              </div>

              {/* What's next */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What would you like to do next?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setView("browse")}
                    className="rounded-lg border bg-background p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <p className="text-xs font-medium">Talk to another listener</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Browse available peer volunteers</p>
                  </button>
                  <Link href="/therapists" className="rounded-lg border bg-background p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-all block">
                    <p className="text-xs font-medium">See a professional</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Book a session with a licensed therapist</p>
                  </Link>
                  <Link href="/self-care" className="rounded-lg border bg-background p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-all block">
                    <p className="text-xs font-medium">Try self-care tools</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Breathing, grounding, and relaxation</p>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* Input bar */}
          {selectedSession.status === "active" && (
            <div className="flex gap-2 pt-2 border-t">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  e.preventDefault();
                  if (canSend && !sendMessageMutation.isPending) sendMessageMutation.mutate();
                }}
                placeholder={tr("peer.type_message", "Type your message…")}
                className="flex-1"
                autoFocus
              />
              <Button
                onClick={() => sendMessageMutation.mutate()}
                disabled={!canSend || sendMessageMutation.isPending}
                size="icon"
                aria-label={t("peer.send_message") === "peer.send_message" ? "Send message" : t("peer.send_message")}
                data-testid="button-peer-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">No session selected</p>
            <p className="text-sm text-muted-foreground">Choose a listener to start a private, free conversation.</p>
          </div>
          <Button onClick={() => setView("browse")} variant="outline" className="gap-2">
            <Users className="h-4 w-4" />
            Browse listeners
          </Button>
        </div>
      )}
    </div>
  );

  if (listenersError) return <AppLayout><div className="max-w-4xl mx-auto p-4 sm:p-6"><PageError error={listenersErrorObj as Error} resetFn={refetchListeners} /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={t("journey.option.peer.label")}
          subtitle={t("journey.discover.peer.subtitle")}
        />
        <div className="mb-4 rounded-xl border bg-muted/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium">{t("journey.discover.peer.note_title")}</p>
            <p className="text-sm text-muted-foreground">{t("journey.discover.peer.note_body")}</p>
          </div>
          <Link href="/support">
            <Button variant="outline" size="sm">
              {t("journey.discover.back_to_support")}
            </Button>
          </Link>
        </div>
        {/* Mobile tab strip */}
        <div className="sm:hidden flex gap-1 mb-4 bg-muted/50 p-1 rounded-lg">
          <button
            onClick={() => setView("browse")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              view === "browse" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("peer.browse")}
          </button>
          <button
            onClick={() => setView("chat")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              view === "chat" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t("peer.chat")}
            {sessions.some((s) => s.status === "active") && (
              <StatusDot variant="online" label="active session" />
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {view === "browse" ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
            >
              {browseView}
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              {chatView}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm start session dialog */}
        <Dialog open={!!confirmListener} onOpenChange={(open) => { if (!open) setConfirmListener(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{confirmListener?.avatarEmoji}</span>
                Start a session with {confirmListener?.displayAlias || "this listener"}?
              </DialogTitle>
              <DialogDescription>
                {confirmListener?.headline || "A free, private peer support conversation."}
                {" "}You can end the session at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmListener(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => confirmListener && startDirectSessionMutation.mutate(confirmListener.userId)}
                disabled={startDirectSessionMutation.isPending}
              >
                {startDirectSessionMutation.isPending ? "Starting…" : "Start conversation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Listener cooldown check-in dialog */}
        <Dialog
          open={showCooldownDialog && user?.role === "listener"}
          onOpenChange={(open) => {
            if (!checkinRequired) setShowCooldownDialog(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Listener wellbeing check-in</DialogTitle>
              <DialogDescription>
                {inCooldown
                  ? `Cooldown active (${cooldownLabel}). Share how you're doing before you continue.`
                  : "Share a quick wellbeing check-in after this session."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Stress level (1-5)</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={`checkin-stress-${value}`}
                      type="button"
                      size="sm"
                      variant={checkinStress === value ? "default" : "outline"}
                      onClick={() => setCheckinStress(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Emotional load (1-5)</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={`checkin-load-${value}`}
                      type="button"
                      size="sm"
                      variant={checkinLoad === value ? "default" : "outline"}
                      onClick={() => setCheckinLoad(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={checkinNeedsBreak ? "default" : "outline"}
                onClick={() => setCheckinNeedsBreak((prev) => !prev)}
              >
                {checkinNeedsBreak ? "Break requested" : "Request extended break"}
              </Button>
              <Textarea
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                placeholder="Optional: write a quick reflection."
                rows={3}
              />
            </div>
            <DialogFooter>
              {!checkinRequired && (
                <Button variant="outline" onClick={() => setShowCooldownDialog(false)}>
                  Later
                </Button>
              )}
              <Button
                onClick={() => listenerCheckinMutation.mutate()}
                disabled={listenerCheckinMutation.isPending}
              >
                {listenerCheckinMutation.isPending ? "Saving..." : "Submit check-in"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Report dialog */}
        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("peer.report_session")}</DialogTitle>
              <DialogDescription>Let us know what happened and we'll review it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={t("peer.reason")}
              />
              <Textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder={t("peer.details_optional")}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
              <Button
                onClick={() => reportSessionMutation.mutate()}
                disabled={!reportReason.trim() || reportSessionMutation.isPending}
                variant="destructive"
                data-testid="button-peer-report"
              >
                {t("peer.submit_report")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
