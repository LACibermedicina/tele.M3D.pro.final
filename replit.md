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
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** Implements a 5-level Manchester Protocol (or WHO ETAT fallback) visual classification with color-coded badges and help dialogs.
- **WhatsApp IA:** Messages display with role labels (Doctor, Patient, AI) and color-coded bubbles. Patient online status is shown in real-time.
- **Documentation:** Public-facing manual, FAQ, and installation guides with searchable content, category filters, and code blocks.

**Technical Implementations:**
- **Database:** PostgreSQL on Neon, using `drizzle-orm/node-postgres`. Schema migrations handled via `npm run db:push`. Default doctor user and schedule created on startup.
- **AI Services:** Integrates Google Gemini API (`gemini-2.0-flash`) for AI functionalities (chatbot, triage, video consultation, medical records, SOAP reports). Replit OpenAI AI Integrations provide a robust fallback mechanism. AI prompts consistently reference OMS (WHO), Protocolos de Atenção Primária - MS/Brasil, and DSM-5/DSM-5-TR (APA) guidelines.
- **Video Consultations:** Utilizes Agora for real-time video, audio, and screen sharing. Features include real-time chat, AI diagnostic queries, real-time audio transcription (browser SpeechRecognition API), and specialist invitation. Comprehensive end-call flow with options for completing consultations and auto-generating medical records via AI.
- **Patient Features:** Includes AI-powered symptom triage, a waiting room for immediate consultations, tracking of consultation requests, prescription management, and access to medical records. Sidebar navigation is role-filtered: patients see Dashboard, Schedule, My Consultations, Waiting Room (Sala de Espera), Consultation Request, Records, and Prescriptions. Doctor-only items (Patients list, WhatsApp, AI Assistant, Medical References, Teams, Cafe) are hidden from patients.
- **Consultation Access Tokens:** Doctors can generate QR codes and short access codes (6-char) for patients to join consultations without login. Component `ConsultationAccessGenerator` available on schedule page (today + future appointments). Public page at `/acesso/:code`. Backend: `POST /api/consultation-access/generate`, `POST /api/consultation-access/validate`, `POST /api/consultation-access/send-whatsapp`.
- **Doctor "Em Atendimento" Status:** `/api/doctors/online` checks for active video consultations per doctor and returns `inConsultation: true/false`. Doctors in active video calls show yellow "Em Atendimento" badge in the Sala de Espera listing instead of green "Online", with a warning message advising patients to wait or choose another doctor.
- **Temporary Visitor Access:** Visitors cannot see the Sala de Espera unless logged in or possessing a temporary access link. Doctors/admins generate links with configurable expiry (default 2h, managed via system settings). Backend: `POST /api/temporary-access/generate`, `GET /api/temporary-access/validate/:code`. Access code stored in `sessionStorage` with timestamp; expiry period configurable in admin System Settings.
- **Admin System Settings:** Configurable system parameters accessible via the "Configurações" tab in `/admin`. Settings are key-value pairs in `system_settings` table with categories (access, consultations, ai, notifications, prescriptions, financial). Default settings seeded on startup. Editable inline with category filtering. Backend: `GET /api/system-settings`, `GET /api/system-settings/:key`, `PUT /api/system-settings/:key`. Settings include: temp link expiry, consultation token expiry, max consultation duration, AI triage toggle, diagnostic confidence threshold, post-consultation auto-generation, WhatsApp notifications, waiting room capacity, digital signature requirement, TMC credit costs.
- **Doctor Notes:** A dedicated interface for doctors to manage clinical notes with flexible organization and auto-save functionality.
- **Incomplete Consultations Dashboard:** Provides doctors with a tool to manage and evaluate unfinished consultations, offering options to reactivate, invite specialists, or complete cases.
- **Post-Consultation Workflow:** When a consultation ends or is completed, AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes. Items are stored in `post_consultation_items` table with `pending_review` status. Doctors review on `/post-consultation-review` page with drug interaction analysis (AI-powered via Gemini), approve/reject individually or in bulk. Approved items become visible to patients in their consultation history (`/my-consultations` video history tab) with expandable details.
- **WhatsApp IA:** Enables intelligent messaging for doctors, including message persistence, patient online status tracking, and AI-powered analysis of incoming patient messages.
- **Financial Management / Digital Wallet:** Dedicated `/wallet` dashboard accessible to doctors, patients, and researchers. Features: balance overview with stats cards (total received, commissions/spent), 4-tab layout (Comprar/Histórico/Transferir/Custos), PayPal credit package purchases, transfer between users, transaction history with typed labels, and feature cost reference. Navigation accessible via header "Carteira Digital" link.
- **Epidemiological Reports:** AI-powered analysis of clinical data to generate epidemiological insights, including symptom frequency, triage level distribution, and age group breakdowns using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Facilitates team collaboration with discussion rooms, inter-consultation features, and structured note-taking.
- **Doctor Schedule:** Three-tab structure: "Hoje" (today's open/active consultations), "Futuras" (upcoming scheduled appointments after today), and "Histórico" (completed, cancelled, expired). Both "Hoje" and "Futuras" tabs include a "Cancelar Todas" button with confirmation dialog that bulk-cancels all pending appointments, notifies patients via WebSocket + persistent notifications, and moves them to history. Backend: `POST /api/appointments/cancel-all` (scope: today|future|all), `GET /api/appointments/doctor/:id/future`. Instant consultation with online patients available.
- **IAM3D Interconsulta:** Real-time AI diagnostic analysis during video consultations. Auto-triggers when doctor saves notes (minimum 2 doctor_notes or 1 transcription). Displays in AI panel with purple-themed cards, latest analysis prominent, older analyses collapsible. Note type: `iam3d_diagnostic`.
- **Post-Consultation Diagnostic Classification:** After consultation end/complete, AI extracts syndromic diagnostic hypotheses with CID-10/CID-11 and DSM-5/DSM-5-TR codes, confidence percentages, differentials, red flags, and suggested exams. Stored in `diagnostic_inferences` table. If confidence < 96%, doctor gets `diagnostic_review` notification requiring review. If ≥ 96%, doctor gets `diagnostic_ready` notification. Both always request authorization to compile clinical history and diagnostic-epidemiological framework. Doctor reviews on `/diagnostic-review` page with checkboxes to authorize compilation (clinical history + epidemiological inference). On approval, AI compiles structured clinical history referencing OMS/MS-Brasil/DSM-5 and epidemiological framework with DataSUS/MeSH/CID-10 data, stored in `medicalRecords.diagnosticHypotheses`. Backend: `GET /api/diagnostic-inferences/pending`, `GET /api/diagnostic-inferences/consultation/:id`, `POST /api/diagnostic-inferences/:id/review`.

## External Dependencies
- **Database:** PostgreSQL (hosted on Neon)
- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **AI/ML:**
    - Google Gemini API (`gemini-2.0-flash`)
    - Replit OpenAI AI Integrations (`gpt-4o-mini`)
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal (for credit packages)