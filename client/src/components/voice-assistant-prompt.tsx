import { useEffect } from "react";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, BrainCircuit } from "lucide-react";

export function VoiceAssistantPrompt() {
  const { user } = useAuth();
  const { showPrompt, setShowPrompt, setVoiceMode, dismissPrompt, hasDecided } = useVoiceAssistant();

  useEffect(() => {
    if (user && !hasDecided) {
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, hasDecided, setShowPrompt]);

  if (!user || !showPrompt) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={(open) => { if (!open) dismissPrompt(); }}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-cyan-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl text-white">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            Assistente Virtual IAM3D
          </DialogTitle>
          <DialogDescription className="text-white/70 text-base pt-2">
            Deseja utilizar o assistente virtual por comando de voz? 
            Isso ativará uma experiência interativa conversacional com o IAM3D.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <p className="text-white/50 text-sm">
            Você poderá navegar, consultar informações médicas e interagir com o sistema usando apenas sua voz.
            O assistente permanecerá ativo até que você solicite seu encerramento.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setVoiceMode(true)}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white h-12"
            >
              <Mic className="w-5 h-5 mr-2" />
              Sim, ativar voz
            </Button>
            <Button
              onClick={dismissPrompt}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10 h-12"
            >
              <MicOff className="w-5 h-5 mr-2" />
              Não, obrigado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
