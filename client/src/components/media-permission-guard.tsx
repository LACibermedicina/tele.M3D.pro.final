import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { releaseAllMediaStreams, hasActiveMediaFeatures } from "@/hooks/use-media-guard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Mic, MicOff, Shield } from "lucide-react";

const MEDIA_PAGES = [
  "/consultation/video",
  "/patient/video",
  "/consultation-session",
  "/coffee-room",
  "/doctor-office",
];

function isMediaPage(path: string): boolean {
  return MEDIA_PAGES.some(p => path.startsWith(p));
}

const GUARD_DISMISSED_KEY = "media_guard_dismissed_session";

export default function MediaPermissionGuard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const previousLocationRef = useState(location);

  useEffect(() => {
    if (!user) {
      setHasChecked(false);
      return;
    }

    const dismissed = sessionStorage.getItem(GUARD_DISMISSED_KEY);
    if (dismissed) {
      setHasChecked(true);
      return;
    }

    const timer = setTimeout(() => {
      checkAndPrompt();
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const prevLoc = previousLocationRef[0];
    if (prevLoc !== location) {
      previousLocationRef[1](location);

      if (isMediaPage(prevLoc) && !isMediaPage(location)) {
        const cleanupTimer = setTimeout(() => {
          if (!hasActiveMediaFeatures()) {
            releaseAllMediaStreams();
          }
        }, 500);
        return () => clearTimeout(cleanupTimer);
      }
    }
  }, [location]);

  async function checkAndPrompt() {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMedia = devices.some(d => d.kind === "videoinput" || d.kind === "audioinput");
        if (hasMedia && !isMediaPage(location)) {
          setShowDialog(true);
        }
      }
    } catch {}
    setHasChecked(true);
  }

  function handlePauseMedia() {
    releaseAllMediaStreams();
    sessionStorage.setItem(GUARD_DISMISSED_KEY, "paused");
    setShowDialog(false);
  }

  function handleAllowMedia() {
    sessionStorage.setItem(GUARD_DISMISSED_KEY, "allowed");
    setShowDialog(false);
  }

  if (!user || !showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={(open) => {
      if (!open) {
        handlePauseMedia();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Controle de Câmera e Microfone
          </DialogTitle>
          <DialogDescription>
            Para proteger sua privacidade, o acesso à câmera e ao microfone permanecerá desativado até que você utilize um recurso que precise deles, como teleconsulta, assistente de voz ou sala de café virtual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Quando o acesso será ativado automaticamente:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 flex-shrink-0" />
                Teleconsulta por vídeo
              </li>
              <li className="flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 flex-shrink-0" />
                Assistente de voz IAM3D
              </li>
              <li className="flex items-center gap-2">
                <Camera className="h-3.5 w-3.5 flex-shrink-0" />
                Sala de café virtual / Consultório
              </li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao sair dessas telas, o acesso será pausado automaticamente.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleAllowMedia}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Manter Ativo
          </Button>
          <Button
            onClick={handlePauseMedia}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <CameraOff className="h-4 w-4" />
            Pausar Até Necessário
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
