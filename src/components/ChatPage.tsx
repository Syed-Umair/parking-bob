"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles } from "lucide-react";
import type { Spot } from "@/lib/db";
import SpotCard from "./SpotCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  spots?: Spot[];
}

// ---------------------------------------------------------------------------
// Suggested prompts shown before first message
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  "Find car parking in Koramangala under ₹50",
  "Covered bike spot in Indiranagar",
  "SUV parking near Whitefield with EV charging",
  "Cheapest spot in HSR Layout",
];

const WELCOME_REPLY =
  "I'm parkingBob — your parking concierge for Bengaluru. Tell me where you're headed and what you're driving, and I'll find you a spot.";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME_REPLY },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput("");
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      // Build history for context (exclude the welcome message)
      const history = messages
        .filter((m) => m.role === "user" || (m.role === "assistant" && m.content !== WELCOME_REPLY))
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
        });
        const data = await res.json() as {
          reply: string;
          spots?: Spot[];
        };

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? "Sorry, I couldn't find anything.",
            spots: data.spots,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, messages]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">

      {/* ── Message area ───────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

          {/* Welcome / empty state */}
          {messages.length === 1 && (
            <div className="mb-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Find parking in Bengaluru
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell me where you're going and what you're driving.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={msg.role === "user" ? "max-w-[75%]" : "max-w-[90%] w-full"}>

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-foreground rounded-bl-sm border border-border/40"
                    }`}
                  >
                    {/* Render **bold** markdown */}
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={j}>{part.slice(2, -2)}</strong>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </div>

                  {/* Spot cards rendered inline below bot message */}
                  {msg.spots && msg.spots.length > 0 && (
                    <div className="mt-3 grid gap-px overflow-hidden rounded-xl border border-border/40 bg-border/20 sm:grid-cols-2">
                      {msg.spots.map((spot) => (
                        <SpotCard key={spot.id} spot={spot} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border/40 bg-card px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips — shown only when no user messages yet */}
          {messages.length === 1 && !loading && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Input bar ──────────────────────────────────────── */}
      <div className="border-t border-border/40 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Input
            ref={inputRef}
            placeholder="Ask about parking — area, vehicle, budget…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            disabled={loading}
            className="text-sm"
            autoFocus
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Powered by IBM watsonx.ai · Granite 3.3
        </p>
      </div>
    </div>
  );
}
