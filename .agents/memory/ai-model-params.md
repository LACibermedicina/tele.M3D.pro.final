---
name: AI model/param constraints (Gemini free tier + gpt-5 proxy)
description: Which model names and request params actually work with this repo's Gemini key and the Replit OpenAI proxy.
---

# Gemini (GEMINI_API_KEY, free tier)
- The key is FREE tier. Google retires models from the free tier by setting quota `limit: 0` → every call 429s (RESOURCE_EXHAUSTED), even the first one. This killed `gemini-2.0-flash` (and `gemini-1.5-flash` was removed from the API entirely).
- **Why:** free-tier quotas are per-model and can silently drop to zero when a model ages out; a 429 with `limit: 0` means "model retired from free tier", not "slow down".
- **How to apply:** when Gemini calls suddenly 429 with limit:0, switch the model name (verify via `GET /v1beta/models` + a real generateContent curl) instead of adding retries. `gemini-2.5-flash` works as of Jul 2026.
- `gemini-2.5-flash` is a thinking model: thought tokens count against `maxOutputTokens`. For JSON vision calls with tight output limits, pass `generationConfig.thinkingConfig.thinkingBudget: 0` (cast `as any` — the old `@google/generative-ai` SDK types don't know the field but it is forwarded to the API).

# gpt-5-* via Replit OpenAI proxy (AI_INTEGRATIONS_OPENAI_*)
- `gpt-5-mini` (and family) REJECTS `max_tokens` (must use `max_completion_tokens`) and REJECTS any `temperature` other than default 1 (omit it).
- **How to apply:** any OpenAI fallback call added to this repo must use `max_completion_tokens` and no `temperature`, or the fallback fails with invalid_request_error and the user sees the original Gemini error.
