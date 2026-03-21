import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle, Send, X, Loader2, Home
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatbotResponse {
  message?: { content?: string };
  response?: string;
}

export function ImmersiveFloatingChat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: "Como posso ajudar? Diga \"início\" para voltar ao chat principal.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const lower = msg.toLowerCase();
    if (lower === "início" || lower === "inicio" || lower === "home" || lower === "voltar") {
      const navMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Voltando ao chat principal...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, navMsg]);
      setIsLoading(false);
      setTimeout(() => setLocation("/"), 500);
      return;
    }

    try {
      const endpoint = user ? "/api/chatbot/message" : "/api/chatbot/visitor-message";
      const res = await apiRequest("POST", endpoint, { message: msg, language: "pt" });
      const data = (await res.json()) as ChatbotResponse;
      const aiText = user
        ? data.message?.content || data.response || "Como posso ajudar?"
        : data.response || "Como posso ajudar?";

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Erro. Tente novamente.", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-slate-900 text-white border-white/20 hover:bg-slate-800 shadow-lg"
          onClick={() => setLocation("/")}
        >
          <Home className="w-4 h-4 mr-1" />
          Chat Principal
        </Button>
        <Button
          size="icon"
          className="rounded-full h-14 w-14 bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "60vh" }}>
      <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-white/10">
        <span className="text-white text-sm font-semibold flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-cyan-400" />
          Assistente
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white" onClick={() => setIsOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 py-2 min-h-[200px]" ref={scrollRef}>
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-cyan-600 text-white" : "bg-white/10 text-white/90"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="px-3 pb-3 pt-1 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
          placeholder="Digite..."
          className="bg-white/10 border-white/20 text-white text-xs placeholder:text-white/40 h-8"
        />
        <Button size="icon" className="h-8 w-8 bg-cyan-600 hover:bg-cyan-500 text-white shrink-0" onClick={handleSend} disabled={isLoading || !input.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
