import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

const DEFAULT_RESPONSE_TIMEOUT_MS = 3 * 60 * 1000;
const DEFAULT_INACTIVITY_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

function disconnectAllMediaServices() {
  try {
    const tracks = document.querySelectorAll("video, audio");
    tracks.forEach((el) => {
      const mediaEl = el as HTMLVideoElement | HTMLAudioElement;
      if (mediaEl.srcObject) {
        const stream = mediaEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        mediaEl.srcObject = null;
      }
      mediaEl.pause();
    });
  } catch {}

  try {
    if ((window as any).__agoraClient) {
      (window as any).__agoraClient.leave();
      (window as any).__agoraClient = null;
    }
  } catch {}

  try {
    if ((window as any).__agoraLocalVideoTrack) {
      (window as any).__agoraLocalVideoTrack.close();
      (window as any).__agoraLocalVideoTrack = null;
    }
    if ((window as any).__agoraLocalAudioTrack) {
      (window as any).__agoraLocalAudioTrack.close();
      (window as any).__agoraLocalAudioTrack = null;
    }
  } catch {}
}

export { disconnectAllMediaServices };

function clearAllTimers(
  inactivityRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  responseRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  countdownRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>
) {
  if (inactivityRef.current) { clearTimeout(inactivityRef.current); inactivityRef.current = null; }
  if (responseRef.current) { clearTimeout(responseRef.current); responseRef.current = null; }
  if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
}

export default function InactivityMonitor() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState(180);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimeoutRef = useRef(DEFAULT_INACTIVITY_MS);
  const responseTimeoutRef = useRef(DEFAULT_RESPONSE_TIMEOUT_MS);
  const showPromptRef = useRef(false);
  const logoutCalledRef = useRef(false);
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    if (!user) return;
    fetch("/api/system-settings/public/presence")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const minutes = parseInt(data.auto_logoff_minutes, 10);
        if (Number.isFinite(minutes) && minutes > 0) {
          inactivityTimeoutRef.current = minutes * 60 * 1000;
        }
        const warningSec = parseInt(data.auto_logoff_warning_seconds, 10);
        if (Number.isFinite(warningSec) && warningSec > 0) {
          responseTimeoutRef.current = warningSec * 1000;
          setCountdown(warningSec);
        }
      })
      .catch(() => {});
  }, [user]);

  const startPromptCountdown = useCallback(() => {
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }

    setCountdown(Math.floor(responseTimeoutRef.current / 1000));

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    responseTimerRef.current = setTimeout(async () => {
      if (logoutCalledRef.current) return;
      logoutCalledRef.current = true;
      setIsLoggingOut(true);
      disconnectAllMediaServices();
      toast({
        title: "Sessão encerrada",
        description: "Sua sessão foi encerrada por inatividade. Todos os serviços de áudio e vídeo foram desconectados.",
        variant: "destructive",
      });
      try { await logoutRef.current(); } catch {}
      window.location.href = "/";
    }, responseTimeoutRef.current);
  }, [toast]);

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }

    inactivityTimerRef.current = setTimeout(() => {
      showPromptRef.current = true;
      setShowPrompt(true);
      startPromptCountdown();
    }, inactivityTimeoutRef.current);
  }, [startPromptCountdown]);

  const handleStayOnline = useCallback(() => {
    if (responseTimerRef.current) { clearTimeout(responseTimerRef.current); responseTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    showPromptRef.current = false;
    setShowPrompt(false);
    setCountdown(180);
    logoutCalledRef.current = false;
    startInactivityTimer();
  }, [startInactivityTimer]);

  const handleManualLogout = useCallback(async () => {
    if (logoutCalledRef.current) return;
    logoutCalledRef.current = true;
    setIsLoggingOut(true);
    clearAllTimers(inactivityTimerRef, responseTimerRef, countdownIntervalRef);
    disconnectAllMediaServices();
    toast({
      title: "Sessão encerrada",
      description: "Você saiu do sistema. Serviços de áudio e vídeo foram desconectados.",
      variant: "destructive",
    });
    try { await logoutRef.current(); } catch {}
    window.location.href = "/";
  }, [toast]);

  useEffect(() => {
    if (!user) {
      clearAllTimers(inactivityTimerRef, responseTimerRef, countdownIntervalRef);
      showPromptRef.current = false;
      setShowPrompt(false);
      logoutCalledRef.current = false;
      return;
    }

    startInactivityTimer();

    const handleActivity = () => {
      if (!showPromptRef.current) {
        startInactivityTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers(inactivityTimerRef, responseTimerRef, countdownIntervalRef);
    };
  }, [user, startInactivityTimer]);

  if (!showPrompt || !user) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl border border-amber-500/30 p-6 max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Você ainda está online?</h3>
            <p className="text-sm text-muted-foreground">Verificação de atividade</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Não detectamos atividade recente no sistema. Sua sessão será encerrada automaticamente em:
        </p>
        <div className="text-center my-4">
          <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4 text-center">
          Todos os serviços de áudio e vídeo ativos serão desconectados.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleManualLogout}
            disabled={isLoggingOut}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            Sair agora
          </Button>
          <Button
            onClick={handleStayOnline}
            disabled={isLoggingOut}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6"
          >
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Continuar online
          </Button>
        </div>
      </div>
    </div>
  );
}