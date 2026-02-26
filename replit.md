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
- **Navigation Menu:** Desktop uses dropdown menus for multi-item groups (Clínico, Revisão, etc.) and direct icon links for single-item groups. Mobile uses slide-out sheet with category headers. All icons have consistent drop-shadow styling. Coffee room relocated from Quick Actions to Comunicação & IA group.
- **Clear Schedule (Limpar Agenda):** Doctors can clear their entire schedule from Quick Actions dropdown (next to "Abrir Consultório"). Cancels all scheduled appointments and pending inter-consultations, notifying patients and inter-consultation doctors. Backend enforces authentication and role-based authorization.
- **Admin Theme:** Distinctive dark indigo/slate gradient background with subtle dot grid pattern and radial glow effects, differentiating admin pages from the main origami theme.
- **Voice Assistant Prompt:** On first login, users are prompted to enable the IAM3D voice assistant. When enabled, a full-screen overlay with the animated sphere stays active until the user says "fechar assistente" or similar voice commands. A floating mic toggle button persists for quick access.
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** Implements a 5-level Manchester Protocol (or WHO ETAT fallback) visual classification with color-coded badges and help dialogs.
- **WhatsApp IA:** Messages display with role labels (Doctor, Patient, AI) and color-coded bubbles. Patient online status is shown in real-time.
- **Documentation:** Public-facing manual, FAQ, and installation guides with searchable content, category filters, and code blocks. Downloadable comprehensive PDF documentation with SVG diagrams (architecture, module relationships, ER diagrams, user guides by role).
- **Mobile Dashboards:** Rebuilt mobile patient and visitor dashboards with real API data, touch-friendly buttons, and IAM3D voice assistant integration.

**Technical Implementations:**
- **Database:** PostgreSQL on Neon, with Drizzle ORM for schema management and migrations.
- **AI Services:** Integrates Google Gemini API for chatbot, triage, video consultation support, medical records, and SOAP reports, with Replit OpenAI as fallback. AI prompts adhere to OMS (WHO), MS/Brasil, and DSM-5/DSM-5-TR guidelines.
- **Video Consultations:** Utilizes Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, real-time audio transcription, and specialist invitations. Includes comprehensive end-call workflows with AI-driven medical record generation.
- **Patient Features:** AI-powered symptom triage, waiting room for immediate consultations, prescription management, and access to medical records. Role-filtered navigation for patients.
- **Consultation Access:** Doctors can generate QR codes and short access codes for patients to join consultations without login.
- **Doctor Status:** Doctors in active video calls are visibly marked as "Em Atendimento" in the waiting room.
- **Temporary Visitor Access:** Generatable temporary access links for visitors to the waiting room, with configurable expiry.
- **Admin System Settings:** Configurable system parameters via an admin interface, including temporary link expiry, consultation token expiry, AI triage toggle, and financial settings.
- **Doctor Notes:** A dedicated interface for doctors to manage clinical notes with flexible organization and auto-save.
- **Incomplete Consultations:** Dashboard for doctors to manage and evaluate unfinished consultations, including real-time active call monitoring.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review. Includes AI-powered drug interaction analysis.
- **WhatsApp IA:** Intelligent messaging for doctors with message persistence, patient online status, and AI analysis of patient messages.
- **Financial Management / Digital Wallet:** Comprehensive `/wallet` dashboard for managing balances, purchases, transfers, transaction history, external wallet linking, and withdrawal requests.
- **Epidemiological Reports:** AI-powered analysis of clinical data for epidemiological insights (symptom frequency, triage levels, age groups) using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Features for team collaboration, discussion rooms, and structured inter-consultation note-taking.
- **Patient Consultation Request:** Two-path system: "Buscar por Especialidade" to browse doctors or "Triagem por Sintomas" for AI-guided doctor recommendations.
- **Doctor Inter-Consultation:** Dedicated page for doctor-to-doctor scheduling with case descriptions and urgency levels.
- **Doctor Schedule:** Three-tab schedule (Today, Future, History) with bulk cancellation options and instant consultation features.
- **IAM3D Voice Assistant:** Full-screen Agora.io-style voice interface with animated sphere, session timer, bottom control bar (mic, mute, speaker, end call), and real-time on-duty doctor availability. Uses Web Speech API for STT/TTS. Unified with chatbot: `/api/chatbot/message` (auth) and `/api/chatbot/visitor-message` (visitors). Supports scheduling confirmation, urgent consultation with on-duty doctors (quick-call doctor cards), patient registration for visitors, profile navigation, and action buttons. Role-based capability badges (Triagem/Agendar/Urgente for patients, Diagnóstico/Protocolos/Plantão for doctors). Conversation persistence via conversationId.
- **Doctor On-Duty Urgent Calls:** Doctors in plantão (24h on-duty) are visible to patients requesting urgent consultations via IAM3D voice assistant. Backend finds on-duty doctors, creates consultation requests with urgent status, and sends real-time notifications. Doctor availability page shows IAM3D urgent call indicator when on-duty.
- **IAM3D Interconsulta:** Real-time AI diagnostic analysis during video consultations, triggered by doctor notes or transcription.
- **Profile Photo Upload:** Functionality for users to upload profile pictures, stored statically.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes, confidence levels, and suggested exams, requiring doctor review and authorization for clinical history compilation.
- **Admin Financial Management:** Admin interface for managing user credit balances, feature costs, credit package CRUD (create/edit/activate/deactivate), configurable TMC/USD exchange rate, and auditing wallet transactions. PayPal checkout for credit purchases with 6 seeded packages and 15 feature costs.
- **Reports Dashboard:** Dedicated page for doctors/admins with predefined reports on consultations, patients, financials, and doctor performance, with filtering and export options.
- **Dynamic NFT Management:** Page for managing LGPD-compliant anonymized medical data insights as NFTs, allowing creation, detail viewing, share purchases, and consent record display.
- **Internal Broker:** Dedicated page for trading NFT shares and TM3D tokens, featuring an order book, order management, and trade history.
- **External Wallet Integration:** Tab in wallet for linking MetaMask/WalletConnect, viewing linked wallets, and managing withdrawal requests.
- **Wallet Audit Log:** Comprehensive transaction auditing with action type filtering and weekly report summaries.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal