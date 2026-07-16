const RELOAD_GUARD_KEY = "chunk-reload-ts";

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Load failed/i.test(
    message,
  );
}

export function reloadOnStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — still attempt a single reload
  }
  window.location.reload();
  return true;
}
