# Medical Practice Management App

## Overview
This full-stack medical practice management application aims to modernize healthcare operations by streamlining clinical workflows, enhancing patient care with AI-powered tools, and providing robust administrative features. It integrates video consultations, AI diagnostics, advanced scheduling, and comprehensive patient record management, focusing on efficiency for providers and accessibility for patients while ensuring data security and adherence to medical guidelines. The project envisions significant market potential by delivering a secure, AI-enhanced platform that improves healthcare delivery and operational efficiency.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.

## System Architecture
The application is built with an Express.js backend and a React frontend, utilizing shared TypeScript schemas for data consistency. PostgreSQL with Drizzle ORM is used for database management. AI services primarily leverage Google Gemini API, with Replit OpenAI AI Integrations as a fallback.

**UI/UX Decisions:**
- **Navigation:** Adaptive navigation for desktop (dropdowns, icon links) and mobile (slide-out sheet).
- **Theming:** Distinctive dark indigo/slate gradient for admin, glass morphism for desktop windows (`backdrop-blur`, `hsla` backgrounds). Per-role theme config (accent, panel bg, text, titlebar, icon colors for admin/doctor/patient/pharmacist/researcher) persisted in `layout_settings` table (category `theme`, keys `theme_{field}_{role}`), applied at runtime via CSS variables in `LayoutSettingsContext`. Global desktop opacity sliders (`desktop_glass_opacity`, `desktop_titlebar_opacity`) also in `layout_settings`.
- **Dashboards:** Interactive, draggable panels with minimization to a bottom taskbar dock. Role-based widgets are displayed in the `DesktopHome` window.
- **Desktop OS-Style Environment:** macOS-inspired windowed environment with draggable, resizable, minimizable, and closable windows.
- **Voice Assistant:** IAM3D voice assistant with context-aware overlays.
- **Doctor Notes:** macOS Notes-style interface with comprehensive management features.
- **Triage System:** Visual 5-level Manchester Protocol (or WHO ETAT) classification.
- **Contextual Search:** Command palette (`⌘K`) for role-scoped data search.
- **Header Quick Controls:** Shared `header-quick-controls.tsx` renders beside the language flag in all bar variants (top/bottom/left/right/floating/mobile): doctor office open/close toggle (reuses /api/doctor-office/open|close + status, confirm dialog when patients are waiting), always-visible logout icon for all users, and patient-only taskbar shortcuts limited to Solicitar Atendimento (/consultation-request) and Meus Atendimentos (/my-consultations, badge). Inline quick-action/analysis shortcut clutter removed from all bars (minimized-window tray kept). Full-screen (non-desktop-window) menu pages get a floating X (`FullscreenPageClose` in App.tsx) returning to /dashboard.
- **Standardized Bar Control Cluster (Task #130):** `renderBarControls(opts)` in `header.tsx` renders the same control set in every bar variant — search (⌘K), voice assistant toggle, credit balance, NotificationCenter (with `side`/`light`/`triggerClassName` props for docked dark bars, popover z-[10050]), office toggle, language, avatar menu, direct logout — with vertical (left/right docks) and compact (floating) modes; `DesktopTaskbarWindows` accepts `vertical`/`tooltipSide` and appears in all variants incl. top. On fresh login the nav bar resets to the bottom dock (`LayoutSettingsContext` watches logged-out→logged-in transition; quick login also writes `nav_dock_mode=bottom` before redirect); user can still move it afterwards. Desktop windows use macOS traffic-light controls (yellow minimize #febc2e, green maximize #28c840, red close #ff5f57, dark icons on hover) independent of per-role titlebar theme, plus a larger high-contrast resize handle.
- **Admin Theme Customization:** Per-role accent color configuration, desktop glass opacity sliders, and mobile menu style selection.
- **View Modes:** Three distinct modes (Immersive, Mobile, Desktop) selectable by the user post-login, optimized for different interaction styles and devices.
- **Access Modality (Clássica / Profissional / Assistida):** Three-preset versioning of the experience. Persisted globally in `system_settings.access_modality_default` (default: `professional`) and per-user in `users.access_modality` (nullable; null inherits global). Backend exposes `GET /api/system/access-modality-default`, `PUT /api/admin/access-modality-default`, `PATCH /api/auth/access-modality`, and `effectiveAccessModality` in `/api/auth/me`. Frontend `AccessModalityContext` reflects the modality on `documentElement[data-access-modality]` and gates Proposals #39 (UnifiedToolbox/DraggableWidgetButtons) and #5 (FloatingRadiologyAnalyzer, draggable radiology button) without removing them — Classic hides floating widgets only (menu/page access preserved: the FHIR Radiology tab is visible in all modalities); Professional enables full set; Assisted mounts a minimal `AssistedLayout` shell with always-on IAM3D voice/visual assistant and an ephemeral narrative prompt (kept only in React state, never logged server-side). Selectable via `mode-selection` page (per-user) and Admin → "Modalidades de Acesso" tab (global default).

**Technical Implementations:**
- **AI Services:** Google Gemini API (with Replit OpenAI fallback) for chatbot, triage, video consultation support, medical records, and SOAP reports, adhering to medical guidelines (OMS, MS/Brasil, DSM-5/DSM-5-TR). AI prompt configurations are admin-manageable.
- **Video Consultations:** Agora for real-time video, audio, screen sharing, chat, AI diagnostic queries, transcription, and specialist invitations.
- **Patient Features:** AI-powered symptom triage, waiting room, prescription management, and medical record access.
- **Post-Consultation Workflow:** AI auto-generates prescriptions, exams, referrals, and follow-up items from clinical notes, requiring doctor review, with drug interaction analysis and inline editing capabilities.
- **WhatsApp IA:** Intelligent messaging for doctors with persistence and AI analysis.
- **Financial Management:** Comprehensive digital wallet with dashboards, transfers, and external integration.
- **Epidemiological Reports:** AI-powered analysis of clinical data using MeSH and ICD codes.
- **Medical Teams & Inter-Consultations:** Collaboration features for healthcare professionals.
- **External Medication Search & AI Generation:** Prescription forms integrate external databases (RxNorm/NIH, OpenFDA, ANVISA/RENAME) for treatment plan generation.
- **CRM/Professional License Verification:** Automated verification of medical registrations via external APIs (CFM, Ordem dos Médicos).
- **Digital Signature Verification:** Dual-path signature verification (ICP-Brasil A3, SignatureService) with public QR code verification.
- **Post-Consultation Diagnostic Classification:** AI extracts syndromic diagnostic hypotheses with CID-10/11 and DSM-5/TR codes.
- **Unified Payment Checkout:** Supports PayPal, Stripe, and PagBank.
- **Inactivity Detection & Auto-Logout:** Configurable timeout with session management and Agora disconnection.
- **Stale-Deploy Recovery (Safari hardening):** `client/src/lib/stale-chunk.ts` auto-recovers from "Importing a module script failed" after deploys: stale-chunk errors (vite:preloadError + ErrorBoundary) trigger a single cache-busting reload (`?__v=` param, 60s sessionStorage guard); a proactive version guard compares the client's hashed main-bundle path against `GET /api/version` (served no-store from `server/index.ts`; "dev" in development) on load, `pageshow persisted` (Safari BFCache) and visibilitychange, reloading before broken imports. Production HTML is served `no-cache, must-revalidate`; hashed assets `immutable`.
- **Admin Controls:** Mass user/service disconnection, user deactivation/activation.
- **Root Superuser & Admin Registration Approval:** Idempotent startup seed (`ensureRootSuperuser` in `server/routes.ts`) guarantees user `root` (role admin, `isProtected`, email lucasmedicina86@icloud.com; password set only on first creation, never reverted on redeploys). Self-registration accepts role `admin` but creates the account blocked (`deactivationReason` = pending root approval); no token/cookie issued and the frontend shows a "pending approval" toast instead of auto-login. Root (or any active admin) activates via existing `POST /api/admin/users/:userId/unblock`. Researcher self-registration is immediate.
- **Patient Data Export:** HL7 FHIR R4 compliant export (JSON/PDF) with de-identification.
- **Pharmacy Integration:** Module with pharmacist role, prescription verification, and dispensing.
- **Medical Records:** CFM/LGPD/RGPD-compliant structured digital medical records (PMD v1.0) with audit logs and a unified timeline view.
- **Clinic Management:** Multi-clinic support with shared patient records and revenue sharing.
- **FHIR R4 Dashboard & ECG/Radiology Analysis:** Medical dashboard with FHIR R4 CRUD, clinical history, and AI ECG/Radiology analysis featuring triple verification pipelines, color-coded annotations, and AI visualizations.
- **Profile Unification:** Automatic merging of temporary patient data and prevention of duplicate profiles.
- **Consultation Notification System:** Real-time room presence detection, urgency request panel for doctors, and WhatsApp notifications.
- **Clinical History Access Control:** Patient-facing records show AI-generated summaries; doctor access is role-scoped.
- **SUS Prontuário:** SUS-standard prontuário generation with full clinical sections and SOAP compliance verification.
- **General Waiting Room (Sala de Espera Geral / Urgência):** Patients join a doctor-agnostic queue (`consultation_requests.queue_type='general'`, `requested_urgent`) via `/api/waiting-room/join|status|leave` (join is idempotent, urgent→`very_urgent`, status polls position or admitted room). Doctors see general + directed pending requests in the doctor-office "Pacientes Aguardando" panel (queue/urgency badges, wait time) sorted by urgency rank then arrival; admitting atomically claims the request and routes both parties into the canonical `doctor-office-<doctorId>` channel.

## External Dependencies
- **Database:** PostgreSQL (Neon)
- **ORM:** Drizzle ORM
- **AI/ML:** Google Gemini API, Replit OpenAI AI Integrations
- **Video Conferencing:** Agora
- **Payment Processing:** PayPal, Stripe, PagBank