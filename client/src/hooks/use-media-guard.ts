import { useEffect, useRef, useCallback } from "react";

const MEDIA_FEATURES = new Set<string>();

export function registerMediaFeature(featureId: string) {
  MEDIA_FEATURES.add(featureId);
}

export function unregisterMediaFeature(featureId: string) {
  MEDIA_FEATURES.delete(featureId);
}

export function hasActiveMediaFeatures(): boolean {
  return MEDIA_FEATURES.size > 0;
}

export function getActiveMediaFeatures(): string[] {
  return Array.from(MEDIA_FEATURES);
}

export function releaseAllMediaStreams() {
  try {
    const mediaElements = document.querySelectorAll("video, audio");
    mediaElements.forEach((el) => {
      const mediaEl = el as HTMLVideoElement | HTMLAudioElement;
      if (mediaEl.srcObject) {
        const stream = mediaEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        mediaEl.srcObject = null;
      }
      mediaEl.pause();
    });
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

  try {
    if ((window as any).__agoraClient) {
      (window as any).__agoraClient.leave();
      (window as any).__agoraClient = null;
    }
  } catch {}
}

export function useMediaFeature(featureId: string) {
  const registeredRef = useRef(false);

  const activate = useCallback(() => {
    registerMediaFeature(featureId);
    registeredRef.current = true;
  }, [featureId]);

  const deactivate = useCallback(() => {
    unregisterMediaFeature(featureId);
    registeredRef.current = false;
  }, [featureId]);

  useEffect(() => {
    return () => {
      if (registeredRef.current) {
        unregisterMediaFeature(featureId);
      }
    };
  }, [featureId]);

  return { activate, deactivate };
}

export function useMediaCleanupOnUnmount(featureId: string, cleanupFn?: () => void) {
  useEffect(() => {
    registerMediaFeature(featureId);
    return () => {
      unregisterMediaFeature(featureId);
      if (cleanupFn) {
        cleanupFn();
      }
      if (!hasActiveMediaFeatures()) {
        releaseAllMediaStreams();
      }
    };
  }, [featureId]);
}
