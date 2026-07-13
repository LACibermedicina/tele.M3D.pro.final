import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessModality } from "@/contexts/AccessModalityContext";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Contrast } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import LanguageSelector from "@/components/ui/language-selector";

const EXIT_PHRASES_PROFESSIONAL = [
  "voltar para profissional",
  "modo profissional",
  "sair do modo assistido",
  "sair da modalidade assistida",
  "exit assisted mode",
  "exit assisted",
  "leave assisted mode",
  "salir del modo asistido",
];

const EXIT_PHRASES_CLASSIC = [
  "modo clássico",
  "modo classico",
  "voltar para clássico",
  "voltar para classico",
  "switch to classic",
  "classic mode",
  "modo clásico",
];

export function AssistedLayout() {
  const { user, logout } = useAuth();
  const { setModality } = useAccessModality();
  const [, setLocation] = useLocation();

  const [voiceOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [muted, setMuted] = useState(false);
  const [silentVoice, setSilentVoice] = useState(false);
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try { return localStorage.getItem("tele_m3d_assisted_contrast") === "high"; } catch { return false; }
  });
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [liveIntent, setLiveIntent] = useState<string>("");
  const [liveResult, setLiveResult] = useState<string>("");
  const lastSubmittedRef = useRef<string>("");

  const handleExitToProfessional = async () => {
    await setModality("professional");
    setLocation("/");
  };

  // Voice exit: react to any voice transcript dispatching the agreed event
  useEffect(() => {
    const onTranscript = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      const text = (detail?.text || "").toLowerCase();
      if (!text) return;
      if (EXIT_PHRASES_CLASSIC.some((p) => text.includes(p))) {
        void setModality("classic").then(() => setLocation("/"));
      } else if (EXIT_PHRASES_PROFESSIONAL.some((p) => text.includes(p))) {
        void handleExitToProfessional();
      }
    };
    const onTranscriptCapture = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) setLiveTranscript(detail.text);
    };
    const onIntent = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) setLiveIntent(detail.text);
    };
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) setLiveResult(detail.text);
    };
    window.addEventListener("iam3d-voice-final", onTranscript as EventListener);
    window.addEventListener("iam3d-voice-final", onTranscriptCapture as EventListener);
    window.addEventListener("iam3d-intent", onIntent as EventListener);
    window.addEventListener("iam3d-result", onResult as EventListener);
    return () => {
      window.removeEventListener("iam3d-voice-final", onTranscript as EventListener);
      window.removeEventListener("iam3d-voice-final", onTranscriptCapture as EventListener);
      window.removeEventListener("iam3d-intent", onIntent as EventListener);
      window.removeEventListener("iam3d-result", onResult as EventListener);
    };
  }, []);

  // Mute/unmute by dispatching events the assistant inspects
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("iam3d-mic-mute", { detail: { muted } }));
  }, [muted]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("iam3d-voice-silent", { detail: { silent: silentVoice } }));
  }, [silentVoice]);

  // High-contrast toggle — reflected on documentElement so CSS scoped to
  // [data-access-modality='assisted'][data-assisted-contrast='high'] activates.
  useEffect(() => {
    try {
      if (highContrast) {
        document.documentElement.setAttribute("data-assisted-contrast", "high");
        localStorage.setItem("tele_m3d_assisted_contrast", "high");
      } else {
        document.documentElement.removeAttribute("data-assisted-contrast");
        localStorage.setItem("tele_m3d_assisted_contrast", "normal");
      }
    } catch {}
    return () => {
      try { document.documentElement.removeAttribute("data-assisted-contrast"); } catch {}
    };
  }, [highContrast]);

  const handleSubmitPrompt = () => {
    const txt = prompt.trim();
    if (!txt) return;
    lastSubmittedRef.current = txt;
    // Ephemeral pipe to the always-on voice assistant — the assistant treats it
    // as a user message but we never persist it ourselves.
    window.dispatchEvent(new CustomEvent("iam3d-prompt", { detail: { text: txt } }));
    setPrompt("");
  };

  return (
    <>
      {/* Minimal top bar — always present */}
      <div
        data-assisted-shell="topbar"
        className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-md border-b border-white/10"
      >
        <div className="flex items-center gap-2 text-white/90">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span data-assisted-title className="text-sm font-semibold">Modalidade Assistida</span>
          {user?.name && (
            <span className="text-xs text-white/60 ml-2">— {user.name.split(" ")[0]}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div data-testid="button-assisted-language">
            <LanguageSelector
              triggerClassName="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              contentClassName="z-[10002]"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={() => setHighContrast((v) => !v)}
            title={highContrast ? "Desativar alto contraste" : "Ativar alto contraste"}
            aria-pressed={highContrast}
            data-testid="button-assisted-contrast"
          >
            <Contrast className="w-4 h-4" />
            <span className="sr-only">{highContrast ? "Alto contraste ativo" : "Alto contraste desligado"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={() => setSilentVoice((v) => !v)}
            title={silentVoice ? "Ativar voz da IA" : "Silenciar voz da IA"}
            aria-pressed={silentVoice}
            data-assisted-state={silentVoice ? "silent" : "speaking"}
            data-testid="button-assisted-volume"
          >
            {silentVoice ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="sr-only">{silentVoice ? "Voz da IA silenciada" : "Voz da IA ativa"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={() => setMuted((v) => !v)}
            title={muted ? "Reativar microfone" : "Mutar microfone"}
            aria-pressed={muted}
            data-assisted-state={muted ? "muted" : "listening"}
            data-testid="button-assisted-mic"
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="sr-only">{muted ? "Microfone mudo" : "Microfone escutando"}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8"
            onClick={handleExitToProfessional}
            title="Voltar para modalidade Profissional"
            data-testid="button-exit-assisted"
          >
            <Settings className="w-4 h-4 mr-1" />
            Sair do modo assistido
          </Button>
          {user && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-300 hover:text-red-200 hover:bg-red-500/10 h-8"
              onClick={() => { void logout(); }}
              title="Logout"
              data-testid="button-logout-assisted"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Narrative prompt panel — always visible in assisted mode, ephemeral state */}
      <div
        data-assisted-shell="panel"
        className="fixed top-12 right-4 z-[10001] w-[min(420px,calc(100vw-2rem))] bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-4 space-y-3"
        data-testid="panel-narrative-prompt"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Painel Narrativo</h3>
          <span className="text-[10px] uppercase tracking-wide text-cyan-300/80">efêmero</span>
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Descreva a situação clínica em linguagem natural. O texto fica apenas no seu dispositivo e é enviado à IAM3D quando você confirmar. Nunca é registrado em logs do servidor.
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex.: Paciente 45 anos, dor torácica há 2h, sem alergias conhecidas..."
          className="min-h-[120px] bg-slate-950/60 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-cyan-500"
          data-testid="textarea-narrative-prompt"
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white/70 hover:text-white"
            onClick={() => setPrompt("")}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={handleSubmitPrompt}
            disabled={!prompt.trim()}
            data-testid="button-submit-narrative-prompt"
          >
            <Send className="w-4 h-4 mr-1" />
            Enviar à IA
          </Button>
        </div>
        <p className="text-[10px] text-white/40 italic">
          Comandos de voz: "voltar para profissional" encerra a modalidade assistida.
        </p>

        <div className="border-t border-white/10 pt-3 space-y-2" data-testid="panel-narrative-live">
          <div className="text-[10px] uppercase tracking-wide text-white/50">Diálogo ao vivo</div>
          <div className="space-y-1.5">
            <div data-testid="live-transcript">
              <div className="text-[10px] text-cyan-300/70">Transcrição</div>
              <div className="text-xs text-white/90 min-h-[1rem]">{liveTranscript || "—"}</div>
            </div>
            <div data-testid="live-intent">
              <div className="text-[10px] text-amber-300/70">Intenção interpretada</div>
              <div className="text-xs text-white/90 min-h-[1rem]">{liveIntent || "—"}</div>
            </div>
            <div data-testid="live-result">
              <div className="text-[10px] text-emerald-300/70">Resultado da execução</div>
              <div className="text-xs text-white/90 min-h-[1rem]">{liveResult || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* IAM3D voice assistant — always-on visual */}
      <IAM3DVoiceAssistant isOpen={voiceOpen} onClose={() => { /* keep mounted in assisted */ }} />
    </>
  );
}
