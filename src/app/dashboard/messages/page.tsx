"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

type ConversationPreview = {
  id: string;
  otherUser: { id: string; name: string | null; handle: string | null; image: string | null };
  lastMessage: { id: string; content: string; senderId: string; read: boolean; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
};

type Message = {
  id: string;
  content: string;
  senderId: string;
  read: boolean;
  createdAt: string;
};

export default function MessagesPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeId = searchParams.get("id");

  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<ConversationPreview["otherUser"] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = (session?.user as any)?.id;

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (convId: string) => {
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages.reverse()); // API returns newest first, display oldest first
        setOtherUser(data.otherUser);
      }
    } catch { /* ignore */ }
    setThreadLoading(false);
  }, []);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    } else {
      setMessages([]);
      setOtherUser(null);
    }
  }, [activeId, loadMessages]);

  // Poll for new messages when a conversation is open
  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(() => {
      loadMessages(activeId);
      loadConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeId, loadMessages, loadConversations]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    // Optimistic add
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      content,
      senderId: userId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        loadConversations();
      }
    } catch {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
    }
    setSending(false);
  }

  function selectConversation(id: string) {
    router.push(`/dashboard/messages?id=${id}`);
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d`;
    return d.toLocaleDateString();
  }

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Conversations sidebar */}
        <div className={`w-full md:w-80 md:min-w-[320px] border-r border-rudo-card-border flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-rudo-card-border">
            <h2 className="font-orbitron font-bold text-xs tracking-[2px] uppercase text-rudo-dark-text">
              Messages
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="status-dot" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-sm text-rudo-dark-text-sec font-light">No conversations yet</p>
                <p className="text-xs text-rudo-dark-muted font-light mt-1">
                  Visit a user&apos;s profile to send them a message
                </p>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-none cursor-pointer transition-colors ${
                    activeId === c.id
                      ? "bg-rudo-blue-soft"
                      : "bg-transparent hover:bg-rudo-card-bg"
                  }`}
                >
                  {c.otherUser.image ? (
                    <img
                      src={c.otherUser.image}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-sm text-white font-bold flex-shrink-0">
                      {(c.otherUser.name || "?")[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${c.unreadCount > 0 ? "font-bold text-rudo-dark-text" : "font-light text-rudo-dark-text"}`}>
                        {c.otherUser.name || c.otherUser.handle || "User"}
                      </span>
                      {c.lastMessage && (
                        <span className="text-[10px] text-rudo-dark-muted ml-2 flex-shrink-0">
                          {formatTime(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-rudo-dark-text-sec truncate font-light">
                        {c.lastMessage
                          ? `${c.lastMessage.senderId === userId ? "You: " : ""}${c.lastMessage.content}`
                          : "No messages yet"}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-rudo-blue text-white text-[10px] flex items-center justify-center flex-shrink-0 font-bold">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className={`flex-1 flex flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {activeId && otherUser ? (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-rudo-card-border flex items-center gap-3">
                <button
                  onClick={() => router.push("/dashboard/messages")}
                  className="md:hidden bg-transparent border-none text-rudo-dark-text-sec cursor-pointer p-1"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {otherUser.image ? (
                  <img src={otherUser.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rudo-blue to-rudo-blue/60 flex items-center justify-center text-xs text-white font-bold">
                    {(otherUser.name || "?")[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-rudo-dark-text">{otherUser.name || otherUser.handle}</p>
                  {otherUser.handle && (
                    <p className="text-[10px] text-rudo-blue">@{otherUser.handle}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {threadLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="status-dot" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-rudo-dark-text-sec font-light">
                      Start the conversation
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-3 py-2 text-sm font-light ${
                            isMine
                              ? "bg-rudo-blue text-white rounded-[16px_16px_4px_16px]"
                              : "bg-rudo-card-bg border border-rudo-card-border text-rudo-dark-text rounded-[16px_16px_16px_4px]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMine ? "text-white/60" : "text-rudo-dark-muted"
                            }`}
                          >
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-rudo-card-border flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={2000}
                  className="flex-1 px-4 py-2 bg-rudo-card-bg border border-rudo-card-border text-sm text-rudo-dark-text placeholder:text-rudo-dark-muted font-light outline-none focus:border-rudo-blue transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="px-4 py-2 bg-rudo-blue text-white text-xs font-orbitron tracking-wider border-none cursor-pointer hover:bg-rudo-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-3 text-rudo-dark-muted">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm text-rudo-dark-text-sec font-light">
                  Select a conversation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
