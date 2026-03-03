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
- **Mobile Layout:** Side menu (hamburger) for all users; top bar for essential elements.
- **Admin Theme:** Distinctive dark indigo/slate gradient with subtle dot grid and radial glow effects.
- **Voice Assistant:** IAM3D voice assistant with half-screen overlay on mobile and full-screen on desktop.
- **Doctor Notes:** macOS Notes-style interface with folders, search, pinning, and color labels.
- **Triage System:** 5-level Manchester Protocol (or WHO ETAT fallback) visual classification with color-coded badges.
- **WhatsApp IA:** Messages display with role labels and color-coded bubbles; patient online status shown.
- **Documentation:** Comprehensive role-based documentation with PDF export.
- **Mobile Dashboards:** Rebuilt mobile patient dashboard with prominent "Consultar Agora" card and list-style navigation. Visitor dashboard with IAM3D integration.
- **Desktop Patient Dashboard:** Prominent "Consultar Agora" button with auto-find-first-available-doctor logic and live doctor availability count.

**Technical Implementations:**
- **Database:** PostgreSQL on Neon with Drizzle ORM.
- **AI Services:** Google Gemini API (with Replit OpenAI fallback) for chatbot, triage, video consultation support, medical records, and SOAP reports, adhering to medical guidelines.
- **Video Consultations:** Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, transcription, and specialist invitations, with AI-driven medical record generation. Includes dual-side transcription and UI controls.
- **Patient Features:** AI-powered symptom triage, waiting room, prescription management, and medical record access.
- **Consultation Access:** QR codes and short access codes for patients to join consultations without login; temporary visitor links.
- **Admin System Settings:** Configurable system parameters via admin interface.
- **Doctor Notes:** Dedicated interface for clinical notes with flexible organization and auto-save.
- **Incomplete Consultations:** Dashboard for doctors to manage and monitor unfinished consultations.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review and drug interaction analysis.
- **WhatsApp IA:** Intelligent messaging for doctors with persistence, online status, and AI analysis.
- **Financial Management / Digital Wallet:** Comprehensive dashboard for balances, purchases, transfers, history, and withdrawal requests.
- **Epidemiological Reports:** AI-powered analysis of clinical data for epidemiological insights using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Collaboration features, discussion rooms, and structured inter-consultation note-taking.
- **Patient Consultation Request:** Two-path system: "Buscar por Especialidade" or "Triagem por Sintomas".
- **Doctor Inter-Consultation:** Page for doctor-to-doctor scheduling with case descriptions and urgency.
- **Doctor Schedule:** Three-tab schedule (Today, Future, History) with bulk actions and patient blocking.
- **IAM3D Voice Assistant:** Full-screen voice interface with animated sphere, session timer, and control bar, utilizing Web Speech API. Supports scheduling, urgent consultations, patient registration, and profile navigation.
- **Doctor On-Duty Urgent Calls:** Doctors in plantão are visible for urgent consultations via IAM3D, with real-time notifications.
- **IAM3D Interconsulta:** Real-time AI diagnostic analysis during video consultations.
- **Profile Photo Upload:** User profile picture upload functionality.
- **External Medication Search:** Prescription form integrates external medication databases (RxNorm/NIH, OpenFDA, ANVISA/RENAME) with locale-aware search.
- **AI Medication List Generation:** Prescription form generates complete treatment plans from diagnosis, symptoms, and patient history.
- **Digital Signature Verification:** Dual-path signature verification (RSA-PSS ICP-Brasil A3, RSA-SHA256 SignatureService) with public QR code-based verification endpoint.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes for doctor review.
- **Admin Financial Management:** Admin interface for user credit balances, feature costs, credit package CRUD, exchange rates, and wallet transaction auditing.
- **Unified Payment Checkout:** Wallet purchase supports PayPal, Stripe (Card/Link/Apple Pay/Google Pay via PaymentElement), and PagBank (PIX/Boleto).
- **Reports Dashboard:** Dedicated page for doctors/admins with predefined reports.
- **Dynamic NFT Management:** Page for managing LGPD-compliant anonymized medical data insights as NFTs.
- **Internal Broker:** Page for trading NFT shares and TM3D tokens with order book and trade history.
- **External Wallet Integration:** Tab in wallet for linking MetaMask/WalletConnect and managing withdrawal requests.
- **Wallet Audit Log:** Comprehensive transaction auditing with action type filtering and weekly reports.
- **Inactivity Detection & Auto-Logout:** Configurable inactivity timeout with prompt and auto-logout.
- **Patient Data Export (HL7 FHIR R4):** Standardized patient data export compliant with international healthcare standards in JSON or PDF, with de-identification options.
- **Pharmacy Integration System:** Comprehensive pharmacy module with pharmacist user role, prescription verification, dispensing, and LGPD-compliant reporting.
- **PMD v1.0 (Prontuário Médico Digital):** CFM/LGPD/RGPD-compliant structured medical records with versioning and audit logs.
- **Consultation Rating:** Patients can rate completed video consultations (1-5 stars + optional feedback).
- **Prontuário Unificado (Unified Record):** Consolidates all patient data into a single timeline view organized by day.
- **Clinic Management System:** Multi-clinic support with shared patients/records, revenue sharing, and patient discounts, including clinic creation, member management, and patient binding.
- **Waiting Room Management:** Doctor-facing waiting room page showing all patients with pending/accepted requests, with live updates and urgency badges.
- **Doctor Transfer Workflow:** Multi-party consent flow for transferring patients between doctors with status tracking and notifications.
- **Data Access Control & Consent:** Consent-based medical data sharing between doctors with two-step approval for access requests (summary or full access).
- **Clinical History Compilation:** Comprehensive clinical history endpoint compiling all patient interactions into a grouped timeline.
- **Preferred Doctor Management:** Patients can set/change their primary doctor.
- **Internationalization (i18n):** Dual-layer translation system using `react-i18next` for static translations and AI-powered auto-translation for dynamic content.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal, Stripe (Replit integration + stripe-replit-sync), PagBank (PIX/Boleto via REST API)