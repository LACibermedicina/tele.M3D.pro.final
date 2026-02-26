import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";

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
