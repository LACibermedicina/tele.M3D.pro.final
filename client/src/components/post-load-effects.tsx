import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";

interface PostLoadConfig {
  postload_autoscroll_enabled: string;
  postload_autoscroll_distance: string;
  postload_autoscroll_delay_ms: string;
  postload_autoscroll_return_delay_ms: string;
  postload_custom_scripts_enabled: string;
  postload_custom_scripts: string;
}

export default function PostLoadEffects() {
  const [location] = useLocation();
  const [config, setConfig] = useState<PostLoadConfig | null>(null);
  const initialRunDone = useRef(false);

  useEffect(() => {
    fetch("/api/system-settings/public/postload")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PostLoadConfig | null) => {
        if (data) setConfig(data);
      })
      .catch(() => {});
  }, []);

  const runOnce = useCallback(() => {
    if (!config) return;
    runEffects(config);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    if (!initialRunDone.current) {
      initialRunDone.current = true;
      runOnce();
      return;
    }
    runOnce();
  }, [config, location, runOnce]);

  return null;
}

function runEffects(config: PostLoadConfig) {
  if (config.postload_autoscroll_enabled === "true") {
    const distance = parseInt(config.postload_autoscroll_distance, 10) || 5;
    const delay = parseInt(config.postload_autoscroll_delay_ms, 10) || 300;
    const returnDelay =
      parseInt(config.postload_autoscroll_return_delay_ms, 10) || 150;

    setTimeout(() => {
      window.scrollTo({ top: distance, behavior: "instant" });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      }, returnDelay);
    }, delay);
  }

  if (config.postload_custom_scripts_enabled === "true") {
    try {
      const scripts = JSON.parse(config.postload_custom_scripts);
      if (Array.isArray(scripts)) {
        const sorted = scripts
          .filter(
            (s: { enabled?: boolean }) => s.enabled !== false
          )
          .sort(
            (a: { order?: number }, b: { order?: number }) =>
              (a.order ?? 0) - (b.order ?? 0)
          );

        for (const script of sorted) {
          if (script.code && typeof script.code === "string") {
            try {
              const fn = new Function(script.code);
              fn();
            } catch (err) {
              console.warn(
                `[PostLoad] Script "${script.name || "unnamed"}" failed:`,
                err
              );
            }
          }
        }
      }
    } catch {
      console.warn("[PostLoad] Failed to parse custom scripts");
    }
  }
}
