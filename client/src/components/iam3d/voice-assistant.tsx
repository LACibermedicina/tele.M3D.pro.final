import { useState, useRef, useEffect, useCallback } from "react";
import { X, Keyboard, Send, Phone, Calendar, UserPlus, AlertTriangle, Mic, MicOff, PhoneOff, Clock, Stethoscope, User, Shield, Activity, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type AssistantState = "idle" | "listening" | "speaking" | "processing" | "calling";

interface ActionButton {
  label: string;
  icon: typeof Phone;
  action: () => void;
  variant?: "default" | "destructive" | "outline";
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
  const [response, setResponse] = useState("Olá! Sou o IAM3D, seu assistente médico virtual. Posso ajudar com triagem de sintomas, agendamento de consultas, chamadas urgentes com médicos de plantão e muito mais. Toque no microfone para começar.");
  const [showInput, setShowInput] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actionButtons, setActionButtons] = useState<ActionButton[]>([]);
  const [lastSymptoms, setLastSymptoms] = useState<string>("");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: onlineDoctors = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors/online"],
    enabled: isOpen,
    refetchInterval: 15000,
  });

  const onDutyDoctors = onlineDoctors.filter((d: any) => d.isOnDuty || d.onDuty24h);

  useEffect(() => {
    if (isOpen) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

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
    const size = Math.min(window.innerWidth * 0.5, 220);
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
      calling: ["#b71c1c", "#e53935", "#ef5350", "#ff8a80"],
    };

    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, size, size);

      const colors = stateColors[state];
      const speed = state === "processing" ? 3 : state === "calling" ? 2.5 : state === "speaking" ? 2 : state === "listening" ? 1.5 : 1;
      const morphAmount = state === "listening" ? 12 : state === "calling" ? 10 : state === "speaking" ? 8 : state === "processing" ? 6 : 4;

      for (let layer = 3; layer >= 0; layer--) {
        const layerRadius = baseRadius + layer * 7;
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

        const gradient = ctx.createRadialGradient(cx - layerRadius * 0.3, cy - layerRadius * 0.3, 0, cx, cy, layerRadius + morphAmount);
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
      const glowAlpha = state === "listening" ? 0.3 : state === "calling" ? 0.35 : state === "speaking" ? 0.25 : 0.1;
      const glowColor = state === "calling" ? "239, 83, 80" : "78, 205, 196";
      glowGrad.addColorStop(0, `rgba(${glowColor}, ${glowAlpha})`);
      glowGrad.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      const highlightGrad = ctx.createRadialGradient(cx - baseRadius * 0.25, cy - baseRadius * 0.35, 0, cx, cy, baseRadius);
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

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startListening = () => {
    if (!recognitionRef.current || isMuted) return;
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
    if (!synthRef.current || !isSpeakerOn) { setState("idle"); return; }
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
      setState("calling");
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

  const handleRegisterAsPatient = () => {
    handleClose();
    setLocation("/register/patient");
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
              await apiRequest("POST", "/api/chatbot/confirm-appointment", suggestedAppointment);
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

      if (!user) {
        const lower = text.toLowerCase();
        if (lower.includes("cadastr") || lower.includes("registr") || lower.includes("criar conta") || lower.includes("quero ser paciente")) {
          buttons.push({
            label: "Criar Conta de Paciente",
            icon: UserPlus,
            action: handleRegisterAsPatient,
          });
        }
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
    setResponse("Olá! Sou o IAM3D, seu assistente médico virtual. Posso ajudar com triagem de sintomas, agendamento de consultas, chamadas urgentes com médicos de plantão e muito mais. Toque no microfone para começar.");
    setActionButtons([]);
    onClose();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (state === "listening" && !isMuted) {
      stopListening();
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (synthRef.current && !isSpeakerOn === false) {
      synthRef.current.cancel();
    }
  };

  if (!isOpen) return null;

  const stateLabel: Record<AssistantState, string> = {
    idle: "Toque no microfone para falar",
    listening: "Ouvindo...",
    speaking: "IAM3D respondendo...",
    processing: "Analisando...",
    calling: "Conectando médico de plantão...",
  };

  const roleCapabilities = user?.role === "doctor"
    ? [{ label: "Diagnóstico", color: "bg-purple-500/30 text-purple-300" }, { label: "Protocolos", color: "bg-blue-500/30 text-blue-300" }, { label: "Plantão", color: "bg-amber-500/30 text-amber-300" }]
    : user?.role === "patient"
    ? [{ label: "Triagem", color: "bg-cyan-500/30 text-cyan-300" }, { label: "Agendar", color: "bg-green-500/30 text-green-300" }, { label: "Urgente", color: "bg-red-500/30 text-red-300" }]
    : [{ label: "Sintomas", color: "bg-cyan-500/30 text-cyan-300" }, { label: "Agendar", color: "bg-green-500/30 text-green-300" }, { label: "Cadastrar", color: "bg-blue-500/30 text-blue-300" }];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gradient-to-b from-[#0a0e1a] via-[#0d1526] to-[#0a0e1a]">

      {/* Top Bar - Agora-style */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 text-sm font-medium">IAM3D</span>
          </div>
          <span className="text-white/40 text-xs">|</span>
          <span className="text-white/50 text-xs font-mono">{formatDuration(callDuration)}</span>
        </div>
        <div className="flex items-center gap-3">
          {onDutyDoctors.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <Stethoscope className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300 text-xs font-medium">{onDutyDoctors.length} médico{onDutyDoctors.length > 1 ? 's' : ''} de plantão</span>
            </div>
          )}
          {user && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10">
              <User className="w-3 h-3 text-white/60" />
              <span className="text-white/60 text-xs">{user.name?.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Role Capabilities Bar */}
      <div className="flex items-center justify-center gap-2 py-2 bg-black/20">
        {roleCapabilities.map((cap) => (
          <span key={cap.label} className={`px-3 py-1 rounded-full text-[11px] font-medium ${cap.color}`}>
            {cap.label}
          </span>
        ))}
        {!user && (
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/10 text-white/40">
            Visitante
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">

        {/* Sphere */}
        <div className="relative mb-4">
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
            {state === "calling" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-3/4 rounded-full border-2 border-red-400/40 animate-ping" />
              </div>
            )}
          </button>

          {/* State indicator */}
          <div className="mt-2 text-center">
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
              state === "listening" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" :
              state === "speaking" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
              state === "processing" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
              state === "calling" ? "bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse" :
              "bg-white/5 text-white/50 border border-white/10"
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

        {/* Transcript - live speech */}
        {transcript && state === "listening" && (
          <div className="w-full max-w-md mb-3 px-4 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-cyan-200/90 text-sm text-center italic">"{transcript}"</p>
          </div>
        )}

        {/* AI Response */}
        {response && state !== "listening" && (
          <div className="w-full max-w-md mb-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 max-h-36 overflow-y-auto">
            <p className="text-white/90 text-sm text-center leading-relaxed">{response}</p>
          </div>
        )}

        {/* Action Buttons */}
        {actionButtons.length > 0 && state !== "listening" && (
          <div className="w-full max-w-md mb-3 space-y-2">
            {actionButtons.map((btn, idx) => (
              <Button
                key={idx}
                onClick={btn.action}
                variant={btn.variant === "destructive" ? "destructive" : "default"}
                className={`w-full h-11 text-sm rounded-xl ${
                  btn.variant === "destructive"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-cyan-600/80 hover:bg-cyan-600 text-white border border-cyan-500/30"
                }`}
                disabled={state === "processing" || state === "calling"}
              >
                <btn.icon className="w-4 h-4 mr-2" />
                {btn.label}
              </Button>
            ))}
          </div>
        )}

        {/* On-Duty Doctor Quick Call */}
        {onDutyDoctors.length > 0 && user?.role === "patient" && state === "idle" && actionButtons.length === 0 && (
          <div className="w-full max-w-md mb-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/50 text-xs text-center mb-2">Médicos de plantão disponíveis</p>
              <div className="space-y-1.5">
                {onDutyDoctors.slice(0, 3).map((doc: any) => (
                  <button
                    key={doc.id}
                    onClick={() => handleUrgentConsultation(`Solicitação de atendimento urgente com Dr(a). ${doc.name}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white/90 text-sm font-medium">Dr(a). {doc.name}</p>
                      <p className="text-white/40 text-xs">{doc.specialty || 'Clínica Geral'}</p>
                    </div>
                    <Phone className="w-4 h-4 text-white/30 group-hover:text-red-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Text Input */}
        <div className="w-full max-w-md space-y-2">
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-2 mx-auto px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 text-xs transition-colors"
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
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-cyan-400/50 rounded-xl"
                disabled={state === "processing" || state === "calling"}
              />
              <Button
                onClick={handleManualSend}
                disabled={!manualInput.trim() || state === "processing" || state === "calling"}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar - Agora-style */}
      <div className="pb-6 pt-4 bg-gradient-to-t from-black/40 to-transparent">
        <div className="flex items-center justify-center gap-5">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500/30 border border-red-500/40 text-red-400"
                : "bg-white/10 border border-white/20 text-white/80 hover:bg-white/20"
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Main mic button */}
          <button
            onClick={handleSphereClick}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
              state === "listening"
                ? "bg-cyan-500 text-white shadow-cyan-500/40 animate-pulse"
                : state === "calling"
                ? "bg-red-500 text-white shadow-red-500/40 animate-pulse"
                : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/30 hover:shadow-cyan-500/50"
            }`}
          >
            {state === "listening" ? <Mic className="w-7 h-7" /> : state === "calling" ? <Phone className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          {/* Speaker */}
          <button
            onClick={toggleSpeaker}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              !isSpeakerOn
                ? "bg-red-500/30 border border-red-500/40 text-red-400"
                : "bg-white/10 border border-white/20 text-white/80 hover:bg-white/20"
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End call */}
          <button
            onClick={handleClose}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        <p className="text-white/20 text-[10px] text-center mt-4">Tele{"<"}M3D{">"} Pro • IAM3D Assistente Médico Virtual</p>
      </div>
    </div>
  );
}
