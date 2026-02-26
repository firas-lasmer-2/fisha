import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { MessageCircle, Send, HeartHandshake, AlertTriangle, Star } from "lucide-react";
import type {
  ListenerQueueEntry,
  PeerMessage,
  PeerSession,
  User,
} from "@shared/schema";

interface PeerSessionsResponse {
  sessions: (PeerSession & { otherUser: User })[];
  activeQueueEntry: ListenerQueueEntry | null;
}

export default function PeerSupportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("ar");
  const [topicTagsInput, setTopicTagsInput] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const { data: sessionsPayload, isLoading: sessionsLoading } = useQuery<PeerSessionsResponse>({
    queryKey: ["/api/peer/sessions"],
  });

  const sessions = sessionsPayload?.sessions || [];
  const activeQueueEntry = sessionsPayload?.activeQueueEntry || null;

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
      const topicTags = topicTagsInput
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      const response = await apiRequest("POST", "/api/peer/queue/join", {
        preferredLanguage,
        topicTags,
      });
      return response.json();
    },
    onSuccess: (payload: { matched?: boolean; session?: PeerSession | null }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
      if (payload?.session?.id) {
        setSelectedSessionId(payload.session.id);
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
      queryClient.invalidateQueries({ queryKey: ["/api/peer/sessions"] });
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
    onError: () => {
      toast({ title: t("peer.feedback_error"), variant: "destructive" });
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

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HeartHandshake className="h-5 w-5 text-primary" />
              {t("peer.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {activeQueueEntry && (
                <Badge variant="outline">{t("peer.queue_status")}: {activeQueueEntry.status}</Badge>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                placeholder={t("peer.language_placeholder")}
              />
              <Input
                value={topicTagsInput}
                onChange={(e) => setTopicTagsInput(e.target.value)}
                placeholder={t("peer.topics_placeholder")}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => joinQueueMutation.mutate()}
                  disabled={joinQueueMutation.isPending || !!activeQueueEntry}
                  data-testid="button-peer-join-queue"
                >
                  {t("peer.join_queue")}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => leaveQueueMutation.mutate()}
                  disabled={leaveQueueMutation.isPending || !activeQueueEntry}
                  data-testid="button-peer-leave-queue"
                >
                  {t("peer.leave_queue")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
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
                    <p className="text-sm text-muted-foreground px-2 py-4">
                      {t("peer.no_sessions")}
                    </p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        className={`w-full rounded-md border px-3 py-2 text-start ${
                          selectedSessionId === session.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        <p className="text-sm font-medium">
                          {session.otherUser.firstName || t("peer.anonymous")} {session.otherUser.lastName || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.status} • #{session.id}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{t("peer.conversation")}</CardTitle>
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

                  {selectedSession.status !== "active" && user?.id === selectedSession.clientId && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Card className="border-dashed">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            {t("peer.rate_session")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={rating}
                            onChange={(e) => setRating(Number(e.target.value))}
                          />
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
