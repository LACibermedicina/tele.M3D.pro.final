import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Send, Volume2, VolumeX, Settings, Home,
  Wallet, FileText, Calendar, Stethoscope, User, LogOut,
  MessageCircle, Loader2, Menu, X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LanguageSelector from "@/components/ui/language-selector";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const navigationMap: Record<string, { path: string; label: string }> = {
  carteira: { path: "/wallet", label: "Carteira Digital" },
  wallet: { path: "/wallet", label: "Carteira Digital" },
  "creditos": { path: "/wallet", label: "Créditos" },
  "créditos": { path: "/wallet", label: "Créditos" },
  consulta: { path: "/consultation-request", label: "Solicitar Consulta" },
  consultar: { path: "/consultation-request", label: "Solicitar Consulta" },
  agenda: { path: "/schedule", label: "Agenda" },
  prontuario: { path: "/records", label: "Prontuários" },
  "prontuário": { path: "/records", label: "Prontuários" },
  prontuarios: { path: "/records", label: "Prontuários" },
  "prontuários": { path: "/records", label: "Prontuários" },
  prescricao: { path: "/prescriptions", label: "Prescrições" },
  "prescrição": { path: "/prescriptions", label: "Prescrições" },
  prescricoes: { path: "/prescriptions", label: "Prescrições" },
  "prescrições": { path: "/prescriptions", label: "Prescrições" },
  perfil: { path: "/profile", label: "Meu Perfil" },
  pacientes: { path: "/patients", label: "Pacientes" },
  dashboard: { path: "/dashboard", label: "Painel" },
  painel: { path: "/dashboard", label: "Painel" },
  inicio: { path: "/", label: "Início" },
  "início": { path: "/", label: "Início" },
  home: { path: "/", label: "Início" },
  manual: { path: "/manual", label: "Manual" },
  faq: { path: "/faq", label: "FAQ" },
  consultorio: { path: "/doctor-office", label: "Consultório" },
  "consultório": { path: "/doctor-office", label: "Consultório" },
  notas: { path: "/doctor-notes", label: "Notas Médicas" },
  equipes: { path: "/medical-teams", label: "Equipes Médicas" },
  relatorios: { path: "/reports", label: "Relatórios" },
  "relatórios": { path: "/reports", label: "Relatórios" },
  admin: { path: "/admin", label: "Administração" },
  farmacia: { path: "/pharmacy", label: "Farmácia" },
  "farmácia": { path: "/pharmacy", label: "Farmácia" },
  "minhas consultas": { path: "/my-consultations", label: "Minhas Consultas" },
  assistente: { path: "/assistant", label: "Assistente Médico" },
  disponibilidade: { path: "/doctor-availability", label: "Disponibilidade" },
  cafe: { path: "/coffee-room", label: "Sala de Café" },
  "café": { path: "/coffee-room", label: "Sala de Café" },
  nft: { path: "/nft-management", label: "NFT" },
  clinicas: { path: "/clinics", label: "Clínicas" },
  "clínicas": { path: "/clinics", label: "Clínicas" },
  "analises": { path: "/analytics", label: "Análises" },
  "análises": { path: "/analytics", label: "Análises" },
  analytics: { path: "/analytics", label: "Análises" },
  "pagamentos": { path: "/admin/payments", label: "Pagamentos" },
  payments: { path: "/admin/payments", label: "Pagamentos" },
  "videoconsulta": { path: "/my-consultations", label: "Videoconsulta" },
  "video": { path: "/my-consultations", label: "Videoconsulta" },
  "agenda paciente": { path: "/patient-agenda", label: "Agenda do Paciente" },
  "revisao": { path: "/post-consultation-review", label: "Revisão Pós-Consulta" },
  "revisão": { path: "/post-consultation-review", label: "Revisão Pós-Consulta" },
  "diagnostico": { path: "/diagnostic-review", label: "Diagnóstico" },
  "diagnóstico": { path: "/diagnostic-review", label: "Diagnóstico" },
  "painel clinico": { path: "/clinical-dashboard", label: "Painel Clínico" },
  "painel clínico": { path: "/clinical-dashboard", label: "Painel Clínico" },
  "fhir": { path: "/fhir-dashboard", label: "FHIR Dashboard" },
  "referencias medicas": { path: "/medical-references", label: "Referências Médicas" },
  "referências médicas": { path: "/medical-references", label: "Referências Médicas" },
  "encaminhamentos": { path: "/doctor-referrals", label: "Encaminhamentos" },
  "consulta imediata": { path: "/immediate-consultation", label: "Consulta Imediata" },
  "chat medico": { path: "/doctor-chat", label: "Chat Médico" },
  "chat médico": { path: "/doctor-chat", label: "Chat Médico" },
  "sala equipe": { path: "/medical-teams", label: "Sala da Equipe" },
  "cafe medico": { path: "/medical-cafe", label: "Café Médico" },
  "café médico": { path: "/medical-cafe", label: "Café Médico" },
  "interconsulta": { path: "/inter-consultation", label: "Interconsulta" },
  "epidemiologia": { path: "/epidemiological-reports", label: "Relatórios Epidemiológicos" },
  "consultas incompletas": { path: "/incomplete-consultations", label: "Consultas Incompletas" },
  "relatorio farmacia": { path: "/pharmacy/reports", label: "Relatórios da Farmácia" },
  "relatório farmácia": { path: "/pharmacy/reports", label: "Relatórios da Farmácia" },
  "broker": { path: "/broker", label: "Broker" },
  "credits": { path: "/credits", label: "Comprar Créditos" },
  "comprar creditos": { path: "/credits", label: "Comprar Créditos" },
  "comprar créditos": { path: "/credits", label: "Comprar Créditos" },
  "documentacao": { path: "/documentation", label: "Documentação" },
  "documentação": { path: "/documentation", label: "Documentação" },
  "instalacao": { path: "/installation", label: "Instalação" },
  "instalação": { path: "/installation", label: "Instalação" },
  "recursos": { path: "/features", label: "Recursos" },
  features: { path: "/features", label: "Recursos" },
};

function detectNavigation(text: string): { path: string; label: string } | null {
  const lower = text.toLowerCase().trim();
  const navPrefixes = ["abrir", "ir para", "ver", "mostrar", "navegar para", "acessar", "consultar", "abra", "vá para", "mostre", "open", "go to", "show"];

  for (const prefix of navPrefixes) {
    if (lower.startsWith(prefix)) {
      const target = lower.replace(prefix, "").trim();
      for (const [key, val] of Object.entries(navigationMap)) {
        if (target.includes(key)) return val;
      }
    }
  }

  for (const [key, val] of Object.entries(navigationMap)) {
    if (lower.includes(key)) return val;
  }

  return null;
}

interface ChatbotResponse {
  message?: { content?: string };
  response?: string;
}

export function ImmersiveLayout() {
  const { user, logout } = useAuth();
  const { clearViewMode } = useViewMode();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: `Olá${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Sou seu assistente. Você pode me pedir para navegar pelo sistema dizendo coisas como "abrir carteira", "ver prontuário", "consultar agenda" ou fazer perguntas sobre saúde.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const recognition = createSpeechRecognition();
    if (recognition) {
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(finalTranscript);
          handleSend(finalTranscript);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const speakText = (text: string) => {
    if (!synthRef.current || !ttsEnabled) return;
    synthRef.current.cancel();
    const clean = text
      .replace(/[📅🔑👋⚠️✅🩺📊📋🎯💡🚨⚡]/g, "")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, ". ")
      .trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt-BR")) || voices.find((v) => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;
    synthRef.current.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const nav = detectNavigation(msg);
    if (nav) {
      const navMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Navegando para ${nav.label}...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, navMsg]);
      speakText(`Abrindo ${nav.label}`);
      setIsLoading(false);
      setTimeout(() => setLocation(nav.path), 800);
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
      speakText(aiText);
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickNavItems = user?.role === "doctor"
    ? [
        { label: "Agenda", path: "/schedule", icon: Calendar },
        { label: "Pacientes", path: "/patients", icon: User },
        { label: "Consultório", path: "/doctor-office", icon: Stethoscope },
        { label: "Prontuários", path: "/records", icon: FileText },
        { label: "Carteira", path: "/wallet", icon: Wallet },
      ]
    : user?.role === "patient"
    ? [
        { label: "Consultar", path: "/consultation-request", icon: Stethoscope },
        { label: "Minhas Consultas", path: "/my-consultations", icon: Calendar },
        { label: "Prontuários", path: "/records", icon: FileText },
        { label: "Créditos", path: "/wallet", icon: Wallet },
        { label: "Perfil", path: "/profile", icon: User },
      ]
    : [
        { label: "Painel", path: "/dashboard", icon: Home },
        { label: "Carteira", path: "/wallet", icon: Wallet },
        { label: "Perfil", path: "/profile", icon: User },
      ];

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-sm">Modo Imersivo</span>
          {user && (
            <Badge data-no-translate variant="outline" className="text-xs border-white/20 text-white/70">
              {user.name?.split(" ")[0]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector triggerClassName="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" />
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white h-8 w-8"
            onClick={() => setTtsEnabled(!ttsEnabled)}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white h-8 w-8"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute top-12 right-2 z-50 bg-slate-800 rounded-lg border border-white/10 shadow-xl p-2 space-y-1 min-w-[180px]">
          {quickNavItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 text-sm"
              onClick={() => {
                setMenuOpen(false);
                setLocation(item.path);
              }}
            >
              <item.icon className="w-4 h-4 mr-2" />
              {item.label}
            </Button>
          ))}
          <hr className="border-white/10 my-1" />
          <Button
            variant="ghost"
            className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10 text-sm"
            onClick={() => {
              clearViewMode();
              setLocation("/mode-selection");
            }}
          >
            <Settings className="w-4 h-4 mr-2" />
            Trocar Modalidade
          </Button>
          {user && (
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm"
              onClick={() => {
                logout();
                setLocation("/login");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        <div className="max-w-lg mx-auto space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "bg-white/10 text-white/90"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span className="text-[10px] opacity-50 mt-1 block">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-2 flex flex-wrap gap-2 justify-center">
        {quickNavItems.slice(0, 4).map((item) => (
          <Button
            key={item.path}
            variant="outline"
            size="sm"
            className="text-xs border-white/20 text-white/70 hover:text-white hover:bg-white/10 bg-transparent"
            onClick={() => setLocation(item.path)}
          >
            <item.icon className="w-3 h-3 mr-1" />
            {item.label}
          </Button>
        ))}
      </div>

      <div className="px-4 pb-4 pt-2 bg-black/20 border-t border-white/10">
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`shrink-0 rounded-full h-10 w-10 ${
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-white/10 text-white/70 hover:text-white"
            }`}
            onClick={toggleListening}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite ou fale um comando..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-cyan-500"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full h-10 w-10 bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const W = window as Record<string, unknown>;
  const SpeechRecognitionAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI || typeof SpeechRecognitionAPI !== "function") return null;
  return new (SpeechRecognitionAPI as new () => SpeechRecognitionInstance)();
}
