const RELOAD_GUARD_KEY = "chunk-reload-ts";
const RELOAD_GUARD_WINDOW_MS = 60_000;
const VERSION_CHECK_MIN_INTERVAL_MS = 60_000;
const VERSION_PARAM = "__v";

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|Load failed/i.test(
    message,
  );
}

function canAttemptReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || "0");
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — still attempt a single reload
  }
  return true;
}

// Safari may serve the cached HTML again on a plain reload; navigating to the
// same URL with a unique query param forces a fresh fetch from the server.
function cacheBustReload(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(VERSION_PARAM, Date.now().toString(36));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function reloadOnStaleChunk(): boolean {
  if (!canAttemptReload()) return false;
  cacheBustReload();
  return true;
}

// The hashed main-bundle path is this client's build identity (null in dev).
function getClientVersion(): string | null {
  const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
  const src = el?.getAttribute("src") || "";
  const match = src.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  return match ? match[0] : null;
}

let lastVersionCheck = 0;

async function checkForNewVersion(): Promise<void> {
  const clientVersion = getClientVersion();
  if (!clientVersion) return; // dev server or unexpected markup
  const now = Date.now();
  if (now - lastVersionCheck < VERSION_CHECK_MIN_INTERVAL_MS) return;
  lastVersionCheck = now;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const data: { version?: string } = await res.json();
    if (
      data.version &&
      data.version !== "dev" &&
      data.version !== "unknown" &&
      data.version !== clientVersion &&
      canAttemptReload()
    ) {
      cacheBustReload();
    }
  } catch {
    // offline or transient network error — never disrupt the app
  }
}

// Proactively detect new deployments: on first load, when a tab is restored
// from Safari's back/forward cache, and when the tab regains visibility.
export function initStaleVersionGuard(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(VERSION_PARAM)) {
      url.searchParams.delete(VERSION_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // URL/history APIs unavailable — cosmetic cleanup only
  }
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) void checkForNewVersion();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForNewVersion();
  });
  void checkForNewVersion();
}
