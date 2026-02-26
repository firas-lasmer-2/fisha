import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle, Send, ArrowLeft, ArrowRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { TherapyConversation, TherapyMessage, User } from "@shared/schema";

export default function MessagesPage() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const [selectedConv, setSelectedConv] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const convParam = urlParams.get("conv");
  useEffect(() => {
    if (convParam) setSelectedConv(parseInt(convParam));
  }, [convParam]);

  const { data: conversations, isLoading: convsLoading } = useQuery<(TherapyConversation & { otherUser: User })[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages, isLoading: msgsLoading } = useQuery<TherapyMessage[]>({
    queryKey: ["/api/conversations", selectedConv, "messages"],
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/conversations/${selectedConv}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConv, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/unread-count"] });
      setMessageText("");
    },
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedConv) return;
    sendMutation.mutate(messageText.trim());
  };

  const selectedConvData = conversations?.find((c) => c.id === selectedConv);

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
              <div className="text-center py-12 px-4 text-muted-foreground text-sm">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                {t("messages.no_conversations")}
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

              <ScrollArea className="flex-1 p-4">
                {msgsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-48" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages?.map((msg) => {
                      const isMe = msg.senderId === user?.id;
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
                            {msg.content}
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
                  />
                  <Button type="submit" size="icon" disabled={!messageText.trim() || sendMutation.isPending} data-testid="button-send-message">
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
