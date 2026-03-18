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
- **Navigation:** Desktop uses dropdown menus and direct icon links; mobile uses a slide-out sheet. Icons have consistent drop-shadow styling.
- **Mobile Layout:** Side menu (hamburger) for all users, top bar for essential elements.
- **Admin Theme:** Distinctive dark indigo/slate gradient with subtle dot grid pattern and radial glow effects.
- **Voice Assistant:** IAM3D voice assistant with half-screen overlay on mobile and full-screen on desktop.
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** 5-level Manchester Protocol (or WHO ETAT fallback) visual classification with color-coded badges.
- **Mobile Dashboards:** Rebuilt mobile patient dashboard with prominent "Consultar Agora" card and compact layout. Visitor dashboard with IAM3D integration.
- **Desktop Patient Dashboard:** Prominent "Consultar Agora" button with auto-find-first-available-doctor logic and live doctor availability count.

**Technical Implementations:**
- **Database:** PostgreSQL on Neon with Drizzle ORM.
- **AI Services:** Google Gemini API (with Replit OpenAI fallback) for chatbot, triage, video consultation support, medical records, and SOAP reports, adhering to medical guidelines (OMS, MS/Brasil, DSM-5/DSM-5-TR).
- **Video Consultations:** Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, transcription, and specialist invitations, with AI-driven medical record generation and dual-side transcription.
- **Patient Features:** AI-powered symptom triage, waiting room, prescription management, and medical record access.
- **Consultation Access:** QR codes and short access codes for patients to join without login.
- **Admin System Settings:** Configurable system parameters via admin interface.
- **Doctor Notes:** Dedicated interface for clinical notes with flexible organization and auto-save.
- **Incomplete Consultations:** Dashboard for doctors to manage and monitor unfinished consultations.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review and including drug interaction analysis.
- **WhatsApp IA:** Intelligent messaging for doctors with persistence, online status, and AI analysis.
- **Financial Management / Digital Wallet:** Comprehensive `/wallet` dashboard for balances, purchases, transfers, history, external wallet linking, and withdrawal requests.
- **Epidemiological Reports:** AI-powered analysis of clinical data for epidemiological insights using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Collaboration features, discussion rooms, and structured inter-consultation note-taking.
- **Patient Consultation Request:** Two-path system: "Buscar por Especialidade" or "Triagem por Sintomas".
- **IAM3D Voice Assistant:** Full-screen voice interface with animated sphere, session timer, and control bar. Uses Web Speech API for STT/TTS. Unified with chatbot API. Supports scheduling, urgent consultations, patient registration, profile navigation, and action buttons.
- **Doctor On-Duty Urgent Calls:** Doctors in plantão (24h on-duty) are visible for urgent consultations via IAM3D, with real-time notifications.
- **IAM3D Interconsulta:** Real-time AI diagnostic analysis during video consultations.
- **External Medication Search:** Prescription form integrates external medication databases (RxNorm/NIH, OpenFDA, ANVISA/RENAME) with locale-aware search.
- **AI Medication List Generation:** Prescription form generates complete treatment plans from diagnosis, symptoms, and patient history.
- **Digital Signature Verification:** Dual-path signature verification (RSA-PSS ICP-Brasil A3, RSA-SHA256 SignatureService) with public QR code-based verification endpoint. Includes OCSP checks and audit trail.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes, confidence levels, and suggested exams, for doctor review.
- **Admin Financial Management:** Admin interface for user credit balances, feature costs, credit package CRUD, exchange rates, and wallet transaction auditing.
- **Unified Payment Checkout:** Wallet purchase supports PayPal, Stripe (card/Apple Pay), and PagBank (PIX/Boleto).
- **Reports Dashboard:** Dedicated page for doctors/admins with predefined reports on consultations, patients, financials, and doctor performance.
- **Dynamic NFT Management:** Page for managing LGPD-compliant anonymized medical data insights as NFTs.
- **Internal Broker:** Page for trading NFT shares and TM3D tokens with order book and trade history.
- **External Wallet Integration:** Tab in wallet for linking MetaMask/WalletConnect and managing withdrawal requests.
- **Wallet Audit Log:** Comprehensive transaction auditing with action type filtering and weekly reports.
- **Inactivity Detection & Auto-Logout:** Configurable inactivity timeout with a prompt and auto-logout, disconnecting Agora services.
- **Consultation Inactivity Auto-Close:** Dedicated consultation-level inactivity monitor with three admin-configurable timeouts: user inactivity (default 10min), audio/video silence (default 20min), and countdown duration (default 30s). Shows animated progress bar warning modal with "Continuar Conectado" / "Encerrar" options. Disconnects Agora and updates consultation status on timeout. Settings exposed via `/api/system-settings/public/consultation-timeouts` endpoint.
- **Admin Mass Disconnect Controls:** "Controle de Conexões" section in admin Security tab with three buttons: disconnect all users (except admin), disconnect all doctors only, disconnect all services (WebSocket + Agora consultation rooms). Each requires confirmation. Disconnected users receive `force-disconnect` WebSocket message with admin message, gracefully stopping Agora tracks and navigating away. Endpoints: `POST /api/admin/disconnect-all-users`, `/api/admin/disconnect-all-doctors`, `/api/admin/disconnect-all-services`.
- **Patient Data Export (HL7 FHIR R4):** Standardized patient data export compliant with international healthcare standards (fhir-br, fhir-us, fhir-eu, fhir-intl) in JSON or PDF, with de-identification options.
- **Pharmacy Integration System:** Comprehensive pharmacy module with pharmacist user role, prescription verification, dispensing, and LGPD-compliant reporting.
- **PMD v1.0 (Prontuário Médico Digital):** CFM/LGPD/RGPD-compliant structured medical records with audit logs and flexible export options.
- **Consultation Rating:** Patients can rate completed video consultations (1-5 stars + optional feedback).
- **Prontuário Unificado (Unified Record):** Consolidates all patient data (records, consultations, prescriptions, exams) into a single timeline view.
- **Clinic Management System:** Multi-clinic support with shared patients/records, revenue sharing, and patient discounts, including invitation and association features.
- **Per-User Access Control:** Admins can deactivate/activate individual users with a reason, including protection against bulk deletion.
- **FHIR R4 Dashboard + ECG Analysis Engine:** Medical dashboard with FHIR R4 patient/observation CRUD, clinical history timeline, and an ECG analysis engine using AI (Gemini 2.0 Flash/OpenAI gpt-4o-mini) with **triple verification pipeline**: Pass 1 (ECG Reader methodology: 7-phase pipeline with calibration, lead-by-lead, waveform segmentation, rhythm, axis, clinical correlation, synthesis), Pass 2 (EKG Analyst methodology: systematic cardiac assessment, rhythm classification, interval analysis, morphology evaluation), Pass 3 (Cardiology Senior Validation Filter: objective evaluation, indicator analysis, differential probabilities, severity classification). Cross-validation logic prioritizes abnormal findings over normal ones when passes disagree, merges differential diagnoses and annotations, and takes the highest severity level. Progress bar shows 33%→66%→100% during analysis. Includes 9-step systematic criteria, AHA/ESC/SBC epidemiological data, color-coded annotations (semantic colors: red=ischemia, blue=hypertrophy, green=normal, yellow=moderate risk, purple=arrhythmia), action plans, and auto-generated immersive AI visualization image (gpt-image-1) in user's selected language with retry on failure. Includes Recharts visualizations and FHIR Bundle JSON export. Global floating Quick ECG Analyzer and Study Notes widgets.
- **Radiology Imaging Analysis Module:** AI-powered radiographic analysis (Gemini 2.0 Flash primary, OpenAI gpt-4o-mini fallback) with 4-phase procedural analysis pipeline: (1) study identification with correct anatomical region detection from actual image content, (2) technical evaluation, (3) systematic region analysis, (4) clinical correlation with recognized classification scales. Structured output: radiology findings, anatomical overlay, probabilistic diagnosis, prognostic estimation, formal CBR/RSNA report, lay summary, educational notes, multi-specialty relevance, technical quality scoring, color-coded regions, and action plans. Includes global floating "Análise de Estudo" widget (Scan icon, no AI badge), FHIR dashboard "Radiologia" tab, and backend routes for analyze/associate/share/generate-immersive-image. "Gerar Imagem Descritiva Avançada" button generates PACS workstation-style immersive visualization (gpt-image-1) with 6-block layout: RX original with pathology highlight, topographic overlay heatmap, normal anatomy comparison, functional anatomical illustration, structured prognostic/differential data, and clinical summary panel. Color semantics: red=high risk, orange=moderate, yellow=secondary, blue=anatomical reference, green=normal. Doctor notes folders: radiology_study, radiology_shares.

- **Interactive Dashboard System:** Draggable dashboard panels with `DraggableDashboardPanel` wrapper across all dashboards (main, clinical, FHIR, admin, pharmacy, doctor-office, mobile/desktop role dashboards). `MinimizedPanelsContext` manages panel minimization with `MinimizedPanelDock` lateral icon strip. `UnifiedToolbox` floating navigation bar with magnetic edge docking (10% viewport threshold), role-filtered nav groups, collapse mode. Floating widgets (Chatbot, Study Notes) support minimize-to-dock. Storage keys: `draggable_dashboard_{key}_{id}`, `minimized_panels`, `minimized_dock_side`, `unified_toolbox`, `unified_toolbox_dock_mode`, `unified_toolbox_visible`. Components: `client/src/components/dashboard/draggable-dashboard-panel.tsx`, `client/src/components/layout/unified-toolbox.tsx`, `client/src/components/layout/minimized-panel-dock.tsx`, `client/src/contexts/MinimizedPanelsContext.tsx`, `client/src/hooks/use-draggable.ts`.

- **Post-Load Effects System:** Configurable behaviors that execute automatically after each page load, including auto-scroll (scroll down N pixels and return to top) and custom JavaScript script execution. All settings stored as system settings in `postload` category. Public endpoint: `GET /api/system-settings/public/postload`. Admin UI: dedicated "Pós-Carregamento" tab visible only to permanent admins (`username === 'root' || isProtected`). Backend enforces permanent-admin check on `postload_*` settings updates. Frontend component: `PostLoadEffects` mounted globally in App.tsx, fetches config once and re-runs on route changes.

- **MCP Server (TELE-M3D-ECG-MCP):** Model Context Protocol server exposing ECG analysis and study management to ChatGPT and MCP-compatible AI clients via SSE transport at `/mcp`. Tools: `analyzeTELEECG` (proxies to `/api/ecg/analyze`), `getTELEReport` (proxies to `/api/study-report/:id`), `uploadTELEStudy` (proxies to `/api/studies`, creates study metadata/observation record), `listTELEStudies` (proxies to `/api/patient/:id/studies`). Health check at `/health`. Uses `@modelcontextprotocol/sdk`. **Setup:** `TELE_M3D_SECRET` must be set in Replit Secrets for MCP auth. Optional `MCP_CORS_ORIGINS` env var (comma-separated) to allow additional origins for MCP Inspector testing. Module: `server/mcp.ts`. Auth bridge: `requireAuthOrMcp` middleware in `server/routes.ts` (route-local, applied only to `/api/ecg/analyze`).

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe, PagBank