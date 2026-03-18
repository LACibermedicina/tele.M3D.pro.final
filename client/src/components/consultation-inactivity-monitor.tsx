import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, PhoneOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { disconnectAllMediaServices } from "@/components/inactivity-monitor";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
const VIDEO_CHECK_INTERVAL_MS = 3000;
const AUDIO_LEVEL_THRESHOLD = 5;

interface ConsultationInactivityMonitorProps {
  consultationId: string;
  onTimeout: () => void;
  isJoined: boolean;
}

export default function ConsultationInactivityMonitor({
  consultationId,
  onTimeout,
  isJoined,
}: ConsultationInactivityMonitorProps) {
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [countdownTotal, setCountdownTotal] = useState(30);
  const [isEnding, setIsEnding] = useState(false);
  const [triggerReason, setTriggerReason] = useState<"inactivity" | "silence">("inactivity");
  const [configLoaded, setConfigLoaded] = useState(false);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameDataRef = useRef<string | null>(null);
  const showWarningRef = useRef(false);
  const endCalledRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const trackedStreamsRef = useRef<Set<string>>(new Set());
  onTimeoutRef.current = onTimeout;

  const configRef = useRef({
    inactivityMs: 10 * 60 * 1000,
    silenceMs: 20 * 60 * 1000,
    countdownSec: 30,
  });

  useEffect(() => {
    fetch("/api/system-settings/public/consultation-timeouts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const inact = parseInt(data.consultation_inactivity_timeout_minutes, 10);
          const silence = parseInt(data.consultation_silence_timeout_minutes, 10);
          const cd = parseInt(data.consultation_countdown_seconds, 10);
          if (inact > 0) configRef.current.inactivityMs = inact * 60 * 1000;
          if (silence > 0) configRef.current.silenceMs = silence * 60 * 1000;
          if (cd > 0) {
            configRef.current.countdownSec = cd;
            setCountdownTotal(cd);
            setCountdown(cd);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setConfigLoaded(true);
      });
  }, []);

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    if (countdownEndRef.current) { clearTimeout(countdownEndRef.current); countdownEndRef.current = null; }
    if (videoCheckRef.current) { clearInterval(videoCheckRef.current); videoCheckRef.current = null; }
  }, []);

  const cleanupAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analysersRef.current.forEach((entry) => {
      try { entry.source.disconnect(); } catch {}
    });
    analysersRef.current.clear();
    trackedStreamsRef.current.clear();
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  }, []);

  const endConsultation = useCallback(async (reason: string) => {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    setIsEnding(true);

    cleanupAudioAnalysis();
    disconnectAllMediaServices();

    try {
      await apiRequest("POST", `/api/video-consultations/${consultationId}/leave`, {});
    } catch {
    }

    try {
      await apiRequest("POST", `/api/video-consultations/${consultationId}/end`, {
        duration: 0,
        meetingNotes: `Consulta encerrada automaticamente por ${reason === "inactivity" ? "inatividade do usuário" : "silêncio prolongado (sem áudio/vídeo)"}`,
        completionStatus: "timed_out",
        endReason: `auto_timeout_${reason}`,
      });
    } catch (err) {
      console.error("Failed to end consultation via API:", err);
    }

    toast({
      title: "Consulta encerrada",
      description: reason === "inactivity"
        ? "A consulta foi encerrada por inatividade prolongada."
        : "A consulta foi encerrada por silêncio prolongado (sem atividade de áudio/vídeo).",
      variant: "destructive",
    });

    onTimeoutRef.current();
  }, [consultationId, toast, cleanupAudioAnalysis]);

  const startCountdown = useCallback((reason: "inactivity" | "silence") => {
    if (showWarningRef.current) return;
    showWarningRef.current = true;
    setShowWarning(true);
    setTriggerReason(reason);
    const total = configRef.current.countdownSec;
    setCountdown(total);
    setCountdownTotal(total);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    countdownEndRef.current = setTimeout(() => {
      endConsultation(reason);
    }, total * 1000);
  }, [endConsultation]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    inactivityTimerRef.current = setTimeout(() => {
      startCountdown("inactivity");
    }, configRef.current.inactivityMs);
  }, [startCountdown]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    silenceTimerRef.current = setTimeout(() => {
      startCountdown("silence");
    }, configRef.current.silenceMs);
  }, [startCountdown]);

  const checkVideoActivity = useCallback(() => {
    const videoElements = document.querySelectorAll("video");
    for (const videoEl of videoElements) {
      if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0 || videoEl.paused) continue;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(videoEl, 0, 0, 16, 16);
        const currentData = canvas.toDataURL("image/png");
        if (prevFrameDataRef.current && currentData !== prevFrameDataRef.current) {
          if (!showWarningRef.current) {
            resetSilenceTimer();
          }
        }
        prevFrameDataRef.current = currentData;
        return;
      } catch {
      }
    }
  }, [resetSilenceTimer]);

  const startMediaActivityMonitors = useCallback(() => {
    if (videoCheckRef.current) { clearInterval(videoCheckRef.current); videoCheckRef.current = null; }
    videoCheckRef.current = setInterval(checkVideoActivity, VIDEO_CHECK_INTERVAL_MS);
  }, [checkVideoActivity]);

  const handleStayConnected = useCallback(() => {
    clearAllTimers();
    showWarningRef.current = false;
    setShowWarning(false);
    setCountdown(configRef.current.countdownSec);
    endCalledRef.current = false;
    resetInactivityTimer();
    resetSilenceTimer();
    startMediaActivityMonitors();
  }, [clearAllTimers, resetInactivityTimer, resetSilenceTimer, startMediaActivityMonitors]);

  const handleEndNow = useCallback(() => {
    clearAllTimers();
    endConsultation(triggerReason);
  }, [clearAllTimers, endConsultation, triggerReason]);

  useEffect(() => {
    if (!isJoined || !consultationId || !configLoaded) {
      clearAllTimers();
      return;
    }

    resetInactivityTimer();
    resetSilenceTimer();

    const handleActivity = () => {
      if (!showWarningRef.current) {
        resetInactivityTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const scanAndAttachStreams = () => {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === "closed") return;

      const mediaElements = [...document.querySelectorAll("audio"), ...document.querySelectorAll("video")] as HTMLMediaElement[];
      for (const el of mediaElements) {
        if (el.srcObject && el.srcObject instanceof MediaStream) {
          const stream = el.srcObject;
          const streamId = stream.id;
          if (trackedStreamsRef.current.has(streamId)) continue;
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length === 0) continue;
          try {
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analysersRef.current.set(streamId, { analyser, source });
            trackedStreamsRef.current.add(streamId);
          } catch {
          }
        }
      }
    };

    const checkAllAudioLevels = () => {
      scanAndAttachStreams();

      let hasActivity = false;
      analysersRef.current.forEach((entry) => {
        const dataArray = new Uint8Array(entry.analyser.frequencyBinCount);
        entry.analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        if (avg > AUDIO_LEVEL_THRESHOLD) {
          hasActivity = true;
        }
      });

      if (hasActivity && !showWarningRef.current) {
        resetSilenceTimer();
      }

      animFrameRef.current = requestAnimationFrame(checkAllAudioLevels);
    };

    animFrameRef.current = requestAnimationFrame(checkAllAudioLevels);
    startMediaActivityMonitors();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
      cleanupAudioAnalysis();
    };
  }, [isJoined, consultationId, configLoaded, clearAllTimers, resetInactivityTimer, resetSilenceTimer, startMediaActivityMonitors, cleanupAudioAnalysis]);

  if (!showWarning || !isJoined) return null;

  const progressPercent = countdownTotal > 0 ? ((countdownTotal - countdown) / countdownTotal) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl border border-red-500/30 p-6 max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Consulta será encerrada</h3>
            <p className="text-sm text-muted-foreground">
              {triggerReason === "inactivity"
                ? "Inatividade detectada"
                : "Silêncio prolongado detectado"}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {triggerReason === "inactivity"
            ? "Não detectamos interação recente (mouse, teclado ou toque). A consulta será encerrada automaticamente se nenhuma ação for tomada."
            : "Não detectamos atividade de áudio ou vídeo por um período prolongado. A consulta será encerrada automaticamente."}
        </p>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Encerrando em</span>
            <span className="font-mono font-bold text-red-600 dark:text-red-400 text-lg">
              {countdown}s
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleEndNow}
            disabled={isEnding}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <PhoneOff className="h-4 w-4 mr-2" />
            Encerrar agora
          </Button>
          <Button
            onClick={handleStayConnected}
            disabled={isEnding}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6"
          >
            {isEnding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Continuar Conectado
          </Button>
        </div>
      </div>
    </div>
  );
}
