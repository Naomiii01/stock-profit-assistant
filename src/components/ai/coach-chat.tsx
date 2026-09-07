"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "我真的有賺錢嗎？",
  "哪支股票最會賺？",
  "哪支股票最會賠？",
  "我的勝率如何？",
  "我是不是交易過度？",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function CoachChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "嗨，我是你的 AI 投資教練 👋 你可以問我任何關於你交易紀錄的問題，我會依照具體數據回答。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? data.error ?? "發生錯誤，請稍後再試。" },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "連線發生錯誤，請稍後再試。" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] max-w-2xl flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {q}
          </button>
        ))}
      </div>

      <Card className="flex-1 overflow-y-auto p-0">
        <CardContent className="flex flex-col gap-3 p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex max-w-[85%] flex-col gap-1 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                m.role === "assistant"
                  ? "self-start bg-secondary text-secondary-foreground"
                  : "self-end bg-primary text-primary-foreground"
              )}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 self-start rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse" /> 思考中…
            </div>
          )}
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入你想問的投資問題…"
        />
        <Button type="submit" size="icon" disabled={loading}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
