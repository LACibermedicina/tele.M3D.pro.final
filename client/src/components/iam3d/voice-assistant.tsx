import { useState, useRef, useEffect, useCallback } from "react";
import { X, Keyboard, Send, Phone, Calendar, UserPlus, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type AssistantState = "idle" | "listening" | "speaking" | "processing";

interface ActionButton {
  label: string;
  icon: typeof Phone;
  action: () => void;
  variant?: "default" | "destructive";
}

interface IAM3DVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IAM3DVoiceAssistant({ isOpen, onClose }: IAM3DVoiceAssistantProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [state, setState] = useState<AssistantState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("Olá! Sou o IAM3D, seu assistente médico de voz. Posso ajudar com triagem, agendamento, consultas urgentes e mais. Toque na esfera para começar.");
  const [showInput, setShowInput] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actionButtons, setActionButtons] = useState<ActionButton[]>([]);
  const [lastSymptoms, setLastSymptoms] = useState<string>("");

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        setTranscript(final || interim);
        if (final) {
          const lower = final.toLowerCase().trim();
          const closeCommands = ["fechar assistente", "encerrar assistente", "fechar o assistente", "encerrar o assistente", "desligar assistente", "parar assistente", "sair do assistente", "tchau assistente", "finalizar assistente"];
          if (closeCommands.some(cmd => lower.includes(cmd))) {
            speakText("Até logo! Estou aqui quando precisar.");
            setTimeout(() => handleClose(), 2000);
            return;
          }
          handleSendMessage(final);
        }
      };

      recognition.onend = () => {
        if (state === "listening") setState("idle");
      };

      recognition.onerror = () => {
        setState("idle");
      };

      recognitionRef.current = recognition;
    }

    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (synthRef.current) synthRef.current.cancel();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (synthRef.current) synthRef.current.cancel();
      setState("idle");
      return;
    }
    drawSphere();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isOpen, state]);

  const drawSphere = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(window.innerWidth * 0.65, 280);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = size * 0.35;
    let time = 0;

    const stateColors: Record<AssistantState, string[]> = {
      idle: ["#1e3a5f", "#2d6a9f", "#4ecdc4", "#1a237e"],
      listening: ["#0d47a1", "#1565c0", "#42a5f5", "#00bcd4"],
      speaking: ["#00695c", "#26a69a", "#80cbc4", "#4dd0e1"],
      processing: ["#4a148c", "#7c43bd", "#b388ff", "#651fff"],
    };

    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, size, size);

      const colors = stateColors[state];
      const speed = state === "processing" ? 3 : state === "speaking" ? 2 : state === "listening" ? 1.5 : 1;
      const morphAmount = state === "listening" ? 12 : state === "speaking" ? 8 : state === "processing" ? 6 : 4;

      for (let layer = 3; layer >= 0; layer--) {
        const layerRadius = baseRadius + layer * 8;
        const alpha = 0.15 + layer * 0.1;

        ctx.beginPath();
        const points = 64;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const noise1 = Math.sin(angle * 3 + time * speed) * morphAmount;
          const noise2 = Math.cos(angle * 5 + time * speed * 0.7) * (morphAmount * 0.6);
          const noise3 = Math.sin(angle * 7 + time * speed * 1.3) * (morphAmount * 0.3);
          const r = layerRadius + noise1 + noise2 + noise3;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const gradient = ctx.createRadialGradient(
          cx - layerRadius * 0.3,
          cy - layerRadius * 0.3,
          0,
          cx,
          cy,
          layerRadius + morphAmount
        );
        gradient.addColorStop(0, colors[layer % colors.length] + "cc");
        gradient.addColorStop(0.5, colors[(layer + 1) % colors.length] + "88");
        gradient.addColorStop(1, colors[(layer + 2) % colors.length] + "22");
        ctx.fillStyle = gradient;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      const glowRadius = baseRadius * 1.4;
      const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
      const glowAlpha = state === "listening" ? 0.3 : state === "speaking" ? 0.25 : 0.1;
      glowGrad.addColorStop(0, `rgba(78, 205, 196, ${glowAlpha})`);
      glowGrad.addColorStop(1, "rgba(78, 205, 196, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const highlightGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.25,
        cy - baseRadius * 0.35,
        0,
        cx,
        cy,
        baseRadius
      );
      highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)");
      highlightGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.05)");
      highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [state]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    if (synthRef.current) synthRef.current.cancel();
    setTranscript("");
    setState("listening");
    try {
      recognitionRef.current.start();
    } catch {
      setState("idle");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setState("idle");
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const clean = text
      .replace(/[📅🔑👋⚠️✅🩺📊📋🎯💡🚨⚡🔴🟠🟡🟢🔵💊🏥]/g, "")
      .replace(/\*\*/g, "")
      .replace(/•/g, "")
      .replace(/\n+/g, ". ")
      .trim();
    if (!clean) { setState("idle"); return; }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith("pt-BR")) || voices.find(v => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onstart = () => setState("speaking");
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");

    synthRef.current.speak(utterance);
  };

  const handleUrgentConsultation = async (symptoms: string) => {
    try {
      setState("processing");
      const res = await apiRequest("POST", "/api/chatbot/urgent-consultation", {
        symptoms: symptoms || "Sintomas relatados via assistente de voz",
        urgencyLevel: "urgent",
      });
      const data = await res.json();
      setResponse(data.message);
      speakText(data.message);
      setActionButtons([]);
      if (data.success) {
        toast({
          title: "Consulta Urgente Solicitada",
          description: `Médico de plantão notificado: ${data.selectedDoctor?.name || 'médico disponível'}`,
        });
      }
    } catch {
      const errMsg = "Não foi possível solicitar a consulta urgente. Tente novamente.";
      setResponse(errMsg);
      speakText(errMsg);
    }
  };

  const handleNavigate = (path: string) => {
    handleClose();
    setLocation(path);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    setState("processing");
    setResponse("");
    setActionButtons([]);
    setLastSymptoms(text);

    try {
      const endpoint = user ? "/api/chatbot/message" : "/api/chatbot/visitor-message";
      const payload: any = { message: text };
      if (user && conversationId) {
        payload.conversationId = conversationId;
      }
      if (!user) {
        payload.mode = "general";
      }

      const res = await apiRequest("POST", endpoint, payload);
      const data = await res.json();

      let aiText: string;
      let suggestedAppointment: any = null;
      let actionType: string | null = null;

      if (user) {
        aiText = data.message?.content || data.response || "Desculpe, não entendi. Pode repetir?";
        if (data.conversationId) setConversationId(data.conversationId);
        suggestedAppointment = data.metadata?.suggestedAppointment;
        actionType = data.metadata?.actionType;
      } else {
        aiText = data.response || "Desculpe, não entendi. Pode repetir?";
      }

      setResponse(aiText);
      speakText(aiText);

      const buttons: ActionButton[] = [];

      if (suggestedAppointment) {
        buttons.push({
          label: `Confirmar com Dr(a). ${suggestedAppointment.doctorName}`,
          icon: Calendar,
          action: async () => {
            try {
              setState("processing");
              const confirmRes = await apiRequest("POST", "/api/chatbot/confirm-appointment", suggestedAppointment);
              const confirmData = await confirmRes.json();
              const confirmMsg = `Consulta confirmada com Dr(a). ${suggestedAppointment.doctorName}!`;
              setResponse(confirmMsg);
              speakText(confirmMsg);
              setActionButtons([]);
              toast({ title: "Consulta Confirmada", description: confirmMsg });
            } catch {
              speakText("Não foi possível confirmar. Tente novamente.");
            }
          },
        });
      }

      if (actionType === "urgent_consultation" && user?.role === "patient") {
        buttons.push({
          label: "Solicitar Consulta Urgente",
          icon: Phone,
          variant: "destructive",
          action: () => handleUrgentConsultation(text),
        });
      }

      if (actionType === "register_update") {
        buttons.push({
          label: "Ir para Meu Perfil",
          icon: UserPlus,
          action: () => handleNavigate("/profile"),
        });
      }

      if (data.type === "appointment" && !suggestedAppointment) {
        buttons.push({
          label: "Ver Agenda",
          icon: Calendar,
          action: () => handleNavigate("/schedule"),
        });
      }

      setActionButtons(buttons);
    } catch {
      const errMsg = "Desculpe, houve um problema. Tente novamente.";
      setResponse(errMsg);
      speakText(errMsg);
    }
  };

  const handleSphereClick = () => {
    if (state === "listening") {
      stopListening();
    } else if (state === "speaking") {
      if (synthRef.current) synthRef.current.cancel();
      setState("idle");
    } else if (state === "idle") {
      startListening();
    }
  };

  const handleManualSend = () => {
    if (!manualInput.trim()) return;
    setTranscript(manualInput);
    handleSendMessage(manualInput);
    setManualInput("");
  };

  const handleClose = () => {
    if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
    if (synthRef.current) synthRef.current.cancel();
    setState("idle");
    setTranscript("");
    setResponse("Olá! Sou o IAM3D, seu assistente médico de voz. Posso ajudar com triagem, agendamento, consultas urgentes e mais. Toque na esfera para começar.");
    setActionButtons([]);
    onClose();
  };

  if (!isOpen) return null;

  const stateLabel: Record<AssistantState, string> = {
    idle: "Toque para falar",
    listening: "Ouvindo...",
    speaking: "Falando...",
    processing: "Processando...",
  };

  const roleCapabilities = user?.role === "doctor" 
    ? ["Diagnóstico", "Protocolos", "Plantão"]
    : user?.role === "patient" 
    ? ["Triagem", "Agendar", "Urgente"] 
    : ["Sintomas", "Agendar", "Acesso"];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/95 via-slate-800/98 to-slate-900/95 backdrop-blur-xl">
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-6 left-0 right-0 text-center">
        <h2 className="text-white/90 text-lg font-light tracking-widest">IAM3D</h2>
        <p className="text-white/50 text-xs mt-0.5">Assistente Médico de Voz</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          {roleCapabilities.map((cap) => (
            <span key={cap} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-6">
        <div className="relative mb-6">
          <button
            onClick={handleSphereClick}
            className="relative block focus:outline-none"
            aria-label={stateLabel[state]}
          >
            <canvas ref={canvasRef} className="block" />

            {state === "listening" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-3/4 rounded-full border-2 border-cyan-400/30 animate-ping" />
              </div>
            )}
          </button>

          <div className="mt-3 text-center">
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
              state === "listening" ? "bg-cyan-500/20 text-cyan-300" :
              state === "speaking" ? "bg-emerald-500/20 text-emerald-300" :
              state === "processing" ? "bg-purple-500/20 text-purple-300" :
              "bg-white/10 text-white/70"
            }`}>
              {state === "listening" && (
                <span className="flex gap-0.5">
                  <span className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-4 bg-cyan-300 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                </span>
              )}
              {stateLabel[state]}
            </span>
          </div>
        </div>

        {transcript && state === "listening" && (
          <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-white/80 text-sm text-center italic">"{transcript}"</p>
          </div>
        )}

        {response && state !== "listening" && (
          <div className="w-full mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 max-h-40 overflow-y-auto">
            <p className="text-white/90 text-sm text-center leading-relaxed">{response}</p>
          </div>
        )}

        {actionButtons.length > 0 && state !== "listening" && (
          <div className="w-full mb-4 space-y-2">
            {actionButtons.map((btn, idx) => (
              <Button
                key={idx}
                onClick={btn.action}
                variant={btn.variant === "destructive" ? "destructive" : "default"}
                className={`w-full h-11 text-sm ${
                  btn.variant === "destructive" 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
                disabled={state === "processing"}
              >
                <btn.icon className="w-4 h-4 mr-2" />
                {btn.label}
              </Button>
            ))}
          </div>
        )}

        <div className="w-full space-y-2">
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 text-xs transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5" />
            {showInput ? "Ocultar teclado" : "Digitar mensagem"}
          </button>

          {showInput && (
            <div className="flex gap-2">
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-cyan-400/50"
                disabled={state === "processing"}
              />
              <Button
                onClick={handleManualSend}
                disabled={!manualInput.trim() || state === "processing"}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="pb-8 text-center">
        <p className="text-white/30 text-xs">Tele{"<"}M3D{">"} Pro • Assistente de Voz</p>
      </div>
    </div>
  );
}
