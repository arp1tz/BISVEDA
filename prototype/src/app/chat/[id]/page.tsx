"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PanelLeft, Sparkles, PhoneCall, Mic, X } from "lucide-react";
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
import { LabsCard } from "@/components/chat/v9/LabsCard";
import { AhcCard } from "@/components/chat/v9/AhcCard";
import { HallmarkCard } from "@/components/chat/v9/HallmarkCard";
import { MarkCard } from "@/components/chat/v9/MarkCard";
import { ImageReadCard } from "@/components/chat/v9/ImageReadCard";
import { FormICard } from "@/components/chat/v9/FormICard";
import { HelplineCallCard } from "@/components/chat/v9/HelplineCallCard";
import { HelplineModal } from "@/components/chat/v9/HelplineModal";
import { listConversations, getConversation, saveConversation } from "@/lib/conversations";
import { useVoiceInput } from "@/lib/voice/useVoiceInput";
import { speak, stopSpeaking, onSpeakingChange, languageLabel } from "@/lib/voice/tts";
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

function ChatWorkspaceInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = (params?.id as string) || "default-chat";

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recentChats, setRecentChats] = useState<ChatSessionItem[]>([]);

  // Messages & conversation state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [isHelplineOpen, setIsHelplineOpen] = useState(false);

  // Source Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef<boolean>(false);

  // Voice chat: speak → answer is read aloud → the mic re-opens, until the user ends it.
  const [voiceMode, setVoiceMode] = useState(searchParams.get("voice") === "1");
  const voiceModeRef = useRef(voiceMode);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const sendRef = useRef<(text: string) => void>(() => {});

  const setVoiceModeBoth = (on: boolean) => {
    voiceModeRef.current = on;
    setVoiceMode(on);
  };

  useEffect(() => onSpeakingChange(setIsSpeakingNow), []);
  // Stop talking when leaving the chat page.
  useEffect(() => () => stopSpeaking(), []);

  const voice = useVoiceInput({
    onTranscript: (text) => {
      setVoiceNote(null);
      sendRef.current(text);
    },
    onError: (message) => {
      setVoiceNote(message);
      setVoiceModeBoth(false);
    },
  });

  /**
   * After an answer arrives in voice mode: read it aloud, then listen again. `owner` is the
   * assistant message's id, so the matching AnswerCard's Read aloud button (speechId={msg.id})
   * shows Stop while this plays, whether the voice loop or the button itself started it.
   */
  const handleVoiceAnswer = async (resp: BisvedaResponse, owner: string) => {
    const text = resp.text || resp.refusal?.message || resp.clarify?.question || "";
    let interrupted = false;
    if (text) {
      const result = await speak(text, resp.language, { owner });
      if (result.ok) interrupted = !!result.interrupted;
      else if (result.reason === "no_voice")
        setVoiceNote(`No ${languageLabel(result.language)} voice is installed on this device, so answers can't be read aloud. You can keep talking.`);
      else if (result.reason === "unsupported") setVoiceNote("Read aloud is not supported in this browser.");
    }
    if (!interrupted && voiceModeRef.current) {
      await new Promise((r) => setTimeout(r, 350)); // let the room go quiet before the mic opens
      if (voiceModeRef.current) void voice.start();
    }
  };

  const handleMicClick = () => {
    setVoiceNote(null);
    if (voice.state === "listening") {
      voice.stop(); // finish now → transcript is sent
      return;
    }
    if (voice.state === "transcribing") return;
    stopSpeaking(); // tapping the mic while an answer is playing interrupts it
    setVoiceModeBoth(true);
    void voice.start();
  };

  const handleEndVoiceChat = () => {
    setVoiceModeBoth(false);
    stopSpeaking();
    voice.stop(true);
  };

  // Auto-scroll on new content
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load sidebar conversations list
  useEffect(() => {
    const list = listConversations().map((c) => ({
      id: c.id,
      title: c.title,
      timestamp: c.updatedAt,
    }));
    setRecentChats(list);
  }, []);

  // Restore conversation or handle initial query/attachment
  useEffect(() => {
    const storedConv = getConversation(conversationId);
    if (storedConv && Array.isArray(storedConv.messages) && storedConv.messages.length > 0) {
      setMessages(storedConv.messages);
      for (let i = storedConv.messages.length - 1; i >= 0; i--) {
        const m = storedConv.messages[i];
        if (m.response?.cards?.form_i?.fields) {
          setFormState(m.response.cards.form_i.fields);
          break;
        }
      }
      return;
    }

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

    // Geolocation handling: request location only if user explicitly asks for nearby labs/AHC
    let activeLoc = userLocation;
    if (
      !activeLoc &&
      /\b(near\s*me|nearby|closest|around\s*me)\b/i.test(trimmed) &&
      typeof navigator !== "undefined" &&
      "geolocation" in navigator
    ) {
      try {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { timeout: 3000 }
          );
        });
        if (pos) {
          activeLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(activeLoc);
        }
      } catch {}
    }

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

    // Build history from current messages to maintain multi-turn context (last 6 turns)
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

    const updatedWithUser = [...messages, userMsg, assistantMsg];
    setMessages(updatedWithUser);
    setIsLoading(true);
    let completedResponse: BisvedaResponse | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          conversation_id: conversationId,
          history: historyTurns.slice(-6),
          userLocation: activeLoc || undefined,
          attachment: attachment ? { name: attachment.name, base64: attachment.base64, type: attachment.type } : undefined,
          formState: Object.keys(formState).length > 0 ? formState : undefined,
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
              } catch {
                // ignore parse errors
              }
            } else if ((eventType === "result" || eventType === "response") && dataStr) {
              try {
                const finalResp = JSON.parse(dataStr) as BisvedaResponse;
                completedResponse = finalResp;

                if (finalResp.cards?.form_i?.fields) {
                  setFormState((prev) => ({ ...prev, ...finalResp.cards!.form_i!.fields }));
                }

                setMessages((prev) => {
                  const next = prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, response: finalResp, isStreaming: false }
                      : msg
                  );
                  saveConversation(conversationId, next);
                  setRecentChats(
                    listConversations().map((c) => ({
                      id: c.id,
                      title: c.title,
                      timestamp: c.updatedAt,
                    }))
                  );
                  return next;
                });
              } catch {
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
              setMessages((prev) => {
                const next = prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        isStreaming: false,
                        response: {
                          conversation_id: conversationId,
                          kind: "refusal" as const,
                          language: "en",
                          grounding: "none" as const,
                          text: "",
                          refusal: {
                            reason: "not_in_sources" as const,
                            message: errMessage,
                            next_steps: [{ text: "Visit BIS official portal", url: "https://www.bis.gov.in" }],
                          },
                          sources: [],
                          follow_ups: [],
                        },
                      }
                    : msg
                );
                saveConversation(conversationId, next);
                return next;
              });
            }
          }
        }
      } else {
        // Fallback: standard JSON response
        const finalResp = (await res.json()) as BisvedaResponse;
        completedResponse = finalResp;
        if (finalResp.cards?.form_i?.fields) {
          setFormState((prev) => ({ ...prev, ...finalResp.cards!.form_i!.fields }));
        }

        setMessages((prev) => {
          const next = prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, response: finalResp, isStreaming: false }
              : msg
          );
          saveConversation(conversationId, next);
          setRecentChats(
            listConversations().map((c) => ({
              id: c.id,
              title: c.title,
              timestamp: c.updatedAt,
            }))
          );
          return next;
        });
      }
    } catch (err: any) {
      console.error("Chat query failed:", err);
      setMessages((prev) => {
        const next = prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                response: {
                  conversation_id: conversationId,
                  kind: "refusal" as const,
                  language: "en",
                  grounding: "none" as const,
                  text: "",
                  refusal: {
                    reason: "not_in_sources" as const,
                    message: "An error occurred while connecting to the server. Please try again.",
                    next_steps: [{ text: "Visit BIS official portal", url: "https://www.bis.gov.in" }],
                  },
                  sources: [],
                  follow_ups: ["Which standard applies to helmets?"],
                },
              }
            : msg
        );
        saveConversation(conversationId, next);
        return next;
      });
    } finally {
      setIsLoading(false);
      if (voiceModeRef.current && completedResponse) void handleVoiceAnswer(completedResponse, assistantMsgId);
    }
  };
  sendRef.current = (text: string) => {
    void handleSendMessage(text);
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
      <AppHeader onOpenHelpline={() => setIsHelplineOpen(true)} />

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
        <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-[#F7F8FA]/50 relative">
          {/* Top Bar with Sidebar Reopen Toggle & Talk on Call */}
          <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
            {!sidebarOpen ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A] shadow-xs cursor-pointer pointer-events-auto"
                title="Open Sidebar"
                aria-label="Open Sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={() => setIsHelplineOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-amber-200 text-xs font-bold text-[#0B2A4A] shadow-xs hover:bg-amber-50 transition-all pointer-events-auto cursor-pointer hover:scale-105"
              title="Talk with BISVEDA on Call"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#E8710A]" />
              <span>Talk on Call</span>
            </button>
          </div>

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
                    {[
                      "Is BIS mandatory for helmets under QCO?",
                      "Find toy testing labs for IS 9873",
                      "Gold jewellery hallmarking IS 1417",
                      "Register jewellery shop Form I",
                    ].map((ex) => (
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

                    {/* Grounded Answer Card or Form Question */}
                    {(msg.response?.kind === "answer" ||
                      msg.response?.kind === "smalltalk" ||
                      msg.response?.kind === "form_question") && (
                      <AnswerCard
                        response={msg.response}
                        query={msg.userQuery}
                        onOpenSourceDrawer={(idx) => handleOpenSourceDrawer(msg.response!, idx)}
                        onRequestLocation={handleRequestLocation}
                        onSendQuery={(q) => handleSendMessage(q)}
                        userLocation={userLocation}
                        speechId={msg.id}
                      />
                    )}

                    {/* In-chat Feature Cards */}
                    {msg.response?.cards?.image && (
                      <ImageReadCard card={msg.response.cards.image} />
                    )}
                    {msg.response?.cards?.hallmark && (
                      <HallmarkCard card={msg.response.cards.hallmark} />
                    )}
                    {msg.response?.cards?.mark && (
                      <MarkCard card={msg.response.cards.mark} />
                    )}
                    {msg.response?.cards?.labs && (
                      <LabsCard card={msg.response.cards.labs} />
                    )}
                    {msg.response?.cards?.ahc && (
                      <AhcCard card={msg.response.cards.ahc} />
                    )}
                    {msg.response?.cards?.form_i && (
                      <FormICard card={msg.response.cards.form_i} />
                    )}
                    {msg.response?.cards?.helpline && (
                      <HelplineCallCard card={msg.response.cards.helpline} />
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

              {(voiceMode || voiceNote) && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  {voiceMode ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF7ED] border border-[#FDBA74]/60 text-[#0B2A4A] font-medium">
                      <Mic className={`h-3.5 w-3.5 text-[#E8710A] ${voice.state === "listening" ? "animate-pulse" : ""}`} />
                      <span>
                        Voice chat ·{" "}
                        {voice.state === "listening"
                          ? "Listening…"
                          : voice.state === "transcribing"
                            ? "Understanding…"
                            : isLoading
                              ? "Thinking…"
                              : isSpeakingNow
                                ? "Speaking… (tap the mic to interrupt)"
                                : "Ready"}
                      </span>
                      <button
                        type="button"
                        onClick={handleEndVoiceChat}
                        className="ml-1 inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                        aria-label="End voice chat"
                      >
                        <X className="h-3 w-3" />
                        <span>End</span>
                      </button>
                    </div>
                  ) : (
                    <span />
                  )}
                  {voiceNote && <span className="text-[#B45309]">{voiceNote}</span>}
                </div>
              )}

              <Composer
                onSend={handleSendMessage}
                isLoading={isLoading}
                placeholder="Ask a follow-up… e.g. which labs can test this?"
                voiceState={voice.state}
                onMicClick={handleMicClick}
              />

              <div className="text-center text-[11px] text-[#64748B] select-none pt-0.5">
                Answers come only from official BIS documents in our knowledge base
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

      {/* Helpline Voice Call Modal */}
      <HelplineModal
        isOpen={isHelplineOpen}
        onClose={() => setIsHelplineOpen(false)}
      />
    </div>
  );
}

export default function ChatWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-[#0B2A4A] border-t-transparent rounded-full" />
            <span>Loading BISVEDA Assistant…</span>
          </div>
        </div>
      }
    >
      <ChatWorkspaceInner />
    </Suspense>
  );
}
