import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessModality } from "@/contexts/AccessModalityContext";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Languages } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const EXIT_PHRASES = [
  "voltar para profissional",
  "sair do modo assistido",
  "sair da modalidade assistida",
  "exit assisted mode",
  "exit assisted",
  "leave assisted mode",
  "salir del modo asistido",
];

export function AssistedLayout() {
  const { user, logout } = useAuth();
  const { setModality } = useAccessModality();
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();

  const [voiceOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [muted, setMuted] = useState(false);
  const [silentVoice, setSilentVoice] = useState(false);
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
      if (EXIT_PHRASES.some((p) => text.includes(p))) {
        void handleExitToProfessional();
      }
    };
    window.addEventListener("iam3d-voice-final", onTranscript as EventListener);
    return () => window.removeEventListener("iam3d-voice-final", onTranscript as EventListener);
  }, []);

  // Mute/unmute by toggling a global flag the assistant inspects
  useEffect(() => {
    (window as any).__iam3dMicMuted = muted;
    window.dispatchEvent(new CustomEvent("iam3d-mic-mute", { detail: { muted } }));
  }, [muted]);

  useEffect(() => {
    (window as any).__iam3dVoiceSilent = silentVoice;
    window.dispatchEvent(new CustomEvent("iam3d-voice-silent", { detail: { silent: silentVoice } }));
  }, [silentVoice]);

  const handleSubmitPrompt = () => {
    const txt = prompt.trim();
    if (!txt) return;
    lastSubmittedRef.current = txt;
    // Ephemeral pipe to the always-on voice assistant — the assistant treats it
    // as a user message but we never persist it ourselves.
    window.dispatchEvent(new CustomEvent("iam3d-prompt", { detail: { text: txt } }));
    setPrompt("");
  };

  const cycleLanguage = () => {
    const order = ["pt", "en", "es"];
    const idx = order.indexOf(i18n.language?.split("-")[0] || "pt");
    const next = order[(idx + 1) % order.length];
    void i18n.changeLanguage(next);
  };

  return (
    <>
      {/* Minimal top bar — always present */}
      <div className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 text-white/90">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold">Modalidade Assistida</span>
          {user?.name && (
            <span className="text-xs text-white/60 ml-2">— {user.name.split(" ")[0]}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={cycleLanguage}
            title="Alternar idioma"
            data-testid="button-assisted-language"
          >
            <Languages className="w-4 h-4 mr-1" />
            <span className="text-xs uppercase">{(i18n.language || "pt").split("-")[0]}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={() => setSilentVoice((v) => !v)}
            title={silentVoice ? "Ativar voz da IA" : "Silenciar voz da IA"}
            data-testid="button-assisted-volume"
          >
            {silentVoice ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
            onClick={() => setMuted((v) => !v)}
            title={muted ? "Reativar microfone" : "Mutar microfone"}
            data-testid="button-assisted-mic"
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
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
      </div>

      {/* IAM3D voice assistant — always-on visual */}
      <IAM3DVoiceAssistant isOpen={voiceOpen} onClose={() => { /* keep mounted in assisted */ }} />
    </>
  );
}
