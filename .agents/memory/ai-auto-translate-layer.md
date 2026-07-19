---
name: AI auto-translate layer conventions
description: Conventions and gotchas for the runtime AI page-translation engine (non-PT flags translate every page on load).
---

The app translates hardcoded Portuguese UI at runtime: a DOM-walking engine (client `auto-translate.tsx`) batches visible text to `POST /api/ai/translate-batch`, cached per segment+language in the `ui_translations` table.

**Conventions to keep when building new UI:**
- The engine translates Portuguese→target only. All hardcoded UI source strings (JSX text, placeholders, titles, toasts) must be written in pt-BR; English source strings are never translated and leak through in every language. When a page "won't translate", check for English source strings first.
- Any container rendering user-generated/clinical content (chat messages, notes, transcriptions, record field values) must carry `data-no-translate` so PHI is never sent to AI providers. This is a standing rule for all new clinical UI, not a one-time pass.
- Never use `[translate="no"]` as the skip marker — the i18n config sets it on `documentElement` (to block Google Translate), so matching it would skip the whole page.

**Behavioral gotchas:**
- First visit to an untranslated page takes ~10s: cached and uncached segments share one batch and the server awaits all AI chunks before responding. Repeat visits are ~50ms (DB cache). Don't mistake first-visit latency for a broken engine.
- The server persists translations even if the client disconnects mid-request, so screenshot/preview sessions still warm the cache.
- The preview browser resolves language `en` via the i18next detector when no preference is stored, so the engine runs in screenshots by default.
