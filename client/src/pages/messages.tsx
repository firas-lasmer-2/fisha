import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle, Send, ArrowLeft, ArrowRight, ShieldAlert, Lock, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  decryptMessageContent,
  encryptMessageContent,
  generateConversationKey,
  isEncryptedPayload,
  unwrapConversationKey,
  wrapConversationKey,
} from "@/lib/e2e";
import type { TherapyConversation, TherapyMessage, User } from "@shared/schema";

const CRISIS_KEYWORDS = [
  "انتحار",
  "أقتل نفسي",
  "أريد الموت",
  "لا أريد العيش",
  "أنهي حياتي",
  "suicide",
  "me tuer",
  "mourir",
  "en finir",
  "plus envie de vivre",
  "نقتل روحي",
  "نموت",
  "ما نحبش نعيش",
  "نكمل حياتي",
];

export default function MessagesPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [selectedConv, setSelectedConv] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [conversationKey, setConversationKey] = useState<CryptoKey | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<number, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const convParam = urlParams.get("conv");
  const therapistParam = urlParams.get("therapist");
  useEffect(() => {
    if (convParam) setSelectedConv(parseInt(convParam, 10));
  }, [convParam]);

  const { data: conversations, isLoading: convsLoading } = useQuery<
    (TherapyConversation & { otherUser: User })[]
  >({
    queryKey: ["/api/conversations"],
  });

  // Auto-select or create conversation when ?therapist=<userId> param is present
  useEffect(() => {
    if (!therapistParam || !conversations || convParam) return;
    const existing = conversations.find(
      (c) => c.otherUser.id === therapistParam
    );
    if (existing) {
      setSelectedConv(existing.id);
    } else {
      apiRequest("POST", "/api/conversations", { therapistId: therapistParam })
        .then((r) => r.json())
        .then((conv) => {
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          setSelectedConv(conv.id);
        })
        .catch(() => {});
    }
  }, [therapistParam, conversations, convParam]);

  const { data: messages, isLoading: msgsLoading } = useQuery<TherapyMessage[]>({
    queryKey: ["/api/conversations", selectedConv, "messages"],
    enabled: !!selectedConv,
  });

  const selectedConvData = conversations?.find((c) => c.id === selectedConv);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, decryptedMessages]);

  useEffect(() => {
    if (!selectedConv) return;

    const channel = supabase
      .channel(`conversation-${selectedConv}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "therapy_messages",
          filter: `conversation_id=eq.${selectedConv}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConv, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
          queryClient.invalidateQueries({ queryKey: ["/api/unread-count"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv]);

  useEffect(() => {
    let cancelled = false;

    async function ensureConversationKey() {
      if (!user || !selectedConvData) {
        setConversationKey(null);
        return;
      }

      const isClient = selectedConvData.clientId === user.id;
      const userWrappedKey = isClient
        ? selectedConvData.clientKeyEncrypted
        : selectedConvData.therapistKeyEncrypted;

      if (userWrappedKey) {
        const key = await unwrapConversationKey(user.id, userWrappedKey);
        if (!cancelled) {
          setConversationKey(key);
        }
        return;
      }

      if (!user.publicKey || !selectedConvData.otherUser.publicKey) {
        if (!cancelled) {
          setConversationKey(null);
        }
        return;
      }

      const generatedKey = await generateConversationKey();
      const clientPublicKey = isClient ? user.publicKey : selectedConvData.otherUser.publicKey;
      const therapistPublicKey = isClient ? selectedConvData.otherUser.publicKey : user.publicKey;

      const clientKeyEncrypted = await wrapConversationKey(generatedKey, clientPublicKey);
      const therapistKeyEncrypted = await wrapConversationKey(generatedKey, therapistPublicKey);

      await apiRequest("POST", `/api/conversations/${selectedConvData.id}/encryption-keys`, {
        clientKeyEncrypted,
        therapistKeyEncrypted,
        keyVersion: 1,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (!cancelled) {
        setConversationKey(generatedKey);
      }
    }

    ensureConversationKey().catch(() => {
      if (!cancelled) {
        setConversationKey(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedConvData, user]);

  useEffect(() => {
    let cancelled = false;

    async function resolveMessages() {
      if (!messages || messages.length === 0) {
        setDecryptedMessages({});
        return;
      }

      const resolved: Record<number, string> = {};

      for (const msg of messages) {
        if (conversationKey && isEncryptedPayload(msg.content)) {
          try {
            resolved[msg.id] = await decryptMessageContent(msg.content, conversationKey);
          } catch {
            resolved[msg.id] = t("messages.unable_to_decrypt");
          }
        } else {
          resolved[msg.id] = msg.content;
        }
      }

      if (!cancelled) {
        setDecryptedMessages(resolved);
      }
    }

    resolveMessages().catch(() => {
      if (!cancelled) {
        setDecryptedMessages({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [conversationKey, messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConv || !conversationKey) {
        throw new Error(t("messages.encryption_key_unavailable"));
      }

      const encryptedContent = await encryptMessageContent(content, conversationKey);
      const lowerContent = content.toLowerCase();
      const crisisDetectedByClient = CRISIS_KEYWORDS.some((kw) => lowerContent.includes(kw));

      const res = await apiRequest("POST", `/api/conversations/${selectedConv}/messages`, {
        content: encryptedContent,
        encrypted: true,
        crisisDetectedByClient,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConv, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unread-count"] });
      setMessageText("");
    },
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedConv || !conversationKey) return;
    sendMutation.mutate(messageText.trim());
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-3.5rem)] flex">
        <div className={`${selectedConv ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-e`}>
          <div className="p-4 border-b">
            <h2 className="font-semibold" data-testid="text-messages-title">{t("nav.messages")}</h2>
          </div>
          <ScrollArea className="flex-1">
            {convsLoading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-0.5 p-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-start ${
                      selectedConv === conv.id ? "bg-accent" : "hover:bg-muted/50"
                    }`}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    <div className="w-10 h-10 rounded-full gradient-calm flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(conv.otherUser.firstName?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {conv.otherUser.firstName} {conv.otherUser.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Your messages are private</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every conversation is end-to-end encrypted — only you and your therapist can read them.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 mt-1"
                  onClick={() => { window.location.href = "/therapists"; }}
                >
                  <Users className="h-3.5 w-3.5" />
                  Find a therapist to message
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className={`${selectedConv ? "flex" : "hidden md:flex"} flex-col flex-1`}>
          {selectedConv && selectedConvData ? (
            <>
              <div className="p-4 border-b flex items-center gap-3">
                <button className="md:hidden" onClick={() => setSelectedConv(null)}>
                  {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                </button>
                <div className="w-8 h-8 rounded-full gradient-calm flex items-center justify-center text-white text-sm font-bold">
                  {(selectedConvData.otherUser.firstName?.[0] || "?").toUpperCase()}
                </div>
                <span className="font-medium text-sm">
                  {selectedConvData.otherUser.firstName} {selectedConvData.otherUser.lastName}
                </span>
              </div>

              {!conversationKey && (
                <div className="p-3 border-b bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{t("messages.encryption_waiting")}</span>
                </div>
              )}

              <ScrollArea className="flex-1 p-4">
                {msgsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-48" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages?.map((msg) => {
                      const isMe = msg.senderId === user?.id;
                      const resolvedMessage = decryptedMessages[msg.id] ?? msg.content;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${msg.id}`}
                        >
                          <div
                            className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                              isMe
                                ? "gradient-calm text-white rounded-ee-sm"
                                : "bg-muted rounded-es-sm"
                            }`}
                          >
                            {resolvedMessage}
                            <div className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                              {new Date(msg.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t("messages.type")}
                    className="flex-1"
                    data-testid="input-message"
                    disabled={!conversationKey}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!messageText.trim() || sendMutation.isPending || !conversationKey}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{t("messages.select_conversation")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
