# Threat Model

## Project Overview

Publicly deployed medical practice management platform built with an Express.js backend, React frontend, shared TypeScript schema layer, and PostgreSQL/Drizzle persistence. The production deployment is internet-reachable and handles highly sensitive medical, identity, communication, and payment data for patients, doctors, admins, pharmacists, and researchers.

Production assumptions for this scan:
- `NODE_ENV` is `production`
- The Replit deployment is public
- TLS is handled by the platform
- Mockup sandbox areas are out of scope unless production reachability is demonstrated

## Assets

- **Patient health information** — medical records, consultation notes, diagnoses, prescriptions, exam files, radiology/ECG assets, transcripts, and patient summaries. Exposure can directly harm patients and create severe regulatory impact.
- **User accounts and sessions** — doctor, patient, admin, pharmacist, and researcher identities, session JWTs, access links, and consultation join tokens. Compromise enables impersonation and unauthorized clinical actions.
- **Realtime consultation data** — video consultation IDs, meeting notes, transcriptions, recordings, and participation metadata. These are highly sensitive and time-critical.
- **Payment and wallet state** — Stripe/PayPal/PagBank transaction state, credit balances, and wallet audit data. Tampering can create financial fraud.
- **Application secrets and service credentials** — `SESSION_SECRET`, payment secrets, WhatsApp credentials, AI provider keys, Agora credentials, MCP secret, and database credentials.
- **Clinical integrations and external messaging** — WhatsApp flows, AI prompts/responses, professional-license verification, and partner APIs. These cross trust boundaries with PHI and payment context.

## Trust Boundaries

- **Browser/mobile client → Express API** — all client input is untrusted; every protected route must authenticate and authorize server-side.
- **Express API → PostgreSQL** — the backend has broad access to patient, payment, and operational data; broken access control or injection here has high blast radius.
- **Express API → third-party services** — AI providers, Agora, WhatsApp, payment processors, and professional-verification services receive sensitive data and require strict origin/authentication controls.
- **Public/visitor → authenticated patient/doctor/admin surfaces** — the app exposes both anonymous and logged-in experiences, including consultation access links and webhook endpoints.
- **Doctor/patient/admin/pharmacy/lab role boundaries** — role separation must be enforced server-side, especially around medical records, consultations, prescriptions, and financial operations.
- **Production vs dev/test paths** — test helpers, seed/setup behavior, and development-only assumptions should be ignored unless reachable from production traffic.

## Scan Anchors

- **Primary production entry points:** `server/index.ts`, `server/routes.ts`, `server/routes/*.ts`, `server/mcp.ts`
- **Highest-risk areas:** auth/session logic, video consultation routes, consultation access token flows, payment webhooks, clinical asset uploads, pharmacy/lab/hospital integrations, AI/medical-record workflows
- **Public surfaces:** auth endpoints, consultation access endpoints, webhooks, static `/uploads/*`, visitor/WebSocket token flows, any route in `server/routes.ts` lacking `requireAuth`/role checks
- **Authenticated/admin surfaces:** admin settings, medical records, payment admin, clinical assets, doctor workflows, collaborator APIs
- **Code-pattern watchlist:** duplicate Express route definitions can silently shadow later authenticated handlers in `server/routes.ts`; validate the first registered handler for any sensitive path, not just the last one
- **Usually dev-only / lower priority unless proven reachable:** scripts under `server/scripts/`, seed/setup helpers, Vite/dev tooling

## Threat Categories

### Spoofing

The system issues multiple JWT types and consultation access tokens across normal login, visitor, patient-join, and MCP-assisted flows. The application must ensure each token type is only accepted for its intended surface, tokens cannot be minted from attacker-controlled identifiers alone, and service-to-service secrets such as `TELE_M3D_SECRET` are never treated as a substitute for end-user authorization beyond explicitly scoped internal APIs.

### Tampering

The backend accepts writes for consultations, notes, recordings, payments, collaborator workflows, and admin settings. The system must enforce server-side authorization on every mutation and must authenticate payment/webhook callbacks before changing transaction state or credit balances. Client-controlled consultation IDs, patient IDs, and status fields must never be trusted without verifying ownership.

### Information Disclosure

The application stores PHI, consultation transcripts, exam files, recordings, and patient identifiers. API responses and uploaded files must be scoped to authorized users only. Static file serving, direct object references, notifications, and consultation-access flows must not expose medical data or identifiers to unauthorized parties.

### Denial of Service

Public endpoints include login, consultation-access validation, webhook receivers, visitor token issuance, and AI-adjacent workflows. The system must prevent unauthenticated users from repeatedly triggering expensive operations or brute-forcing short access codes and consultation identifiers.

### Elevation of Privilege

This codebase contains many role-separated medical and administrative actions. Every sensitive route must require the correct authenticated role, and public token or link workflows must not become alternate paths into doctor/patient/admin capabilities. Broken access control on consultation, prescription, payment, or clinical-asset routes is especially severe because it can expose or alter protected health data at scale.
