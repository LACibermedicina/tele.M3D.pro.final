import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

export function VoiceAssistantOverlay() {
  const { voiceMode, setVoiceMode } = useVoiceAssistant();

  if (!voiceMode) return null;

  return (
    <IAM3DVoiceAssistant
      isOpen={true}
      onClose={() => setVoiceMode(false)}
    />
  );
}

export function VoiceAssistantToggle() {
  const { voiceMode, setVoiceMode, hasDecided } = useVoiceAssistant();

  if (!hasDecided) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setVoiceMode(!voiceMode)}
      className={`fixed bottom-24 right-6 z-[100] w-12 h-12 rounded-full shadow-lg transition-all ${
        voiceMode
          ? "bg-cyan-600 text-white hover:bg-cyan-700 animate-pulse"
          : "bg-white/90 dark:bg-slate-800 text-cyan-600 hover:bg-cyan-100 dark:hover:bg-slate-700 border border-cyan-200 dark:border-cyan-800"
      }`}
      title={voiceMode ? "Desativar IAM3D" : "Ativar IAM3D"}
    >
      <Mic className="w-5 h-5" />
    </Button>
  );
}
