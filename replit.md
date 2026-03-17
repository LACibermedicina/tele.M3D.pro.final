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
- **Patient Data Export (HL7 FHIR R4):** Standardized patient data export compliant with international healthcare standards (fhir-br, fhir-us, fhir-eu, fhir-intl) in JSON or PDF, with de-identification options.
- **Pharmacy Integration System:** Comprehensive pharmacy module with pharmacist user role, prescription verification, dispensing, and LGPD-compliant reporting.
- **PMD v1.0 (Prontuário Médico Digital):** CFM/LGPD/RGPD-compliant structured medical records with audit logs and flexible export options.
- **Consultation Rating:** Patients can rate completed video consultations (1-5 stars + optional feedback).
- **Prontuário Unificado (Unified Record):** Consolidates all patient data (records, consultations, prescriptions, exams) into a single timeline view.
- **Clinic Management System:** Multi-clinic support with shared patients/records, revenue sharing, and patient discounts, including invitation and association features.
- **Per-User Access Control:** Admins can deactivate/activate individual users with a reason, including protection against bulk deletion.
- **FHIR R4 Dashboard + ECG Analysis Engine:** Medical dashboard with FHIR R4 patient/observation CRUD, clinical history timeline, and an ECG analysis engine using AI (Gemini 2.0 Flash/OpenAI gpt-4o-mini) replicating the "ECG Reader" GPT methodology with a 7-phase pipeline: (1) technical calibration verification, (2) lead-by-lead analysis (12 leads), (3) waveform segmentation (P-QRS-ST-T-U), (4) rhythm strip interpretation, (5) electrical axis determination, (6) clinical pattern correlation (Sokolow-Lyon, Cornell, Sgarbossa, Brugada, WPW), (7) evidence-based diagnostic synthesis. Includes 9-step systematic criteria, AHA/ESC/SBC epidemiological data, color-coded annotations (semantic colors: red=ischemia, blue=hypertrophy, green=normal, yellow=moderate risk, purple=arrhythmia), action plans, and auto-generated immersive AI visualization image (gpt-image-1) showing color-coded annotated ECG summary. Includes Recharts visualizations and FHIR Bundle JSON export. Global floating Quick ECG Analyzer and Study Notes widgets.
- **Radiology Imaging Analysis Module:** AI-powered radiographic analysis (Gemini 2.0 Flash primary, OpenAI gpt-4o-mini fallback) with 4-phase procedural analysis pipeline: (1) study identification with correct anatomical region detection from actual image content, (2) technical evaluation, (3) systematic region analysis, (4) clinical correlation with recognized classification scales. Structured output: radiology findings, anatomical overlay, probabilistic diagnosis, prognostic estimation, formal CBR/RSNA report, lay summary, educational notes, multi-specialty relevance, technical quality scoring, color-coded regions, and action plans. Includes global floating "Análise de Estudo" widget (Scan icon, no AI badge), FHIR dashboard "Radiologia" tab, and backend routes for analyze/associate/share/generate-immersive-image. "Gerar Imagem Descritiva Avançada" button generates PACS workstation-style immersive visualization (gpt-image-1) with 6-block layout: RX original with pathology highlight, topographic overlay heatmap, normal anatomy comparison, functional anatomical illustration, structured prognostic/differential data, and clinical summary panel. Color semantics: red=high risk, orange=moderate, yellow=secondary, blue=anatomical reference, green=normal. Doctor notes folders: radiology_study, radiology_shares.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe, PagBank