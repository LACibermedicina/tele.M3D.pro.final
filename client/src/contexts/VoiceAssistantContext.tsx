import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface VoiceAssistantContextType {
  voiceMode: boolean;
  setVoiceMode: (enabled: boolean) => void;
  showPrompt: boolean;
  setShowPrompt: (show: boolean) => void;
  dismissPrompt: () => void;
  hasDecided: boolean;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType>({
  voiceMode: false,
  setVoiceMode: () => {},
  showPrompt: false,
  setShowPrompt: () => {},
  dismissPrompt: () => {},
  hasDecided: false,
});

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const [voiceMode, setVoiceModeState] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("iam3d_voice_preference");
    if (stored !== null) {
      setHasDecided(true);
      setVoiceModeState(stored === "true");
    }
  }, []);

  const setVoiceMode = useCallback((enabled: boolean) => {
    setVoiceModeState(enabled);
    setHasDecided(true);
    localStorage.setItem("iam3d_voice_preference", String(enabled));
    setShowPrompt(false);
  }, []);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    setHasDecided(true);
    localStorage.setItem("iam3d_voice_preference", "false");
  }, []);

  return (
    <VoiceAssistantContext.Provider value={{ voiceMode, setVoiceMode, showPrompt, setShowPrompt, dismissPrompt, hasDecided }}>
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  return useContext(VoiceAssistantContext);
}
