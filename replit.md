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
- **Patient Features:** Includes AI-powered symptom triage, a waiting room for immediate consultations, tracking of consultation requests, prescription management, and access to medical records.
- **Doctor Notes:** A dedicated interface for doctors to manage clinical notes with flexible organization and auto-save functionality.
- **Incomplete Consultations Dashboard:** Provides doctors with a tool to manage and evaluate unfinished consultations, offering options to reactivate, invite specialists, or complete cases.
- **WhatsApp IA:** Enables intelligent messaging for doctors, including message persistence, patient online status tracking, and AI-powered analysis of incoming patient messages.
- **Financial Management:** Manages TMC credits with package purchases via PayPal and a detailed transaction history.
- **Epidemiological Reports:** AI-powered analysis of clinical data to generate epidemiological insights, including symptom frequency, triage level distribution, and age group breakdowns using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Facilitates team collaboration with discussion rooms, inter-consultation features, and structured note-taking.
- **Doctor Schedule:** Comprehensive daily schedule and history views, with an option for instant consultations with online patients.

## External Dependencies
- **Database:** PostgreSQL (hosted on Neon)
- **ORM:** Drizzle ORM (`drizzle-orm/node-postgres`)
- **AI/ML:**
    - Google Gemini API (`gemini-2.0-flash`)
    - Replit OpenAI AI Integrations (`gpt-4o-mini`)
- **Video Conferencing:** Agora
- **PDF Generation:** jspdf
- **Payment Processing:** PayPal (for credit packages)