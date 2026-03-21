# Medical Practice Management App

## Overview
This full-stack medical practice management application aims to modernize healthcare operations by streamlining clinical workflows, enhancing patient care with AI-powered tools, and providing robust administrative features. It integrates video consultations, AI diagnostics, advanced scheduling, and comprehensive patient record management, focusing on efficiency for providers and accessibility for patients while ensuring data security and adherence to medical guidelines.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.

## System Architecture
The application is built with an Express.js backend and a React frontend, utilizing shared TypeScript schemas for data consistency. PostgreSQL with Drizzle ORM is used for database management. AI services primarily leverage Google Gemini API, with Replit OpenAI AI Integrations (`gpt-4o-mini`) as a fallback.

**UI/UX Decisions:**
- **Navigation:** Desktop uses dropdowns and icon links; mobile uses a slide-out sheet. Icons have consistent drop-shadows.
- **Admin Theme:** Distinctive dark indigo/slate gradient with subtle patterns.
- **Voice Assistant:** IAM3D voice assistant with half-screen overlay on mobile and full-screen on desktop.
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** 5-level Manchester Protocol (or WHO ETAT fallback) visual classification.
- **Dashboards:** Rebuilt mobile patient dashboard, visitor dashboard with IAM3D, and desktop patient dashboard with "Consultar Agora" button.
- **Interactive Dashboard System:** Draggable panels with minimization to a bottom taskbar dock. `UnifiedToolbox` defaults to right side with navigation links, detachable items, and a "Reset Interface" button. Main nav bar defaults to bottom (draggable from any non-button area). Minimized panels appear as a taskbar strip above the bottom nav. Centralized `resetAllLayout()` in `LayoutSettingsContext` clears all layout localStorage keys and restores defaults.

**Technical Implementations:**
- **AI Services:** Google Gemini API (with Replit OpenAI fallback) for chatbot, triage, video consultation support, medical records, and SOAP reports, adhering to medical guidelines (OMS, MS/Brasil, DSM-5/DSM-5-TR).
- **Video Consultations:** Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, transcription, and specialist invitations, including AI-driven medical record generation and dual-side transcription.
- **Patient Features:** AI-powered symptom triage, waiting room, prescription management, and medical record access. Consultation access via QR codes and short codes.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review and including drug interaction analysis.
- **WhatsApp IA:** Intelligent messaging for doctors with persistence and AI analysis.
- **Financial Management / Digital Wallet:** Comprehensive dashboard for balances, purchases, transfers (with escrow), history, external wallet linking, and withdrawal requests.
- **Epidemiological Reports:** AI-powered analysis of clinical data for epidemiological insights using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Collaboration features and structured inter-consultation note-taking.
- **IAM3D Voice Assistant:** Full-screen voice interface for scheduling, urgent consultations, patient registration, profile navigation, and inter-consultations with real-time AI diagnostic analysis during video calls.
- **External Medication Search & AI Generation:** Prescription form integrates external medication databases (RxNorm/NIH, OpenFDA, ANVISA/RENAME) and generates complete treatment plans from diagnosis.
- **Digital Signature Verification:** Dual-path signature verification (RSA-PSS ICP-Brasil A3, RSA-SHA256 SignatureService) with public QR code-based verification endpoint and OCSP checks.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes, confidence levels, and suggested exams.
- **Unified Payment Checkout:** Wallet purchase supports PayPal, Stripe (card/Apple Pay), and PagBank (PIX/Boleto).
- **Inactivity Detection & Auto-Logout:** Configurable inactivity timeout with prompt and auto-logout, disconnecting Agora services. Consultation-level inactivity monitor with auto-close functionality.
- **Admin Mass Disconnect Controls:** Admin controls to disconnect all users, all doctors, or all services.
- **Patient Data Export:** HL7 FHIR R4 compliant export in JSON or PDF, with de-identification options.
- **Pharmacy Integration System:** Module with pharmacist role, prescription verification, dispensing, and LGPD-compliant reporting.
- **PMD v1.0 (Prontuário Médico Digital):** CFM/LGPD/RGPD-compliant structured medical records with audit logs.
- **Prontuário Unificado (Unified Record):** Consolidates all patient data into a single timeline view.
- **Clinic Management System:** Multi-clinic support with shared patients/records, revenue sharing, and patient discounts.
- **Per-User Access Control:** Admins can deactivate/activate individual users.
- **FHIR R4 Dashboard + ECG Analysis Engine:** Medical dashboard with FHIR R4 patient/observation CRUD, clinical history, and AI ECG analysis with a **triple verification pipeline** for enhanced accuracy, color-coded annotations, action plans, and auto-generated immersive AI visualizations.
- **Radiology Imaging Analysis Module:** AI-powered radiographic analysis with a 4-phase procedural analysis pipeline, structured output, probabilistic diagnosis, and immersive visualization generation.
- **AI Technical Detail Visibility Control:** Non-admin users see clinical results only, while admins see full AI technical details (confidence, probabilities, engine names).
- **Post-Load Effects System:** Configurable behaviors that execute automatically after each page load, including auto-scroll and custom JavaScript execution.
- **MCP Server (TELE-M3D-ECG-MCP):** Model Context Protocol server exposing ECG analysis and study management to ChatGPT and MCP-compatible AI clients via SSE.
- **Profile Unification & Duplicate Prevention:** Document+country unique constraint on users/patients, automatic merge of temporary patient data into permanent accounts during registration or access-link validation, admin manual merge endpoint, and `profileMergeAuditLogs` audit trail.
- **Consultation Notification System:** Room presence detection (patient/doctor join broadcasts with persistent DB fallback + WhatsApp), urgency request panel for doctors with Accept/Chat/Discard buttons and first-accept-wins logic, post-acceptance broadcast to other doctors with "Atendido por" message, WhatsApp notifications using patient code (not name) for privacy, and admin-configurable WhatsApp sender number via system settings.
- **AI Prompt Configuration Admin Module (ECG + Radiology):** Admin interface with two sub-modules ("Config ECG" and "Config Radiologia") for customizing AI analysis prompts without code changes. Configurable: analysis prompt templates (ECG triple-verification passes, radiology procedural phases), severity scale definitions (1-5), color semantics (hex + meaning), image generation prompt templates, AI model parameters (temperature, max tokens, model), and JSON schema templates. Persisted in `system_settings` table (`ai_ecg_config`, `ai_radiology_config` categories). Deep merge with hardcoded defaults ensures robustness. Backend: `server/services/aiPromptConfig.ts`, API routes `GET/PUT /api/admin/ai-config/:module`, `POST /api/admin/ai-config/:module/reset`. Frontend: `client/src/components/admin/ai-prompt-config.tsx`.
- **Post-Consultation Item Editing:** Inline editing of prescriptions, exams, referrals, and follow-ups during review and post-approval. Tabbed UI with "Pendentes" and "Aprovados" views. Edit audit trail with `editHistory` jsonb column tracking previous values, editor, timestamp, and reason. Server-side Zod validation enforces mandatory edit reason for approved items, prevents no-op edits, and rejects unchanged submissions. "Editado após aprovação" badge indicators. Patient notifications on post-approval edits. API: `PATCH /api/post-consultation/items/:id/edit`, `GET /api/post-consultation/approved`.
- **Post-Consultation Workflow + SUS Prontuário:** Enhanced end-of-consultation flow with 2-step summary panel. Follow-ups are only auto-generated when explicitly mentioned in consultation notes. Summary panel shows all auto-generated items (prescriptions, exams, referrals, follow-ups) with enable/disable toggles. SUS-standard prontuário generation with full clinical sections (identification, chief complaint, HDA, past history, family history, social history, review of systems, physical exam, assessment, plan). SOAP compliance verification cross-references AI transcription with SOAP notes, scoring 0-100% with flagged inconsistencies. Table: `susProntuarios`. API: `POST /api/sus-prontuario/generate`, `GET /api/sus-prontuario/:consultationId`, `PATCH /api/sus-prontuario/:id/review`, `GET /api/sus-prontuarios/patient/:patientId`, `PATCH /api/post-consultation/items/:id/toggle`, `GET /api/post-consultation/summary/:consultationId`.
- **Clinical History Access Control (Doctor/Patient):** Patient-facing medical records (`/api/medical-records/my`) now filter to only show records with `patientFriendlyActive=true`, returning AI-generated patient-friendly summaries instead of raw clinical data. Doctors can generate patient-friendly versions via AI (`POST /api/medical-records/:id/patient-friendly`) and toggle patient visibility (`PATCH /api/medical-records/:id/patient-friendly/toggle`). Raw clinical notes hidden from patients in `my-consultations.tsx`. Doctor access scoped to patients they have appointments, records, or team hierarchy with. Schema: `patientFriendlyVersion` (text) and `patientFriendlyActive` (boolean) columns on `medicalRecords`.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe, PagBank