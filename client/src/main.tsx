import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config"; // Initialize i18n system
import { reloadOnStaleChunk, initStaleVersionGuard } from "./lib/stale-chunk";

// After a new deployment, browsers with a cached page may try to import
// old hashed chunks that no longer exist ("Importing a module script failed").
// Reload once (cache-busting) to fetch the fresh index.html; guarded against
// reload loops. The version guard also proactively refreshes stale tabs
// (Safari BFCache / cached HTML) before a broken import ever happens.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnStaleChunk()) {
    event.preventDefault();
  }
});
initStaleVersionGuard();

createRoot(document.getElementById("root")!).render(<App />);
