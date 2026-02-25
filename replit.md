# Medical Practice Management App

## Overview
A full-stack medical practice management application built with Express.js backend and React frontend.

## Architecture
- **Backend**: Express.js with TypeScript (`server/`)
- **Frontend**: React with Vite (`client/`)
- **Database**: PostgreSQL via Neon (Drizzle ORM with `drizzle-orm/node-postgres`)
- **Shared types**: `shared/schema.ts`

## Key Files
- `server/db.ts` - Database connection (constructs URL from individual PG env vars if DATABASE_URL is not a full connection string)
- `server/routes.ts` - API routes
- `server/storage.ts` - Database storage layer
- `server/index.ts` - Server entry point
- `shared/schema.ts` - Drizzle schema and types (46 tables)
- `client/src/App.tsx` - Frontend entry point

## Database
- PostgreSQL hosted on Neon (heliumdb)
- Uses `drizzle-orm/node-postgres` with `pg` driver
- Environment variables: `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- Schema migrations via `npm run db:push`
- On startup, creates default doctor user and schedule if not present

## AI Services
- **Primary**: Google Gemini API (`gemini-2.0-flash`) via `server/services/gemini.ts`
- **Fallback**: Replit OpenAI AI Integrations (`gpt-4o-mini`) — auto-fallback when Gemini quota/rate limits are hit
- **Environment**: `GEMINI_API_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Integration files**: `server/replit_integrations/` (chat, audio, image, batch)

## Clinical Reference Guidelines (Default)
All AI prompts (chatbot, triage, video consultation, medical records, SOAP reports) reference these three standard guideline sets:
1. **OMS (WHO)**: Diretrizes clínicas internacionais, mhGAP, GINA, GOLD, ETAT, Lista de Medicamentos Essenciais
2. **Protocolos de Atenção Primária - MS/Brasil**: Cadernos de Atenção Básica (CAB 19, 32, 36, 37), PCDT/CONITEC, PNAB, ESF, RENAME, Previne Brasil, vigilância epidemiológica
3. **DSM-5/DSM-5-TR (APA)**: Critérios diagnósticos para transtornos mentais, classificação e terapêutica psiquiátrica, complementado por diretrizes ABP e mhGAP-OMS
- Stored in `chatbot_references` table with priority 10 and `use_for_diagnostics = true`
- Keyword matching in `server/services/gemini.ts` boosts relevance for psychiatric terms, OMS protocols, and primary care queries
- Doctor system prompt in `server/routes.ts` explicitly lists all three guideline sets

## Dependencies
- jspdf v4.2.0 (PDF generation)
- openai (for Replit AI Integrations fallback)
- See `package.json` for full list

## Patient Features
- **Consultation Request**: `/consultation-request` - AI-powered 4-step symptom triage and doctor recommendations
- **Waiting Room**: `/immediate-consultation` - View online doctors with urgency room section for on-duty doctors, stats cards, urgency level selector (normal/urgent/emergency). Accessible to visitors and logged-in users.
- **My Consultations**: `/my-consultations` - Track consultation requests
- **Prescriptions**: Nav item conditionally shown for patients with active prescriptions within validity dates (via `/api/prescriptions/recent` query in header)
- **Medical Records**: Nav item "Meu Prontuário" conditionally shown if patient has existing records (via `/api/medical-records/my` query in header). Route `/records` accessible to patients.
- Navigation: Top header bar always visible for patient pages. Prescription and records nav items only appear for patients who have data.

## Doctor Notes (macOS Notes-style)
- **Route**: `/doctor-notes` - Full-featured note-taking interface for doctors
- **Database**: `doctor_notes` table with title, content, folder, color, isPinned, optional patientId
- **Features**: Sidebar with folder tabs (Todas, Clínicas, Pacientes, Estudos, Pessoais), search, pinned notes, color labels, auto-save (800ms debounce)
- **API**: CRUD at `/api/doctor-notes` (GET, POST, PATCH /:id, DELETE /:id) - doctor-only access
- **Files**: `client/src/pages/doctor-notes.tsx`, schema in `shared/schema.ts`, storage in `server/storage.ts`

## Video Consultation Features (Doctor)
- **Route**: `/consultation/video/:patientId`
- **Chat**: Real-time chat with sender identity (doctor/patient), bubble-style messages
- **AI Diagnostic**: Doctor sends questions, backend generates AI response using Gemini/OpenAI with patient context (history, allergies, records). Responses saved as `ai_response` notes.
- **Audio Transcription**: Real-time speech-to-text using browser SpeechRecognition API (Chrome/Edge). Entries show timestamp, speaker (Doutor/Paciente), text. Doctor can toggle speaker identification manually. Export to .txt or save to consultation notes. Auto-saves on call end.
- **Screen Sharing**: Doctor can share screen via Agora `createScreenVideoTrack()`. Toggle button in control bar (Monitor/MonitorOff icons). When active, replaces camera track; auto-reverts on stop. Floating red indicator shown.
- **Specialist Invite**: Doctor can invite online specialists to join consultation. Dialog shows online doctors from `/api/doctors/online`. Backend `POST /api/video-consultations/:id/invite-specialist` sends WebSocket notification + `pendingNotifications` to specialist with join link.
- **Notes**: Doctor annotations, saved transcriptions displayed with border accents. All notes included in meetingNotes on call end.
- **Consultation note types**: `chat`, `ai_query`, `ai_response`, `doctor_note`, `annotation`, `transcription`
- **End Call**: Doctor's "end call" button saves transcriptions, calculates duration, charges credits, and notifies patient via WebSocket

## Video Consultation Features (Patient)
- **Route**: `/patient/video/:consultationId`
- **Join**: Patient joins via `/api/doctor-office/join/:doctorId` (idempotent, reuses existing active consultation)
- **Leave**: Patient can leave call via "Sair" button → calls `/api/video-consultations/:id/leave` → notifies doctor
- **Auto-redirect**: If doctor ends consultation, patient is auto-redirected to `/my-consultations` via polling consultation status
- **Chat**: Real-time chat with doctor during video call

## WhatsApp IA (Doctor Messaging)
- **Route**: `/whatsapp` - Central de mensagens inteligente
- **Backend**: `/api/whatsapp/send` saves doctor messages to DB regardless of WhatsApp Business API status (works internally without API credentials)
- **Message fields**: `direction` (inbound/outbound/doctor_to_patient), `senderRole` (patient/doctor/ai/system), `doctorId`
- **Frontend**: Messages display with role labels (Doutor(a), Paciente, IA MedPro) and color-coded bubbles (blue for doctor, gray for patient, AI indicator style for AI)
- **Patient Online Status**: Real-time via WebSocket tracking (`GET /api/patients/online-status`, polled every 10s). Both doctors and patients tracked in `authenticatedClients` map. Shows green/gray dot + Online/Offline text.
- **Allow Reply Toggle**: Doctor can toggle "Resposta habilitada" / "Sem resposta" per message. When enabled, patient sees "Responder" button in notification center. Patient replies via `POST /api/notifications/patient-reply` → saved as WhatsApp message + WebSocket notification to doctor.
- **AI Processing**: Incoming patient messages are analyzed by Gemini/OpenAI for scheduling requests and clinical questions; AI responses are auto-generated
- **Files**: `client/src/pages/whatsapp.tsx`, `server/services/whatsapp.ts`, routes in `server/routes.ts`, `client/src/components/notifications/notification-center.tsx`

## Triage System (Classificação de Risco)
- **Protocol**: Protocolo de Manchester (MTS) / Ministério da Saúde Brasil, with WHO ETAT fallback
- **5 Levels**: emergency (red), very_urgent (orange), urgent (yellow), standard (green), non_urgent (blue)
- **Components**: `client/src/lib/triage.ts` (constants, config, mapping), `client/src/components/triage/triage-badge.tsx` (TriageBadge, TriageColorBar, TriageDot), `client/src/components/triage/triage-help-dialog.tsx` (protocol guide dialog)
- **AI Integration**: Triage prompt in `server/routes.ts` uses 5-level Manchester Protocol classification with criteria
- **Applied to**: consultation-request.tsx, my-consultations.tsx, doctor-chat.tsx, patient-records.tsx, whatsapp.tsx (details panel)
- **Legacy mapping**: `mapLegacyTriageLevel()` converts old values (routine, moderate, low, immediate) to new 5-level system
- **Help dialog**: Accessible from WhatsApp details panel, doctor chat, and consultation request analysis page

## Financial Management (Credits)
- **Route**: `/credits` - TMC credits purchase and management
- **Balance**: Current balance display with gradient card
- **Packages**: 4 credit packages with PayPal checkout integration
- **Transaction History**: Full history with credit/debit indicators, timestamps, and running balance (`GET /api/tmc/transactions`)
- **Cost Table**: Lists costs per feature (Video: 50 TMC, WhatsApp: 10 TMC, AI Exam: 15 TMC, etc.)

## Epidemiological Reports
- **Route**: `/epidemiological-reports` - AI-powered epidemiological analysis for doctors and admins
- **Backend**: `GET /api/epidemiological-reports` (basic stats), `POST /api/epidemiological-reports/analyze` (AI MeSH analysis)
- **Data Sources**: Consultation notes, medical records, consultation requests, video consultations
- **AI Analysis**: Gemini/OpenAI extracts symptoms → MeSH codes, diagnoses → ICD codes from clinical texts
- **Tabs**: Visão Geral (overview with AI summary), Sintomas/MeSH, Diagnósticos, Classificação de Risco
- **Charts**: Symptom frequency bars, triage level distribution, age group breakdown
- **Period Filter**: 7/30/90/365 days
- **Files**: `client/src/pages/epidemiological-reports.tsx`, routes in `server/routes.ts`

## Medical Teams & Inter-Consultations
- **Route**: `/medical-teams` - Team management and inter-consultation discussions
- **Team Room**: `/team-room/:id` - 3 tabs: Discussion, Inter-Consultation, Files
- **Notes**: `team_notes` table with types: discussion, interconsultation, case_summary, clinical_question
- **Features**: Urgency flags, note threading (parentNoteId), doctor invitation dialog, online status

## Running
- `npm run dev` starts the development server (Express + Vite on port 5000)
