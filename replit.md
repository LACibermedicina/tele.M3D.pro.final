# Tele<M3D> - Sistema de Telemedicina

## Overview
Tele<M3D> is an AI-powered telemedicine platform designed to modernize healthcare delivery and improve patient-doctor interactions. It integrates traditional medical practice management with advanced telemedicine features such as multilingual support, video consultations, WhatsApp integration, automated scheduling, clinical decision support, and FIPS-compliant digital signatures. This responsive full-stack web application offers real-time communication, comprehensive patient data management, and an optimized mobile experience for both patients and doctors.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built with React and TypeScript, using Wouter for routing. It leverages Shadcn/ui components (based on Radix UI) styled with Tailwind CSS for a fully responsive, medical-themed design. State management is handled by TanStack React Query, form handling by React Hook Form with Zod validation, and real-time updates via a custom WebSocket hook. The UI features a warm autumn pastel color scheme with an animated origami-inspired background system on public-facing pages.

**Responsive Design System**:
- **Breakpoints**: Mobile (<768px), Tablet (768px-1024px), Desktop (>1024px)
- **Device Detection**: Custom hooks (useIsMobile, useIsTablet, useDeviceType) for device-specific rendering
- **Adaptive Layouts**: Conditional component rendering based on device type with separate mobile/desktop dashboard components
- **Tailwind Responsive Classes**: Extensive use of sm:, md:, lg:, xl: prefixes for responsive styling across ALL pages
- **Mobile Optimizations**: Touch-friendly interfaces with accessibility-compliant tap targets (44-48px minimum), optimized font sizes (text-xs sm:text-sm md:text-base), and gesture-aware scrolling
- **Flexible Grid Systems**: CSS Grid and Flexbox with responsive column adjustments:
  - Mobile: Single column layouts (grid-cols-1, flex-col)
  - Tablet: 2-column grids (sm:grid-cols-2, md:grid-cols-2) 
  - Desktop: 3-4 column grids (lg:grid-cols-3, lg:grid-cols-4)
- **Responsive Spacing**: Consistent spacing patterns across all pages:
  - Padding: p-3 sm:p-4 lg:p-6 sm:p-6 lg:p-8
  - Gaps: gap-3 sm:gap-4 lg:gap-6
  - Margins: mb-4 sm:mb-6 lg:mb-8
- **Typography Scaling**: Font sizes adapt to screen size across ALL pages:
  - Page Titles: text-2xl sm:text-3xl lg:text-4xl
  - Body text: text-sm sm:text-base
  - Small text: text-xs sm:text-sm
  - Icons: w-6 h-6 sm:w-8 sm:h-8 for headers
- **Video Call Responsiveness**: 
  - Consultation Session: w-12 h-12 (48px) mobile controls, w-14 h-14 (56px) tablet/desktop
  - Coffee Room: w-11 h-11 (44px) mobile controls, w-12 h-12 (48px) tablet/desktop
  - Adaptive video panels, resizable chat interfaces, and mobile-optimized layouts
  - Responsive padding (p-2 sm:p-4), spacing (gap-2 sm:gap-4), and icon scaling
- **Page-Specific Optimizations**:
  - Doctor Chat: Flex column on mobile (min-h-[500px]), grid layout on desktop (lg:h-[calc(100vh-200px)])
  - Immediate Consultation: Doctor cards stack vertically on mobile (flex-col sm:flex-row)
  - Medical Teams: Header flex-col sm:flex-row with responsive typography
  - Consultation Request: Responsive containers (px-3 sm:px-6 lg:px-8) and adaptive spacing
  - Patient Agenda: Responsive grid (grid-cols-1 lg:grid-cols-3) with adaptive padding
  - Medical Records: Flex-col sm:flex-row header layout with responsive text
  - Admin Page: Responsive analytics grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)
  - All forms and inputs: Optimized for mobile with text-sm classes and proper spacing
- **Theme Consistency**: All color schemes and themes work seamlessly across all device sizes in both light and dark modes

**Visual Design System**:
- **Animated Origami Background**: Canvas API-based polygons (0.25 opacity) with rotation animation and floating SVG shapes (triangles, diamonds, pentagons)
- **Enhanced Contrast**: Radial gradient dark mask (5-15% darkening) overlaying the background for improved text readability
- **Card Design**: Semi-transparent cards (98% opacity) with backdrop blur and enhanced shadows for depth separation
- **Page Variants**: 
  - "origami" variant for all public pages (login, features, registration pages) and ALL authenticated pages (dashboard, doctor-availability, immediate-consultation, doctor-chat, patients, schedule, whatsapp, consultation-request, my-consultations, coffee-room, doctor-office, medical-teams, medical-cafe, team-room)
  - "medical" variant for documentation and content-heavy pages with medical imagery
- **Complete Visual Consistency**: 
  - ALL authenticated pages use PageWrapper with variant="origami" and origamiImage={origamiHeroImage} for unified autumn pastel theme
  - Autumn pastel color scheme (warm oranges, soft greens, terracotta accents) is applied consistently across the entire platform
  - Every area of the system - public and restricted - shares the same visual identity and background animation
  - Seamless visual transition between authentication and authenticated states maintains user experience continuity
- **Dynamic Header Colors**: The header intelligently adjusts colors based on page type and scroll state:
  - Authenticated pages (not scrolled): Dark text/icons/logo (light mode) or white text/icons/logo (dark mode) for contrast with light background
  - Authenticated pages (scrolled): White text/icons/logo with dark background
  - Public pages (home/login): Always white text/icons/logo with diffuse shadow when not scrolled
  - All states maintain proper contrast ratios for accessibility in both light and dark modes

### Backend Architecture
The server is a RESTful API built with Node.js and Express.js, using TypeScript in ESModule format. It includes middleware for JSON parsing, CORS, and request logging. A WebSocket server provides live updates. API endpoints are domain-organized, and centralized error handling ensures structured error responses.

### Data Storage Solutions
The application uses PostgreSQL with Drizzle ORM and Neon serverless driver. The schema includes entities for users, patients, appointments, medical records, WhatsApp messages, exam results, and digital signatures. Drizzle-Zod integration provides runtime type checking and API validation.

### Authentication and Authorization
Security is implemented with user-based authentication and role-based access control (doctor, admin, patient), aiming for healthcare compliance. It incorporates FIPS 140-2 Level 3 compliance indicators, integrated digital certificate management for document signing, and PostgreSQL-based session management.

### Key Features
- **AI Clinical Assistant**: Integration with the Gemini API for diagnostic support, medication interaction analysis, and clinical Q&A, prioritizing medical PDF references for responses.
- **WhatsApp Integration**: Automated patient communication.
- **Real-time Dashboards**: Simplified dashboards displaying production-backed statistics.
- **Medical Records Management**: Strict role-based access control.
- **Appointment Scheduling**: AI-powered scheduling with various appointment types.
- **Digital Document Signing**: A system for FIPS-compliant digital signatures for medical documents with QR code verification (note: current private key storage is not production-ready for FIPS compliance).
- **Video Consultation Feature**: Real-time video/audio using Agora.io with multi-tab panels for chat, AI diagnostics, and doctor notes.
- **TMC Credits System**: Manages credit purchases, debits, transfers, and commissions, with PayPal integration for secure purchases.
- **Enhanced Registration & Profile Management**: Role-based registration with mandatory fields and secure profile picture uploads.
- **AI Reference Management**: Admin-only PDF upload system for AI knowledge base with secure file validation and role-based access control.
- **Comprehensive Error Handling**: User-friendly error messages with practical suggestions for common HTTP errors, and an admin error logging system for detailed error tracking and resolution.
- **Database Cleanup Endpoint**: Admin-only endpoint for removing test data with strict confirmation.
- **Visitor Chatbot**: Publicly accessible AI chatbot with limited, safe functionality, referencing public medical PDFs.
- **Guest Access Control**: Visitors (non-authenticated users) can view available services but cannot schedule appointments directly - they are prompted to login or register first.
- **Doctor Availability Management**: Doctors can set weekly schedules, mark themselves as online, and enable/disable immediate consultation availability. Includes real-time status tracking and flexible scheduling with configurable consultation durations.
- **24-Hour On-Call (Plantão) System**: Doctors can activate a 24-hour on-call shift that automatically marks them as online/available when they login during the shift period. Features auto-countdown timer, priority display for on-duty doctors in patient consultation requests, and seamless scheduling with 15-minute interval appointments.
- **Immediate Consultation System**: Patients can request instant consultations with doctors who are currently online and available, with auto-refresh to show real-time doctor availability, priority routing to on-duty doctors, and direct appointment creation for emergency needs.
- **Doctor-Patient Chat System**: Real-time messaging between doctors and patients with pending consultation requests. Doctors can view patient medical history, send messages, and initiate video consultations directly from the chat interface. Only patients with open consultation requests (pending or accepted) linked to the specific doctor appear in the chat. Consultation requests are automatically created when appointments are scheduled through any channel (immediate consultation, chatbot, WhatsApp, or manual scheduling), ensuring seamless communication flow.
- **AI-Powered Drug Interaction Checker**: Comprehensive medication safety analysis using Gemini AI that evaluates each prescribed medication against patient profile, medical history, and other medications. The system generates detailed reports with active ingredient summaries, drug-drug interactions with risk percentages, side effect probabilities, patient-specific risk factors, and visual bar charts showing adverse effect distributions. Results are displayed in an interactive dialog with color-coded risk levels and comprehensive medication safety insights.
- **Open Doctor Office System**: Doctors can open a virtual consultation room that creates a persistent video channel. When doctors click "Abrir Consultório" (Open Office), they become available for immediate consultations. Patients requesting emergency care or immediate consultation automatically enter the doctor's open office video room, enabling instant real-time video communication without scheduling delays. The system uses named Agora channels (`doctor-office-{doctorId}`) for persistent room access, automatically creates appointments and consultation records, and broadcasts office status changes via WebSocket for real-time availability updates.
- **WhatsApp Consultation Invites**: Doctors can invite patients for consultations directly from the patient list using a WhatsApp icon button. The feature allows selecting date, time, and sending personalized invitation messages. Messages are formatted with appointment details (date, time) in Brazilian Portuguese format and sent via WhatsApp Business API, with automatic storage in the conversation history.
- **QR Code Document Access**: Medical records and prescriptions feature QR code generation for quick document access. Users can generate QR codes that link directly to specific documents, download the QR code image, or copy the access URL. The QR codes are displayed in a modal dialog with clear instructions for sharing. This feature enables easy document sharing with patients, pharmacies, or other healthcare providers while maintaining secure access through authentication.
- **Real Doctor Profile Dashboard**: The mobile doctor dashboard displays authentic user data including profile picture (profilePicture), medical specialization, CRM license number, and real-time statistics from the database. All hardcoded placeholder data has been replaced with live information from user sessions and API endpoints, ensuring accurate representation of each doctor's practice.
- **Video Call Controls and Chat**: Both the coffee room and consultation session video calls feature complete video/audio toggle controls using Agora SDK's setEnabled() method for camera and microphone management. Real-time text chat functionality is integrated directly into video calls, allowing participants to exchange messages during consultations and coffee room sessions with timestamped messages and auto-scroll behavior.

## External Dependencies

### Third-party Services
- **Neon Database**: Serverless PostgreSQL hosting.
- **Google Gemini API**: Gemini 1.5 Flash model for AI features.
- **WhatsApp Business API**: Meta's official integration for messaging.
- **Agora.io**: Real-time video/audio communication SDK.
- **PayPal**: Payment gateway for credit purchases.

### Development and Build Tools
- **Vite**: Frontend build tool.
- **ESBuild**: Backend bundling.
- **Drizzle Kit**: Database migration and schema management.
- **PostCSS**: CSS processing.

### UI and Component Libraries
- **Radix UI**: Accessible React components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **React Hook Form**: Form state management.
- **TanStack React Query**: Server state management.

### Security and Compliance
- **Zod**: TypeScript-first schema validation.
- **Date-fns**: Date manipulation library.