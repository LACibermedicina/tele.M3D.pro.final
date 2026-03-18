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
- **Interactive Dashboard System:** Draggable panels with minimization to a dock, and a `UnifiedToolbox` floating navigation bar that supports detachable items as standalone mini-panels.

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

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe, PagBank