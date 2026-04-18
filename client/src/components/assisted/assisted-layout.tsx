import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessModality } from "@/contexts/AccessModalityContext";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, X, Send, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function AssistedLayout() {
  const { user, logout } = useAuth();
  const { setModality } = useAccessModality();
  const [, setLocation] = useLocation();
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [showPromptPanel, setShowPromptPanel] = useState(false);

  // Reopen voice if user closes it (assisted mode keeps it always available)
  useEffect(() => {
    if (!voiceOpen) {
      const timer = setTimeout(() => setVoiceOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [voiceOpen]);

  const handleExitToProfessional = async () => {
    await setModality("professional");
    setLocation("/");
  };

  const handleSubmitPrompt = () => {
    if (!prompt.trim()) return;
    // Ephemeral: dispatch event to voice assistant for navigation/intent handling
    window.dispatchEvent(new CustomEvent("iam3d-prompt", { detail: { text: prompt } }));
    setPrompt("");
    setShowPromptPanel(false);
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10 h-8"
            onClick={() => setShowPromptPanel((v) => !v)}
            title="Painel narrativo"
            data-testid="button-toggle-narrative-prompt"
          >
            Narrativa
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
            Sair
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

      {/* Narrative prompt panel — ephemeral, never logged */}
      {showPromptPanel && (
        <div className="fixed top-12 right-4 z-[10001] w-[min(420px,calc(100vw-2rem))] bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Painel Narrativo</h3>
            <button
              onClick={() => setShowPromptPanel(false)}
              className="text-white/60 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Descreva a situação clínica em linguagem natural. O conteúdo é mantido apenas no seu dispositivo e enviado pontualmente à IA quando você confirmar.
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
        </div>
      )}

      {/* IAM3D voice assistant — always-on visual */}
      <IAM3DVoiceAssistant isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </>
  );
}
