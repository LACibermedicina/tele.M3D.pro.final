import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config"; // Initialize i18n system
import { reloadOnStaleChunk } from "./lib/stale-chunk";

// After a new deployment, browsers with a cached page may try to import
// old hashed chunks that no longer exist ("Importing a module script failed").
// Reload once to fetch the fresh index.html; guard against reload loops.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnStaleChunk()) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
