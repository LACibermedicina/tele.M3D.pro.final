# Medical Practice Management App

## Overview
This project is a full-stack medical practice management application designed to streamline clinical workflows, enhance patient care through AI-powered tools, and provide robust administrative features. It aims to modernize healthcare operations by integrating video consultations, AI diagnostics, sophisticated scheduling, and comprehensive patient record management. The application focuses on improving efficiency for healthcare providers and accessibility for patients, with a strong emphasis on adhering to medical guidelines and ensuring data security.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.

## System Architecture
The application features an Express.js backend and a React frontend, with shared TypeScript schemas for consistency. PostgreSQL is used for the database, managed with Drizzle ORM. AI services primarily leverage Google Gemini API for advanced capabilities, with Replit OpenAI AI Integrations (`gpt-4o-mini`) as a fallback.

**UI/UX Decisions:**
- **Navigation:** Desktop uses dropdown menus for multi-item groups and direct icon links for single-item groups. Mobile uses a slide-out sheet. Icons have consistent drop-shadow styling.
- **Mobile Layout:** Side menu (hamburger) for all users. Top bar keeps essential elements.
- **Admin Theme:** Distinctive dark indigo/slate gradient with subtle dot grid pattern and radial glow effects.
- **Voice Assistant:** IAM3D voice assistant with full-screen overlay and floating mic toggle.
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** 5-level Manchester Protocol (or WHO ETAT fallback) visual classification with color-coded badges.
- **WhatsApp IA:** Messages display with role labels and color-coded bubbles; patient online status shown.
- **Documentation:** Comprehensive role-based documentation system including installation, technical, user manual, and FAQ, with PDF export.
- **Mobile Dashboards:** Rebuilt mobile patient and visitor dashboards with real API data and IAM3D integration.

**Technical Implementations:**
- **Database:** PostgreSQL on Neon with Drizzle ORM.
- **AI Services:** Google Gemini API (with Replit OpenAI fallback) for chatbot, triage, video consultation support, medical records, and SOAP reports, adhering to medical guidelines (OMS, MS/Brasil, DSM-5/DSM-5-TR).
- **Video Consultations:** Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, transcription, and specialist invitations, with AI-driven medical record generation.
- **Patient Features:** AI-powered symptom triage, waiting room, prescription management, and medical record access.
- **Consultation Access:** QR codes and short access codes for patients to join consultations without login. Doctor status visible in the waiting room. Temporary visitor access links with configurable expiry.
- **Admin System Settings:** Configurable system parameters via admin interface (e.g., link expiry, AI triage toggle, financial settings).
- **Doctor Notes:** Dedicated interface for clinical notes with flexible organization and auto-save.
- **Incomplete Consultations:** Dashboard for doctors to manage and monitor unfinished consultations.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review and including drug interaction analysis.
- **WhatsApp IA:** Intelligent messaging for doctors with persistence, online status, and AI analysis.
- **Financial Management / Digital Wallet:** Comprehensive `/wallet` dashboard for balances, purchases, transfers, history, external wallet linking, and withdrawal requests.
- **Epidemiological Reports:** AI-powered analysis of clinical data for epidemiological insights using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Collaboration features, discussion rooms, and structured inter-consultation note-taking.
- **Patient Consultation Request:** Two-path system: "Buscar por Especialidade" or "Triagem por Sintomas".
- **Doctor Inter-Consultation:** Page for doctor-to-doctor scheduling with case descriptions and urgency.
- **Doctor Schedule:** Three-tab schedule (Today, Future, History) with bulk cancellation, instant consultation, individual appointment deletion, and patient blocking features.
- **IAM3D Voice Assistant:** Full-screen voice interface with animated sphere, session timer, and control bar. Uses Web Speech API for STT/TTS. Unified with chatbot API. Supports scheduling, urgent consultations, patient registration, profile navigation, and action buttons. Role-based capability badges.
- **Doctor On-Duty Urgent Calls:** Doctors in plantão (24h on-duty) are visible for urgent consultations via IAM3D, with real-time notifications.
- **IAM3D Interconsulta:** Real-time AI diagnostic analysis during video consultations.
- **Profile Photo Upload:** User profile picture upload functionality.
- **External Medication Search:** Prescription form integrates external medication databases (RxNorm/NIH, OpenFDA, ANVISA/RENAME) with locale-aware search.
- **AI Medication List Generation:** Prescription form generates complete treatment plans from diagnosis, symptoms, and patient history, including clinical analysis, treatment approach, prioritized medication list, non-pharmacological measures, follow-up, and alerts.
- **Digital Signature Verification:** Dual-path signature verification (RSA-PSS ICP-Brasil A3, RSA-SHA256 SignatureService) with public QR code-based verification endpoint. Includes OCSP checks and audit trail.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes, confidence levels, and suggested exams, for doctor review.
- **Admin Financial Management:** Admin interface for user credit balances, feature costs, credit package CRUD, exchange rates, and wallet transaction auditing. PayPal integration for credit purchases. Admin payments monitoring dashboard at `/admin/payments` with filters by provider/status/date, summary cards, and provider breakdown.
- **Unified Payment Checkout:** Wallet purchase supports PayPal, Stripe (card/Apple Pay), and PagBank (PIX/Boleto). Payment method selection before package choice. `payment_transactions` table tracks all providers. Stripe webhook at `/api/stripe/webhook` (registered before `express.json()`). PagBank webhook at `/api/pagbank/webhook`. Stripe uses `stripe-replit-sync` for managed webhooks and schema sync.
- **Reports Dashboard:** Dedicated page for doctors/admins with predefined reports on consultations, patients, financials, and doctor performance.
- **Dynamic NFT Management:** Page for managing LGPD-compliant anonymized medical data insights as NFTs.
- **Internal Broker:** Page for trading NFT shares and TM3D tokens with order book and trade history.
- **External Wallet Integration:** Tab in wallet for linking MetaMask/WalletConnect and managing withdrawal requests.
- **Wallet Audit Log:** Comprehensive transaction auditing with action type filtering and weekly reports.
- **Inactivity Detection & Auto-Logout:** Configurable inactivity timeout with a prompt and auto-logout if no response, disconnecting Agora services.
- **Patient Data Export (HL7 FHIR R4):** Standardized patient data export compliant with international healthcare standards (fhir-br, fhir-us, fhir-eu, fhir-intl) in JSON or PDF format, with de-identification options (HIPAA Safe Harbor, LGPD/GDPR consent).
- **Pharmacy Integration System:** Comprehensive pharmacy module with pharmacist user role, prescription verification, dispensing, and LGPD-compliant reporting. Includes pharmacist registration, dashboard, reports, AI dosage suggestions, and database enhancements for tracking and verification.
- **PMD v1.0 (Prontuário Médico Digital):** CFM/LGPD/RGPD-compliant structured medical records. JSON structure: `{id_paciente, medico_crm, paciente{nome,dt_nasc,sexo,endereco,contato}, clinico{anamnese,historico,exames,diagnostico,tratamento,evolucoes[]}, logs[{timestamp,user,acao,antigo,novo}]}`. Access control: creator doctor (view/edit/logs), admin (full), others (basic read, no logs). API: POST `/api/pmd/create`, GET `/api/pmd/list`, GET `/api/pmd/:id`, PATCH `/api/pmd/:id` (auto audit log), GET `/api/pmd/:id/export?locale=BR|ES|USA&format=PDF|JSON|XML|CSV`, PATCH `/api/pmd/:id/convert`. Export BR: CFM+nome_mãe+CRM. Export ES: RGPD+DNI+vacinas. Export USA: HIPAA. Fallback: BR. Service: `server/services/pmd-export-service.ts`. Schema fields: `pmdData` (jsonb), `pmdAuditLogs` (jsonb), `pmdVersion` (text) on `medical_records` table.
- **Consultation Rating:** Patients can rate completed video consultations (1-5 stars + optional feedback) via the "Histórico" tab in My Consultations. Uses `POST /api/appointments/:id/rate` endpoint. Star ratings display inline on rated consultations; unrated ones show "Avaliar Consulta" button.
- **Prontuário Unificado (Unified Record):** Consolidates all patient data (records, consultations, prescriptions, exams) into a single timeline view organized by day. API: `GET /api/medical-records/:patientId/unified` returns `{patient, timeline[], summary}`. Timeline groups entries by date with color-coded cards (blue=consultations, green=records, amber=prescriptions, purple=exams). Includes summary stats and vertical timeline with date markers. Default tab in medical records page.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe (Replit integration + stripe-replit-sync), PagBank (PIX/Boleto via REST API)