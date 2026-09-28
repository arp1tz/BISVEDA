"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PanelLeft, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/chat/v9/AppHeader";
import { AppFooter } from "@/components/chat/v9/AppFooter";
import { ChatSidebar, ChatSessionItem } from "@/components/chat/v9/ChatSidebar";
import { UserMessage } from "@/components/chat/v9/UserMessage";
import { WorkingSteps } from "@/components/chat/v9/WorkingSteps";
import { AnswerCard } from "@/components/chat/v9/AnswerCard";
import { ClarifyMessage } from "@/components/chat/v9/ClarifyMessage";
import { RefusalMessage } from "@/components/chat/v9/RefusalMessage";
import { FollowUps } from "@/components/chat/v9/FollowUps";
import { Composer, AttachmentItem } from "@/components/chat/v9/Composer";
import { SourceDrawer } from "@/components/chat/v9/SourceDrawer";
import type { BisvedaResponse, StageEvent } from "@/lib/pipeline/respond";
import type { Source } from "@/lib/pipeline/package";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content?: string;
  userQuery?: string;
  response?: BisvedaResponse;
  workingSteps?: StageEvent[];
  isStreaming?: boolean;
  imageThumbnail?: string;
  filename?: string;
}

const DEFAULT_RECENT_CHATS: ChatSessionItem[] = [
  { id: "helmets-qco", title: "Helmets mandatory standard & QCO", timestamp: Date.now() - 3600000 * 2 },
  { id: "toys-safety", title: "Toy safety testing under IS 9873", timestamp: Date.now() - 3600000 * 24 },
  { id: "pressure-cooker", title: "Domestic Pressure Cooker Scheme I", timestamp: Date.now() - 3600000 * 48 },
];

export default function ChatWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = (params?.id as string) || "default-chat";

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recentChats, setRecentChats] = useState<ChatSessionItem[]>(DEFAULT_RECENT_CHATS);

  // Messages & conversation state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Source Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef<boolean>(false);

  // Auto-scroll on new content
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Initial query and attachment handling from URL searchParams and sessionStorage
  useEffect(() => {
    const q = searchParams.get("q") || "";
    let pendingAttachment: AttachmentItem | null = null;
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(`pending_attachment_${conversationId}`);
        if (stored) {
          pendingAttachment = JSON.parse(stored);
          sessionStorage.removeItem(`pending_attachment_${conversationId}`);
        }
      } catch {}
    }

    if ((q || pendingAttachment) && !initialSentRef.current) {
      initialSentRef.current = true;
      handleSendMessage(q || "Please inspect this product photo and identify applicable BIS standards.", pendingAttachment);
    }
  }, [searchParams, conversationId]);

  // Send message function with SSE streaming and context history retention
  const handleSendMessage = async (text: string, attachment?: AttachmentItem | null) => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    if (isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Append user message with optional attachment thumbnail
    const userMsg: MessageItem = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      imageThumbnail: attachment?.previewUrl,
      filename: attachment?.name,
    };

    const initialSteps: StageEvent[] = [
      { stage: "understand", label: "Understanding your question", status: "active" },
      { stage: "search", label: "Searching official BIS sources", status: "active" },
      { stage: "check", label: "Checking certification rules", status: "active" },
      { stage: "write", label: "Writing a clear answer", status: "active" },
    ];

    const assistantMsg: MessageItem = {
      id: assistantMsgId,
      role: "assistant",
      userQuery: trimmed,
      workingSteps: initialSteps,
      isStreaming: true,
    };

    // Build history from current messages to maintain multi-turn context
    const historyTurns: Array<{ query: string; response?: any }> = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "user") {
        const nextMsg = messages[i + 1];
        historyTurns.push({
          query: m.content || m.userQuery || "",
          response: nextMsg?.role === "assistant" ? nextMsg.response : undefined,
        });
      }
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // Update recent chats title if it's the first query
    setRecentChats((prev) => {
      const exists = prev.find((c) => c.id === conversationId);
      if (exists) return prev;
      return [{ id: conversationId, title: trimmed.slice(0, 36) || "Chat Session", timestamp: Date.now() }, ...prev];
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          conversation_id: conversationId,
          history: historyTurns,
          userLocation: userLocation || undefined,
          attachment: attachment ? { name: attachment.name, base64: attachment.base64 } : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const block of parts) {
            if (!block.trim()) continue;
            const lines = block.split("\n");
            let eventType = "message";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.replace("event: ", "").trim();
              } else if (line.startsWith("data: ")) {
                dataStr = line.replace("data: ", "").trim();
              }
            }

            if (eventType === "stage" && dataStr) {
              try {
                const stageEvent = JSON.parse(dataStr) as StageEvent;
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId) return msg;
                    const existingSteps = msg.workingSteps || [];
                    const updated = existingSteps.map((s) =>
                      s.stage === stageEvent.stage ? stageEvent : s
                    );
                    return { ...msg, workingSteps: updated };
                  })
                );
              } catch (e) {
                // ignore parse errors
              }
            } else if ((eventType === "result" || eventType === "response") && dataStr) {
              try {
                const finalResp = JSON.parse(dataStr) as BisvedaResponse;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, response: finalResp, isStreaming: false }
                      : msg
                  )
                );
              } catch (e) {
                // ignore parse error
              }
            } else if (eventType === "error") {
              let errMessage = "An error occurred while processing your question. Please try again.";
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed?.message) errMessage = parsed.message;
              } catch {
                // keep default message
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        isStreaming: false,
                        response: {
                          conversation_id: conversationId,
                          kind: "refusal",
                          language: "en",
                          grounding: "none",
                          text: "",
                          refusal: {
                            reason: "not_in_sources",
                            message: errMessage,
                            next_steps: [{ text: "Visit BIS official portal", url: "https://www.bis.gov.in" }],
                          },
                          sources: [],
                          follow_ups: [],
                        },
                      }
                    : msg
                )
              );
            }
          }
        }
      } else {
        // Fallback: standard JSON response
        const finalResp = (await res.json()) as BisvedaResponse;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, response: finalResp, isStreaming: false }
              : msg
          )
        );
      }
    } catch (err: any) {
      console.error("Chat query failed:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                response: {
                  conversation_id: conversationId,
                  kind: "refusal",
                  language: "en",
                  grounding: "none",
                  text: "",
                  refusal: {
                    reason: "not_in_sources",
                    message: "An error occurred while connecting to the server. Please try again.",
                    next_steps: [{ text: "Visit BIS official portal", url: "https://www.bis.gov.in" }],
                  },
                  sources: [],
                  follow_ups: ["Which standard applies to helmets?"],
                },
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSourceDrawer = (response: BisvedaResponse, sourceIndex: number) => {
    if (!response.sources || response.sources.length === 0) return;
    const targetSource = response.sources[sourceIndex - 1] || response.sources[0];
    setActiveSource(targetSource);
    setActiveSourceIndex(sourceIndex);
    setDrawerOpen(true);
  };

  const handleRequestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Geolocation denied or unavailable:", err.message);
        }
      );
    }
  };

  const handleNewChat = () => {
    const newId = `c-${Date.now().toString(36)}`;
    router.push(`/chat/${newId}`);
    setMessages([]);
  };

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant" && m.response);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0F172A]">
      {/* Top Header */}
      <AppHeader />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <ChatSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          onNewChat={handleNewChat}
          currentChatId={conversationId}
          recentChats={recentChats}
          onSelectChat={(id) => router.push(`/chat/${id}`)}
        />

        {/* Center Chat Column */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#F7F8FA]/50 relative">
          {/* Top Bar with Sidebar Reopen Toggle */}
          {!sidebarOpen && (
            <div className="absolute top-3 left-4 z-10">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A] shadow-xs cursor-pointer"
                title="Open Sidebar"
                aria-label="Open Sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-[760px] mx-auto w-full space-y-6">
              {messages.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#0B2A4A]/5 text-[#0B2A4A] mb-2">
                    <Sparkles className="h-6 w-6 text-[#E8710A]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#0F172A]">
                    Official BIS Standards &amp; Certification Assistant
                  </h2>
                  <p className="text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
                    Ask about mandatory Quality Control Orders, testing laboratories, standard numbers, or certification procedures.
                  </p>
                  <div className="pt-4 flex flex-wrap justify-center gap-2">
                    {["Is BIS mandatory for helmets?", "How to certify domestic pressure cookers?", "IS 9873 toy testing labs"].map((ex) => (
                      <button
                        key={ex}
                        onClick={() => handleSendMessage(ex)}
                        className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#0F172A] hover:border-[#0B2A4A] transition-colors cursor-pointer"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <UserMessage
                      key={msg.id}
                      text={msg.content || ""}
                      imageThumbnail={msg.imageThumbnail}
                      filename={msg.filename}
                    />
                  );
                }

                // Assistant Message
                return (
                  <div key={msg.id} className="space-y-4 animate-in fade-in duration-200">
                    {/* Streaming working steps */}
                    {msg.isStreaming && !msg.response && (
                      <WorkingSteps steps={msg.workingSteps || []} />
                    )}

                    {/* Disambiguation / Clarification */}
                    {msg.response?.kind === "clarify" && msg.response.clarify && (
                      <ClarifyMessage
                        question={msg.response.clarify.question}
                        options={msg.response.clarify.options}
                        onSelectOption={(opt) => handleSendMessage(opt)}
                      />
                    )}

                    {/* Refusal / Out of scope with Guided Pathways */}
                    {msg.response?.kind === "refusal" && msg.response.refusal && (
                      <RefusalMessage
                        message={msg.response.refusal.message}
                        nextSteps={msg.response.refusal.next_steps}
                        onSelectSuggestion={(q) => handleSendMessage(q)}
                      />
                    )}

                    {/* Grounded Answer Card */}
                    {(msg.response?.kind === "answer" || msg.response?.kind === "smalltalk") && (
                      <AnswerCard
                        response={msg.response}
                        query={msg.userQuery}
                        onOpenSourceDrawer={(idx) => handleOpenSourceDrawer(msg.response!, idx)}
                        onRequestLocation={handleRequestLocation}
                        onSendQuery={(q) => handleSendMessage(q)}
                        userLocation={userLocation}
                      />
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Composer Area (760px Centered) */}
          <div className="p-4 bg-white/90 backdrop-blur-md border-t border-[#E5E7EB] shrink-0">
            <div className="max-w-[760px] mx-auto w-full space-y-2">
              {/* Follow-up suggestions */}
              {latestAssistantMessage?.response?.follow_ups &&
                latestAssistantMessage.response.follow_ups.length > 0 &&
                !isLoading && (
                  <FollowUps
                    suggestions={latestAssistantMessage.response.follow_ups}
                    onSelect={(s) => handleSendMessage(s)}
                  />
                )}

              <Composer
                onSend={handleSendMessage}
                isLoading={isLoading}
                placeholder="Ask a follow-up… e.g. which labs can test this?"
              />

              <div className="text-center text-[10px] text-[#64748B] select-none pt-0.5">
                Official BIS standards &amp; gazetted Quality Control Orders · Ministry of Consumer Affairs
              </div>
            </div>
          </div>
        </main>

        {/* Right Slide-over Source Drawer */}
        <SourceDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          source={activeSource}
          sourceIndex={activeSourceIndex}
        />
      </div>

      {/* Global Footer */}
      <AppFooter />
    </div>
  );
}
