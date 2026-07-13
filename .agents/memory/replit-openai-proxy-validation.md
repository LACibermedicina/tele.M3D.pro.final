---
name: Replit OpenAI proxy validation
description: How to health-check OpenAI credentials when the Replit AI-integrations proxy is in play
---
The Replit AI-integrations OpenAI proxy (AI_INTEGRATIONS_OPENAI_BASE_URL) does NOT implement `GET /models` — it returns HTTP 405 even with valid credentials.

**Why:** A diagnostics check that treats any non-200 as "broken credentials" will falsely flag the integration as corrupted.

**How to apply:** When validating OpenAI access, test a direct OPENAI_API_KEY against api.openai.com/v1/models; for the Replit proxy, only 401/403 means broken auth — treat other statuses (405/404) as reachable/valid.
