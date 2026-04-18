import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Default doctor ID for development environment (proper UUID format)
export const DEFAULT_DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440000';

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("visitor"), // admin, patient, doctor, visitor, researcher, pharmacist
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  document: text("document"),
  documentCountry: text("document_country"),
  tmcCredits: integer("tmc_credits").default(0), // Digital credits balance
  digitalCertificate: text("digital_certificate"), // For FIPS compliance
  profilePicture: text("profile_picture"),
  isBlocked: boolean("is_blocked").default(false),
  blockedBy: uuid("blocked_by"),
  deactivationReason: text("deactivation_reason"),
  isProtected: boolean("is_protected").default(false),
  superiorDoctorId: uuid("superior_doctor_id"),
  hierarchyLevel: integer("hierarchy_level").default(0),
  inviteQrCode: text("invite_qr_code"),
  percentageFromInferiors: integer("percentage_from_inferiors").default(10), // Percentage received from hierarchical inferiors
  medicalLicense: text("medical_license"), // CRM number for doctors
  medicalLicenseState: text("medical_license_state"), // UF/State for CRM
  crmVerificationStatus: text("crm_verification_status").default("unverified"), // unverified, pending, verified, failed, invalid, expired
  crmVerifiedAt: timestamp("crm_verified_at"),
  crmVerificationData: jsonb("crm_verification_data"), // API response data from verification
  specialization: text("specialization"),
  lastLogin: timestamp("last_login"),
  totalUsageSeconds: integer("total_usage_seconds").default(0),
  lastSessionStart: timestamp("last_session_start"),
  forceLogoutAt: timestamp("force_logout_at"),
  isOnline: boolean("is_online").default(false), // Doctor online status
  availableForImmediate: boolean("available_for_immediate").default(false), // Available for immediate consultations
  onlineSince: timestamp("online_since"), // When doctor went online
  consultationPrice: integer("consultation_price").default(0),
  onDutyUntil: timestamp("on_duty_until"),
  onDutyStartedAt: timestamp("on_duty_started_at"),
  accessModality: text("access_modality"), // 'classic' | 'professional' | 'assisted' | null (use global default)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ACCESS_MODALITIES = ['classic', 'professional', 'assisted'] as const;
export type AccessModality = typeof ACCESS_MODALITIES[number];
export const accessModalitySchema = z.enum(ACCESS_MODALITIES);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).unique(), // Link to user account (for patient login)
  primaryDoctorId: uuid("primary_doctor_id").references(() => users.id), // Assigned primary physician
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  bloodType: text("blood_type"),
  allergies: text("allergies"),
  medicalHistory: jsonb("medical_history"),
  whatsappNumber: text("whatsapp_number"),
  photoUrl: text("photo_url"),
  document: text("document"),
  documentCountry: text("document_country"),
  isTemporary: boolean("is_temporary").default(false),
  mergedIntoPatientId: uuid("merged_into_patient_id"),
  healthStatus: text("health_status").default("a_determinar").notNull(), // excelente, bom, regular, critico, a_determinar
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  type: text("type").notNull(), // consultation, followup, emergency
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, rescheduled
  notes: text("notes"),
  aiScheduled: boolean("ai_scheduled").default(false),
  videoCallUrl: text("video_call_url"),
  audioTranscript: text("audio_transcript"),
  rating: integer("rating"), // 1-5 stars rating from patient (CHECK constraint added in DB)
  feedback: text("feedback"), // Patient feedback text
  rescheduledFromId: uuid("rescheduled_from_id"), // Original appointment ID if rescheduled (no FK to avoid circular ref)
  rescheduledToId: uuid("rescheduled_to_id"), // New appointment ID if rescheduled (no FK to avoid circular ref)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const medicalRecords = pgTable("medical_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  diagnosis: text("diagnosis"),
  symptoms: text("symptoms"),
  treatment: text("treatment"),
  prescription: text("prescription"),
  observations: text("observations"),
  diagnosticHypotheses: jsonb("diagnostic_hypotheses"),
  audioTranscript: text("audio_transcript"),
  isEncrypted: boolean("is_encrypted").default(true),
  digitalSignature: text("digital_signature"),
  pmdData: jsonb("pmd_data"),
  pmdAuditLogs: jsonb("pmd_audit_logs").default(sql`'[]'::jsonb`),
  pmdVersion: text("pmd_version").default("1.0"),
  patientFriendlyVersion: text("patient_friendly_version"),
  patientFriendlyActive: boolean("patient_friendly_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id),
  doctorId: uuid("doctor_id").references(() => users.id), // The doctor in the conversation
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  message: text("message").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, image, audio
  direction: text("direction").notNull().default("inbound"), // inbound (patient->system), outbound (system->patient), doctor_to_patient, patient_to_doctor
  senderRole: text("sender_role"), // patient, doctor, system, ai
  isFromAI: boolean("is_from_ai").default(false),
  appointmentScheduled: boolean("appointment_scheduled").default(false),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  processed: boolean("processed").default(false),
  isRead: boolean("is_read").default(false), // Whether recipient has read the message
  readAt: timestamp("read_at"), // When message was read
  deliveredToWhatsApp: boolean("delivered_to_whatsapp").default(false), // If message was sent via WhatsApp API
  whatsappMessageId: text("whatsapp_message_id"), // WhatsApp API message ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examResults = pgTable("exam_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  examType: text("exam_type").notNull(),
  results: jsonb("results").notNull(), // Structured data extracted by AI
  rawData: text("raw_data"), // Original file content
  fileUrl: text("file_url"),
  analyzedByAI: boolean("analyzed_by_ai").default(true),
  abnormalValues: jsonb("abnormal_values"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collaborators = pgTable("collaborators", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // pharmacy, laboratory, hospital, clinic
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  cnpj: text("cnpj"), // Brazilian tax ID for healthcare institutions
  cnes: text("cnes"), // Brazilian National Registry of Healthcare Establishments
  licenseNumber: text("license_number"), // Professional/institutional license
  specialization: text("specialization"), // e.g., cardiology, orthopedics for hospitals
  isOnline: boolean("is_online").default(false),
  isActive: boolean("is_active").default(true),
  apiEndpoint: text("api_endpoint"),
  credentials: text("credentials"), // Encrypted API credentials
  integrationConfig: jsonb("integration_config"), // Configuration for specific integration type
  complianceStatus: text("compliance_status").default("pending"), // pending, approved, suspended
  lastHealthCheck: timestamp("last_health_check"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prescription sharing with pharmacies
export const prescriptionShares = pgTable("prescription_shares", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  medicalRecordId: uuid("medical_record_id").references(() => medicalRecords.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  pharmacyId: uuid("pharmacy_id").references(() => collaborators.id).notNull(),
  prescriptionText: text("prescription_text").notNull(),
  digitalSignatureId: uuid("digital_signature_id").references(() => digitalSignatures.id),
  status: text("status").notNull().default("shared"), // shared, dispensed, partially_dispensed, cancelled
  shareMethod: text("share_method").notNull().default("api"), // api, manual, qr_code
  accessCode: text("access_code"), // Secure code for patient verification
  expiresAt: timestamp("expires_at"), // Prescription expiry
  dispensedAt: timestamp("dispensed_at"),
  dispensingNotes: text("dispensing_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Laboratory orders and results
export const labOrders = pgTable("lab_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  laboratoryId: uuid("laboratory_id").references(() => collaborators.id).notNull(),
  orderDetails: text("order_details").notNull(), // Tests requested
  urgency: text("urgency").default("routine"), // routine, urgent, stat
  status: text("status").notNull().default("ordered"), // ordered, collected, processing, completed, cancelled
  externalOrderId: text("external_order_id"), // ID from laboratory system
  collectionDate: timestamp("collection_date"),
  expectedResultDate: timestamp("expected_result_date"),
  completedAt: timestamp("completed_at"),
  results: jsonb("results"), // Structured test results
  resultsFileUrl: text("results_file_url"), // PDF or file link
  criticalValues: boolean("critical_values").default(false),
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Hospital referrals and transfers
export const hospitalReferrals = pgTable("hospital_referrals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  referringDoctorId: uuid("referring_doctor_id").references(() => users.id).notNull(),
  hospitalId: uuid("hospital_id").references(() => collaborators.id).notNull(),
  specialty: text("specialty").notNull(), // Target specialty/department
  urgency: text("urgency").notNull().default("routine"), // routine, urgent, emergency
  reason: text("reason").notNull(), // Reason for referral
  clinicalSummary: text("clinical_summary"), // Patient condition summary
  requestedServices: text("requested_services"), // Specific services needed
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, completed
  externalReferralId: text("external_referral_id"), // ID from hospital system
  scheduledDate: timestamp("scheduled_date"),
  completedAt: timestamp("completed_date"),
  dischargeNotes: text("discharge_notes"), // Summary after treatment
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration monitoring and audit trail
export const collaboratorIntegrations = pgTable("collaborator_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  collaboratorId: uuid("collaborator_id").references(() => collaborators.id).notNull(),
  integrationType: text("integration_type").notNull(), // prescription_share, lab_order, hospital_referral
  entityId: uuid("entity_id").notNull(), // ID of the related prescription/order/referral
  action: text("action").notNull(), // create, update, query, cancel
  status: text("status").notNull(), // success, failed, pending, timeout
  requestData: jsonb("request_data"), // Data sent to external system
  responseData: jsonb("response_data"), // Response from external system
  errorMessage: text("error_message"),
  responseTime: integer("response_time"), // milliseconds
  retryCount: integer("retry_count").default(0),
  processedBy: text("processed_by"), // system, user_id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// API authentication for external collaborators
export const collaboratorApiKeys = pgTable("collaborator_api_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  collaboratorId: uuid("collaborator_id").references(() => collaborators.id).notNull(),
  keyName: text("key_name").notNull(), // Friendly name for the key
  hashedKey: text("hashed_key").notNull(), // Hashed version of the API key
  permissions: jsonb("permissions").notNull(), // Array of allowed actions/endpoints
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  ipWhitelist: text("ip_whitelist").array(), // Allowed IP addresses
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const doctorSchedule = pgTable("doctor_schedule", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6, Sunday to Saturday
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time").notNull(), // HH:MM format
  consultationDuration: integer("consultation_duration").default(30), // minutes
  isActive: boolean("is_active").default(true),
});

export const digitalSignatures = pgTable("digital_signatures", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentType: text("document_type").notNull(), // prescription, exam_request, medical_certificate
  documentId: uuid("document_id").notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  digitalKeyId: uuid("digital_key_id").references(() => digitalKeys.id), // Which key was used
  documentHash: text("document_hash").notNull(), // SHA-256 hash of document
  signature: text("signature").notNull(), // Encrypted signature
  certificateInfo: jsonb("certificate_info"),
  qrCodeData: text("qr_code_data"), // QR code content for verification
  qrCodeUrl: text("qr_code_url"), // URL to QR code image
  verificationUrl: text("verification_url"), // Public URL to verify signature
  status: text("status").notNull().default("pending"), // pending, signed, rejected, verified
  signedAt: timestamp("signed_at"),
  verificationCount: integer("verification_count").default(0), // How many times verified
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoConsultations = pgTable("video_consultations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: uuid("appointment_id").references(() => appointments.id), // nullable for direct patient calls
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  sessionId: text("session_id").notNull().unique().default(sql`gen_random_uuid()`), // Auto-generated WebRTC session identifier
  agoraChannelName: text("agora_channel_name"), // Agora channel for video/audio
  agoraAppId: text("agora_app_id"), // Agora application ID
  status: text("status").notNull().default("waiting"), // waiting, active, ended, cancelled
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  recordingUrl: text("recording_url"),
  audioRecordingUrl: text("audio_recording_url"),
  transcriptionStatus: text("transcription_status").default("pending"), // pending, processing, completed, failed
  fullTranscript: text("full_transcript"),
  meetingNotes: text("meeting_notes"),
  duration: integer("duration"), // in seconds
  participants: jsonb("participants"), // WebRTC participant data
  connectionLogs: jsonb("connection_logs"), // Connection quality and issues
  isRecorded: boolean("is_recorded").default(false),
  encryptionEnabled: boolean("encryption_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Consultation notes: chat messages, AI queries, doctor notes during video consultation
export const consultationNotes = pgTable("consultation_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  consultationId: uuid("consultation_id").references(() => videoConsultations.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(), // Who created the note/message
  type: text("type").notNull(), // chat, ai_query, doctor_note, ai_response
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Additional data (AI query parameters, chat sender info, etc.)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Consultation recordings: video segments and their metadata
export const consultationRecordings = pgTable("consultation_recordings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  consultationId: uuid("consultation_id").references(() => videoConsultations.id).notNull(),
  segmentUrl: text("segment_url").notNull(), // URL to video segment
  startTime: timestamp("start_time").notNull(), // When this segment started
  endTime: timestamp("end_time"), // When this segment ended
  duration: integer("duration"), // Duration in seconds
  segmentType: text("segment_type").default("video"), // video, audio, screen_share
  fileSize: integer("file_size"), // Size in bytes
  isProcessed: boolean("is_processed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TMC Credit System
export const tmcTransactions = pgTable("tmc_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // debit, credit, recharge, transfer, commission
  amount: integer("amount").notNull(), // Can be negative for debits
  reason: text("reason").notNull(), // consultation, prescription, data_access, etc.
  relatedUserId: uuid("related_user_id").references(() => users.id), // For commissions and transfers
  functionUsed: text("function_used"), // Which feature was used
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  medicalRecordId: uuid("medical_record_id").references(() => medicalRecords.id),
  metadata: jsonb("metadata"), // Additional transaction details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TMC System Configuration
export const tmcConfig = pgTable("tmc_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  functionName: text("function_name").notNull().unique(),
  costInCredits: integer("cost_in_credits").notNull(),
  description: text("description"),
  category: text("category").notNull(), // consultation, prescription, data_access, admin
  isActive: boolean("is_active").default(true),
  minimumRole: text("minimum_role").default("visitor"), // Minimum role required
  bonusForPatient: integer("bonus_for_patient").default(0), // Credits patient receives when their data is accessed
  commissionPercentage: integer("commission_percentage").default(10), // For hierarchical doctors
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cashbox - Admin managed system treasury
export const cashbox = pgTable("cashbox", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  balance: integer("balance").notNull().default(0), // Current balance in credits
  totalRevenue: integer("total_revenue").notNull().default(0), // Total revenue collected
  totalExpenses: integer("total_expenses").notNull().default(0), // Total expenses paid
  serverCosts: integer("server_costs").notNull().default(0), // Server maintenance costs
  description: text("description"), // Description of the cashbox entry
  metadata: jsonb("metadata"), // Additional details (user count, consultation count, etc.)
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cashbox Transactions - Track all cashbox movements
export const cashboxTransactions = pgTable("cashbox_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // revenue, expense, server_cost, adjustment
  amount: integer("amount").notNull(), // Amount in credits
  description: text("description").notNull(),
  relatedTransactionId: uuid("related_transaction_id").references(() => tmcTransactions.id), // Link to user transaction
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  metadata: jsonb("metadata"), // Additional transaction details
  performedBy: uuid("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot Configuration and References
export const chatbotReferences = pgTable("chatbot_references", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // medical, procedural, emergency, general, diagnostic
  keywords: text("keywords").array(), // Keywords for AI matching
  priority: integer("priority").default(1), // Higher priority = used first
  source: text("source"), // Reference source (medical guidelines, etc.)
  sourceType: text("source_type").notNull().default("text"), // text, pdf, url, internet
  fileUrl: text("file_url"), // URL to uploaded PDF or file
  fileName: text("file_name"), // Original file name
  fileSize: integer("file_size"), // File size in bytes
  pdfExtractedText: text("pdf_extracted_text"), // Full text extracted from PDF
  isActive: boolean("is_active").default(true),
  language: text("language").default("pt"), // Language of content
  allowedRoles: text("allowed_roles").array().default(sql`ARRAY['admin', 'doctor', 'patient']::text[]`), // Which roles can use this reference
  useForDiagnostics: boolean("use_for_diagnostics").default(false), // Use for diagnostic consultations
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chatbot Conversations - Store chat history
export const chatbotConversations = pgTable("chatbot_conversations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  userRole: text("user_role").notNull(), // patient, doctor, admin
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`), // Array of {role: 'user'|'assistant', content: string, timestamp: string}
  context: text("context"), // patient_health_query, doctor_diagnostics, medical_guidelines
  referencesUsed: text("references_used").array(), // IDs of chatbotReferences used
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Laboratory Templates for PDF Processing
// Support System Configuration
export const supportConfig = pgTable("support_config", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  whatsappNumber: text("whatsapp_number"), // Support WhatsApp number
  supportEmail: text("support_email").default("info@interligas.org"),
  samuWhatsapp: text("samu_whatsapp").default("5517933004006"), // (17) 93300-4006
  samuOnlineUrl: text("samu_online_url").default("https://samu.saude.gov.br/emergencia"),
  supportChatbotEnabled: boolean("support_chatbot_enabled").default(true),
  emergencyGeolocationEnabled: boolean("emergency_geolocation_enabled").default(true),
  paraguayEmergencyNumber: text("paraguay_emergency_number").default("911"),
  emergencySmsEnabled: boolean("emergency_sms_enabled").default(true),
  businessHours: jsonb("business_hours"), // Support hours configuration
  autoResponderEnabled: boolean("auto_responder_enabled").default(true),
  autoResponderMessage: text("auto_responder_message").default("Obrigado por entrar em contato! Nossa equipe responderá em breve."),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System Settings - General application configuration
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingType: text("setting_type").notNull().default("string"), // string, number, boolean, json
  description: text("description"),
  category: text("category").notNull(), // scheduling, ai, notifications, general
  isEditable: boolean("is_editable").default(true),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const labTemplates = pgTable("lab_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  laboratoryName: text("laboratory_name").notNull(),
  templateName: text("template_name").notNull(),
  fieldMappings: jsonb("field_mappings").notNull(), // JSON mapping of PDF fields to database
  extractionRules: jsonb("extraction_rules").notNull(), // Rules for text extraction
  validationRules: jsonb("validation_rules"), // Data validation rules
  samplePdfUrl: text("sample_pdf_url"), // Example PDF for testing
  isActive: boolean("is_active").default(true),
  successRate: integer("success_rate").default(0), // Percentage of successful extractions
  lastTested: timestamp("last_tested"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clinical Interview Templates
export const clinicalInterviews = pgTable("clinical_interviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id),
  userId: uuid("user_id").references(() => users.id), // Who initiated (can be visitor)
  currentStage: integer("current_stage").default(1),
  totalStages: integer("total_stages").default(7),
  responses: jsonb("responses").notNull(), // Array of user responses
  symptoms: jsonb("symptoms"), // Extracted symptoms data
  urgencyLevel: text("urgency_level").default("low"), // low, medium, high, emergency
  aiAnalysis: jsonb("ai_analysis"), // AI diagnostic hypotheses
  isCompleted: boolean("is_completed").default(false),
  requiresEmergency: boolean("requires_emergency").default(false),
  sessionToken: text("session_token").unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Enhanced Prescription System
export const medications = pgTable("medications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  genericName: text("generic_name").notNull(),
  brandNames: text("brand_names").array(),
  activeIngredient: text("active_ingredient").notNull(),
  dosageForm: text("dosage_form").notNull(), // tablet, capsule, syrup, injection, etc.
  strength: text("strength").notNull(), // mg, ml, etc.
  route: text("route").notNull(), // oral, topical, intravenous, etc.
  category: text("category").notNull(), // antibiotic, analgesic, etc.
  indication: text("indication").array(), // What it treats
  contraindications: text("contraindications").array(),
  sideEffects: text("side_effects").array(),
  pregnancyCategory: text("pregnancy_category"), // A, B, C, D, X
  requiresPrescription: boolean("requires_prescription").default(true),
  isControlled: boolean("is_controlled").default(false),
  controlledSubstanceClass: text("controlled_substance_class"), // I, II, III, IV, V
  registrationNumber: text("registration_number"), // ANVISA registration
  manufacturer: text("manufacturer"),
  isActive: boolean("is_active").default(true),
  interactions: jsonb("interactions"), // Drug interactions data
  dosageGuidelines: jsonb("dosage_guidelines"), // Age/weight-based dosing
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  medicalRecordId: uuid("medical_record_id").references(() => medicalRecords.id),
  appointmentId: uuid("appointment_id").references(() => appointments.id),
  prescriptionNumber: text("prescription_number").unique().notNull(),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // active, dispensed, cancelled, expired
  isElectronic: boolean("is_electronic").default(true),
  digitalSignatureId: uuid("digital_signature_id").references(() => digitalSignatures.id),
  isUrgent: boolean("is_urgent").default(false),
  allowGeneric: boolean("allow_generic").default(true),
  specialInstructions: text("special_instructions"),
  expiresAt: timestamp("expires_at"),
  dispensedAt: timestamp("dispensed_at"),
  pharmacistId: uuid("pharmacist_id").references(() => users.id),
  pharmacistReadAt: timestamp("pharmacist_read_at"),
  tmcCostPaid: integer("tmc_cost_paid").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prescriptionItems = pgTable("prescription_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id).notNull(),
  medicationId: uuid("medication_id").references(() => medications.id),
  dosage: text("dosage").notNull(), // "500mg"
  frequency: text("frequency").notNull(), // "3 times daily", "every 8 hours"
  duration: text("duration").notNull(), // "7 days", "until finished"
  quantity: integer("quantity").notNull(), // Total quantity to dispense
  instructions: text("instructions").notNull(), // "Take with food"
  customMedication: text("custom_medication"), // For non-database medications
  isGenericAllowed: boolean("is_generic_allowed").default(true),
  priority: integer("priority").default(1), // Order in prescription
  isDispensed: boolean("is_dispensed").default(false),
  dispensedQuantity: integer("dispensed_quantity").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prescriptionTemplates = pgTable("prescription_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "common_cold", "hypertension", etc.
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false), // Available to all doctors
  templateData: jsonb("template_data").notNull(), // Structured template with medications
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const drugInteractions = pgTable("drug_interactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  medication1Id: uuid("medication1_id").references(() => medications.id).notNull(),
  medication2Id: uuid("medication2_id").references(() => medications.id).notNull(),
  severity: text("severity").notNull(), // minor, moderate, major, contraindicated
  effect: text("effect").notNull(), // Description of interaction
  mechanism: text("mechanism"), // How the interaction occurs
  management: text("management"), // How to manage the interaction
  evidence: text("evidence").default("theoretical"), // theoretical, possible, probable, established
  isActive: boolean("is_active").default(true),
  source: text("source"), // Reference source
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Layout and theme settings (admin-configurable)
export const layoutSettings = pgTable("layout_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(), // background_image, primary_color, theme_mode, etc.
  settingValue: text("setting_value"), // JSON string or simple value
  settingType: text("setting_type").notNull().default("text"), // text, color, image, json
  category: text("category").notNull().default("general"), // general, theme, background, typography
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Error logging for admin monitoring
export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  errorCode: text("error_code").notNull().unique(), // ERR-YYYYMMDD-XXXX format
  userId: uuid("user_id").references(() => users.id), // Optional user who triggered the error
  errorType: text("error_type").notNull(), // authentication, validation, database, external_api, internal, etc.
  endpoint: text("endpoint"), // Which API endpoint
  method: text("method"), // GET, POST, etc.
  technicalMessage: text("technical_message").notNull(), // Full technical error message
  userMessage: text("user_message").notNull(), // Friendly message shown to user
  stackTrace: text("stack_trace"), // Full stack trace
  context: jsonb("context"), // Additional context data
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  resolved: boolean("resolved").default(false),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Patient personal agenda and notes
export const patientNotes = pgTable("patient_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(), // Who created the note (patient or admin)
  date: timestamp("date").notNull(), // Date the note refers to
  title: text("title"),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").default(true), // Only patient and admin can see
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Doctor Notes (macOS Notes-style personal notes for doctors)
export const doctorNotes = pgTable("doctor_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id),
  title: text("title").default("").notNull(),
  content: text("content").default("").notNull(),
  folder: text("folder").default("all").notNull(),
  color: text("color").default("default").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// TMC Credit Packages for purchase via PayPal
export const tmcCreditPackages = pgTable("tmc_credit_packages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Pacote Básico", "Pacote Premium"
  credits: integer("credits").notNull(), // Number of credits in package
  priceUsd: text("price_usd").notNull(), // Price in USD (stored as string for precision)
  priceBrl: text("price_brl"), // Price in BRL (optional)
  bonusCredits: integer("bonus_credits").default(0), // Extra promotional credits
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isPromotional: boolean("is_promotional").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PayPal Orders for credit purchases
export const paypalOrders = pgTable("paypal_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  packageId: uuid("package_id").references(() => tmcCreditPackages.id),
  paypalOrderId: text("paypal_order_id").notNull().unique(), // PayPal's order ID
  amount: text("amount").notNull(), // Amount charged
  currency: text("currency").notNull().default("USD"),
  creditsAmount: integer("credits_amount").notNull(), // Credits to be added
  status: text("status").notNull().default("created"), // created, approved, captured, failed, cancelled
  payerEmail: text("payer_email"),
  payerId: text("payer_id"),
  captureId: text("capture_id"), // PayPal capture ID after payment
  errorMessage: text("error_message"),
  transactionId: uuid("transaction_id").references(() => tmcTransactions.id), // Link to credit transaction
  metadata: jsonb("metadata"), // Additional PayPal response data
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Digital Keys for doctors (FIPS-compliant signature system)
export const digitalKeys = pgTable("digital_keys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: uuid("doctor_id").references(() => users.id).notNull().unique(), // One key per doctor
  publicKey: text("public_key").notNull(), // PEM format public key
  privateKeyEncrypted: text("private_key_encrypted").notNull(), // Encrypted private key (never store plain)
  keyAlgorithm: text("key_algorithm").notNull().default("RSA"), // RSA or ECC
  keySize: integer("key_size").default(2048), // Key size in bits
  certificateInfo: jsonb("certificate_info"), // Certificate metadata
  isActive: boolean("is_active").default(true),
  isExportedToUsb: boolean("is_exported_to_usb").default(false),
  usbExportedAt: timestamp("usb_exported_at"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"), // Key expiration date
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Signature Verifications for public QR code validation
export const signatureVerifications = pgTable("signature_verifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureId: uuid("signature_id").references(() => digitalSignatures.id).notNull(),
  verifiedBy: text("verified_by"), // IP address or user identifier
  verificationMethod: text("verification_method").notNull().default("qr_code"), // qr_code, direct_link, api
  isValid: boolean("is_valid").notNull(),
  validationDetails: jsonb("validation_details"), // Detailed verification results
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  geolocation: jsonb("geolocation"), // Optional location data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Consultation Requests - AI-powered consultation triage and scheduling
export const consultationRequests = pgTable("consultation_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  symptoms: text("symptoms").notNull(), // Patient's description of symptoms
  aiAnalysis: jsonb("ai_analysis"), // AI analysis of symptoms + medical history
  clinicalPresentation: text("clinical_presentation"), // AI-generated summary for doctor
  urgencyLevel: text("urgency_level").notNull().default("standard"), // emergency, very_urgent, urgent, standard, non_urgent
  recommendedDoctors: jsonb("recommended_doctors"), // Array of suggested doctor IDs with reasoning
  selectedDoctorId: uuid("selected_doctor_id").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, scheduled, cancelled
  whatsappNotificationSent: boolean("whatsapp_notification_sent").default(false),
  acceptedAt: timestamp("accepted_at"),
  scheduledAppointmentId: uuid("scheduled_appointment_id").references(() => appointments.id),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Consultation Sessions - Collaborative consultation rooms with specialists
export const consultationSessions = pgTable("consultation_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  consultationId: uuid("consultation_id").references(() => videoConsultations.id).notNull(),
  primaryDoctorId: uuid("primary_doctor_id").references(() => users.id).notNull(),
  invitedSpecialists: jsonb("invited_specialists"), // Array of specialist user IDs
  activeParticipants: jsonb("active_participants"), // Current participants in session
  privateChat: jsonb("private_chat").default(sql`'[]'::jsonb`), // Team chat messages
  sessionNotes: jsonb("session_notes").default(sql`'[]'::jsonb`), // Collaborative notes
  audioTranscripts: jsonb("audio_transcripts").default(sql`'[]'::jsonb`), // Audio→text segments
  aiClinicalSummary: text("ai_clinical_summary"), // AI-generated summary from transcripts
  status: text("status").notNull().default("active"), // active, completed, cancelled
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clinical Assets - Patient exam uploads with AI extraction
export const clinicalAssets = pgTable("clinical_assets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id), // Patient or doctor
  assetType: text("asset_type").notNull(), // lab_result, imaging_study, vital_signs, medical_report
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  extractedData: jsonb("extracted_data"), // AI-extracted structured data (glucose, hemoglobin, etc.)
  interpretableMetrics: jsonb("interpretable_metrics"), // Converted to chartable format
  abnormalFindings: jsonb("abnormal_findings"), // Highlighted anomalies
  aiAnalysis: text("ai_analysis"), // AI interpretation of results
  vitalSigns: jsonb("vital_signs"), // If asset contains vitals (BP, HR, temp, etc.)
  timeline: timestamp("timeline"), // When this data point occurred
  relatedStudyId: uuid("related_study_id"), // Link to previous/related studies
  isProcessed: boolean("is_processed").default(false),
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Patient Chat Threads - Direct patient-doctor messaging
export const patientChatThreads = pgTable("patient_chat_threads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  appointmentId: uuid("appointment_id").references(() => appointments.id), // Optional link to appointment
  messages: jsonb("messages").default(sql`'[]'::jsonb`), // Array of {senderId, content, timestamp, isRead}
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0), // Unread messages for patient
  status: text("status").notNull().default("active"), // active, archived, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Medical Teams - Collaboration between doctors
export const medicalTeams = pgTable("medical_teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  teamType: text("team_type").notNull().default("clinical_discussion"), // clinical_discussion, patient_case, study_group
  patientId: uuid("patient_id").references(() => patients.id), // If team is for a specific patient case
  isActive: boolean("is_active").default(true),
  roomId: text("room_id"), // Agora video room ID for meetings
  lastMeetingAt: timestamp("last_meeting_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Medical Team Members
export const medicalTeamMembers = pgTable("medical_team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => medicalTeams.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("member"), // leader, member, observer
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Medical Team Discussion Notes
export const teamNotes = pgTable("team_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => medicalTeams.id).notNull(),
  authorId: uuid("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("discussion"), // discussion, interconsultation, case_summary, clinical_question
  isUrgent: boolean("is_urgent").default(false),
  parentNoteId: uuid("parent_note_id"), // For threaded replies
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  appointments: many(appointments),
  medicalRecords: many(medicalRecords),
  doctorSchedule: many(doctorSchedule),
  digitalSignatures: many(digitalSignatures),
  videoConsultations: many(videoConsultations),
  tmcTransactions: many(tmcTransactions),
  chatbotReferencesCreated: many(chatbotReferences, { relationName: "chatbotCreator" }),
  chatbotReferencesUpdated: many(chatbotReferences, { relationName: "chatbotUpdater" }),
  labTemplatesCreated: many(labTemplates),
  clinicalInterviews: many(clinicalInterviews),
  superiorDoctor: one(users, { fields: [users.superiorDoctorId], references: [users.id], relationName: "hierarchy" }),
  subordinateDoctors: many(users, { relationName: "hierarchy" }),
  blockedByUser: one(users, { fields: [users.blockedBy], references: [users.id], relationName: "blocking" }),
  blockedUsers: many(users, { relationName: "blocking" }),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  medicalRecords: many(medicalRecords),
  whatsappMessages: many(whatsappMessages),
  examResults: many(examResults),
  digitalSignatures: many(digitalSignatures),
  videoConsultations: many(videoConsultations),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [appointments.doctorId],
    references: [users.id],
  }),
  medicalRecords: many(medicalRecords),
  whatsappMessages: many(whatsappMessages),
  videoConsultations: many(videoConsultations),
}));

export const medicalRecordsRelations = relations(medicalRecords, ({ one }) => ({
  patient: one(patients, {
    fields: [medicalRecords.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [medicalRecords.doctorId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [medicalRecords.appointmentId],
    references: [appointments.id],
  }),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  patient: one(patients, {
    fields: [whatsappMessages.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [whatsappMessages.appointmentId],
    references: [appointments.id],
  }),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  patient: one(patients, {
    fields: [examResults.patientId],
    references: [patients.id],
  }),
}));

export const digitalSignaturesRelations = relations(digitalSignatures, ({ one }) => ({
  patient: one(patients, {
    fields: [digitalSignatures.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [digitalSignatures.doctorId],
    references: [users.id],
  }),
}));

export const videoConsultationsRelations = relations(videoConsultations, ({ one }) => ({
  appointment: one(appointments, {
    fields: [videoConsultations.appointmentId],
    references: [appointments.id],
  }),
  patient: one(patients, {
    fields: [videoConsultations.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [videoConsultations.doctorId],
    references: [users.id],
  }),
}));

export const collaboratorsRelations = relations(collaborators, ({ many }) => ({
  prescriptionShares: many(prescriptionShares),
  labOrders: many(labOrders),
  hospitalReferrals: many(hospitalReferrals),
  integrations: many(collaboratorIntegrations),
  apiKeys: many(collaboratorApiKeys),
}));

export const prescriptionSharesRelations = relations(prescriptionShares, ({ one }) => ({
  medicalRecord: one(medicalRecords, {
    fields: [prescriptionShares.medicalRecordId],
    references: [medicalRecords.id],
  }),
  patient: one(patients, {
    fields: [prescriptionShares.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [prescriptionShares.doctorId],
    references: [users.id],
  }),
  pharmacy: one(collaborators, {
    fields: [prescriptionShares.pharmacyId],
    references: [collaborators.id],
  }),
  digitalSignature: one(digitalSignatures, {
    fields: [prescriptionShares.digitalSignatureId],
    references: [digitalSignatures.id],
  }),
}));

export const labOrdersRelations = relations(labOrders, ({ one }) => ({
  patient: one(patients, {
    fields: [labOrders.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [labOrders.doctorId],
    references: [users.id],
  }),
  laboratory: one(collaborators, {
    fields: [labOrders.laboratoryId],
    references: [collaborators.id],
  }),
}));

export const hospitalReferralsRelations = relations(hospitalReferrals, ({ one }) => ({
  patient: one(patients, {
    fields: [hospitalReferrals.patientId],
    references: [patients.id],
  }),
  referringDoctor: one(users, {
    fields: [hospitalReferrals.referringDoctorId],
    references: [users.id],
  }),
  hospital: one(collaborators, {
    fields: [hospitalReferrals.hospitalId],
    references: [collaborators.id],
  }),
}));

export const collaboratorIntegrationsRelations = relations(collaboratorIntegrations, ({ one }) => ({
  collaborator: one(collaborators, {
    fields: [collaboratorIntegrations.collaboratorId],
    references: [collaborators.id],
  }),
}));

export const collaboratorApiKeysRelations = relations(collaboratorApiKeys, ({ one }) => ({
  collaborator: one(collaborators, {
    fields: [collaboratorApiKeys.collaboratorId],
    references: [collaborators.id],
  }),
}));

// New relations for TMC and extended functionality
export const tmcTransactionsRelations = relations(tmcTransactions, ({ one }) => ({
  user: one(users, {
    fields: [tmcTransactions.userId],
    references: [users.id],
  }),
  relatedUser: one(users, {
    fields: [tmcTransactions.relatedUserId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [tmcTransactions.appointmentId],
    references: [appointments.id],
  }),
  medicalRecord: one(medicalRecords, {
    fields: [tmcTransactions.medicalRecordId],
    references: [medicalRecords.id],
  }),
}));

export const tmcConfigRelations = relations(tmcConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [tmcConfig.updatedBy],
    references: [users.id],
  }),
}));

export const chatbotReferencesRelations = relations(chatbotReferences, ({ one }) => ({
  creator: one(users, {
    fields: [chatbotReferences.createdBy],
    references: [users.id],
    relationName: "chatbotCreator",
  }),
  updater: one(users, {
    fields: [chatbotReferences.updatedBy],
    references: [users.id],
    relationName: "chatbotUpdater",
  }),
}));

export const labTemplatesRelations = relations(labTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [labTemplates.createdBy],
    references: [users.id],
  }),
}));

export const clinicalInterviewsRelations = relations(clinicalInterviews, ({ one }) => ({
  patient: one(patients, {
    fields: [clinicalInterviews.patientId],
    references: [patients.id],
  }),
  user: one(users, {
    fields: [clinicalInterviews.userId],
    references: [users.id],
  }),
}));

// Prescription system relations
export const medicationsRelations = relations(medications, ({ many }) => ({
  prescriptionItems: many(prescriptionItems),
  drugInteractions1: many(drugInteractions, { relationName: "medication1" }),
  drugInteractions2: many(drugInteractions, { relationName: "medication2" }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [prescriptions.doctorId],
    references: [users.id],
  }),
  medicalRecord: one(medicalRecords, {
    fields: [prescriptions.medicalRecordId],
    references: [medicalRecords.id],
  }),
  appointment: one(appointments, {
    fields: [prescriptions.appointmentId],
    references: [appointments.id],
  }),
  digitalSignature: one(digitalSignatures, {
    fields: [prescriptions.digitalSignatureId],
    references: [digitalSignatures.id],
  }),
  items: many(prescriptionItems),
}));

export const prescriptionItemsRelations = relations(prescriptionItems, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionItems.prescriptionId],
    references: [prescriptions.id],
  }),
  medication: one(medications, {
    fields: [prescriptionItems.medicationId],
    references: [medications.id],
  }),
}));

export const prescriptionTemplatesRelations = relations(prescriptionTemplates, ({ one }) => ({
  doctor: one(users, {
    fields: [prescriptionTemplates.doctorId],
    references: [users.id],
  }),
}));

export const drugInteractionsRelations = relations(drugInteractions, ({ one }) => ({
  medication1: one(medications, {
    fields: [drugInteractions.medication1Id],
    references: [medications.id],
    relationName: "medication1",
  }),
  medication2: one(medications, {
    fields: [drugInteractions.medication2Id],
    references: [medications.id],
    relationName: "medication2",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isTemporary: true,
  mergedIntoPatientId: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMedicalRecordSchema = createInsertSchema(medicalRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

export const insertExamResultSchema = createInsertSchema(examResults).omit({
  id: true,
  createdAt: true,
});

export const insertCollaboratorSchema = createInsertSchema(collaborators).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const pendingNotifications = pgTable("pending_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("medium"),
  actionUrl: text("action_url"),
  senderId: uuid("sender_id").references(() => users.id),
  delivered: boolean("delivered").default(false),
  read: boolean("read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPendingNotificationSchema = createInsertSchema(pendingNotifications).omit({
  id: true,
  createdAt: true,
});

export type PendingNotification = typeof pendingNotifications.$inferSelect;
export type InsertPendingNotification = z.infer<typeof insertPendingNotificationSchema>;

export const insertPrescriptionShareSchema = createInsertSchema(prescriptionShares).omit({
  id: true,
  createdAt: true,
});

export const insertLabOrderSchema = createInsertSchema(labOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHospitalReferralSchema = createInsertSchema(hospitalReferrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollaboratorIntegrationSchema = createInsertSchema(collaboratorIntegrations).omit({
  id: true,
  createdAt: true,
});

export const insertCollaboratorApiKeySchema = createInsertSchema(collaboratorApiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDoctorScheduleSchema = createInsertSchema(doctorSchedule).omit({
  id: true,
});

export const insertDigitalSignatureSchema = createInsertSchema(digitalSignatures).omit({
  id: true,
  createdAt: true,
});

export const insertVideoConsultationSchema = createInsertSchema(videoConsultations).omit({
  id: true,
  sessionId: true, // Auto-generated by server
  createdAt: true,
  updatedAt: true,
});

export const insertConsultationNoteSchema = createInsertSchema(consultationNotes).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export const insertConsultationRecordingSchema = createInsertSchema(consultationRecordings).omit({
  id: true,
  createdAt: true,
});

export const insertTmcTransactionSchema = createInsertSchema(tmcTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertTmcConfigSchema = createInsertSchema(tmcConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCashboxSchema = createInsertSchema(cashbox).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCashboxTransactionSchema = createInsertSchema(cashboxTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertChatbotReferenceSchema = createInsertSchema(chatbotReferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLabTemplateSchema = createInsertSchema(labTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClinicalInterviewSchema = createInsertSchema(clinicalInterviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportConfigSchema = createInsertSchema(supportConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Prescription system insert schemas
export const insertMedicationSchema = createInsertSchema(medications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({
  id: true,
  prescriptionNumber: true, // Auto-generated by server
  createdAt: true,
  updatedAt: true,
});

export const insertPrescriptionItemSchema = createInsertSchema(prescriptionItems).omit({
  id: true,
  createdAt: true,
});

export const insertPrescriptionTemplateSchema = createInsertSchema(prescriptionTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrugInteractionSchema = createInsertSchema(drugInteractions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientNoteSchema = createInsertSchema(patientNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDoctorNoteSchema = createInsertSchema(doctorNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
});

export const insertLayoutSettingSchema = createInsertSchema(layoutSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTmcCreditPackageSchema = createInsertSchema(tmcCreditPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaypalOrderSchema = createInsertSchema(paypalOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigitalKeySchema = createInsertSchema(digitalKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSignatureVerificationSchema = createInsertSchema(signatureVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertConsultationRequestSchema = createInsertSchema(consultationRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultationSessionSchema = createInsertSchema(consultationSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClinicalAssetSchema = createInsertSchema(clinicalAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientChatThreadSchema = createInsertSchema(patientChatThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type ExamResult = typeof examResults.$inferSelect;
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;

export type Collaborator = typeof collaborators.$inferSelect;
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;

export type PrescriptionShare = typeof prescriptionShares.$inferSelect;
export type InsertPrescriptionShare = z.infer<typeof insertPrescriptionShareSchema>;

export type LabOrder = typeof labOrders.$inferSelect;
export type InsertLabOrder = z.infer<typeof insertLabOrderSchema>;

export type HospitalReferral = typeof hospitalReferrals.$inferSelect;
export type InsertHospitalReferral = z.infer<typeof insertHospitalReferralSchema>;

export type CollaboratorIntegration = typeof collaboratorIntegrations.$inferSelect;
export type InsertCollaboratorIntegration = z.infer<typeof insertCollaboratorIntegrationSchema>;

export type CollaboratorApiKey = typeof collaboratorApiKeys.$inferSelect;
export type InsertCollaboratorApiKey = z.infer<typeof insertCollaboratorApiKeySchema>;

export type DoctorSchedule = typeof doctorSchedule.$inferSelect;
export type InsertDoctorSchedule = z.infer<typeof insertDoctorScheduleSchema>;

export type DigitalSignature = typeof digitalSignatures.$inferSelect;
export type InsertDigitalSignature = z.infer<typeof insertDigitalSignatureSchema>;

export type VideoConsultation = typeof videoConsultations.$inferSelect;
export type InsertVideoConsultation = z.infer<typeof insertVideoConsultationSchema>;

export type ConsultationNote = typeof consultationNotes.$inferSelect;
export type InsertConsultationNote = z.infer<typeof insertConsultationNoteSchema>;

export type ConsultationRecording = typeof consultationRecordings.$inferSelect;
export type InsertConsultationRecording = z.infer<typeof insertConsultationRecordingSchema>;

export type TmcTransaction = typeof tmcTransactions.$inferSelect;
export type InsertTmcTransaction = z.infer<typeof insertTmcTransactionSchema>;

export type TmcConfig = typeof tmcConfig.$inferSelect;
export type InsertTmcConfig = z.infer<typeof insertTmcConfigSchema>;

export type Cashbox = typeof cashbox.$inferSelect;
export type InsertCashbox = z.infer<typeof insertCashboxSchema>;

export type CashboxTransaction = typeof cashboxTransactions.$inferSelect;
export type InsertCashboxTransaction = z.infer<typeof insertCashboxTransactionSchema>;

export type ChatbotReference = typeof chatbotReferences.$inferSelect;
export type InsertChatbotReference = z.infer<typeof insertChatbotReferenceSchema>;

export type LabTemplate = typeof labTemplates.$inferSelect;
export type InsertLabTemplate = z.infer<typeof insertLabTemplateSchema>;

export type ClinicalInterview = typeof clinicalInterviews.$inferSelect;
export type InsertClinicalInterview = z.infer<typeof insertClinicalInterviewSchema>;

export type SupportConfig = typeof supportConfig.$inferSelect;
export type InsertSupportConfig = z.infer<typeof insertSupportConfigSchema>;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

// Prescription system types
export type Medication = typeof medications.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;

export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;

export type PrescriptionItem = typeof prescriptionItems.$inferSelect;
export type InsertPrescriptionItem = z.infer<typeof insertPrescriptionItemSchema>;

export type PrescriptionTemplate = typeof prescriptionTemplates.$inferSelect;
export type InsertPrescriptionTemplate = z.infer<typeof insertPrescriptionTemplateSchema>;

export type DrugInteraction = typeof drugInteractions.$inferSelect;
export type InsertDrugInteraction = z.infer<typeof insertDrugInteractionSchema>;

export type PatientNote = typeof patientNotes.$inferSelect;
export type InsertPatientNote = z.infer<typeof insertPatientNoteSchema>;

export type DoctorNote = typeof doctorNotes.$inferSelect;
export type InsertDoctorNote = z.infer<typeof insertDoctorNoteSchema>;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;

export type LayoutSetting = typeof layoutSettings.$inferSelect;
export type InsertLayoutSetting = z.infer<typeof insertLayoutSettingSchema>;

export type TmcCreditPackage = typeof tmcCreditPackages.$inferSelect;
export type InsertTmcCreditPackage = z.infer<typeof insertTmcCreditPackageSchema>;

export type PaypalOrder = typeof paypalOrders.$inferSelect;
export type InsertPaypalOrder = z.infer<typeof insertPaypalOrderSchema>;

export type DigitalKey = typeof digitalKeys.$inferSelect;
export type InsertDigitalKey = z.infer<typeof insertDigitalKeySchema>;

export type SignatureVerification = typeof signatureVerifications.$inferSelect;
export type InsertSignatureVerification = z.infer<typeof insertSignatureVerificationSchema>;

export type ConsultationRequest = typeof consultationRequests.$inferSelect;
export type InsertConsultationRequest = z.infer<typeof insertConsultationRequestSchema>;

export type ConsultationSession = typeof consultationSessions.$inferSelect;
export type InsertConsultationSession = z.infer<typeof insertConsultationSessionSchema>;

export type ClinicalAsset = typeof clinicalAssets.$inferSelect;
export type InsertClinicalAsset = z.infer<typeof insertClinicalAssetSchema>;

export type PatientChatThread = typeof patientChatThreads.$inferSelect;
export type InsertPatientChatThread = z.infer<typeof insertPatientChatThreadSchema>;

export const insertMedicalTeamSchema = createInsertSchema(medicalTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MedicalTeam = typeof medicalTeams.$inferSelect;
export type InsertMedicalTeam = z.infer<typeof insertMedicalTeamSchema>;

export const insertMedicalTeamMemberSchema = createInsertSchema(medicalTeamMembers).omit({
  id: true,
  joinedAt: true,
});
export type MedicalTeamMember = typeof medicalTeamMembers.$inferSelect;
export type InsertMedicalTeamMember = z.infer<typeof insertMedicalTeamMemberSchema>;

export const insertTeamNoteSchema = createInsertSchema(teamNotes).omit({
  id: true,
  createdAt: true,
});
export type TeamNote = typeof teamNotes.$inferSelect;
export type InsertTeamNote = z.infer<typeof insertTeamNoteSchema>;

// Dashboard stats type
export interface DashboardStats {
  todayConsultations: number;
  whatsappMessages: number;
  aiScheduling: number;
  secureRecords: number;
  totalPatients?: number;
  tmcCredits?: number;
  activeUsers?: number;
}

// Post-consultation items (auto-generated prescriptions, exams, referrals)
export const postConsultationItems = pgTable('post_consultation_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  consultationId: varchar('consultation_id').notNull(),
  patientId: varchar('patient_id').notNull(),
  doctorId: varchar('doctor_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // prescription, exam, referral, followup
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  details: jsonb('details'), // structured data: medications, exams, etc.
  status: varchar('status', { length: 50 }).default('pending_review').notNull(), // pending_review, approved, rejected, signed
  patientSummary: text('patient_summary'), // accessible language for patient
  reviewNotes: text('review_notes'),
  aiAnalysis: jsonb('ai_analysis'), // drug interactions, contraindications, etc.
  reviewedAt: timestamp('reviewed_at'),
  editHistory: jsonb('edit_history').default(sql`'[]'::jsonb`),
  editedAt: timestamp('edited_at'),
  editedBy: varchar('edited_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertPostConsultationItemSchema = createInsertSchema(postConsultationItems).omit({ id: true, createdAt: true });
export type InsertPostConsultationItem = z.infer<typeof insertPostConsultationItemSchema>;
export type PostConsultationItem = typeof postConsultationItems.$inferSelect;

export const susProntuarios = pgTable('sus_prontuarios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  consultationId: varchar('consultation_id').notNull(),
  patientId: varchar('patient_id').notNull(),
  doctorId: varchar('doctor_id').notNull(),
  identification: jsonb('identification'),
  chiefComplaint: text('chief_complaint'),
  historyPresentIllness: text('history_present_illness'),
  pastMedicalHistory: text('past_medical_history'),
  familyHistory: text('family_history'),
  socialHistory: text('social_history'),
  reviewOfSystems: text('review_of_systems'),
  physicalExam: text('physical_exam'),
  assessment: text('assessment'),
  plan: text('plan'),
  soapNotes: jsonb('soap_notes'),
  soapComplianceScore: integer('soap_compliance_score'),
  soapComplianceFlags: jsonb('soap_compliance_flags'),
  sourceTranscription: text('source_transcription'),
  sourceMeetingNotes: text('source_meeting_notes'),
  generatedByAi: boolean('generated_by_ai').default(true),
  reviewedByDoctor: boolean('reviewed_by_doctor').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertSusProntuarioSchema = createInsertSchema(susProntuarios).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSusProntuario = z.infer<typeof insertSusProntuarioSchema>;
export type SusProntuario = typeof susProntuarios.$inferSelect;

// Diagnostic Inferences - AI-generated syndromic classifications per consultation
export const diagnosticInferences = pgTable('diagnostic_inferences', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  consultationId: varchar('consultation_id').notNull(),
  patientId: varchar('patient_id').notNull(),
  doctorId: varchar('doctor_id').notNull(),
  hypotheses: jsonb('hypotheses').notNull(), // Array of { code, system (CID-10|ICD-11|DSM-5), description, confidence, category, differentials }
  overallConfidence: integer('overall_confidence').notNull(), // 0-100 percentage
  needsReview: boolean('needs_review').default(true).notNull(), // true if confidence < 96%
  reviewStatus: varchar('review_status', { length: 50 }).default('pending').notNull(), // pending, approved, rejected
  clinicalHistoryAuthorized: boolean('clinical_history_authorized').default(false).notNull(),
  epidemiologicalAuthorized: boolean('epidemiological_authorized').default(false).notNull(),
  reviewNotes: text('review_notes'),
  compiledAt: timestamp('compiled_at'), // when clinical history was compiled
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertDiagnosticInferenceSchema = createInsertSchema(diagnosticInferences).omit({ id: true, createdAt: true });
export type InsertDiagnosticInference = z.infer<typeof insertDiagnosticInferenceSchema>;
export type DiagnosticInference = typeof diagnosticInferences.$inferSelect;

// Consultation Access Tokens - unique codes for direct consultation access without login
export const consultationAccessTokens = pgTable('consultation_access_tokens', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  token: varchar('token', { length: 12 }).notNull().unique(),
  shortCode: varchar('short_code', { length: 8 }).notNull().unique(),
  consultationId: varchar('consultation_id'),
  appointmentId: varchar('appointment_id'),
  patientId: varchar('patient_id').notNull(),
  doctorId: varchar('doctor_id').notNull(),
  patientName: varchar('patient_name', { length: 255 }),
  scheduledAt: timestamp('scheduled_at'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active, used, expired, revoked
  accessMethod: varchar('access_method', { length: 20 }), // qrcode, link, whatsapp
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertConsultationAccessTokenSchema = createInsertSchema(consultationAccessTokens).omit({ id: true, createdAt: true });
export type InsertConsultationAccessToken = z.infer<typeof insertConsultationAccessTokenSchema>;
export type ConsultationAccessToken = typeof consultationAccessTokens.$inferSelect;

export const interConsultations = pgTable("inter_consultations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  requestingDoctorId: uuid("requesting_doctor_id").references(() => users.id).notNull(),
  targetDoctorId: uuid("target_doctor_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id),
  specialty: text("specialty"),
  clinicalCase: text("clinical_case").notNull(),
  urgency: text("urgency").notNull().default("standard"), // emergency, urgent, standard, elective
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, completed, cancelled
  responseNotes: text("response_notes"),
  respondedAt: timestamp("responded_at"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInterConsultationSchema = createInsertSchema(interConsultations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InterConsultation = typeof interConsultations.$inferSelect;
export type InsertInterConsultation = z.infer<typeof insertInterConsultationSchema>;

// Wallet Audit Log - comprehensive transaction auditing
export const walletAuditLog = pgTable("wallet_audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // credit, debit, transfer_in, transfer_out, purchase, commission, refund, admin_adjustment
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  actorId: uuid("actor_id").references(() => users.id), // Who performed the action (admin, system, self)
  actorRole: text("actor_role"), // admin, system, doctor, patient
  relatedTransactionId: uuid("related_transaction_id"),
  description: text("description").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWalletAuditLogSchema = createInsertSchema(walletAuditLog).omit({ id: true, createdAt: true });
export type InsertWalletAuditLog = z.infer<typeof insertWalletAuditLogSchema>;
export type WalletAuditLog = typeof walletAuditLog.$inferSelect;

// Dynamic NFTs - anonymized medical data insights
export const dynamicNfts = pgTable("dynamic_nfts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  nftType: text("nft_type").notNull(), // epidemiological_insight, clinical_pattern, research_dataset, diagnostic_model
  dataCategory: text("data_category").notNull(), // symptoms, diagnoses, treatments, outcomes
  anonymizedData: jsonb("anonymized_data").notNull(), // Statistical/aggregate data only, no PII
  valueTmc: integer("value_tmc").notNull().default(0), // Current value in TMC
  totalShares: integer("total_shares").notNull().default(100), // Total ownership shares
  availableShares: integer("available_shares").notNull().default(100), // Shares available for sale
  ownerId: uuid("owner_id").references(() => users.id).notNull(), // Current primary owner
  creatorId: uuid("creator_id").references(() => users.id).notNull(), // Who created the NFT
  consentRecords: jsonb("consent_records"), // LGPD consent tracking: [{patientId, consentDate, scope}]
  dataSourceCount: integer("data_source_count").default(0), // How many records contributed
  lastValueUpdate: timestamp("last_value_update"),
  status: text("status").notNull().default("active"), // active, frozen, retired
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDynamicNftSchema = createInsertSchema(dynamicNfts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDynamicNft = z.infer<typeof insertDynamicNftSchema>;
export type DynamicNft = typeof dynamicNfts.$inferSelect;

// NFT Ownership - track share ownership
export const nftOwnership = pgTable("nft_ownership", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nftId: uuid("nft_id").references(() => dynamicNfts.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  shares: integer("shares").notNull(),
  purchasePrice: integer("purchase_price").notNull(), // Price per share in TMC when acquired
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
});

export const insertNftOwnershipSchema = createInsertSchema(nftOwnership).omit({ id: true, acquiredAt: true });
export type InsertNftOwnership = z.infer<typeof insertNftOwnershipSchema>;
export type NftOwnership = typeof nftOwnership.$inferSelect;

// Broker Orders - buy/sell orders for NFTs and TM3D
export const brokerOrders = pgTable("broker_orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  orderType: text("order_type").notNull(), // buy, sell
  assetType: text("asset_type").notNull(), // nft_share, tm3d
  nftId: uuid("nft_id").references(() => dynamicNfts.id), // For NFT trades
  quantity: integer("quantity").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(), // In TMC
  totalPrice: integer("total_price").notNull(),
  filledQuantity: integer("filled_quantity").notNull().default(0),
  status: text("status").notNull().default("open"), // open, partially_filled, filled, cancelled
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrokerOrderSchema = createInsertSchema(brokerOrders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrokerOrder = z.infer<typeof insertBrokerOrderSchema>;
export type BrokerOrder = typeof brokerOrders.$inferSelect;

// Broker Trades - completed trades
export const brokerTrades = pgTable("broker_trades", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  buyOrderId: uuid("buy_order_id").references(() => brokerOrders.id).notNull(),
  sellOrderId: uuid("sell_order_id").references(() => brokerOrders.id).notNull(),
  buyerId: uuid("buyer_id").references(() => users.id).notNull(),
  sellerId: uuid("seller_id").references(() => users.id).notNull(),
  assetType: text("asset_type").notNull(), // nft_share, tm3d
  nftId: uuid("nft_id").references(() => dynamicNfts.id),
  quantity: integer("quantity").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  totalPrice: integer("total_price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrokerTradeSchema = createInsertSchema(brokerTrades).omit({ id: true, createdAt: true });
export type InsertBrokerTrade = z.infer<typeof insertBrokerTradeSchema>;
export type BrokerTrade = typeof brokerTrades.$inferSelect;

// TM3D Supply Control - track total supply and circulation
export const tm3dSupply = pgTable("tm3d_supply", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  totalSupply: integer("total_supply").notNull().default(1000000), // Total TM3D ever created
  circulatingSupply: integer("circulating_supply").notNull().default(0), // Currently in wallets
  reserveSupply: integer("reserve_supply").notNull().default(1000000), // Held in reserve
  lastMintAmount: integer("last_mint_amount").default(0),
  lastBurnAmount: integer("last_burn_amount").default(0),
  priceInUsd: text("price_in_usd").default("0.20"), // Reference price
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// External Wallet Links - connect to MetaMask/external wallets
export const externalWallets = pgTable("external_wallets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  walletAddress: text("wallet_address").notNull(), // MetaMask/external address
  walletType: text("wallet_type").notNull().default("metamask"), // metamask, walletconnect, custom
  network: text("network").notNull().default("tm3d"), // tm3d, ethereum, polygon
  label: text("label"), // User-friendly label
  isVerified: boolean("is_verified").default(false),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExternalWalletSchema = createInsertSchema(externalWallets).omit({ id: true, createdAt: true });
export type InsertExternalWallet = z.infer<typeof insertExternalWalletSchema>;
export type ExternalWallet = typeof externalWallets.$inferSelect;

// Withdrawal Requests - track transfers to external wallets
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  externalWalletId: uuid("external_wallet_id").references(() => externalWallets.id).notNull(),
  amount: integer("amount").notNull(), // In TMC
  fee: integer("fee").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled
  txHash: text("tx_hash"), // External transaction hash
  processedAt: timestamp("processed_at"),
  processedBy: uuid("processed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({ id: true, createdAt: true });
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

// Pharmacy Dispensing - tracks medication dispensing by pharmacists
export const pharmacyDispensing = pgTable("pharmacy_dispensing", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id).notNull(),
  prescriptionItemId: uuid("prescription_item_id").references(() => prescriptionItems.id),
  pharmacistId: uuid("pharmacist_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  medicationName: text("medication_name").notNull(),
  dispensedQuantity: integer("dispensed_quantity").notNull(),
  batchNumber: text("batch_number"),
  manufacturer: text("manufacturer"),
  expiryDate: timestamp("expiry_date"),
  dispensingNotes: text("dispensing_notes"),
  verificationMethod: text("verification_method").notNull().default("manual"), // qr_code, digital, manual
  signatureVerified: boolean("signature_verified").default(false),
  crmVerified: boolean("crm_verified").default(false),
  crmVerificationNotes: text("crm_verification_notes"),
  status: text("status").notNull().default("pending"), // pending, dispensed, partial, rejected
  dispensedAt: timestamp("dispensed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPharmacyDispensingSchema = createInsertSchema(pharmacyDispensing).omit({ id: true, createdAt: true });
export type InsertPharmacyDispensing = z.infer<typeof insertPharmacyDispensingSchema>;
export type PharmacyDispensing = typeof pharmacyDispensing.$inferSelect;

// Pharmacy Reports - LGPD-compliant reporting
export const pharmacyReports = pgTable("pharmacy_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  pharmacistId: uuid("pharmacist_id").references(() => users.id).notNull(),
  reportType: text("report_type").notNull().default("daily"), // daily, weekly, monthly, custom
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDispensed: integer("total_dispensed").default(0),
  totalPrescriptions: integer("total_prescriptions").default(0),
  medicationBreakdown: jsonb("medication_breakdown"),
  doctorBreakdown: jsonb("doctor_breakdown"),
  pathologyBreakdown: jsonb("pathology_breakdown"),
  scheduleBreakdown: jsonb("schedule_breakdown"),
  lgpdCompliant: boolean("lgpd_compliant").default(true),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPharmacyReportSchema = createInsertSchema(pharmacyReports).omit({ id: true, createdAt: true, generatedAt: true });
export type InsertPharmacyReport = z.infer<typeof insertPharmacyReportSchema>;
export type PharmacyReport = typeof pharmacyReports.$inferSelect;

// Doctor Patient Blocks — doctors can block specific patients from booking
export const doctorPatientBlocks = pgTable("doctor_patient_blocks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  reason: text("reason"),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
});

export const insertDoctorPatientBlockSchema = createInsertSchema(doctorPatientBlocks).omit({ id: true, blockedAt: true });
export type InsertDoctorPatientBlock = z.infer<typeof insertDoctorPatientBlockSchema>;
export type DoctorPatientBlock = typeof doctorPatientBlocks.$inferSelect;

// Unified Payment Transactions - tracks all payment methods (PayPal, Stripe, PagBank)
export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  packageId: uuid("package_id").references(() => tmcCreditPackages.id),
  provider: text("provider").notNull(), // paypal, stripe, pagbank
  providerOrderId: text("provider_order_id"), // external order/payment ID
  paymentMethod: text("payment_method").notNull(), // pix, credit_card, debit_card, boleto, apple_pay, paypal
  amount: text("amount").notNull(),
  currency: text("currency").notNull().default("BRL"),
  creditsAmount: integer("credits_amount").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled, refunded
  payerEmail: text("payer_email"),
  payerName: text("payer_name"),
  payerDocument: text("payer_document"), // CPF for PagBank
  pixCode: text("pix_code"), // PIX copy-paste code
  pixQrCodeUrl: text("pix_qr_code_url"), // PIX QR code image URL
  boletoUrl: text("boleto_url"), // Boleto PDF URL
  boletoBarcode: text("boleto_barcode"), // Boleto barcode
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeClientSecret: text("stripe_client_secret"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

// Clinics — Hospital administration groups created by doctors
export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  patientDiscountPercent: integer("patient_discount_percent").notNull().default(30),
  associateCommissionPercent: integer("associate_commission_percent").notNull().default(15),
  logoUrl: text("logo_url"),
  specialty: text("specialty"),
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClinicSchema = createInsertSchema(clinics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinics.$inferSelect;

// Clinic Members — doctors and staff associated with a clinic
export const clinicMembers = pgTable("clinic_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("associate"), // owner, associate, staff
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertClinicMemberSchema = createInsertSchema(clinicMembers).omit({ id: true, joinedAt: true });
export type InsertClinicMember = z.infer<typeof insertClinicMemberSchema>;
export type ClinicMember = typeof clinicMembers.$inferSelect;

// Clinic Patient Bindings — patients linked to a clinic for discounts
export const clinicPatientBindings = pgTable("clinic_patient_bindings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  patientId: uuid("patient_id").references(() => users.id).notNull(),
  discountPercent: integer("discount_percent").notNull().default(30),
  isActive: boolean("is_active").default(true),
  boundAt: timestamp("bound_at").defaultNow().notNull(),
});

export const insertClinicPatientBindingSchema = createInsertSchema(clinicPatientBindings).omit({ id: true, boundAt: true });
export type InsertClinicPatientBinding = z.infer<typeof insertClinicPatientBindingSchema>;
export type ClinicPatientBinding = typeof clinicPatientBindings.$inferSelect;

// Clinic Consultation Log — tracks clinic-related consultations for commission
export const clinicConsultationLogs = pgTable("clinic_consultation_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicId: uuid("clinic_id").references(() => clinics.id).notNull(),
  appointmentId: uuid("appointment_id"),
  doctorId: uuid("doctor_id").references(() => users.id).notNull(),
  patientId: uuid("patient_id").references(() => users.id).notNull(),
  originalCost: integer("original_cost").notNull(),
  discountApplied: integer("discount_applied").notNull().default(0),
  finalCost: integer("final_cost").notNull(),
  ownerCommission: integer("owner_commission").notNull().default(0),
  ownerPaid: boolean("owner_paid").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClinicConsultationLogSchema = createInsertSchema(clinicConsultationLogs).omit({ id: true, createdAt: true });
export type InsertClinicConsultationLog = z.infer<typeof insertClinicConsultationLogSchema>;
export type ClinicConsultationLog = typeof clinicConsultationLogs.$inferSelect;

// FHIR R4 Local Storage Tables
export const fhirPatients = pgTable("fhir_patients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceData: jsonb("resource_data").notNull(),
  name: text("name"),
  family: text("family"),
  gender: text("gender"),
  birthDate: text("birth_date"),
  phone: text("phone"),
  email: text("email"),
  active: boolean("active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fhirObservations = pgTable("fhir_observations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fhirPatientId: uuid("fhir_patient_id").references(() => fhirPatients.id),
  resourceData: jsonb("resource_data").notNull(),
  code: text("code"),
  display: text("display"),
  valueString: text("value_string"),
  valueQuantity: text("value_quantity"),
  unit: text("unit"),
  status: text("status").default("final").notNull(),
  effectiveDateTime: text("effective_date_time"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFhirPatientSchema = createInsertSchema(fhirPatients).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFhirPatient = z.infer<typeof insertFhirPatientSchema>;
export type FhirPatient = typeof fhirPatients.$inferSelect;

export const insertFhirObservationSchema = createInsertSchema(fhirObservations).omit({ id: true, createdAt: true });
export type InsertFhirObservation = z.infer<typeof insertFhirObservationSchema>;
export type FhirObservation = typeof fhirObservations.$inferSelect;

// Credit Transfer Requests - escrow-based transfer with approval
export const creditTransfers = pgTable("credit_transfers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: uuid("from_user_id").references(() => users.id).notNull(),
  toUserId: uuid("to_user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, cancelled, expired
  escrowTransactionId: uuid("escrow_transaction_id").references(() => tmcTransactions.id),
  completionTransactionId: uuid("completion_transaction_id").references(() => tmcTransactions.id),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreditTransferSchema = createInsertSchema(creditTransfers).omit({ id: true, createdAt: true });
export type InsertCreditTransfer = z.infer<typeof insertCreditTransferSchema>;
export type CreditTransfer = typeof creditTransfers.$inferSelect;

// Profile Merge Audit Logs — tracks merges of temporary patient data into permanent accounts
export const profileMergeAuditLogs = pgTable("profile_merge_audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  temporaryPatientId: uuid("temporary_patient_id").notNull(),
  permanentPatientId: uuid("permanent_patient_id").notNull(),
  permanentUserId: uuid("permanent_user_id").references(() => users.id).notNull(),
  mergedBy: text("merged_by").notNull(), // 'system_registration', 'system_access_link', 'admin_manual'
  mergedRecords: jsonb("merged_records").notNull(), // { medicalRecords: N, appointments: N, ... }
  beforeState: jsonb("before_state"), // snapshot of temp patient data
  afterState: jsonb("after_state"), // snapshot of merged permanent data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileMergeAuditLogSchema = createInsertSchema(profileMergeAuditLogs).omit({ id: true, createdAt: true });
export type InsertProfileMergeAuditLog = z.infer<typeof insertProfileMergeAuditLogSchema>;
export type ProfileMergeAuditLog = typeof profileMergeAuditLogs.$inferSelect;

// User Notes — persistent multi-note system for desktop home widget
export const userNotes = pgTable("user_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title").default("").notNull(),
  content: text("content").default("").notNull(),
  color: text("color").default("default").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserNoteSchema = createInsertSchema(userNotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserNote = z.infer<typeof insertUserNoteSchema>;
export type UserNote = typeof userNotes.$inferSelect;

// TMC system types
export interface TmcBalance {
  userId: string;
  balance: number;
  lastTransaction: string;
}

export interface SystemConfig {
  functionCosts: Record<string, number>;
  commissionRates: Record<string, number>;
  bonusRates: Record<string, number>;
}
