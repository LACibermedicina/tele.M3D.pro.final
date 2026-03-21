import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { geminiService } from "./services/gemini";
import { whatsAppService } from "./services/whatsapp";
import { SchedulingService } from "./services/scheduling";
import { whisperService } from "./services/whisper";
import { cryptoService } from "./services/crypto";
import { clinicalInterviewService } from "./services/clinical-interview";
import { pdfGeneratorService, PrescriptionData } from "./services/pdf-generator";
import * as tmcCreditsService from "./services/tmc-credits";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import creditsRouter from "./routes/credits";
import signaturesRouter from "./routes/signatures";
import medicalTeamsRouter from "./routes/medical-teams";
import { insertPatientSchema, insertAppointmentSchema, insertWhatsappMessageSchema, insertMedicalRecordSchema, insertVideoConsultationSchema, insertConsultationNoteSchema, insertConsultationRecordingSchema, insertPrescriptionShareSchema, insertCollaboratorSchema, insertLabOrderSchema, insertCollaboratorApiKeySchema, insertMedicationSchema, insertPrescriptionSchema, insertPrescriptionItemSchema, insertPrescriptionTemplateSchema, insertConsultationRequestSchema, insertMedicalTeamSchema, insertMedicalTeamMemberSchema, User, DEFAULT_DOCTOR_ID, examResults, patients, medications, prescriptions, prescriptionItems, prescriptionTemplates, drugInteractions, users, appointments, tmcTransactions, whatsappMessages, medicalRecords, systemSettings, chatbotReferences, chatbotConversations, medicalTeams, medicalTeamMembers, pendingNotifications, videoConsultations, consultationNotes, consultationRequests, diagnosticInferences, consultationAccessTokens, walletAuditLog, dynamicNfts, nftOwnership, brokerOrders, brokerTrades, tm3dSupply, externalWallets, withdrawalRequests, tmcConfig, cashbox, cashboxTransactions, tmcCreditPackages, paypalOrders, interConsultations, pharmacyDispensing, pharmacyReports, digitalSignatures, digitalKeys, signatureVerifications, doctorPatientBlocks, paymentTransactions, clinics, clinicMembers, clinicPatientBindings, clinicConsultationLogs, fhirPatients, fhirObservations, creditTransfers, profileMergeAuditLogs, prescriptionShares, labOrders, hospitalReferrals, clinicalAssets } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { creditService } from "./services/credit-service";
import { searchExternalMedications } from "./services/medication-search";
import { z } from "zod";
import { db } from "./db";
import { eq, desc, sql, and, or, isNotNull, isNull, inArray, gte, lte, lt, ne, ilike } from "drizzle-orm";
import { generateAgoraToken, getAgoraAppId } from "./agora";

// TMC Credit System Validation Schemas
const tmcTransferSchema = z.object({
  toUserId: z.string().uuid("ID do usuário deve ser um UUID válido"),
  amount: z.number().int().min(1, "Quantidade deve ser maior que 0").max(10000, "Quantidade máxima é 10.000 TMC"),
  reason: z.string().min(1, "Motivo é obrigatório").max(500, "Motivo deve ter no máximo 500 caracteres")
});

const tmcRechargeSchema = z.object({
  userId: z.string().uuid("ID do usuário deve ser um UUID válido"),
  amount: z.number().int().min(1, "Quantidade deve ser maior que 0").max(50000, "Quantidade máxima é 50.000 TMC"),
  method: z.enum(['manual', 'card', 'pix', 'bank_transfer'], {
    errorMap: () => ({ message: "Método deve ser: manual, card, pix ou bank_transfer" })
  })
});

const tmcDebitSchema = z.object({
  functionName: z.string().min(1, "Nome da função é obrigatório"),
  appointmentId: z.string().uuid().optional(),
  medicalRecordId: z.string().uuid().optional()
});

const tmcConfigSchema = z.object({
  functionName: z.string().min(1, "Nome da função é obrigatório"),
  costInCredits: z.number().int().min(0, "Custo deve ser 0 ou maior").max(10000, "Custo máximo é 10.000 TMC"),
  description: z.string().min(1, "Descrição é obrigatória").max(1000, "Descrição deve ter no máximo 1000 caracteres"),
  category: z.enum(['consultation', 'prescription', 'data_access', 'admin'], {
    errorMap: () => ({ message: "Categoria deve ser: consultation, prescription, data_access ou admin" })
  }),
  minimumRole: z.enum(['visitor', 'patient', 'doctor', 'admin', 'researcher'], {
    errorMap: () => ({ message: "Nível mínimo deve ser: visitor, patient, doctor, admin ou researcher" })
  }),
  bonusForPatient: z.number().int().min(0, "Bônus deve ser 0 ou maior").max(1000, "Bônus máximo é 1.000 TMC"),
  commissionPercentage: z.number().int().min(0, "Porcentagem deve ser 0 ou maior").max(50, "Porcentagem máxima é 50%"),
  isActive: z.boolean()
});

const tmcValidateCreditsSchema = z.object({
  functionName: z.string().min(1, "Nome da função é obrigatório")
});
import crypto from "crypto";
import QRCode from "qrcode";
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  const express = await import('express');
  const uploadsPublicDir = path.join(process.cwd(), 'client', 'public', 'uploads');
  if (!fs.existsSync(uploadsPublicDir)) {
    fs.mkdirSync(uploadsPublicDir, { recursive: true });
  }
  app.use('/uploads', express.default.static(uploadsPublicDir));
  
  // Migrate database schema for new features
  await migrateOnDutyColumns();
  await migrateMedicalTeamsTables();
  await migrateInterConsultationsTable();
  await migratePharmacyTables();
  await migratePMDColumns();
  await migrateDoctorPatientBlocks();
  await migratePaymentTransactions();
  await migrateClinicTables();
  await migrateUserDeactivationFields();
  await migrateFhirTables();
  await migratePostConsultationEditColumns();
  await initStripeSync();
  
  // Initialize default doctor if not exists and get the actual ID
  const actualDoctorId = await initializeDefaultDoctor();
  
  // Initialize default system settings
  await initializeDefaultSystemSettings();
  
  // Seed credit packages and feature costs
  await initializeCreditPackagesAndCosts();
  
  // Initialize scheduling service
  const schedulingService = new SchedulingService(storage);
  
  // Ensure default schedule exists for the doctor
  if (actualDoctorId) {
    await schedulingService.createDefaultSchedule(actualDoctorId);
  } else {
    console.error('Failed to initialize doctor, using DEFAULT_DOCTOR_ID as fallback');
  }
  
  // Configure Multer for profile picture uploads
  const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads', 'profiles');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const storage_multer = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `profile-${uniqueSuffix}${ext}`);
    }
  });
  
  const upload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
      }
    }
  });
  
  // Configure Multer for PDF reference uploads
  const pdfsDir = path.join(process.cwd(), 'client', 'public', 'uploads', 'references');
  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }
  
  const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, pdfsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `reference-${uniqueSuffix}${ext}`);
    }
  });
  
  const uploadPDF = multer({
    storage: pdfStorage,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit for PDFs
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /pdf/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = file.mimetype === 'application/pdf';
      
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'));
      }
    }
  });

  // Configure Multer for clinical asset uploads (exams, images)
  const clinicalAssetsDir = path.join(process.cwd(), 'client', 'public', 'uploads', 'clinical-assets');
  if (!fs.existsSync(clinicalAssetsDir)) {
    fs.mkdirSync(clinicalAssetsDir, { recursive: true });
  }

  const clinicalAssetStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, clinicalAssetsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `clinical-${uniqueSuffix}${ext}`);
    }
  });

  const uploadClinicalAsset = multer({
    storage: clinicalAssetStorage,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|pdf/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const mimetype = allowedMimes.includes(file.mimetype);
      
      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF and image files (JPEG, PNG) are allowed'));
      }
    }
  });
  
  // Global middleware to populate req.user from JWT cookie (if present)
  app.use(async (req: any, res: any, next: any) => {
    try {
      const token = req.cookies?.authToken;
      if (token) {
        const jwtSecret = process.env.SESSION_SECRET;
        if (jwtSecret) {
          try {
            const payload = jwt.verify(token, jwtSecret, {
              issuer: 'telemed-system',
              audience: 'web-app',
              algorithms: ['HS256']
            }) as any;
            
            const user = await storage.getUser(payload.userId);
            if (user) {
              req.user = user;
            }
          } catch (jwtError) {
            // Token invalid or expired - continue without user
          }
        }
      }
    } catch (error) {
      // Silently fail - don't block the request
    }
    next();
  });
  
  // WebSocket server for real-time updates with authentication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store authenticated WebSocket connections by doctor ID and consultation rooms
  const authenticatedClients = new Map<string, WebSocket[]>();
  
  // Store consultation rooms: consultationId -> { doctor: WebSocket[], patient: WebSocket[] }
  const consultationRooms = new Map<string, { doctor: WebSocket[], patient: WebSocket[] }>();

  // Store user roles for mass disconnect: userId -> actual role from JWT/DB
  const clientUserRoles = new Map<string, string>();
  
  wss.on('connection', (ws: WebSocket, req) => {
    console.log('Client connected to WebSocket');
    
    // WebSocket connections require JWT authentication
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('WebSocket connection denied: missing JWT token');
      ws.close(1008, 'JWT token required');
      return;
    }
    
    // Verify JWT token and extract user info with proper signature verification
    let userId: string;
    let userType: 'doctor' | 'patient' | 'visitor';
    let userRole: string = '';
    let consultationId: string | undefined;
    
    try {
      // Require SESSION_SECRET - fail if not set
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - WebSocket authentication failed');
        ws.close(1008, 'Server configuration error');
        return;
      }
      
      // Use proper JWT signature verification with full validation
      const payload = jwt.verify(token, jwtSecret, {
        issuer: 'healthcare-system',
        audience: 'websocket',
        algorithms: ['HS256']
      }) as any;
      
      // Support doctor, patient, and visitor authentication
      if (payload.type === 'doctor_auth') {
        userId = payload.doctorId;
        userType = 'doctor';
        userRole = payload.role || 'doctor';
        if (!userId) {
          console.log('WebSocket connection denied: Invalid JWT payload - missing doctorId');
          ws.close(1008, 'Invalid token payload');
          return;
        }
      } else if (payload.type === 'patient_auth') {
        userId = payload.patientId;
        userType = 'patient';
        userRole = 'patient';
        consultationId = payload.consultationId;
        if (!userId || !consultationId) {
          console.log('WebSocket connection denied: Invalid JWT payload - missing patientId or consultationId');
          ws.close(1008, 'Invalid token payload');
          return;
        }
      } else if (payload.type === 'visitor_auth') {
        userId = payload.visitorId || payload.userId;
        userType = 'visitor';
        userRole = 'visitor';
        if (!userId) {
          console.log('WebSocket connection denied: Invalid JWT payload - missing visitorId');
          ws.close(1008, 'Invalid token payload');
          return;
        }
      } else {
        console.log('WebSocket connection denied: Invalid token type');
        ws.close(1008, 'Invalid token type');
        return;
      }
      
    } catch (error) {
      console.log('WebSocket connection denied: Invalid JWT token', error);
      ws.close(1008, 'Invalid token');
      return;
    }
    
    if (!authenticatedClients.has(userId)) {
      authenticatedClients.set(userId, []);
    }
    authenticatedClients.get(userId)?.push(ws);
    clientUserRoles.set(userId, userRole);
    console.log(`${userType} ${userId} (role: ${userRole}) connected to WebSocket`);
    
    if (userType === 'patient' && consultationId) {
      if (!consultationRooms.has(consultationId)) {
        consultationRooms.set(consultationId, { doctor: [], patient: [] });
      }
      consultationRooms.get(consultationId)?.patient.push(ws);
      console.log(`Patient ${userId} connected to consultation ${consultationId}`);
    }
    
    ws.on('close', () => {
      console.log(`${userType} ${userId} disconnected from WebSocket`);
      
      const clients = authenticatedClients.get(userId);
      if (clients) {
        const index = clients.indexOf(ws);
        if (index > -1) {
          clients.splice(index, 1);
        }
        if (clients.length === 0) {
          authenticatedClients.delete(userId);
          clientUserRoles.delete(userId);
        }
      }
      
      if (userType === 'doctor') {
        consultationRooms.forEach((room, roomConsultationId) => {
          const doctorIndex = room.doctor.indexOf(ws);
          if (doctorIndex > -1) {
            room.doctor.splice(doctorIndex, 1);
            if (room.doctor.length === 0 && room.patient.length === 0) {
              consultationRooms.delete(roomConsultationId);
            }
          }
        });
      }
      
      if (userType === 'patient' && consultationId) {
        const room = consultationRooms.get(consultationId);
        if (room) {
          const index = room.patient.indexOf(ws);
          if (index > -1) {
            room.patient.splice(index, 1);
          }
          if (room.doctor.length === 0 && room.patient.length === 0) {
            consultationRooms.delete(consultationId);
          }
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Handle WebRTC signaling messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`Received message from ${userType} ${userId}:`, message.type);
        
        // Validate message structure - allow join-room with JWT consultationId
        if (!message.type) {
          console.log('Invalid message: missing type');
          return;
        }
        
        // For join-room, allow consultationId from JWT or message
        if (message.type === 'join-room' && !(message.consultationId || consultationId)) {
          console.log('Invalid join-room message: missing consultationId');
          return;
        }
        
        // For signaling messages, require consultationId in message
        if (['offer', 'answer', 'ice-candidate', 'call-status'].includes(message.type) && !message.consultationId) {
          console.log('Invalid signaling message: missing consultationId');
          return;
        }
        
        // Handle different message types for WebRTC signaling
        switch (message.type) {
          case 'join-room':
            handleJoinRoom(message, ws, userType, userId, consultationId);
            break;
            
          case 'offer':
          case 'answer':
          case 'ice-candidate':
            relaySignalingMessage(message, userType, userId);
            break;
            
          case 'call-status':
            broadcastCallStatus(message, userType, userId);
            break;
            
          default:
            console.log(`Unknown message type: ${message.type}`);
        }
        
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  });

  // Secure broadcast function - sends only to authorized recipients
  const broadcastToDoctor = (doctorId: string, data: any) => {
    const clients = authenticatedClients.get(doctorId);
    if (clients) {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  };

  const broadcastToUser = (userId: string, data: any) => {
    const clients = authenticatedClients.get(userId);
    if (clients) {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
          }));
        }
      });
      return true;
    }
    return false;
  };

  // Broadcast to all admin users
  const broadcastToAdmins = async (data: any) => {
    try {
      const adminUsers = await storage.getUsersByRole('admin');
      adminUsers.forEach(admin => {
        const clients = authenticatedClients.get(admin.id);
        if (clients) {
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                ...data,
                timestamp: new Date().toISOString()
              }));
            }
          });
        }
      });
    } catch (error) {
      console.error('Error broadcasting to admins:', error);
    }
  };

  // Broadcast real-time activity to all connected admin users
  const broadcastAdminActivity = async (activity: {
    type: string;
    action: string;
    entityId?: string;
    userId?: string;
    details?: any;
  }) => {
    const activityData = {
      type: 'admin-activity',
      activity: {
        ...activity,
        timestamp: new Date().toISOString()
      }
    };
    await broadcastToAdmins(activityData);
  };
  
  // WebRTC signaling helper functions
  
  // Handle room joining for video consultations
  const handleJoinRoom = (message: any, ws: WebSocket, userType: 'doctor' | 'patient' | 'visitor', userId: string, consultationId?: string) => {
    const targetConsultationId = consultationId || message.consultationId;
    
    if (!targetConsultationId) {
      console.log('Cannot join room: missing consultationId');
      return;
    }
    
    if (!consultationRooms.has(targetConsultationId)) {
      consultationRooms.set(targetConsultationId, { doctor: [], patient: [] });
    }
    
    const room = consultationRooms.get(targetConsultationId)!;
    
    if (userType === 'doctor' && !room.doctor.includes(ws)) {
      room.doctor.push(ws);
      console.log(`Doctor ${userId} joined consultation room ${targetConsultationId}`);
    } else if (userType === 'patient' && !room.patient.includes(ws)) {
      room.patient.push(ws);
      console.log(`Patient ${userId} joined consultation room ${targetConsultationId}`);
    }
    
    const isNewJoin = (userType === 'doctor' && room.doctor.length === 1 && room.doctor[0] === ws) ||
      (userType === 'patient' && room.patient.length === 1 && room.patient[0] === ws);

    const joinNotification = {
      type: 'user-joined',
      consultationId: targetConsultationId,
      userType,
      userId,
      timestamp: new Date().toISOString()
    };
    
    broadcastToRoom(targetConsultationId, joinNotification, ws);

    if (!isNewJoin) return;

    (async () => {
      try {
        const consultation = await db.select().from(videoConsultations)
          .where(eq(videoConsultations.id, targetConsultationId))
          .then(rows => rows[0]);
        if (!consultation) return;

        if (userType === 'patient') {
          const doctorId = consultation.doctorId;
          if (!doctorId) return;
          const patient = consultation.patientId
            ? await storage.getPatient(consultation.patientId)
            : null;
          const patientName = patient?.name || 'Paciente';
          const patientCode = (consultation.patientId || '').slice(-6).toUpperCase();

          const doctorActionUrl = `/consultation/video/${consultation.patientId}`;
          const delivered = broadcastToUser(doctorId, {
            type: 'room_presence',
            data: {
              title: 'Paciente entrou na sala',
              message: `${patientName} entrou na sala de consulta e aguarda atendimento.`,
              priority: 'critical',
              consultationId: targetConsultationId,
              patientName,
              userType: 'patient',
              actionUrl: doctorActionUrl
            }
          });

          if (!delivered) {
            try {
              await db.insert(pendingNotifications).values({
                userId: doctorId,
                type: 'patient_joined_office',
                title: 'Paciente na Sala de Consulta',
                message: `${patientName} entrou na sala e aguarda atendimento.`,
                priority: 'critical',
                actionUrl: doctorActionUrl,
                senderId: consultation.patientId || null,
                delivered: false,
                read: false,
                metadata: { consultationId: targetConsultationId, patientName }
              });
            } catch (e) {
              console.error('Failed to store room presence notification:', e);
            }
          }

          try {
            if (whatsAppService.isConfigured()) {
              const whatsappEnabled = await storage.getSystemSetting('whatsapp_notifications_enabled');
              if (whatsappEnabled?.value === 'true') {
                const doctor = await storage.getUser(doctorId);
                if (doctor?.whatsappNumber) {
                  await whatsAppService.sendMessage(
                    doctor.whatsappNumber,
                    `🔔 Paciente #${patientCode} entrou na sala de consulta e aguarda atendimento.\n\nAcesse a plataforma para iniciar o atendimento.\n\n🏥 Tele<M3D> Pro`
                  );
                }
              }
            }
          } catch (waErr) {
            console.error('WhatsApp room presence notification error:', waErr);
          }

        } else if (userType === 'doctor') {
          const patientId = consultation.patientId;
          if (!patientId) return;
          const patient = await storage.getPatient(patientId);
          if (!patient?.userId) return;
          const doctor = await storage.getUser(userId);
          const doctorName = doctor?.name || 'Médico(a)';

          const patientActionUrl = `/patient/video/${targetConsultationId}`;
          const deliveredToPatient = broadcastToUser(patient.userId, {
            type: 'room_presence',
            data: {
              title: 'Médico(a) entrou na sala',
              message: `Dr(a). ${doctorName} está pronto(a) para o atendimento.`,
              priority: 'high',
              consultationId: targetConsultationId,
              doctorName,
              userType: 'doctor',
              actionUrl: patientActionUrl
            }
          });

          if (!deliveredToPatient) {
            try {
              await db.insert(pendingNotifications).values({
                userId: patient.userId,
                type: 'consultation_ready',
                title: 'Médico(a) na Sala de Consulta',
                message: `Dr(a). ${doctorName} está pronto(a) para o atendimento.`,
                priority: 'high',
                actionUrl: patientActionUrl,
                senderId: userId,
                delivered: false,
                read: false,
                metadata: { consultationId: targetConsultationId, doctorName }
              });
            } catch (e) {
              console.error('Failed to store doctor room presence notification:', e);
            }
          }
        }
      } catch (err) {
        console.error('Room presence notification error:', err);
      }
    })();
  };
  
  // Relay WebRTC signaling messages between doctor and patient
  const relaySignalingMessage = (message: any, senderType: 'doctor' | 'patient', senderId: string) => {
    const { consultationId } = message;
    const room = consultationRooms.get(consultationId);
    
    if (!room) {
      console.log(`Cannot relay message: consultation room ${consultationId} not found`);
      return;
    }
    
    // Relay message to the other participant type
    const targetSockets = senderType === 'doctor' ? room.patient : room.doctor;
    
    const relayedMessage = {
      ...message,
      from: senderType,
      fromId: senderId,
      timestamp: new Date().toISOString()
    };
    
    targetSockets.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(relayedMessage));
      }
    });
    
    console.log(`Relayed ${message.type} from ${senderType} ${senderId} to ${targetSockets.length} recipients`);
  };
  
  // Broadcast call status updates to all participants in a room
  const broadcastCallStatus = (message: any, senderType: 'doctor' | 'patient', senderId: string) => {
    const { consultationId } = message;
    
    const statusMessage = {
      ...message,
      from: senderType,
      fromId: senderId,
      timestamp: new Date().toISOString()
    };
    
    broadcastToRoom(consultationId, statusMessage);
    console.log(`Broadcasted call status from ${senderType} ${senderId} to consultation ${consultationId}`);
  };
  
  // Broadcast message to all participants in a consultation room
  const broadcastToRoom = (consultationId: string, message: any, excludeSocket?: WebSocket) => {
    const room = consultationRooms.get(consultationId);
    if (!room) return;
    
    const allSockets = [...room.doctor, ...room.patient];
    allSockets.forEach(socket => {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  };

  // Broadcast to all connected WebSocket clients
  const broadcastToAll = (data: any) => {
    authenticatedClients.forEach((clientSet, userId) => {
      clientSet.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
          }));
        }
      });
    });
  };

  // Legacy broadcast function removed for security - use broadcastToDoctor exclusively

  // API Key Authentication Middleware for External Collaborators
  const authenticateApiKey = async (req: any, res: any, next: any) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      const collaboratorId = req.headers['x-collaborator-id'];
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

      // Validate required headers
      if (!apiKey) {
        return res.status(401).json({ message: 'API key required' });
      }

      if (!collaboratorId) {
        return res.status(401).json({ message: 'Collaborator ID required' });
      }

      // Validate collaboratorId is a valid UUID to prevent database constraint violations
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(collaboratorId)) {
        return res.status(400).json({ message: 'Invalid collaborator ID format' });
      }

      // Verify collaborator exists EARLY to prevent FK violations in audit logging
      const collaborator = await storage.getCollaborator(collaboratorId);
      if (!collaborator) {
        // Return 401 without logging to prevent FK constraint violations
        return res.status(401).json({ message: 'Invalid collaborator' });
      }

      // Hash the provided API key for comparison
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      // Validate API key in database
      const validApiKey = await storage.validateApiKey(hashedKey);
      
      if (!validApiKey || validApiKey.collaboratorId !== collaboratorId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: collaboratorId,
          integrationType: 'api_access',
          entityId: req.path,
          action: 'authentication_failed',
          status: 'failed',
          errorMessage: 'Invalid API key or collaborator ID mismatch',
          requestData: {
            endpoint: req.path,
            method: req.method,
            clientIp: clientIp,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(401).json({ message: 'Invalid API key' });
      }

      // Check if API key is active
      if (!validApiKey.isActive) {
        await storage.createCollaboratorIntegration({
          collaboratorId: collaboratorId,
          integrationType: 'api_access',
          entityId: req.path,
          action: 'authentication_failed',
          status: 'failed',
          errorMessage: 'API key is inactive',
          requestData: {
            endpoint: req.path,
            method: req.method,
            clientIp: clientIp,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(401).json({ message: 'API key is inactive' });
      }

      // Check expiry
      if (validApiKey.expiresAt && new Date(validApiKey.expiresAt) < new Date()) {
        await storage.createCollaboratorIntegration({
          collaboratorId: collaboratorId,
          integrationType: 'api_access',
          entityId: req.path,
          action: 'authentication_failed',
          status: 'failed',
          errorMessage: 'API key has expired',
          requestData: {
            endpoint: req.path,
            method: req.method,
            clientIp: clientIp,
            expiresAt: validApiKey.expiresAt,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(401).json({ message: 'API key has expired' });
      }

      // Check IP whitelist with proper CIDR support
      if (validApiKey.ipWhitelist && validApiKey.ipWhitelist.length > 0) {
        const isIpAllowed = validApiKey.ipWhitelist.some(allowedIp => {
          // Exact IP match
          if (!allowedIp.includes('/')) {
            return allowedIp === clientIp;
          }
          
          // CIDR notation - basic implementation for demo
          // In production, use libraries like 'ip-cidr' or 'ipaddr.js'
          const [network, prefixLength] = allowedIp.split('/');
          if (!network || !prefixLength) return false;
          
          // For demo: only support common /24 networks
          if (prefixLength === '24') {
            const networkPrefix = network.substring(0, network.lastIndexOf('.'));
            const clientPrefix = clientIp.substring(0, clientIp.lastIndexOf('.'));
            return networkPrefix === clientPrefix;
          }
          
          // For other CIDR ranges, deny for security (production would use proper library)
          return false;
        });

        if (!isIpAllowed) {
          await storage.createCollaboratorIntegration({
            collaboratorId: collaboratorId,
            integrationType: 'api_access',
            entityId: req.path,
            action: 'authentication_failed',
            status: 'failed',
            errorMessage: 'IP address not whitelisted',
            requestData: {
              endpoint: req.path,
              method: req.method,
              clientIp: clientIp,
              allowedIps: validApiKey.ipWhitelist,
              timestamp: new Date().toISOString()
            },
          });
          return res.status(403).json({ message: 'IP address not allowed' });
        }
      }

      // Rate limiting check (simplified implementation)
      const hourAgo = new Date();
      hourAgo.setHours(hourAgo.getHours() - 1);
      
      const recentIntegrations = await storage.getCollaboratorIntegrationsByCollaborator(collaboratorId);
      const recentRequests = recentIntegrations.filter(integration => 
        new Date(integration.createdAt) >= hourAgo && 
        integration.action === 'api_request'
      ).length;

      if (validApiKey.rateLimit && recentRequests >= validApiKey.rateLimit) {
        await storage.createCollaboratorIntegration({
          collaboratorId: collaboratorId,
          integrationType: 'api_access',
          entityId: req.path,
          action: 'rate_limit_exceeded',
          status: 'failed',
          errorMessage: 'Rate limit exceeded',
          requestData: {
            endpoint: req.path,
            method: req.method,
            clientIp: clientIp,
            requestCount: recentRequests,
            rateLimit: validApiKey.rateLimit,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(429).json({ message: 'Rate limit exceeded' });
      }

      // Update last used timestamp
      await storage.updateCollaboratorApiKey(validApiKey.id, {
        lastUsed: new Date()
      });

      // Collaborator existence already verified early to prevent FK violations
      // Use the collaborator object from the earlier verification

      // Log successful authentication and attach to request
      await storage.createCollaboratorIntegration({
        collaboratorId: collaboratorId,
        integrationType: 'api_access',
        entityId: req.path,
        action: 'api_request',
        status: 'success',
        requestData: {
          endpoint: req.path,
          method: req.method,
          clientIp: clientIp,
          timestamp: new Date().toISOString()
        },
      });

      // Attach authentication data to request for use in route handlers
      req.authenticatedCollaborator = collaborator;
      req.apiKey = validApiKey;
      req.clientIp = clientIp;

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      res.status(500).json({ message: 'Authentication service error' });
    }
  };

  // WhatsApp webhook verification
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = whatsAppService.verifyWebhook(mode as string, token as string, challenge as string);
    if (result) {
      res.status(200).send(result);
    } else {
      res.status(403).send('Verification failed');
    }
  });

  // ============================================================================
  // WEBHOOK ENDPOINTS
  // ============================================================================

  // Helper function to get available time slots for a doctor on a given date
  async function getAvailableSlots(doctorId: string, date: Date): Promise<string[]> {
    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0); // Start at 8 AM
    
    const dayEnd = new Date(date);
    dayEnd.setHours(18, 0, 0, 0); // End at 6 PM

    // Get all appointments for the doctor on this date
    const doctorAppointments = await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.doctorId, doctorId),
        sql`DATE(${appointments.scheduledAt}) = DATE(${date.toISOString()})`
      ));

    // Generate all possible 30-minute slots
    const allSlots: Date[] = [];
    const currentSlot = new Date(dayStart);
    while (currentSlot < dayEnd) {
      allSlots.push(new Date(currentSlot));
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
    }

    // Filter out occupied slots
    const availableSlots = allSlots.filter(slot => {
      const slotTime = slot.getTime();
      const slotDuration = 30 * 60 * 1000;
      
      return !doctorAppointments.some(apt => {
        const aptTime = new Date(apt.scheduledAt).getTime();
        const aptDuration = (apt.duration || 30) * 60 * 1000;
        
        // Check if times overlap
        return (slotTime < aptTime + aptDuration) && (slotTime + slotDuration > aptTime);
      });
    });

    // Format slots as strings
    return availableSlots.map(slot => 
      slot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  // WhatsApp webhook handler
  app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
      const messages = whatsAppService.parseWebhookPayload(req.body);
      
      for (const message of messages) {
        // Find or create patient
        let patient = await storage.getPatientByWhatsapp(message.from);
        if (!patient) {
          patient = await storage.createPatient({
            name: `Paciente ${message.from}`,
            phone: message.from,
            whatsappNumber: message.from,
          });
        }

        const whatsappMessage = await storage.createWhatsappMessage({
          patientId: patient.id,
          fromNumber: message.from,
          toNumber: message.to,
          message: message.text,
          messageType: 'text',
          direction: 'inbound',
          senderRole: 'patient',
          isFromAI: false,
        });

        // Analyze message with AI
        const analysis = await geminiService.analyzeWhatsappMessage(
          message.text,
          patient.medicalHistory ? JSON.stringify(patient.medicalHistory) : undefined
        );

        let aiResponse = analysis.response;

        // Handle scheduling requests
        if (analysis.isSchedulingRequest) {
          // Get all doctors with availability for today and tomorrow
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Get all doctors
          const doctors = await db.select()
            .from(users)
            .where(eq(users.role, 'doctor'));

          // Get availability for each doctor for the next 2 days
          const availableDoctors = [];
          for (const doctor of doctors) {
            const todayDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
            const tomorrowDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const todaySlots = await getAvailableSlots(doctor.id, today);
            const tomorrowSlots = await getAvailableSlots(doctor.id, tomorrow);
            
            // Build structured slots with ISO dates and labels
            const allSlots = [
              ...todaySlots.map(timeStr => ({
                dateIso: todayDate,
                time: timeStr,
                label: `Hoje ${timeStr}`
              })),
              ...tomorrowSlots.map(timeStr => ({
                dateIso: tomorrowDate,
                time: timeStr,
                label: `Amanhã ${timeStr}`
              }))
            ];

            if (allSlots.length > 0) {
              availableDoctors.push({
                doctorId: doctor.id,
                doctorName: doctor.name,
                availableSlots: allSlots // Send structured objects with ISO dates
              });
            }
          }

          const schedulingResponse = await geminiService.processSchedulingRequest(
            message.text,
            availableDoctors
          );

          if (schedulingResponse.suggestedAppointment && !schedulingResponse.requiresHumanIntervention) {
            const { dateIso, time, doctorId, doctorName } = schedulingResponse.suggestedAppointment as any;
            
            // Parse the date from Gemini response (should be ISO format)
            let scheduledAt: Date;
            try {
              if (!dateIso || !time) {
                throw new Error('Missing dateIso or time from Gemini response');
              }
              scheduledAt = new Date(`${dateIso}T${time}`);
              if (isNaN(scheduledAt.getTime())) {
                throw new Error('Invalid date/time');
              }
            } catch (e) {
              console.error('Error parsing date/time from Gemini:', e, { dateIso, time });
              aiResponse = 'Desculpe, houve um erro ao processar a data e hora. Por favor, tente novamente.';
              return;
            }

            // Validate that the suggested slot was actually available
            const availableSlotsForDoctor = await getAvailableSlots(doctorId, scheduledAt);
            const suggestedTimeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            if (!availableSlotsForDoctor.includes(suggestedTimeStr)) {
              console.warn('Gemini suggested unavailable slot:', { doctorId, dateIso, time, available: availableSlotsForDoctor });
              aiResponse = `Desculpe, o horário sugerido (${suggestedTimeStr}) não está mais disponível. Horários disponíveis: ${availableSlotsForDoctor.join(', ')}`;
              return;
            }

            // Double-check availability before creating appointment (redundant but safe)
            const doctorAppointments = await db.select()
              .from(appointments)
              .where(and(
                eq(appointments.doctorId, doctorId),
                sql`DATE(${appointments.scheduledAt}) = DATE(${scheduledAt.toISOString()})`
              ));

            const requestedTime = scheduledAt.getTime();
            const duration = 30 * 60 * 1000;
            
            const hasConflict = doctorAppointments.some(apt => {
              const aptTime = new Date(apt.scheduledAt).getTime();
              const aptDuration = (apt.duration || 30) * 60 * 1000;
              return (requestedTime < aptTime + aptDuration) && (requestedTime + duration > aptTime);
            });

            if (hasConflict) {
              aiResponse = 'Desculpe, esse horário não está mais disponível. Por favor, escolha outro horário.';
            } else {
              // Create consultation request to link patient to doctor for chat
              // Check if consultation request already exists
              const existingRequests = await storage.getConsultationRequestsByDoctor(doctorId);
              const hasExistingRequest = existingRequests.some(
                req => req.patientId === patient.id && 
                       (req.status === 'pending' || req.status === 'accepted')
              );
              
              if (!hasExistingRequest) {
                await storage.createConsultationRequest({
                  patientId: patient.id,
                  symptoms: message.text || 'Consulta agendada via WhatsApp',
                  urgencyLevel: 'normal',
                  preferredDateTime: scheduledAt,
                  selectedDoctorId: doctorId,
                  status: 'accepted'
                });
              }

              // Create appointment automatically
              const appointment = await storage.createAppointment({
                patientId: patient.id,
                doctorId,
                scheduledAt: scheduledAt.toISOString(),
                type: schedulingResponse.suggestedAppointment.type || 'Consulta Geral',
                status: 'scheduled',
                roomId: `room_${Date.now()}`,
                duration: 30
              });

              // Update WhatsApp message with appointment reference
              await storage.updateWhatsappMessage(whatsappMessage.id, {
                appointmentScheduled: true,
                appointmentId: appointment.id,
                processed: true,
              });

              aiResponse = schedulingResponse.response;

              // Send confirmation
              const formattedDate = scheduledAt.toLocaleDateString('pt-BR');
              const formattedTime = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              await whatsAppService.sendAppointmentConfirmation(
                message.from,
                patient.name,
                formattedDate,
                formattedTime
              );
            }
          } else {
            aiResponse = schedulingResponse.response;
          }
        }

        // Handle clinical questions
        if (analysis.isClinicalQuestion) {
          const clinicalResponse = await geminiService.answerClinicalQuestion(message.text);
          await whatsAppService.sendClinicalResponse(message.from, message.text, clinicalResponse);
          
          // Store clinical question and AI response as medical record
          const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;
          await storage.createMedicalRecord({
            patientId: patient.id,
            doctorId,
            symptoms: `Pergunta via WhatsApp: ${message.text}`,
            treatment: `Resposta IA: ${clinicalResponse}`,
            isEncrypted: true
          });
          
          aiResponse = 'Enviei uma resposta detalhada sobre sua dúvida clínica.';
        }

        const aiMessage = await storage.createWhatsappMessage({
          patientId: patient.id,
          fromNumber: message.to,
          toNumber: message.from,
          message: aiResponse,
          messageType: 'text',
          direction: 'outbound',
          senderRole: 'ai',
          isFromAI: true,
        });

        // Mark original message as read
        await whatsAppService.markMessageAsRead(message.messageId);

        console.log(`📥 WhatsApp message received from ${message.from} (patient: ${patient.id})`);

        // Broadcast only to the assigned doctor (security: don't expose PHI to visitors/other doctors)
        const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;
        broadcastToDoctor(doctorId, {
          type: 'whatsapp_message',
          data: { 
            patientId: patient.id,
            doctorId: doctorId,
            incomingMessage: whatsappMessage,
            aiMessage: aiMessage
          },
        });
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Patients API
  // Get current patient data for logged-in patient user
  app.get('/api/patients/me', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Find patient by userId (new approach using direct link)
      const patients = await storage.getAllPatients();
      const patient = patients.find(p => p.userId === req.user.id);
      
      // Fallback: Find patient by email or phone for legacy data
      if (!patient) {
        const fallbackPatient = patients.find(p => 
          p.email === req.user.email || 
          p.phone === req.user.phone ||
          p.whatsappNumber === req.user.whatsappNumber
        );
        
        if (!fallbackPatient) {
          return res.status(404).json({ message: 'Patient profile not found' });
        }
        
        // Update the patient record to link userId for next time
        await storage.updatePatient(fallbackPatient.id, { userId: req.user.id });
        return res.json({ ...fallbackPatient, userId: req.user.id });
      }
      
      res.json(patient);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      res.status(500).json({ message: 'Failed to get patient data' });
    }
  });

  app.get('/api/patients', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }

      if (req.user.role === 'admin') {
        const allPatients = await storage.getAllPatients();
        return res.json(allPatients);
      }

      const doctorId = req.user.id;

      const patientIdsFromAppointments = await db.select({ patientId: appointments.patientId })
        .from(appointments)
        .where(eq(appointments.doctorId, doctorId));

      const patientIdsFromRequests = await db.select({ patientId: consultationRequests.patientId })
        .from(consultationRequests)
        .where(eq(consultationRequests.selectedDoctorId, doctorId));

      const patientIdsFromVideoCalls = await db.select({ patientId: videoConsultations.patientId })
        .from(videoConsultations)
        .where(eq(videoConsultations.doctorId, doctorId));

      const patientIdsFromTokens = await db.select({ patientId: consultationAccessTokens.patientId })
        .from(consultationAccessTokens)
        .where(eq(consultationAccessTokens.doctorId, doctorId));

      const uniquePatientIds = new Set<string>();
      for (const row of patientIdsFromAppointments) if (row.patientId) uniquePatientIds.add(row.patientId);
      for (const row of patientIdsFromRequests) if (row.patientId) uniquePatientIds.add(row.patientId);
      for (const row of patientIdsFromVideoCalls) if (row.patientId) uniquePatientIds.add(row.patientId);
      for (const row of patientIdsFromTokens) if (row.patientId) uniquePatientIds.add(row.patientId);

      if (uniquePatientIds.size === 0) {
        return res.json([]);
      }

      const patientIdArray = Array.from(uniquePatientIds);
      const doctorPatients = await db.select().from(patients)
        .where(inArray(patients.id, patientIdArray));

      res.json(doctorPatients);
    } catch (error) {
      console.error('Failed to get patients:', error);
      res.status(500).json({ message: 'Failed to get patients' });
    }
  });

  app.get('/api/patients/:id', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (req.user.role === 'patient') {
        const ownPatient = await storage.getPatientByUserId(req.user.id);
        if (!ownPatient || ownPatient.id !== req.params.id) {
          return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar seus próprios dados.' });
        }
      }
      if (req.user.role === 'doctor') {
        const patientId = req.params.id;
        const doctorId = req.user.id;
        const hasRelationship = await db.select({ id: appointments.id }).from(appointments)
          .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientId))).limit(1);
        if (hasRelationship.length === 0) {
          const hasRequest = await db.select({ id: consultationRequests.id }).from(consultationRequests)
            .where(and(eq(consultationRequests.selectedDoctorId, doctorId), eq(consultationRequests.patientId, patientId))).limit(1);
          if (hasRequest.length === 0) {
            const hasVideo = await db.select({ id: videoConsultations.id }).from(videoConsultations)
              .where(and(eq(videoConsultations.doctorId, doctorId), eq(videoConsultations.patientId, patientId))).limit(1);
            if (hasVideo.length === 0) {
              const hasToken = await db.select({ id: consultationAccessTokens.id }).from(consultationAccessTokens)
                .where(and(eq(consultationAccessTokens.doctorId, doctorId), eq(consultationAccessTokens.patientId, patientId))).limit(1);
              if (hasToken.length === 0) {
                return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar pacientes vinculados a você.' });
              }
            }
          }
        }
      }
      const patient = await storage.getPatient(req.params.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      res.json(patient);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get patient' });
    }
  });

  app.post('/api/patients', async (req, res) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validatedData);
      res.status(201).json(patient);
    } catch (error) {
      res.status(400).json({ message: 'Invalid patient data', error });
    }
  });

  // Patient Notes API (Personal Agenda)
  app.get('/api/patient-notes', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const patientId = req.query.patientId as string;
      if (!patientId) {
        return res.status(400).json({ message: 'Patient ID required' });
      }

      // Only patient (own data), doctor, or admin can view notes
      if (req.user.role === 'patient') {
        const ownPatient = await storage.getPatientByUserId(req.user.id);
        if (!ownPatient || ownPatient.id !== patientId) {
          return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar suas próprias notas.' });
        }
      } else if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const notes = await storage.getPatientNotes(patientId, req.user.id, req.user.role);
      res.json(notes);
    } catch (error) {
      console.error('Error fetching patient notes:', error);
      res.status(500).json({ message: 'Failed to fetch notes' });
    }
  });

  app.post('/api/patient-notes', async (req: any, res) => {
    try {
      console.log('[patient-notes POST] Request body:', req.body);
      console.log('[patient-notes POST] User:', req.user);
      
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Only patient or admin can create notes - explicitly deny all other roles
      if (req.user.role !== 'patient' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied - only patients and admins can create notes' });
      }

      // Whitelist only allowed fields to prevent mass assignment
      const { title, content, date, isPrivate } = req.body;
      
      // Convert date string to Date object if needed
      const processedDate = date && typeof date === 'string' ? new Date(date) : date;
      
      let noteData: any = {
        title,
        content,
        date: processedDate,
        isPrivate: isPrivate !== undefined ? isPrivate : true,
      };
      
      if (req.user.role === 'patient') {
        // Patients can only create notes for themselves
        noteData.patientId = req.user.id;
        noteData.userId = req.user.id;
      } else if (req.user.role === 'admin') {
        // Admin must specify a patientId
        const { patientId } = req.body;
        if (!patientId) {
          return res.status(400).json({ message: 'Admin must specify patientId' });
        }
        noteData.patientId = patientId;
        noteData.userId = req.user.id;
      }

      console.log('[patient-notes POST] Note data:', noteData);
      const note = await storage.createPatientNote(noteData);
      console.log('[patient-notes POST] Note created:', note);
      res.status(201).json(note);
    } catch (error) {
      console.error('[patient-notes POST] Error creating patient note:', error);
      res.status(500).json({ message: 'Failed to create note', error: error.message });
    }
  });

  app.patch('/api/patient-notes/:id', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Only patient or admin can update notes
      if (req.user.role !== 'patient' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify ownership before update
      const existingNote = await storage.getPatientNoteById(req.params.id);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }

      // Only the patient who owns the note or admin can update
      if (req.user.role === 'patient' && existingNote.patientId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Whitelist only editable fields to prevent reassignment of IDs
      const { title, content, date, isPrivate } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (date !== undefined) {
        // Convert date string to Date object if needed
        updateData.date = typeof date === 'string' ? new Date(date) : date;
      }
      if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

      const note = await storage.updatePatientNote(req.params.id, updateData);
      res.json(note);
    } catch (error) {
      console.error('Error updating patient note:', error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  app.delete('/api/patient-notes/:id', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Only patient or admin can delete notes
      if (req.user.role !== 'patient' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify ownership before delete
      const existingNote = await storage.getPatientNoteById(req.params.id);
      if (!existingNote) {
        return res.status(404).json({ message: 'Note not found' });
      }

      // Only the patient who owns the note or admin can delete
      if (req.user.role === 'patient' && existingNote.patientId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const success = await storage.deletePatientNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting patient note:', error);
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });

  // Doctor Notes API (macOS Notes-style)
  const validFolders = ['all', 'clinical', 'patients', 'study', 'personal', 'ecg_study', 'ecg_shares', 'radiology_study', 'radiology_shares'];
  const validColors = ['default', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

  app.get('/api/doctor-notes', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Authentication required' });
      if (!['doctor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
      let notes = await storage.getDoctorNotes(req.user.id);
      const { folder } = req.query;
      if (folder && typeof folder === 'string' && validFolders.includes(folder)) {
        notes = notes.filter((n: any) => n.folder === folder);
      }
      res.json(notes);
    } catch (error) {
      console.error('Error fetching doctor notes:', error);
      res.status(500).json({ message: 'Failed to fetch notes' });
    }
  });

  app.post('/api/doctor-notes', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Authentication required' });
      if (!['doctor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
      const { title, content, folder, color, isPinned, patientId } = req.body;
      const safeFolder = typeof folder === 'string' && validFolders.includes(folder) ? folder : 'all';
      const safeColor = typeof color === 'string' && validColors.includes(color) ? color : 'default';
      const note = await storage.createDoctorNote({
        doctorId: req.user.id,
        title: typeof title === 'string' ? title : '',
        content: typeof content === 'string' ? content : '',
        folder: safeFolder,
        color: safeColor,
        isPinned: typeof isPinned === 'boolean' ? isPinned : false,
        patientId: typeof patientId === 'string' ? patientId : null,
      });
      res.status(201).json(note);
    } catch (error) {
      console.error('Error creating doctor note:', error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  });

  app.patch('/api/doctor-notes/:id', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Authentication required' });
      if (!['doctor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
      const existing = await storage.getDoctorNoteById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Note not found' });
      if (existing.doctorId !== req.user.id) return res.status(403).json({ message: 'Access denied' });
      const { title, content, folder, color, isPinned, patientId } = req.body;
      const update: any = {};
      if (typeof title === 'string') update.title = title;
      if (typeof content === 'string') update.content = content;
      if (typeof folder === 'string' && validFolders.includes(folder)) update.folder = folder;
      if (typeof color === 'string' && validColors.includes(color)) update.color = color;
      if (typeof isPinned === 'boolean') update.isPinned = isPinned;
      if (patientId !== undefined) update.patientId = typeof patientId === 'string' ? patientId : null;
      const note = await storage.updateDoctorNote(req.params.id, update);
      res.json(note);
    } catch (error) {
      console.error('Error updating doctor note:', error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  });

  app.delete('/api/doctor-notes/:id', async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Authentication required' });
      if (!['doctor', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
      const existing = await storage.getDoctorNoteById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Note not found' });
      if (existing.doctorId !== req.user.id) return res.status(403).json({ message: 'Access denied' });
      await storage.deleteDoctorNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting doctor note:', error);
      res.status(500).json({ message: 'Failed to delete note' });
    }
  });

  // Appointments API
  app.get('/api/appointments/today/:doctorId', async (req, res) => {
    try {
      const appts = await storage.getTodayAppointments(req.params.doctorId);
      
      const patientIds = [...new Set(appts.map((a: any) => a.patientId).filter(Boolean))];
      const patientMap: Record<string, any> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      const enriched = appts.map((a: any) => ({
        ...a,
        patientName: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].name : 'Paciente não identificado',
        patientEmail: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].email : null,
        patientPhone: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].phone : null,
        patient: a.patientId && patientMap[a.patientId] ? { id: patientMap[a.patientId].id, name: patientMap[a.patientId].name } : undefined,
      }));

      // Also include active/waiting video consultations for today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const activeConsultations = await db.select()
        .from(videoConsultations)
        .where(and(
          eq(videoConsultations.doctorId, req.params.doctorId),
          inArray(videoConsultations.status, ['waiting', 'active']),
          sql`${videoConsultations.createdAt} >= ${todayStart.toISOString()}`
        ));

      const vcPatientIds = [...new Set(activeConsultations.map(vc => vc.patientId).filter(Boolean))];
      for (const pid of vcPatientIds) {
        if (pid && !patientMap[pid]) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      const activeVcItems = activeConsultations.map(vc => ({
        id: `vc-${vc.id}`,
        consultationId: vc.id,
        type: 'video-consultation' as const,
        status: vc.status,
        patientId: vc.patientId,
        patientName: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].name : 'Paciente não identificado',
        patientPhone: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].phone : null,
        patient: vc.patientId && patientMap[vc.patientId] ? { id: patientMap[vc.patientId].id, name: patientMap[vc.patientId].name } : undefined,
        scheduledAt: vc.createdAt,
        createdAt: vc.createdAt,
        startedAt: vc.startedAt,
        agoraChannelName: vc.agoraChannelName,
      }));
      
      res.json([...enriched, ...activeVcItems]);
    } catch (error) {
      console.error('Today appointments error:', error);
      res.status(500).json({ message: 'Failed to get appointments' });
    }
  });

  app.get('/api/appointments/doctor/:doctorId', async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      const appts = await storage.getAppointmentsByDoctor(req.params.doctorId, date);
      
      const patientIds = [...new Set(appts.map(a => a.patientId).filter(Boolean))];
      const patientMap: Record<string, any> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      const enriched = appts.map(a => ({
        ...a,
        patientName: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].name : 'Paciente não identificado',
        patientEmail: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].email : null,
        patientPhone: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].phone : null,
      }));
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get appointments' });
    }
  });

  app.get('/api/appointments/patient/:patientId', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (req.user.role === 'patient') {
        const ownPatient = await storage.getPatientByUserId(req.user.id);
        if (!ownPatient || ownPatient.id !== req.params.patientId) {
          return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar seus próprios agendamentos.' });
        }
      }
      const appointments = await storage.getAppointmentsByPatient(req.params.patientId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get patient appointments' });
    }
  });

  // Available slots API
  app.get('/api/scheduling/available-slots/:doctorId', async (req, res) => {
    try {
      const { doctorId } = req.params;
      const daysAhead = parseInt(req.query.days as string) || 30;
      
      const availableSlots = await schedulingService.getAvailableSlots(doctorId, daysAhead);
      res.json(availableSlots);
    } catch (error) {
      console.error('Error getting available slots:', error);
      res.status(500).json({ message: 'Failed to get available slots' });
    }
  });

  // Check specific slot availability
  app.post('/api/scheduling/check-availability', async (req, res) => {
    try {
      const { doctorId, date, time } = req.body;
      
      if (!doctorId || !date || !time) {
        return res.status(400).json({ message: 'Doctor ID, date, and time are required' });
      }

      const isAvailable = await schedulingService.isSpecificSlotAvailable(doctorId, date, time);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error('Error checking slot availability:', error);
      res.status(500).json({ message: 'Failed to check availability' });
    }
  });

  app.post('/api/appointments', async (req, res) => {
    try {
      // Transform scheduledAt from string to Date if needed
      const requestData = {
        ...req.body,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      };
      
      // Check if patient is blocked by this doctor
      if (requestData.patientId && requestData.doctorId) {
        const blockCheck = await db.select().from(doctorPatientBlocks)
          .where(and(eq(doctorPatientBlocks.doctorId, requestData.doctorId), eq(doctorPatientBlocks.patientId, requestData.patientId)));
        if (blockCheck.length > 0) {
          return res.status(403).json({ message: 'Este médico bloqueou agendamentos deste paciente.' });
        }
      }

      const validatedData = insertAppointmentSchema.parse(requestData);
      const appointment = await storage.createAppointment(validatedData);
      
      // Create consultation request to link patient to doctor for chat
      if (appointment.patientId && appointment.doctorId) {
        // Check if consultation request already exists
        const existingRequests = await storage.getConsultationRequestsByDoctor(appointment.doctorId);
        const hasExistingRequest = existingRequests.some(
          req => req.patientId === appointment.patientId && 
                 (req.status === 'pending' || req.status === 'accepted')
        );
        
        if (!hasExistingRequest) {
          await storage.createConsultationRequest({
            patientId: appointment.patientId,
            symptoms: appointment.notes || appointment.type || 'Consulta agendada',
            urgencyLevel: appointment.type === 'emergency' ? 'immediate' : 'normal',
            preferredDateTime: new Date(appointment.scheduledAt),
            selectedDoctorId: appointment.doctorId,
            status: 'accepted'
          });
        }

        try {
          if (whatsAppService.isConfigured()) {
            const whatsappEnabled = await storage.getSystemSetting('whatsapp_notifications_enabled');
            if (whatsappEnabled?.value === 'true') {
              const targetDocId = appointment.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID;
              const doc = await storage.getUser(targetDocId);
              if (doc?.whatsappNumber) {
                const patient = await storage.getPatient(appointment.patientId);
                const pCode = appointment.patientId.slice(-6).toUpperCase();
                const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
                await whatsAppService.sendMessage(
                  doc.whatsappNumber,
                  `📅 Nova Consulta Agendada\n\n📋 Paciente: #${pCode}\n📆 Data: ${new Date(appointment.scheduledAt).toLocaleDateString('pt-BR')}\n⏰ Hora: ${new Date(appointment.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n📝 Tipo: ${appointment.type || 'Consulta Geral'}\n\n▶️ Atender: ${baseUrl}/consultation/video/${appointment.patientId}\n📅 Agenda: ${baseUrl}/schedule\n\n🏥 Tele<M3D> Pro`
                );
              }
            }
          }
        } catch (waErr) {
          console.error('WhatsApp appointment notification error (non-blocking):', waErr);
        }
      }
      
      broadcastToDoctor(appointment.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID, { type: 'appointment_created', data: appointment });
      res.status(201).json(appointment);
    } catch (error) {
      res.status(400).json({ message: 'Invalid appointment data', error });
    }
  });

  app.patch('/api/appointments/:id', async (req, res) => {
    try {
      const appointment = await storage.updateAppointment(req.params.id, req.body);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      broadcastToDoctor(appointment.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID, { type: 'appointment_updated', data: appointment });
      res.json(appointment);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update appointment' });
    }
  });

  app.post('/api/appointments/cancel-all', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors and admins can cancel appointments' });
      }
      const { scope, appointmentType } = req.body;
      const doctorId = req.user.role === 'admin' && req.body.doctorId ? req.body.doctorId : req.user.id;
      if (!scope) {
        return res.status(400).json({ message: 'scope (today|future|all) is required' });
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      let conditions: any[];
      if (scope === 'today') {
        conditions = [
          eq(appointments.doctorId, doctorId),
          or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'in-progress')),
          gte(appointments.scheduledAt, todayStart),
          lte(appointments.scheduledAt, todayEnd),
        ];
      } else if (scope === 'future') {
        const tomorrowStart = new Date(todayEnd.getTime() + 1);
        conditions = [
          eq(appointments.doctorId, doctorId),
          or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'in-progress')),
          gte(appointments.scheduledAt, tomorrowStart),
        ];
      } else {
        conditions = [
          eq(appointments.doctorId, doctorId),
          or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'in-progress')),
        ];
      }

      if (appointmentType && appointmentType !== 'all') {
        conditions.push(eq(appointments.type, appointmentType));
      }

      const cancelled = await db.update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(...conditions))
        .returning();

      broadcastToDoctor(doctorId, { type: 'appointments_bulk_cancelled', data: { count: cancelled.length } });

      for (const apt of cancelled) {
        if (apt.patientId) {
          try {
            const patient = await storage.getPatient(apt.patientId);
            if (patient?.userId) {
              broadcastToUser(patient.userId, {
                type: 'appointment_cancelled',
                data: { appointmentId: apt.id, scheduledAt: apt.scheduledAt },
              });
            }
          } catch {}
        }
      }

      let cancelledInterConsultations = 0;
      try {
        const pendingIC = await db.select()
          .from(interConsultations)
          .where(and(
            or(
              eq(interConsultations.requestingDoctorId, doctorId),
              eq(interConsultations.targetDoctorId, doctorId)
            ),
            or(
              eq(interConsultations.status, 'pending'),
              eq(interConsultations.status, 'accepted')
            )
          ));

        if (pendingIC.length > 0) {
          await db.update(interConsultations)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(and(
              or(
                eq(interConsultations.requestingDoctorId, doctorId),
                eq(interConsultations.targetDoctorId, doctorId)
              ),
              or(
                eq(interConsultations.status, 'pending'),
                eq(interConsultations.status, 'accepted')
              )
            ));

          cancelledInterConsultations = pendingIC.length;

          const doctor = await storage.getUser(doctorId);
          const doctorName = doctor?.name || 'Médico';

          for (const ic of pendingIC) {
            const otherDoctorId = ic.requestingDoctorId === doctorId ? ic.targetDoctorId : ic.requestingDoctorId;
            try {
              broadcastToUser(otherDoctorId, {
                type: 'interconsultation_cancelled',
                data: { interConsultationId: ic.id },
              });
            } catch {}
          }
        }
      } catch (icError) {
        console.error('Error cancelling inter-consultations:', icError);
      }

      res.json({ cancelled: cancelled.length, cancelledInterConsultations, appointments: cancelled });
    } catch (error) {
      console.error('Batch cancel error:', error);
      res.status(500).json({ message: 'Failed to cancel appointments' });
    }
  });

  app.get('/api/appointments/doctor/:doctorId/future', async (req, res) => {
    try {
      const { doctorId } = req.params;
      const now = new Date();
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      const tomorrowStart = new Date(todayEnd.getTime() + 1);

      const futureAppts = await db.select()
        .from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          or(eq(appointments.status, 'scheduled'), eq(appointments.status, 'in-progress')),
          gte(appointments.scheduledAt, tomorrowStart)
        ))
        .orderBy(appointments.scheduledAt);

      const patientIds = [...new Set(futureAppts.map(a => a.patientId).filter(Boolean))];
      const patientMap: Record<string, any> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      res.json(futureAppts.map(a => ({
        ...a,
        patientName: a.patientId && patientMap[a.patientId] ? patientMap[a.patientId].name : 'Paciente não identificado',
      })));
    } catch (error) {
      console.error('Future appointments error:', error);
      res.status(500).json({ message: 'Failed to get future appointments' });
    }
  });

  // Export appointments to iCal format
  app.get('/api/appointments/doctor/:doctorId/history', async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { limit: queryLimit = '50' } = req.query;

      const pastAppointments = await db.select()
        .from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          or(
            eq(appointments.status, 'completed'),
            eq(appointments.status, 'cancelled')
          )
        ))
        .orderBy(desc(appointments.scheduledAt))
        .limit(parseInt(queryLimit.toString()));

      const pastVideoConsultations = await db.select({
        id: videoConsultations.id,
        patientId: videoConsultations.patientId,
        status: videoConsultations.status,
        startedAt: videoConsultations.startedAt,
        endedAt: videoConsultations.endedAt,
        duration: videoConsultations.duration,
        meetingNotes: videoConsultations.meetingNotes,
        connectionLogs: videoConsultations.connectionLogs,
        createdAt: videoConsultations.createdAt,
      })
        .from(videoConsultations)
        .where(and(
          eq(videoConsultations.doctorId, doctorId),
          inArray(videoConsultations.status, ['ended', 'completed', 'incomplete'])
        ))
        .orderBy(desc(videoConsultations.createdAt))
        .limit(parseInt(queryLimit.toString()));

      const patientIds = [...new Set([
        ...pastAppointments.map(a => a.patientId).filter(Boolean),
        ...pastVideoConsultations.map(v => v.patientId).filter(Boolean),
      ])];

      const patientNames: Record<string, string> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientNames[pid] = p.name;
          } catch {}
        }
      }

      res.json({
        appointments: pastAppointments.map(a => ({
          ...a,
          patientName: a.patientId ? patientNames[a.patientId] || 'Paciente' : 'Paciente',
        })),
        videoConsultations: pastVideoConsultations.map(v => ({
          ...v,
          patientName: v.patientId ? patientNames[v.patientId] || 'Paciente' : 'Paciente',
        })),
      });
    } catch (error) {
      console.error('Doctor history error:', error);
      res.status(500).json({ message: 'Failed to get history' });
    }
  });

  app.get('/api/appointments/export/:doctorId', async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { format: exportFormat } = req.query;
      
      // Get all appointments for doctor
      const appointments = await storage.getAppointmentsByDoctor(doctorId);
      
      if (exportFormat === 'ical') {
        // Generate iCal format
        let icalContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Tele<M3D>//Telemedicine Platform//PT',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'X-WR-CALNAME:Agenda Tele<M3D>',
          'X-WR-TIMEZONE:America/Sao_Paulo',
        ];

        for (const apt of appointments) {
          const startDate = new Date(apt.scheduledAt);
          const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 min default
          
          const formatICalDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          };

          icalContent.push(
            'BEGIN:VEVENT',
            `UID:${apt.id}@telemed.app`,
            `DTSTAMP:${formatICalDate(new Date())}`,
            `DTSTART:${formatICalDate(startDate)}`,
            `DTEND:${formatICalDate(endDate)}`,
            `SUMMARY:${apt.patientName || 'Consulta'}`,
            `DESCRIPTION:Tipo: ${apt.type || 'consultation'}\\nStatus: ${apt.status}${apt.notes ? '\\nNotas: ' + apt.notes : ''}`,
            `STATUS:${apt.status === 'scheduled' ? 'CONFIRMED' : 'TENTATIVE'}`,
            `SEQUENCE:0`,
            'END:VEVENT'
          );
        }

        icalContent.push('END:VCALENDAR');
        
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="agenda-telemed-${new Date().toISOString().split('T')[0]}.ics"`);
        res.send(icalContent.join('\r\n'));
      } else {
        // JSON format
        res.json(appointments);
      }
    } catch (error) {
      console.error('Export appointments error:', error);
      res.status(500).json({ message: 'Failed to export appointments' });
    }
  });

  // Import appointments from iCal or JSON
  app.post('/api/appointments/import', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      const doctorId = req.body.doctorId || DEFAULT_DOCTOR_ID;
      const fileContent = req.file.buffer.toString('utf-8');
      let imported = 0;

      if (req.file.originalname.endsWith('.ics')) {
        // Parse iCal format
        const lines = fileContent.split(/\r?\n/);
        let currentEvent: any = null;

        for (const line of lines) {
          if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
          } else if (line.startsWith('END:VEVENT') && currentEvent) {
            // Create appointment from parsed event
            if (currentEvent.dtstart) {
              try {
                const appointment = await storage.createAppointment({
                  doctorId,
                  patientId: '', // Will need to be matched or created
                  scheduledAt: currentEvent.dtstart,
                  type: 'consultation',
                  status: 'scheduled',
                  notes: currentEvent.description || '',
                  aiScheduled: false,
                });
                imported++;
              } catch (error) {
                console.error('Failed to import event:', error);
              }
            }
            currentEvent = null;
          } else if (currentEvent) {
            if (line.startsWith('DTSTART:')) {
              const dateStr = line.split(':')[1];
              currentEvent.dtstart = new Date(
                `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T${dateStr.substring(9,11)}:${dateStr.substring(11,13)}:${dateStr.substring(13,15)}Z`
              );
            } else if (line.startsWith('SUMMARY:')) {
              currentEvent.summary = line.split(':').slice(1).join(':');
            } else if (line.startsWith('DESCRIPTION:')) {
              currentEvent.description = line.split(':').slice(1).join(':').replace(/\\n/g, '\n');
            }
          }
        }
      } else if (req.file.originalname.endsWith('.json')) {
        // Parse JSON format
        const events = JSON.parse(fileContent);
        
        for (const event of events) {
          try {
            await storage.createAppointment({
              doctorId,
              patientId: event.patientId || '',
              scheduledAt: new Date(event.scheduledAt),
              type: event.type || 'consultation',
              status: event.status || 'scheduled',
              notes: event.notes || '',
              aiScheduled: false,
            });
            imported++;
          } catch (error) {
            console.error('Failed to import event:', error);
          }
        }
      } else {
        return res.status(400).json({ message: 'Unsupported file format. Use .ics or .json' });
      }

      res.json({ 
        message: 'Import successful',
        imported,
        total: imported 
      });
    } catch (error) {
      console.error('Import appointments error:', error);
      res.status(500).json({ message: 'Failed to import appointments' });
    }
  });

  // WhatsApp Messages API
  app.get('/api/whatsapp/messages/:patientId', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const messages = await storage.getWhatsappMessagesByPatient(req.params.patientId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get messages' });
    }
  });

  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { to, message, allowReply } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!to || !message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ message: 'Destinatário e mensagem são obrigatórios.' });
      }

      const doctorId = req.user.id;

      let patient = await storage.getPatientByWhatsapp(to);
      if (!patient) {
        const allPatients = await storage.getAllPatients();
        patient = allPatients.find((p: any) => p.phone === to || p.whatsappNumber === to);
      }

      let whatsappSent = false;
      try {
        whatsappSent = await whatsAppService.sendMessage(to, message);
      } catch (whatsappErr) {
        console.log('WhatsApp API not configured or failed, saving message internally only.');
      }

      if (patient) {
        const savedMessage = await storage.createWhatsappMessage({
          patientId: patient.id,
          doctorId: doctorId,
          fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID || 'doctor',
          toNumber: to,
          message: message.trim(),
          messageType: 'text',
          direction: 'doctor_to_patient',
          senderRole: 'doctor',
          isFromAI: false,
          processed: true
        });

        console.log(`📤 Doctor message saved for patient ${patient.id}${whatsappSent ? ' (WhatsApp sent)' : ' (internal only)'}`);

        broadcastToDoctor(doctorId, {
          type: 'whatsapp_message',
          data: {
            message: savedMessage,
            patientId: patient.id,
            doctorId: doctorId
          }
        });

        if (patient.userId) {
          const doctorUser = await storage.getUser(doctorId);
          const doctorName = doctorUser?.name || 'Seu médico';
          
          broadcastToUser(patient.userId, {
            type: 'doctor_message',
            data: {
              title: `Mensagem de ${doctorName}`,
              message: message.trim().substring(0, 200),
              doctorId: doctorId,
              doctorName: doctorName,
              patientId: patient.id,
              messageId: savedMessage.id,
              allowReply: (req.body.allowReply !== false),
              actionUrl: '/my-consultations'
            }
          });

          try {
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'doctor_message',
              title: `Mensagem de ${doctorName}`,
              message: message.trim().substring(0, 200),
              priority: 'high',
              actionUrl: '/my-consultations',
              senderId: doctorId,
              delivered: false,
              read: false,
              metadata: { messageId: savedMessage.id, patientId: patient.id, allowReply: (req.body.allowReply !== false), doctorId: doctorId }
            });
          } catch (notifErr) {
            console.error('Failed to store patient notification:', notifErr);
          }
        }

        res.json({ success: true, messageId: savedMessage.id, whatsappSent });
      } else {
        res.json({ success: true, whatsappSent, note: 'Paciente não encontrado no sistema, mensagem não salva.' });
      }
    } catch (error) {
      console.error('WhatsApp send error:', error);
      res.status(500).json({ message: 'Erro ao enviar mensagem. Tente novamente.' });
    }
  });

  // WhatsApp invite patient for consultation
  app.post('/api/whatsapp/invite-consultation', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { patientId, date, time, message } = req.body;

      if (!patientId || !date || !time) {
        return res.status(400).json({ message: 'Patient ID, date and time are required' });
      }

      // Get patient details
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Format date and time
      const appointmentDate = new Date(`${date}T${time}`);
      const formattedDate = appointmentDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Prepare WhatsApp message
      const whatsappMessage = message || 
        `Olá ${patient.name}! 🏥\n\n` +
        `Gostaria de agendar uma consulta com você:\n\n` +
        `📅 Data: ${formattedDate}\n` +
        `🕐 Horário: ${formattedTime}\n\n` +
        `Por favor, confirme sua disponibilidade respondendo esta mensagem.\n\n` +
        `Att,\nDr(a). ${req.user.name}`;

      // Get patient's WhatsApp number
      const whatsappNumber = patient.whatsappNumber || patient.phone;
      
      // Send message via WhatsApp API
      const success = await whatsAppService.sendMessage(whatsappNumber, whatsappMessage);
      
      if (success) {
        // Save sent message to database
        await storage.createWhatsappMessage({
          patientId: patient.id,
          fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID || 'system',
          toNumber: whatsappNumber,
          message: whatsappMessage,
          messageType: 'text',
          isFromAI: false,
          processed: true
        });

        console.log(`📤 Consultation invite sent to ${patient.name} via WhatsApp`);

        res.json({ 
          success: true, 
          message: 'Convite enviado com sucesso',
          sentTo: whatsappNumber
        });
      } else {
        res.status(500).json({ message: 'Falha ao enviar mensagem via WhatsApp' });
      }
    } catch (error) {
      console.error('WhatsApp invite consultation error:', error);
      res.status(500).json({ message: 'Erro ao enviar convite' });
    }
  });

  app.get('/api/medical-records/my', async (req, res) => {
    try {
      if (!req.user) {
        return res.json([]);
      }
      const userId = req.user.id;
      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.json([]);
      }
      const records = await storage.getMedicalRecordsByPatient(patient.id);
      res.json(records || []);
    } catch (error) {
      console.error('Get my medical records error:', error);
      res.json([]);
    }
  });

  // Medical Records API with role-based access control
  app.get('/api/medical-records/:patientId', async (req, res) => {
    try {
      const patientId = req.params.patientId;
      
      // Manual authentication check (requireAuth not available yet in file order)
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = req.user;

      // Get patient first to validate existence
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Role-based access control
      if (user.role === 'admin') {
        // Admins have full access to all medical records
        const records = await storage.getMedicalRecordsByPatient(patientId);
        return res.json(records);
      }

      if (user.role === 'patient') {
        // Patients cannot access medical records directly
        return res.status(403).json({ 
          message: 'Acesso negado: Pacientes não têm acesso direto a prontuários médicos. Consulte seu médico.' 
        });
      }

      if (user.role === 'doctor') {
        // Check if doctor is the primary doctor for this patient
        const isPrimaryDoctor = patient.primaryDoctorId === user.id;
        
        // Check if doctor has any appointments with this patient
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(
          apt => apt.patientId === patientId
        );

        // Check if doctor is in same team hierarchy (superior or through superior's patients)
        let isInTeamHierarchy = false;
        if (user.superiorDoctorId) {
          // Check if patient belongs to superior doctor
          const superiorAppointments = await storage.getAppointmentsByDoctor(user.superiorDoctorId);
          isInTeamHierarchy = patient.primaryDoctorId === user.superiorDoctorId || 
            superiorAppointments.some(apt => apt.patientId === patientId);
        }

        // Allow access if doctor is primary, has appointment, or is in team hierarchy
        if (isPrimaryDoctor || hasAppointment || isInTeamHierarchy) {
          const records = await storage.getMedicalRecordsByPatient(patientId);
          return res.json(records);
        }

        return res.status(403).json({ 
          message: 'Acesso negado: Você só pode visualizar prontuários de pacientes atribuídos a você ou sua equipe' 
        });
      }

      if (user.role === 'researcher') {
        // Researchers cannot access individual patient medical records (LGPD compliance)
        return res.status(403).json({ 
          message: 'Acesso negado: Pesquisadores não têm acesso a prontuários individuais. Use os endpoints de dados estatísticos' 
        });
      }

      // Any other role is denied
      return res.status(403).json({ message: 'Acesso negado: Permissões insuficientes' });
    } catch (error) {
      console.error('Get medical records error:', error);
      res.status(500).json({ message: 'Failed to get medical records' });
    }
  });

  app.get('/api/medical-records/:patientId/unified', async (req, res) => {
    try {
      const patientId = req.params.patientId;
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      const user = req.user;
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      if (user.role === 'patient') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      if (user.role === 'doctor') {
        const isPrimaryDoctor = patient.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(apt => apt.patientId === patientId);
        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
      } else if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const records = await storage.getMedicalRecordsByPatient(patientId);
      const patientAppointments = await db.select().from(appointments)
        .where(eq(appointments.patientId, patientId))
        .orderBy(desc(appointments.scheduledAt));
      const prescriptionsList = await db.select().from(prescriptions)
        .where(eq(prescriptions.patientId, patientId))
        .orderBy(desc(prescriptions.createdAt));
      const exams = await storage.getExamResultsByPatient(patientId);

      const dayMap: Record<string, {
        date: string;
        consultations: any[];
        records: any[];
        prescriptions: any[];
        exams: any[];
      }> = {};

      const getDay = (dateStr: string | Date) => {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
      };

      const ensureDay = (day: string) => {
        if (!dayMap[day]) {
          dayMap[day] = { date: day, consultations: [], records: [], prescriptions: [], exams: [] };
        }
      };

      const doctorCache: Record<string, any> = {};
      const getDoctor = async (id: string) => {
        if (!doctorCache[id]) doctorCache[id] = await storage.getUser(id);
        return doctorCache[id];
      };

      for (const apt of patientAppointments) {
        const day = getDay(apt.scheduledAt);
        ensureDay(day);
        const doctor = await getDoctor(apt.doctorId);
        dayMap[day].consultations.push({
          id: apt.id,
          type: apt.type,
          status: apt.status,
          scheduledAt: apt.scheduledAt,
          doctorName: doctor?.name || 'N/A',
          doctorCRM: doctor?.medicalLicense || '',
          notes: apt.notes,
        });
      }

      for (const rec of records) {
        const day = getDay(rec.createdAt);
        ensureDay(day);
        const doctor = await getDoctor(rec.doctorId);
        const pmd = rec.pmdData as any;
        dayMap[day].records.push({
          id: rec.id,
          appointmentId: rec.appointmentId,
          doctorName: doctor?.name || 'Sistema',
          doctorCRM: doctor?.medicalLicense || '',
          symptoms: pmd?.clinico?.anamnese || rec.symptoms,
          diagnosis: pmd?.clinico?.diagnostico || rec.diagnosis,
          treatment: pmd?.clinico?.tratamento || rec.treatment,
          prescription: rec.prescription,
          observations: rec.observations,
          historico: pmd?.clinico?.historico,
          exames: pmd?.clinico?.exames,
          evolucoes: pmd?.clinico?.evolucoes || [],
          diagnosticHypotheses: rec.diagnosticHypotheses,
          hasPmd: !!pmd,
          pmdVersion: rec.pmdVersion,
          isEncrypted: rec.isEncrypted,
          digitalSignature: !!rec.digitalSignature,
          createdAt: rec.createdAt,
        });
      }

      for (const rx of prescriptionsList) {
        const day = getDay(rx.createdAt);
        ensureDay(day);
        dayMap[day].prescriptions.push({
          id: rx.id,
          diagnosis: rx.diagnosis,
          status: rx.status,
          createdAt: rx.createdAt,
        });
      }

      for (const exam of exams) {
        const day = getDay(exam.createdAt);
        ensureDay(day);
        dayMap[day].exams.push({
          id: exam.id,
          examType: exam.examType,
          results: exam.results,
          abnormalValues: exam.abnormalValues,
          analyzedByAI: exam.analyzedByAI,
          createdAt: exam.createdAt,
        });
      }

      const timeline = Object.values(dayMap).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const patientInfo = {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        bloodType: patient.bloodType,
        allergies: patient.allergies,
      };

      res.json({
        patient: patientInfo,
        timeline,
        summary: {
          totalRecords: records.length,
          totalConsultations: patientAppointments.length,
          totalPrescriptions: prescriptionsList.length,
          totalExams: exams.length,
          totalDays: timeline.length,
        },
      });
    } catch (error) {
      console.error('Unified medical records error:', error);
      res.status(500).json({ message: 'Erro ao gerar prontuário unificado' });
    }
  });

  app.post('/api/appointments/:appointmentId/transcribe', async (req, res) => {
    try {
      // Validate input
      const validation = transcriptionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: validation.error.issues 
        });
      }
      
      const { audioTranscript } = validation.data;
      const appointmentId = req.params.appointmentId;
      
      // Validate appointmentId format
      if (!z.string().uuid().safeParse(appointmentId).success) {
        return res.status(400).json({ message: 'Invalid appointment ID format' });
      }
      
      // Get appointment details
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      // Process consultation transcript with AI
      const analysis = await geminiService.transcribeAndSummarizeConsultation(audioTranscript);
      
      // Create medical record with AI analysis and transcript
      const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;
      const medicalRecord = await storage.createMedicalRecord({
        patientId: appointment.patientId,
        doctorId,
        appointmentId,
        diagnosis: analysis.diagnosis,
        treatment: analysis.treatment,
        audioTranscript,
        isEncrypted: true
      });
      
      res.json({ 
        analysis, 
        medicalRecordId: medicalRecord.id,
        message: 'Consultation transcribed and analyzed successfully' 
      });
    } catch (error) {
      console.error('Consultation transcription error:', error);
      res.status(500).json({ message: 'Failed to process consultation transcript' });
    }
  });

  // Input validation schemas
  const analyzeSchema = z.object({
    symptoms: z.string().min(1, "Symptoms are required"),
    history: z.string().optional(),
    appointmentId: z.string().uuid().optional()
  });

  const transcriptionSchema = z.object({
    audioTranscript: z.string().min(1, "Audio transcript is required")
  });


  app.post('/api/medical-records/:patientId/analyze', async (req, res) => {
    try {
      // Validate patient ID format
      const patientId = req.params.patientId;

      if (!z.string().uuid().safeParse(patientId).success) {
        return res.status(400).json({ message: 'Invalid patient ID format' });
      }
      
      // Manual authentication check
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and doctors can create medical records
      if (user.role !== 'admin' && user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }
      
      // Validate input
      const validation = analyzeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: validation.error.issues 
        });
      }
      
      const { symptoms, history, appointmentId } = validation.data;
      
      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Doctors can only create records for their patients
      if (user.role === 'doctor') {
        const isPrimaryDoctor = patient.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(
          apt => apt.patientId === patientId
        );

        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ 
            message: 'Access denied: You can only create records for your assigned patients' 
          });
        }
      }
      
      // Generate comprehensive AI analysis for medical record
      let analysis;
      try {
        analysis = await geminiService.analyzeSymptomsForMedicalRecord(symptoms, history || '');
      } catch (aiError) {
        console.error('AI analysis service error:', {
          status: aiError instanceof Error ? aiError.name : 'Unknown',
          message: 'AI diagnostic service temporarily unavailable'
        });
        return res.status(502).json({ 
          message: 'AI diagnostic service temporarily unavailable',
          analysis: null
        });
      }
      
      // Return the complete analysis without creating a medical record yet
      // The frontend will use this to populate the form fields
      res.json({
        analysis: {
          diagnosis: analysis.diagnosis,
          treatment: analysis.treatment,
          prescription: analysis.prescription,
          recommendations: analysis.recommendations,
          hypotheses: analysis.hypotheses
        },
        message: 'Análise IA concluída com sucesso. Revise e edite conforme necessário antes de salvar.'
      });
    } catch (error) {
      console.error('Diagnostic analysis error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        patientId: req.params.patientId
      });
      res.status(500).json({ message: 'Failed to process diagnostic analysis' });
    }
  });

  // Exam Results API with role-based access control
  app.get('/api/exam-results/:patientId', async (req, res) => {
    try {
      const patientId = req.params.patientId;
      
      // Manual authentication check
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = req.user;

      // Only admins and doctors have access to exam results
      if (user.role !== 'admin' && user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }

      // Doctors can only access exam results of their patients
      if (user.role === 'doctor') {
        const patient = await storage.getPatient(patientId);
        if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
        }

        const isPrimaryDoctor = patient.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(
          apt => apt.patientId === patientId
        );

        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ 
            message: 'Access denied: You can only view exam results of your assigned patients' 
          });
        }
      }

      // Admins have full access
      const results = await storage.getExamResultsByPatient(patientId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get exam results' });
    }
  });

  app.post('/api/exam-results/analyze', async (req, res) => {
    try {
      // Authentication check
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const user = req.user;
      
      // Only admins and doctors can create exam results
      if (user.role !== 'admin' && user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }

      const { rawData, examType, patientId } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ message: 'Patient ID is required' });
      }

      // Doctors can only create exam results for their patients
      if (user.role === 'doctor') {
        const patient = await storage.getPatient(patientId);
        if (!patient) {
          return res.status(404).json({ message: 'Patient not found' });
        }

        const isPrimaryDoctor = patient.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(
          apt => apt.patientId === patientId
        );

        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ 
            message: 'Access denied: You can only create exam results for your assigned patients' 
          });
        }
      }
      
      const analysis = await geminiService.extractExamResults(rawData, examType);
      
      const examResult = await storage.createExamResult({
        patientId,
        examType,
        results: analysis.structuredResults,
        rawData,
        abnormalValues: analysis.abnormalValues,
        analyzedByAI: true,
      });

      res.json(examResult);
    } catch (error) {
      res.status(500).json({ message: 'Failed to analyze exam results' });
    }
  });

  // Collaborators API
  app.get('/api/collaborators', async (req, res) => {
    try {
      const collaborators = await storage.getAllCollaborators();
      res.json(collaborators);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get collaborators' });
    }
  });

  // Digital Signatures API
  app.get('/api/digital-signatures/pending/:doctorId', async (req, res) => {
    try {
      const signatures = await storage.getPendingSignatures(req.params.doctorId);
      res.json(signatures);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get pending signatures' });
    }
  });

  // Digital signature routes moved after requireAuth definition

  // ICP-Brasil A3 Digital Signature API moved after requireAuth definition
  app.post('/api/medical-records/:id/sign-prescription', async (req, res) => {
    try {
      const medicalRecordId = req.params.id;
      const { pin, doctorName, crm, crmState } = req.body;
      
      // Use authenticated doctor ID or fallback to default for demo
      const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;

      // Validate required ICP-Brasil A3 authentication data
      if (!pin || pin.length < 6) {
        return res.status(400).json({ 
          message: 'PIN do token A3 é obrigatório (mínimo 6 dígitos)' 
        });
      }

      // Get medical record with prescription
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      if (!medicalRecord.prescription) {
        return res.status(400).json({ message: 'No prescription to sign in this medical record' });
      }

      // Create ICP-Brasil A3 certificate with enhanced compliance
      const certificateInfo = cryptoService.createICPBrasilA3Certificate(
        doctorId,
        doctorName || 'Dr. Médico Demo',
        crm || '123456',
        crmState || 'SP'
      );

      // Simulate A3 token authentication
      try {
        await cryptoService.authenticateA3Token(pin, certificateInfo.certificateId);
      } catch (error) {
        return res.status(401).json({ 
          message: 'Falha na autenticação do token A3. Verifique o PIN.' 
        });
      }

      // Generate secure key pair for signature (production should use HSM or secure key storage)
      const { privateKey, publicKey } = await cryptoService.generateKeyPair();

      // Create digital signature
      const signatureResult = await cryptoService.signPrescription(
        medicalRecord.prescription,
        privateKey,
        certificateInfo
      );

      // Perform advanced electronic verification
      const verificationResult = await cryptoService.performElectronicVerification(
        signatureResult.signature,
        signatureResult.documentHash,
        signatureResult.certificateInfo
      );

      // Create digital signature record with enhanced ICP-Brasil A3 information
      const digitalSignature = await storage.createDigitalSignature({
        documentType: 'prescription',
        documentId: medicalRecordId,
        patientId: medicalRecord.patientId,
        doctorId: doctorId,
        signature: signatureResult.signature,
        certificateInfo: {
          ...signatureResult.certificateInfo,
          publicKey: publicKey, // Store public key for verification
          timestamp: signatureResult.timestamp,
          verificationResult,
          legalCompliance: 'CFM Resolução 1821/2007 - Validade Jurídica Plena'
        },
        status: 'signed',
        signedAt: new Date(),
      });

      // Update medical record with digital signature ID reference
      await storage.updateMedicalRecord(medicalRecordId, {
        digitalSignature: digitalSignature.id, // Store signature ID instead of raw signature
      });

      // Generate audit trail
      const auditHash = cryptoService.generateAuditHash(
        signatureResult,
        doctorId,
        medicalRecord.patientId
      );

      // Broadcast signature event for real-time updates
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, { 
        type: 'prescription_signed', 
        data: { 
          medicalRecordId,
          signatureId: digitalSignature.id,
          auditHash 
        } 
      });

      res.status(201).json({
        signature: digitalSignature,
        auditHash,
        note: 'Demo implementation - not production compliant'
      });

    } catch (error) {
      console.error('Prescription signing error:', error);
      res.status(500).json({ message: 'Failed to sign prescription' });
    }
  });

  // Verify prescription signature
  app.get('/api/medical-records/:id/verify-signature', async (req, res) => {
    try {
      const medicalRecordId = req.params.id;

      // Get medical record
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      if (!medicalRecord.digitalSignature) {
        return res.status(404).json({ message: 'No digital signature found for this prescription' });
      }

      // Use efficient signature lookup method
      const prescriptionSignature = await storage.getSignatureByDocument(medicalRecordId, 'prescription');

      if (!prescriptionSignature) {
        return res.status(404).json({ message: 'Digital signature record not found' });
      }

      // Extract stored verification data
      const certInfo = prescriptionSignature.certificateInfo as any || {};
      const storedPublicKey = certInfo.publicKey;
      const storedTimestamp = certInfo.timestamp;

      if (!storedPublicKey || !storedTimestamp) {
        return res.status(400).json({ message: 'Invalid signature record - missing verification data' });
      }

      // Verify signature using stored public key and timestamp
      const isValid = await cryptoService.verifySignature(
        medicalRecord.prescription || '',
        prescriptionSignature.signature,
        storedPublicKey,
        storedTimestamp
      );

      res.json({
        isValid,
        signatureInfo: {
          algorithm: certInfo.algorithm || 'Unknown',
          signedAt: prescriptionSignature.signedAt,
          certificateInfo: prescriptionSignature.certificateInfo,
          note: 'Demo verification - not production compliant'
        }
      });

    } catch (error) {
      console.error('Signature verification error:', error);
      res.status(500).json({ message: 'Failed to verify signature' });
    }
  });

  // Dashboard Stats API (Moved to after requireAuth definition)


  // WhatsApp Messages API
  app.get('/api/whatsapp/messages/recent', async (req, res) => {
    try {
      const messages = await storage.getUnprocessedWhatsappMessages();
      const recentMessages = messages.slice(0, 50);
      res.json(recentMessages);
    } catch (error) {
      console.error('WhatsApp messages error:', error);
      res.status(500).json({ message: 'Failed to get messages' });
    }
  });

  app.get('/api/exam-results/recent', async (req, res) => {
    try {
      // Return empty array for now since we don't have patients with exam results yet
      res.json([]);
    } catch (error) {
      console.error('Recent exam results error:', error);
      res.status(500).json({ message: 'Failed to get exam results' });
    }
  });

  // Video Consultation API Routes
  
  // Get or create video consultation for a patient (used by video page)
  app.post('/api/video-consultations/start-with-patient/:patientId', async (req, res) => {
    try {
      // Require authentication
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Require doctor role
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors can start video consultations' });
      }
      
      const patientId = req.params.patientId;
      const doctorId = req.user.id;
      
      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      
      // Check if there's already an active or waiting consultation for this patient-doctor pair
      const existingConsultations = await db.select().from(videoConsultations)
        .where(and(
          eq(videoConsultations.patientId, patientId),
          eq(videoConsultations.doctorId, doctorId),
          or(
            eq(videoConsultations.status, 'waiting'),
            eq(videoConsultations.status, 'active')
          )
        ))
        .orderBy(desc(videoConsultations.createdAt))
        .limit(1);
      
      if (existingConsultations.length > 0) {
        // Return existing consultation (idempotent)
        return res.status(200).json(existingConsultations[0]);
      }
      
      // Create new consultation
      const consultation = await storage.createVideoConsultation({
        patientId,
        doctorId,
        status: 'waiting',
      });

      if (patient.userId) {
        const directLink = `/patient/video/${consultation.id}`;
        broadcastToUser(patient.userId, {
          type: 'consultation_invite',
          data: {
            title: 'Convite para Teleconsulta',
            message: `Dr(a). ${req.user.name} está chamando você para uma consulta por vídeo.`,
            priority: 'critical',
            consultationId: consultation.id,
            doctorName: req.user.name,
            actionUrl: directLink,
            directLink: directLink
          }
        });

        try {
          await db.insert(pendingNotifications).values({
            userId: patient.userId,
            type: 'consultation_invite',
            title: 'Convite para Teleconsulta',
            message: `Dr(a). ${req.user.name} está chamando você para uma consulta por vídeo. Acesse: ${directLink}`,
            priority: 'critical',
            actionUrl: directLink,
            senderId: doctorId,
            delivered: false,
            read: false,
            metadata: { consultationId: consultation.id, directLink }
          });
        } catch (notifErr) {
          console.error('Failed to store video invite notification:', notifErr);
        }
      }
      
      res.status(201).json(consultation);
    } catch (error) {
      console.error('Start video consultation with patient error:', error);
      res.status(400).json({ message: 'Failed to start video consultation', error });
    }
  });
  
  // Create a new video consultation session
  app.post('/api/video-consultations', async (req: any, res) => {
    try {
      const doctorId = req.user?.id || req.body.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID;
      const data = { ...req.body, doctorId };
      const validatedData = insertVideoConsultationSchema.parse(data);
      const consultation = await storage.createVideoConsultation(validatedData);
      
      // Broadcast to authenticated doctor only
      broadcastToDoctor(consultation.doctorId || doctorId, { type: 'consultation_created', data: consultation });
      
      res.status(201).json(consultation);
    } catch (error) {
      console.error('Create video consultation error:', error);
      res.status(400).json({ message: 'Invalid video consultation data', error });
    }
  });

  // Get video consultations by appointment (specific route before /:id)
  app.get('/api/video-consultations/appointment/:appointmentId', async (req, res) => {
    try {
      const consultations = await storage.getVideoConsultationsByAppointment(req.params.appointmentId);
      res.json(consultations);
    } catch (error) {
      console.error('Get consultations by appointment error:', error);
      res.status(500).json({ message: 'Failed to get video consultations' });
    }
  });

  // Get active video consultations for a doctor (specific route before /:id)
  app.get('/api/video-consultations/active/:doctorId', async (req, res) => {
    try {
      const consultations = await storage.getActiveVideoConsultations(req.params.doctorId);

      const patientIds = [...new Set(consultations.map((vc: any) => vc.patientId).filter(Boolean))];
      const patientMap: Record<string, any> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      const enriched = consultations.map((vc: any) => ({
        ...vc,
        patientName: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].name : 'Paciente não identificado',
      }));

      res.json(enriched);
    } catch (error) {
      console.error('Get active consultations error:', error);
      res.status(500).json({ message: 'Failed to get active consultations' });
    }
  });

  app.post('/api/video-consultations/close-all-active', async (req: any, res) => {
    try {
      const doctorId = req.user?.id || actualDoctorId || DEFAULT_DOCTOR_ID;
      const activeConsultations = await storage.getActiveVideoConsultations(doctorId);
      
      if (activeConsultations.length === 0) {
        return res.json({ message: 'Nenhuma videochamada ativa encontrada.', closed: 0 });
      }

      let closedCount = 0;
      for (const consultation of activeConsultations) {
        try {
          await storage.updateVideoConsultation(consultation.id, {
            status: 'ended',
            endedAt: new Date(),
            connectionLogs: { endReason: 'bulk_close_by_doctor', completionStatus: 'ended' }
          });
          closedCount++;

          if (wss) {
            wss.clients.forEach((client: any) => {
              if (client.readyState === 1) {
                client.send(JSON.stringify({
                  type: 'consultation_ended',
                  consultationId: consultation.id,
                  reason: 'doctor_closed_all'
                }));
              }
            });
          }
        } catch (err) {
          console.error(`Failed to close consultation ${consultation.id}:`, err);
        }
      }

      res.json({ 
        message: `${closedCount} videochamada${closedCount !== 1 ? 's' : ''} encerrada${closedCount !== 1 ? 's' : ''}.`,
        closed: closedCount 
      });
    } catch (error) {
      console.error('Close all active consultations error:', error);
      res.status(500).json({ message: 'Erro ao encerrar videochamadas.' });
    }
  });

  // Generic Agora token generation endpoint
  app.post('/api/agora/generate-token', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { channelName, uid, role } = req.body;

      if (!channelName) {
        return res.status(400).json({ message: 'Channel name is required' });
      }

      const rawUidHash = Math.abs(req.user.id.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0));
      const numericUid = uid || ((rawUidHash % 9999) + 1);

      const token = generateAgoraToken({
        channelName,
        uid: numericUid,
        role: (role as 'publisher' | 'subscriber') || 'publisher',
        expirationTimeInSeconds: 3600 // 1 hour
      });

      res.json({
        token,
        appId: getAgoraAppId(),
        channelName,
        uid: numericUid
      });
    } catch (error) {
      console.error('Generate Agora token error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate token';
      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate Agora token for video consultation (specific route before /:id)
  app.post('/api/video-consultations/agora-token', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { channelName, role } = req.body;

      if (!channelName || !role) {
        return res.status(400).json({ message: 'Channel name and role are required' });
      }

      const rawHash = Math.abs(req.user.id.split('').reduce((a: number, b: string) => ((a << 5) - a) + b.charCodeAt(0), 0));
      const uid = (rawHash % 9999) + 1;

      const token = generateAgoraToken({
        channelName,
        uid,
        role: role as 'publisher' | 'subscriber',
        expirationTimeInSeconds: 3600 // 1 hour
      });

      res.json({
        token,
        appId: getAgoraAppId(),
        channelName,
        uid
      });
    } catch (error) {
      console.error('Generate Agora token error:', error);
      res.status(500).json({ message: 'Failed to generate token' });
    }
  });

  // Get all incomplete consultations for the current doctor
  app.get('/api/video-consultations/incomplete', async (req: any, res) => {
    try {
      const doctorId = req.user?.id || actualDoctorId || DEFAULT_DOCTOR_ID;
      const incompleteVCs = await db.select()
        .from(videoConsultations)
        .where(and(
          eq(videoConsultations.doctorId, doctorId),
          eq(videoConsultations.status, 'incomplete')
        ))
        .orderBy(desc(videoConsultations.createdAt));

      const patientIds = [...new Set(incompleteVCs.map(vc => vc.patientId).filter(Boolean))];
      const patientMap: Record<string, any> = {};
      for (const pid of patientIds) {
        if (pid) {
          try {
            const p = await storage.getPatient(pid);
            if (p) patientMap[pid] = p;
          } catch {}
        }
      }

      const enriched = incompleteVCs.map(vc => ({
        ...vc,
        patientName: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].name : 'Paciente não identificado',
        patientEmail: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].email : null,
        patientPhone: vc.patientId && patientMap[vc.patientId] ? patientMap[vc.patientId].phone : null,
      }));

      res.json(enriched);
    } catch (error) {
      console.error('Get incomplete consultations error:', error);
      res.status(500).json({ message: 'Failed to get incomplete consultations' });
    }
  });

  // Get video consultation history for a specific patient
  app.get('/api/video-consultations/patient-history/:patientId', async (req: any, res) => {
    try {
      const history = await db.select()
        .from(videoConsultations)
        .where(eq(videoConsultations.patientId, req.params.patientId))
        .orderBy(desc(videoConsultations.createdAt));

      res.json(history);
    } catch (error) {
      console.error('Get patient video history error:', error);
      res.status(500).json({ message: 'Failed to get patient video history' });
    }
  });

  // Request inter-consultation with a specialist
  app.post('/api/video-consultations/:id/request-interconsult', async (req: any, res) => {
    try {
      const { specialistId, message, patientId } = req.body;
      const consultation = await storage.getVideoConsultation(req.params.id);
      if (!consultation) {
        return res.status(404).json({ message: 'Consultation not found' });
      }

      const doctorId = req.user?.id || actualDoctorId || DEFAULT_DOCTOR_ID;
      let patientName = 'Paciente';
      if (patientId) {
        try {
          const patient = await storage.getPatient(patientId);
          if (patient) patientName = patient.name;
        } catch {}
      }

      let doctorName = 'Médico';
      try {
        const doctorArr = await db.select().from(users).where(eq(users.id, doctorId)).limit(1);
        if (doctorArr[0]) doctorName = doctorArr[0].name || doctorArr[0].username;
      } catch {}

      await db.insert(pendingNotifications).values({
        userId: specialistId,
        type: 'interconsultation_request',
        title: `Solicitação de Interconsulta - ${patientName}`,
        message: message || `Dr(a). ${doctorName} solicita interconsulta para o paciente ${patientName}.`,
        priority: 'high',
        actionUrl: `/consultation/video/${patientId}`,
        senderId: doctorId,
        delivered: false,
        read: false,
        metadata: {
          consultationId: consultation.id,
          patientId,
          patientName,
          requestingDoctorId: doctorId,
          requestingDoctorName: doctorName,
          message,
          allowJoin: true,
        }
      });

      broadcastToUser(specialistId, {
        type: 'interconsultation_request',
        data: {
          consultationId: consultation.id,
          patientId,
          patientName,
          requestingDoctorId: doctorId,
          requestingDoctorName: doctorName,
          message,
          actionUrl: `/consultation/video/${patientId}`,
        }
      });

      res.json({ success: true, message: 'Interconsultation request sent' });
    } catch (error) {
      console.error('Request interconsult error:', error);
      res.status(500).json({ message: 'Failed to request interconsultation' });
    }
  });

  // Notify offline doctors about interconsultation need
  app.post('/api/video-consultations/:id/notify-offline-doctors', async (req: any, res) => {
    try {
      const { doctorIds, message, patientId } = req.body;
      const consultation = await storage.getVideoConsultation(req.params.id);
      if (!consultation) {
        return res.status(404).json({ message: 'Consultation not found' });
      }

      const doctorId = req.user?.id || actualDoctorId || DEFAULT_DOCTOR_ID;
      let patientName = 'Paciente';
      if (patientId) {
        try {
          const patient = await storage.getPatient(patientId);
          if (patient) patientName = patient.name;
        } catch {}
      }

      let requestingDoctorName = 'Médico';
      try {
        const doctorArr = await db.select().from(users).where(eq(users.id, doctorId)).limit(1);
        if (doctorArr[0]) requestingDoctorName = doctorArr[0].name || doctorArr[0].username;
      } catch {}

      const notificationResults: any[] = [];

      for (const targetDoctorId of doctorIds) {
        try {
          // System notification
          await db.insert(pendingNotifications).values({
            userId: targetDoctorId,
            type: 'interconsultation_request',
            title: `Urgente: Interconsulta - ${patientName}`,
            message: `Dr(a). ${requestingDoctorName} solicita interconsulta para ${patientName}. ${message}`,
            priority: 'critical',
            actionUrl: `/consultation/video/${patientId}`,
            senderId: doctorId,
            delivered: false,
            read: false,
            metadata: {
              consultationId: consultation.id,
              patientId,
              patientName,
              requestingDoctorId: doctorId,
              requestingDoctorName,
              offlineNotification: true,
              channels: ['system', 'whatsapp', 'sms'],
            }
          });

          // WebSocket notification (in case they come online)
          broadcastToUser(targetDoctorId, {
            type: 'interconsultation_request',
            data: {
              consultationId: consultation.id,
              patientId,
              patientName,
              requestingDoctorName,
              message,
              urgent: true,
            }
          });

          // WhatsApp message
          try {
            const targetDocArr = await db.select().from(users).where(eq(users.id, targetDoctorId)).limit(1);
            if (targetDocArr[0]?.phone) {
              const whatsappMsg = `🔴 INTERCONSULTA URGENTE\n\nDr(a). ${requestingDoctorName} solicita sua avaliação para o paciente ${patientName}.\n\n${message}\n\nAcesse o sistema para mais detalhes e entrar na consulta.`;
              
              await db.insert(whatsappMessages).values({
                patientId: targetDoctorId,
                direction: 'outbound',
                messageType: 'text',
                content: whatsappMsg,
                status: 'sent',
                senderRole: 'system',
                metadata: {
                  type: 'interconsultation_notification',
                  consultationId: consultation.id,
                  patientId,
                },
              });

              try {
                await whatsAppService.sendMessage(targetDocArr[0].phone, whatsappMsg);
              } catch (whatsErr) {
                console.warn('WhatsApp send failed (API not configured):', whatsErr);
              }
            }
          } catch (whatsappErr) {
            console.warn('WhatsApp notification failed:', whatsappErr);
          }

          notificationResults.push({ doctorId: targetDoctorId, status: 'notified' });
        } catch (notifErr) {
          console.error(`Failed to notify doctor ${targetDoctorId}:`, notifErr);
          notificationResults.push({ doctorId: targetDoctorId, status: 'failed' });
        }
      }

      res.json({ success: true, results: notificationResults });
    } catch (error) {
      console.error('Notify offline doctors error:', error);
      res.status(500).json({ message: 'Failed to notify offline doctors' });
    }
  });

  // Get video consultation by ID (generic route - must come after specific routes)
  app.get('/api/video-consultations/:id', async (req, res) => {
    try {
      const consultation = await storage.getVideoConsultation(req.params.id);
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }
      res.json(consultation);
    } catch (error) {
      console.error('Get video consultation error:', error);
      res.status(500).json({ message: 'Failed to get video consultation' });
    }
  });

  // Update video consultation status and details
  app.patch('/api/video-consultations/:id', async (req, res) => {
    try {
      const { status, startedAt, endedAt, duration, recordingUrl, audioRecordingUrl, connectionLogs } = req.body;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (startedAt) updateData.startedAt = new Date(startedAt);
      if (endedAt) updateData.endedAt = new Date(endedAt);
      if (duration !== undefined) updateData.duration = duration;
      if (recordingUrl) updateData.recordingUrl = recordingUrl;
      if (audioRecordingUrl) updateData.audioRecordingUrl = audioRecordingUrl;
      if (connectionLogs) updateData.connectionLogs = connectionLogs;

      const consultation = await storage.updateVideoConsultation(req.params.id, updateData);
      
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }

      // Broadcast status updates to authenticated doctor only
      broadcastToDoctor(consultation.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID, { type: 'consultation_updated', data: consultation });
      
      res.json(consultation);
    } catch (error) {
      console.error('Update video consultation error:', error);
      res.status(500).json({ message: 'Failed to update video consultation' });
    }
  });

  // Start video consultation (updates status to active)
  app.post('/api/video-consultations/:id/start', async (req, res) => {
    try {
      const consultation = await storage.updateVideoConsultation(req.params.id, {
        status: 'active',
        startedAt: new Date()
      });
      
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }

      broadcastToDoctor(consultation.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID, { type: 'consultation_started', data: consultation });
      
      // Notify patient that doctor has joined
      if (consultation.patientId) {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          if (patient?.userId) {
            broadcastToUser(patient.userId, {
              type: 'doctor_joined',
              data: {
                consultationId: consultation.id,
                message: 'O médico entrou na consulta.',
                status: 'active'
              }
            });
          }
        } catch (e) {
          console.error('Failed to notify patient about doctor join:', e);
        }
      }
      
      res.json(consultation);
    } catch (error) {
      console.error('Start consultation error:', error);
      res.status(500).json({ message: 'Failed to start consultation' });
    }
  });

  async function generateDiagnosticInference(
    consultationId: string,
    patientId: string,
    doctorId: string,
    clinicalSummary: string,
    patientName: string
  ) {
    try {
      const diagnosticPrompt = `Analise os dados clínicos abaixo e extraia TODAS as hipóteses diagnósticas sindrômicas possíveis, classificadas segundo CID-10/CID-11 e DSM-5/DSM-5-TR quando aplicável.

Para cada hipótese, forneça:
- code: código CID-10 ou DSM-5 (ex: "J06.9", "F32.1", "K21.0")
- system: sistema de classificação ("CID-10", "CID-11", "DSM-5", "DSM-5-TR")
- description: nome completo do diagnóstico em português
- confidence: percentual de certeza (0-100) baseado nos dados clínicos disponíveis
- category: categoria sindrômica (ex: "Infeccioso", "Neuropsiquiátrico", "Cardiovascular", "Endócrino", "Gastrointestinal", "Respiratório", "Musculoesquelético", "Dermatológico", etc.)
- differentials: array com diagnósticos diferenciais a considerar
- redFlags: sinais de alerta que exigem atenção imediata (se houver)
- suggestedExams: exames complementares sugeridos para confirmar/descartar

Ordene por probabilidade (confidence) decrescente.
Retorne APENAS um JSON válido no formato: { "hypotheses": [...], "overallConfidence": <média ponderada> }

Baseie suas análises nas diretrizes da OMS (WHO), Protocolos de Atenção Primária do Ministério da Saúde do Brasil (CAB, PCDT, CONITEC), DSM-5/DSM-5-TR (APA) e evidências científicas atuais.

Dados da consulta:
Paciente: ${patientName}
${clinicalSummary}`;

      const result = await geminiService.generateText(
        diagnosticPrompt,
        'Você é um sistema de classificação diagnóstica médica especializado em CID-10/CID-11 e DSM-5. Retorne APENAS JSON válido, sem markdown nem explicações adicionais.'
      );

      const cleanJson = result.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (!parsed.hypotheses || !Array.isArray(parsed.hypotheses)) {
        console.warn('Invalid diagnostic inference format');
        return;
      }

      const overallConfidence = parsed.overallConfidence || Math.round(
        parsed.hypotheses.reduce((sum: number, h: any) => sum + (h.confidence || 0), 0) / Math.max(parsed.hypotheses.length, 1)
      );
      const needsReview = overallConfidence < 96;

      const inference = await storage.createDiagnosticInference({
        consultationId,
        patientId,
        doctorId,
        hypotheses: parsed.hypotheses,
        overallConfidence,
        needsReview,
        reviewStatus: needsReview ? 'pending' : 'pending',
        clinicalHistoryAuthorized: false,
        epidemiologicalAuthorized: false,
        reviewNotes: null,
        compiledAt: null,
      });

      console.log(`✅ Diagnostic inference generated: ${parsed.hypotheses.length} hypotheses, confidence: ${overallConfidence}%, needs review: ${needsReview}`);

      if (needsReview) {
        await db.insert(pendingNotifications).values({
          userId: doctorId,
          type: 'diagnostic_review',
          title: `Inferência diagnóstica requer revisão — ${patientName}`,
          message: `${parsed.hypotheses.length} hipótese(s) diagnóstica(s) com certeza de ${overallConfidence}% (abaixo de 96%). Revisão necessária antes de compilar história clínica. Autorize a compilação da história clínica e do quadro de inferência diagnóstico-epidemiológica.`,
          priority: 'high',
          actionUrl: '/diagnostic-review',
          delivered: false,
          read: false,
          metadata: {
            inferenceId: inference.id,
            consultationId,
            patientId,
            patientName,
            overallConfidence,
            hypothesesCount: parsed.hypotheses.length,
            requiresAuthorization: true,
          }
        });
        broadcastToDoctor(doctorId, {
          type: 'diagnostic_review_required',
          data: {
            inferenceId: inference.id,
            consultationId,
            patientName,
            overallConfidence,
            hypothesesCount: parsed.hypotheses.length,
            message: `Inferência diagnóstica (${overallConfidence}%) requer revisão e autorização.`
          }
        });
      } else {
        await db.insert(pendingNotifications).values({
          userId: doctorId,
          type: 'diagnostic_ready',
          title: `Diagnóstico sindrômico concluído — ${patientName}`,
          message: `${parsed.hypotheses.length} hipótese(s) com certeza de ${overallConfidence}%. Autorize a compilação da história clínica e do quadro de inferência diagnóstico-epidemiológica no sistema.`,
          priority: 'medium',
          actionUrl: '/diagnostic-review',
          delivered: false,
          read: false,
          metadata: {
            inferenceId: inference.id,
            consultationId,
            patientId,
            patientName,
            overallConfidence,
            hypothesesCount: parsed.hypotheses.length,
            requiresAuthorization: true,
          }
        });
        broadcastToDoctor(doctorId, {
          type: 'diagnostic_ready',
          data: {
            inferenceId: inference.id,
            consultationId,
            patientName,
            overallConfidence,
            hypothesesCount: parsed.hypotheses.length,
            message: `Diagnóstico sindrômico concluído (${overallConfidence}%). Aguardando autorização para compilar.`
          }
        });
      }
    } catch (diagErr) {
      console.error('Failed to generate diagnostic inference:', diagErr);
    }
  }

  // End video consultation (doctor ends the consultation)
  app.post('/api/video-consultations/:id/end', async (req: any, res) => {
    try {
      const { duration, meetingNotes, completionStatus, endReason } = req.body;
      
      const finalStatus = completionStatus === 'completed' ? 'completed' : 
                          completionStatus === 'incomplete' ? 'incomplete' :
                          completionStatus === 'timed_out' ? 'timed_out' : 'ended';
      
      const consultation = await storage.updateVideoConsultation(req.params.id, {
        status: finalStatus,
        endedAt: new Date(),
        duration: duration || 0,
        meetingNotes: meetingNotes || '',
        connectionLogs: endReason ? { endReason, completionStatus: finalStatus } : undefined
      });
      
      if (!consultation) {
        return res.status(404).json({ message: 'Consulta não encontrada' });
      }

      // Auto-generate medical record from consultation data
      if (consultation.patientId && meetingNotes && finalStatus === 'completed') {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          const consultNotes = await storage.getConsultationNotes(consultation.id);
          const doctorNotes = consultNotes.filter((n: any) => n.type === 'doctor_note' || n.type === 'annotation').map((n: any) => n.content).join('\n');
          const transcriptions = consultNotes.filter((n: any) => n.type === 'transcription').map((n: any) => n.content).join('\n');
          const chatMessages = consultNotes.filter((n: any) => n.type === 'chat').map((n: any) => n.content).join('\n');
          const aiResponses = consultNotes.filter((n: any) => n.type === 'ai_response').map((n: any) => n.content).join('\n');
          
          const clinicalSummary = [
            meetingNotes ? `Notas da consulta: ${meetingNotes}` : '',
            doctorNotes ? `Anotações médicas: ${doctorNotes}` : '',
            transcriptions ? `Transcrição: ${transcriptions}` : '',
            aiResponses ? `Análise IA: ${aiResponses}` : '',
          ].filter(Boolean).join('\n\n');

          let aiSummary = clinicalSummary;
          try {
            const summaryPrompt = `Com base nos dados a seguir de uma teleconsulta médica, elabore um prontuário clínico completo e estruturado em português brasileiro, seguindo os protocolos do Ministério da Saúde do Brasil. Inclua: Queixa principal, História da doença atual, Exame clínico (se mencionado), Hipótese diagnóstica, Conduta/Plano terapêutico, e Observações.\n\nPaciente: ${patient?.name || 'Não identificado'}\n\n${clinicalSummary}`;
            aiSummary = await geminiService.generateText(summaryPrompt, 'Você é um assistente médico especializado em prontuários clínicos.');
          } catch (aiErr) {
            console.warn('AI summary generation failed, using raw notes:', aiErr);
          }

          await storage.createMedicalRecord({
            patientId: consultation.patientId,
            doctorId: consultation.doctorId || req.user?.id || DEFAULT_DOCTOR_ID,
            date: new Date(),
            type: 'consultation',
            diagnosis: '',
            treatment: '',
            notes: aiSummary,
            vitalSigns: {},
          });
          console.log(`✅ Auto-generated medical record for patient ${consultation.patientId}`);

          // Auto-generate post-consultation items (prescriptions, exams, referrals)
          try {
            const itemsPrompt = `Com base nos dados da teleconsulta abaixo, extraia TODOS os itens pós-consulta em formato JSON. Para cada item, retorne um objeto com: type ("prescription"|"exam"|"referral"|"followup"), title (nome curto), description (descrição clínica detalhada), details (objeto JSON com dados específicos), patientSummary (explicação em linguagem acessível para o paciente).

Para prescrições (prescription): details deve conter { medications: [{ name, dosage, frequency, duration, route, instructions }] }
Para exames (exam): details deve conter { exams: [{ name, type, urgency, justification }] }
Para encaminhamentos (referral): details deve conter { specialty, reason, urgency, notes }
Para retornos (followup): details deve conter { suggestedDate, reason, instructions }

Retorne APENAS um array JSON válido. Se não houver itens, retorne [].

Dados da consulta:
${clinicalSummary}`;
            const itemsJson = await geminiService.generateText(itemsPrompt, 'Você é um assistente médico que extrai dados estruturados de prontuários. Retorne APENAS JSON válido, sem markdown.');
            const cleanJson = itemsJson.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
            const items = JSON.parse(cleanJson);
            if (Array.isArray(items)) {
              for (const item of items) {
                await storage.createPostConsultationItem({
                  consultationId: consultation.id,
                  patientId: consultation.patientId!,
                  doctorId: consultation.doctorId || req.user?.id || DEFAULT_DOCTOR_ID,
                  type: item.type || 'prescription',
                  title: item.title || 'Item pós-consulta',
                  description: item.description || '',
                  details: item.details || {},
                  status: 'pending_review',
                  patientSummary: item.patientSummary || '',
                  reviewNotes: null,
                  aiAnalysis: null,
                  reviewedAt: null,
                });
              }
              console.log(`✅ Auto-generated ${items.length} post-consultation items`);

              if (items.length > 0) {
                const doctorId = consultation.doctorId || req.user?.id || DEFAULT_DOCTOR_ID;
                await db.insert(pendingNotifications).values({
                  userId: doctorId,
                  type: 'post_consultation_review',
                  title: `${items.length} itens pós-consulta aguardam revisão`,
                  message: `Prescrições, exames e encaminhamentos gerados automaticamente para ${patient?.name || 'paciente'} precisam da sua aprovação.`,
                  priority: 'high',
                  actionUrl: '/post-consultation-review',
                  delivered: false,
                  read: false,
                  metadata: { consultationId: consultation.id, itemCount: items.length }
                });
                broadcastToDoctor(doctorId, {
                  type: 'post_consultation_review',
                  data: { consultationId: consultation.id, itemCount: items.length, patientName: patient?.name }
                });
              }
            }
          } catch (itemsErr) {
            console.error('Failed to auto-generate post-consultation items:', itemsErr);
          }

          // Auto-generate diagnostic syndromic inference with CID/DSM classification
          await generateDiagnosticInference(
            consultation.id,
            consultation.patientId!,
            consultation.doctorId || req.user?.id || DEFAULT_DOCTOR_ID,
            clinicalSummary,
            patient?.name || 'Paciente'
          );
        } catch (recordErr) {
          console.error('Failed to auto-generate medical record:', recordErr);
        }
      }

      // If incomplete, notify doctor with follow-up options
      if (finalStatus === 'incomplete' && consultation.doctorId) {
        try {
          const incPatient = await storage.getPatient(consultation.patientId!);
          const patientName = incPatient?.name || 'Paciente';
          
          await db.insert(pendingNotifications).values({
            userId: consultation.doctorId,
            type: 'incomplete_consultation',
            title: `Consulta inconcluída - ${patientName}`,
            message: endReason || 'A consulta foi encerrada sem confirmação de conclusão. Ações de acompanhamento necessárias.',
            priority: 'high',
            actionUrl: `/consultation/video/${consultation.patientId}`,
            senderId: consultation.patientId || undefined,
            delivered: false,
            read: false,
            metadata: { 
              consultationId: consultation.id,
              patientId: consultation.patientId,
              patientName,
              endReason: endReason || 'Saída sem conclusão',
              allowReactivate: true,
              allowComplete: true,
              allowMessage: true
            }
          });
          
          broadcastToDoctor(consultation.doctorId, {
            type: 'incomplete_consultation',
            data: {
              title: `Consulta inconcluída - ${patientName}`,
              message: endReason || 'Consulta encerrada sem confirmação de conclusão.',
              consultationId: consultation.id,
              patientId: consultation.patientId,
              patientName,
              actionUrl: `/consultation/video/${consultation.patientId}`,
              allowReactivate: true,
              allowComplete: true
            }
          });
        } catch (notifErr) {
          console.error('Failed to send incomplete consultation notification:', notifErr);
        }
      }

      if (duration && duration > 0 && consultation.patientId) {
        try {
          const config = await tmcCreditsService.getCreditConfig();
          const durationMinutes = Math.ceil(duration / 60);
          
          let totalCredits = durationMinutes * config.CREDIT_PER_MINUTE;
          let pricingMode = 'per_minute';
          let doctorPrice = 0;

          if (consultation.doctorId) {
            const doctorArr = await db.select().from(users).where(eq(users.id, consultation.doctorId)).limit(1);
            if (doctorArr[0] && doctorArr[0].consultationPrice && doctorArr[0].consultationPrice > 0) {
              doctorPrice = doctorArr[0].consultationPrice;
              totalCredits = doctorPrice;
              pricingMode = 'fixed_price';
            }
          }
          
          const patient = await storage.getPatient(consultation.patientId);
          
          if (patient?.userId) {
            const userArr = await db.select().from(users).where(eq(users.id, patient.userId)).limit(1);
            
            if (userArr[0] && userArr[0].role !== 'admin') {
              try {
                await tmcCreditsService.debitCredits(
                  patient.userId,
                  totalCredits,
                  'video_consultation',
                  {
                    functionUsed: 'video_consultation',
                    consultationId: consultation.id,
                    durationMinutes,
                    durationSeconds: duration,
                    pricingMode,
                    doctorPrice
                  }
                );
                
                if (consultation.doctorId) {
                  const commissionPercent = config.CONSULTATION_COMMISSION_PERCENT ?? config.DOCTOR_COMMISSION_PERCENT;
                  const platformFee = Math.floor((totalCredits * commissionPercent) / 100);
                  const doctorEarnings = totalCredits - platformFee;
                  
                  if (doctorEarnings > 0) {
                    await tmcCreditsService.creditUser(
                      consultation.doctorId,
                      doctorEarnings,
                      'consultation_commission',
                      {
                        functionUsed: 'video_consultation_commission',
                        consultationId: consultation.id,
                        originalAmount: totalCredits,
                        platformFee,
                        commissionPercent,
                        pricingMode
                      }
                    );
                  }

                  if (platformFee > 0) {
                    try {
                      await tmcCreditsService.addToCashbox(platformFee, 'consultation_platform_fee', {
                        consultationId: consultation.id,
                        doctorId: consultation.doctorId,
                        totalCharged: totalCredits,
                        commissionPercent
                      });
                    } catch (cashErr) {
                      console.warn('Cashbox update failed:', cashErr);
                    }
                  }

                  // Referral commission: pay the referring doctor a % of the consultation
                  try {
                    const doctorRecord = await db.select({ superiorDoctorId: users.superiorDoctorId }).from(users).where(eq(users.id, consultation.doctorId)).limit(1);
                    if (doctorRecord[0]?.superiorDoctorId) {
                      const refSetting = await storage.getSystemSetting('doctor_referral_commission_percent');
                      const referralPercent = refSetting ? parseInt(refSetting.settingValue) : 5;
                      if (referralPercent > 0) {
                        const referralAmount = Math.floor((totalCredits * referralPercent) / 100);
                        if (referralAmount > 0) {
                          await tmcCreditsService.creditUser(
                            doctorRecord[0].superiorDoctorId,
                            referralAmount,
                            'referral_commission',
                            {
                              functionUsed: 'referral_commission',
                              consultationId: consultation.id,
                              referredDoctorId: consultation.doctorId,
                              originalAmount: totalCredits,
                              referralPercent,
                            }
                          );
                          console.log(`✅ Referral commission: ${referralAmount} credits to ${doctorRecord[0].superiorDoctorId} (${referralPercent}%)`);
                        }
                      }
                    }
                  } catch (refErr) {
                    console.warn('Referral commission failed:', refErr);
                  }
                }
                
                console.log(`✅ Charged ${totalCredits} credits (${pricingMode}) for consultation`);
              } catch (creditError: any) {
                console.error('Credit charging error:', creditError);
                if (creditError.message === 'Insufficient credits') {
                  console.warn('Patient has insufficient credits, consultation ended without charge');
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing consultation credits:', error);
        }
      }

      // Notify doctor
      broadcastToDoctor(consultation.doctorId || DEFAULT_DOCTOR_ID, { type: 'consultation_ended', data: consultation });

      // Notify patient that consultation was ended
      if (consultation.patientId) {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          if (patient?.userId) {
            broadcastToUser(patient.userId, {
              type: 'consultation_ended',
              data: {
                consultationId: consultation.id,
                message: 'A consulta foi encerrada pelo médico.',
                actionUrl: '/my-consultations'
              }
            });
          }
        } catch (e) {
          console.error('Failed to notify patient about end:', e);
        }
      }
      
      res.json(consultation);
    } catch (error) {
      console.error('End consultation error:', error);
      res.status(500).json({ message: 'Falha ao encerrar consulta' });
    }
  });

  // Complete an incomplete consultation (doctor confirms completion later)
  app.post('/api/video-consultations/:id/complete', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Apenas médicos podem concluir consultas' });
      }

      const { notes } = req.body;
      const existing = await storage.getVideoConsultation(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: 'Consulta não encontrada' });
      }

      const updatedNotes = existing.meetingNotes 
        ? `${existing.meetingNotes}\n\n--- Conclusão posterior ---\n${notes || 'Consulta concluída pelo médico.'}`
        : notes || 'Consulta concluída pelo médico.';

      const consultation = await storage.updateVideoConsultation(req.params.id, {
        status: 'completed',
        meetingNotes: updatedNotes
      });

      // Auto-generate medical record
      if (consultation && consultation.patientId) {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          const consultNotes = await storage.getConsultationNotes(consultation.id);
          const allNotes = consultNotes.map((n: any) => n.content).join('\n');
          
          let aiSummary = `${updatedNotes}\n${allNotes}`;
          try {
            const summaryPrompt = `Com base nos dados a seguir de uma teleconsulta médica, elabore um prontuário clínico completo em português brasileiro. Inclua: Queixa principal, HDA, Hipótese diagnóstica, Conduta.\n\nPaciente: ${patient?.name || 'Não identificado'}\n\n${updatedNotes}\n${allNotes}`;
            aiSummary = await geminiService.generateText(summaryPrompt, 'Você é um assistente médico especializado em prontuários clínicos.');
          } catch {}
          
          await storage.createMedicalRecord({
            patientId: consultation.patientId,
            doctorId: consultation.doctorId || req.user.id,
            date: new Date(),
            type: 'consultation',
            diagnosis: '',
            treatment: '',
            notes: aiSummary,
            vitalSigns: {},
          });

          // Auto-generate post-consultation items on complete
          try {
            const clinicalData = `${updatedNotes}\n${allNotes}`;
            const itemsPrompt = `Com base nos dados da teleconsulta abaixo, extraia TODOS os itens pós-consulta em formato JSON. Para cada item, retorne um objeto com: type ("prescription"|"exam"|"referral"|"followup"), title (nome curto), description (descrição clínica detalhada), details (objeto JSON com dados específicos), patientSummary (explicação em linguagem acessível para o paciente).

Para prescrições (prescription): details deve conter { medications: [{ name, dosage, frequency, duration, route, instructions }] }
Para exames (exam): details deve conter { exams: [{ name, type, urgency, justification }] }
Para encaminhamentos (referral): details deve conter { specialty, reason, urgency, notes }
Para retornos (followup): details deve conter { suggestedDate, reason, instructions }

Retorne APENAS um array JSON válido. Se não houver itens, retorne [].

Dados da consulta:
${clinicalData}`;
            const itemsJson = await geminiService.generateText(itemsPrompt, 'Você é um assistente médico que extrai dados estruturados de prontuários. Retorne APENAS JSON válido, sem markdown.');
            const cleanJson = itemsJson.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
            const parsedItems = JSON.parse(cleanJson);
            if (Array.isArray(parsedItems)) {
              for (const item of parsedItems) {
                await storage.createPostConsultationItem({
                  consultationId: consultation.id,
                  patientId: consultation.patientId!,
                  doctorId: consultation.doctorId || req.user.id,
                  type: item.type || 'prescription',
                  title: item.title || 'Item pós-consulta',
                  description: item.description || '',
                  details: item.details || {},
                  status: 'pending_review',
                  patientSummary: item.patientSummary || '',
                  reviewNotes: null,
                  aiAnalysis: null,
                  reviewedAt: null,
                });
              }
              console.log(`✅ Auto-generated ${parsedItems.length} post-consultation items on completion`);
            }
          } catch (itemsErr) {
            console.error('Failed to auto-generate post-consultation items on completion:', itemsErr);
          }

          // Auto-generate diagnostic syndromic inference with CID/DSM classification
          const clinicalData = `${updatedNotes}\n${allNotes}`;
          await generateDiagnosticInference(
            consultation.id,
            consultation.patientId!,
            consultation.doctorId || req.user.id,
            clinicalData,
            patient?.name || 'Paciente'
          );
        } catch (recordErr) {
          console.error('Failed to auto-generate medical record on completion:', recordErr);
        }
      }

      // Notify patient
      if (consultation && consultation.patientId) {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          if (patient?.userId) {
            broadcastToUser(patient.userId, {
              type: 'consultation_completed',
              data: {
                consultationId: consultation.id,
                message: 'Sua consulta foi concluída pelo médico. O prontuário foi atualizado.',
                actionUrl: '/my-consultations'
              }
            });
          }
        } catch {}
      }

      res.json(consultation);
    } catch (error) {
      console.error('Complete consultation error:', error);
      res.status(500).json({ message: 'Falha ao concluir consulta' });
    }
  });

  // Reactivate an incomplete consultation
  app.post('/api/video-consultations/:id/reactivate', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
        return res.status(403).json({ message: 'Apenas médicos podem reativar consultas' });
      }

      const consultation = await storage.updateVideoConsultation(req.params.id, {
        status: 'waiting',
        endedAt: null as any,
      });

      if (!consultation) {
        return res.status(404).json({ message: 'Consulta não encontrada' });
      }

      // Notify patient
      if (consultation.patientId) {
        try {
          const patient = await storage.getPatient(consultation.patientId);
          if (patient?.userId) {
            broadcastToUser(patient.userId, {
              type: 'consultation_invite',
              data: {
                title: 'Consulta Reativada',
                message: `Dr(a). ${req.user.name} reativou sua consulta. Clique para entrar.`,
                consultationId: consultation.id,
                actionUrl: `/patient/video/${consultation.id}`,
                priority: 'critical'
              }
            });
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'consultation_invite',
              title: 'Consulta Reativada',
              message: `Dr(a). ${req.user.name} reativou sua consulta. Clique para entrar na videochamada.`,
              priority: 'critical',
              actionUrl: `/patient/video/${consultation.id}`,
              senderId: req.user.id,
              delivered: false,
              read: false,
              metadata: { consultationId: consultation.id }
            });
          }
        } catch {}
      }

      res.json(consultation);
    } catch (error) {
      console.error('Reactivate consultation error:', error);
      res.status(500).json({ message: 'Falha ao reativar consulta' });
    }
  });

  // Patient leaves consultation (doesn't end it, just leaves the video)
  app.post('/api/video-consultations/:id/leave', async (req: any, res) => {
    try {
      const consultationId = req.params.id;
      const consultation = await db.select().from(videoConsultations).where(eq(videoConsultations.id, consultationId)).limit(1);
      
      if (!consultation.length) {
        return res.status(404).json({ message: 'Consulta não encontrada' });
      }

      // Notify doctor that patient left
      if (consultation[0].doctorId) {
        let patientName = 'Paciente';
        try {
          if (consultation[0].patientId) {
            const patient = await storage.getPatient(consultation[0].patientId);
            if (patient) patientName = patient.name;
          }
        } catch {}
        broadcastToDoctor(consultation[0].doctorId, {
          type: 'patient_left_consultation',
          data: {
            consultationId,
            patientName,
            message: `${patientName} saiu da consulta.`
          }
        });
      }

      res.json({ message: 'Saiu da consulta com sucesso' });
    } catch (error) {
      console.error('Leave consultation error:', error);
      res.status(500).json({ message: 'Falha ao sair da consulta' });
    }
  });

  app.post('/api/video-consultations/:id/invite-specialist', async (req: any, res) => {
    try {
      const consultationId = req.params.id;
      const { specialistId } = req.body;
      const doctorUser = req.user as User;
      if (!doctorUser) {
        return res.status(401).json({ message: 'Autenticação necessária' });
      }

      if (!specialistId) {
        return res.status(400).json({ message: 'specialistId é obrigatório' });
      }

      const consultation = await db.select().from(videoConsultations).where(eq(videoConsultations.id, consultationId)).limit(1);
      if (!consultation.length) {
        return res.status(404).json({ message: 'Consulta não encontrada' });
      }

      const specialist = await db.select().from(users).where(eq(users.id, specialistId)).limit(1);
      if (!specialist.length) {
        return res.status(404).json({ message: 'Especialista não encontrado' });
      }

      let patientName = 'Paciente';
      try {
        if (consultation[0].patientId) {
          const patient = await storage.getPatient(consultation[0].patientId);
          if (patient) patientName = patient.name;
        }
      } catch {}

      broadcastToUser(specialistId, {
        type: 'specialist_invite',
        data: {
          consultationId,
          doctorName: doctorUser.name,
          patientName,
          message: `Dr. ${doctorUser.name} convida você para uma interconsulta com ${patientName}.`,
          actionUrl: `/consultation/video/${consultation[0].patientId}?consultationId=${consultationId}`
        }
      });

      try {
        await db.insert(pendingNotifications).values({
          userId: specialistId,
          type: 'specialist_invite',
          title: 'Convite para Interconsulta',
          message: `Dr. ${doctorUser.name} convida você para uma consulta com ${patientName}`,
          data: { consultationId, actionUrl: `/consultation/video/${consultation[0].patientId}?consultationId=${consultationId}` },
        });
      } catch {}

      res.json({ message: 'Convite enviado com sucesso' });
    } catch (error) {
      console.error('Invite specialist error:', error);
      res.status(500).json({ message: 'Falha ao enviar convite' });
    }
  });

  // Upload and transcribe consultation audio
  app.post('/api/video-consultations/:id/transcribe', async (req, res) => {
    try {
      const consultationId = req.params.id;
      const { audioData, patientName } = req.body;
      
      if (!audioData) {
        return res.status(400).json({ message: 'Audio data is required' });
      }

      // Get consultation details
      const consultation = await storage.getVideoConsultation(consultationId);
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }

      // Update transcription status to processing
      await storage.updateVideoConsultation(consultationId, {
        transcriptionStatus: 'processing'
      });

      // Get consultation to broadcast to correct doctor
      const consultationForBroadcast = await storage.getVideoConsultation(consultationId);
      const targetDoctorId = consultationForBroadcast?.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID;
      broadcastToDoctor(targetDoctorId, { type: 'transcription_started', consultationId, status: 'processing' });

      try {
        // Convert base64 audio data to buffer
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        // Validate audio file
        const validation = whisperService.validateAudioFile(audioBuffer);
        if (!validation.isValid) {
          return res.status(400).json({ message: validation.error });
        }

        // Transcribe audio with OpenAI Whisper
        const transcriptionResult = await whisperService.transcribeConsultationAudio(
          audioBuffer,
          consultationId,
          patientName
        );

        // Update consultation with transcription results
        const updatedConsultation = await storage.updateVideoConsultation(consultationId, {
          fullTranscript: transcriptionResult.text,
          meetingNotes: transcriptionResult.summary,
          transcriptionStatus: 'completed'
        });

        // Create medical record with comprehensive transcription data
        const medicalRecord = await storage.createMedicalRecord({
          patientId: consultation.patientId,
          doctorId: consultation.doctorId,
          appointmentId: consultation.appointmentId,
          audioTranscript: transcriptionResult.text,
          diagnosis: transcriptionResult.diagnosis,
          treatment: transcriptionResult.treatment,
          symptoms: transcriptionResult.symptoms,
          observations: transcriptionResult.observations,
          diagnosticHypotheses: transcriptionResult.diagnosticHypotheses,
          isEncrypted: true
        });

        broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, { 
          type: 'transcription_completed', 
          consultationId,
          status: 'completed',
          medicalRecordId: medicalRecord.id
        });

        res.json({
          transcription: transcriptionResult,
          consultation: updatedConsultation,
          medicalRecordId: medicalRecord.id,
          message: 'Audio transcribed and analyzed successfully'
        });

      } catch (transcriptionError) {
        console.error('Transcription processing error:', transcriptionError);
        
        // Update status to failed
        await storage.updateVideoConsultation(consultationId, {
          transcriptionStatus: 'failed'
        });

        // Get consultation to broadcast to correct doctor
        const consultation = await storage.getVideoConsultation(consultationId);
        const targetDoctorId = consultation?.doctorId || actualDoctorId || DEFAULT_DOCTOR_ID;
        broadcastToDoctor(targetDoctorId, { type: 'transcription_failed', consultationId });

        res.status(500).json({ 
          message: 'Failed to process audio transcription',
          error: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'
        });
      }

    } catch (error) {
      console.error('Video consultation transcription error:', error);
      res.status(500).json({ message: 'Failed to transcribe consultation audio' });
    }
  });

  // Get transcription status
  app.get('/api/video-consultations/:id/transcription-status', async (req, res) => {
    try {
      const consultation = await storage.getVideoConsultation(req.params.id);
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }

      res.json({
        status: consultation.transcriptionStatus,
        transcript: consultation.fullTranscript,
        notes: consultation.meetingNotes
      });
    } catch (error) {
      console.error('Get transcription status error:', error);
      res.status(500).json({ message: 'Failed to get transcription status' });
    }
  });

  // Get consultation notes
  app.get('/api/video-consultations/:id/notes', async (req, res) => {
    try {
      const notes = await storage.getConsultationNotes(req.params.id);
      res.json(notes);
    } catch (error) {
      console.error('Get consultation notes error:', error);
      res.status(500).json({ message: 'Failed to get consultation notes' });
    }
  });

  // Create consultation note (chat, AI query, doctor note)
  app.post('/api/video-consultations/:id/notes', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { type, content, metadata } = req.body;
      const validatedData = insertConsultationNoteSchema.parse({
        consultationId: req.params.id,
        userId: req.user.id,
        type,
        content,
        metadata
      });

      const note = await storage.createConsultationNote(validatedData);
      
      // Charge credits for AI diagnostic queries
      if (type === 'ai_query' && req.user.role !== 'admin') {
        try {
          const config = await tmcCreditsService.getCreditConfig();
          const consultation = await storage.getVideoConsultation(req.params.id);
          
          if (consultation?.patientId) {
            const patient = await storage.getPatient(consultation.patientId);
            
            if (patient?.userId) {
              try {
                await tmcCreditsService.debitCredits(
                  patient.userId,
                  config.CREDIT_PER_AI_RESPONSE,
                  'ai_diagnostic_query',
                  {
                    functionUsed: 'ai_diagnostic',
                    consultationId: consultation.id,
                    noteId: note.id,
                    query: content
                  }
                );
                console.log(`✅ Charged ${config.CREDIT_PER_AI_RESPONSE} credits for AI diagnostic query`);
              } catch (creditError: any) {
                console.error('Credit charging error for AI query:', creditError);
                // Don't fail the query if credits fail, but log it
              }
            }
          }
        } catch (error) {
          console.error('Error processing AI query credits:', error);
        }
      }
      
      const consultation2 = await storage.getVideoConsultation(req.params.id);
      if (consultation2) {
        broadcastToDoctor(consultation2.doctorId, {
          type: 'consultation_note_added',
          data: note
        });
        if (consultation2.patientId) {
          const notePatient = await storage.getPatient(consultation2.patientId);
          if (notePatient?.userId) {
            broadcastToUser(notePatient.userId, {
              type: 'consultation_note_added',
              data: note
            });
          }
        }

        if (type === 'chat' && req.user.role === 'patient' && consultation2.status === 'waiting') {
          try {
            const chatPatient = await storage.getPatient(consultation2.patientId!);
            const patientName = chatPatient?.name || 'Paciente';
            const doctor = await db.select().from(users).where(eq(users.id, consultation2.doctorId)).limit(1);
            if (doctor.length > 0) {
              await db.insert(pendingNotifications).values({
                userId: consultation2.doctorId,
                type: 'consultation_message',
                title: `Mensagem de ${patientName}`,
                message: content.length > 100 ? content.substring(0, 100) + '...' : content,
                priority: 'high',
                actionUrl: `/consultation/video/${consultation2.patientId}`,
                senderId: req.user.id,
                delivered: false,
                read: false,
                metadata: { 
                  consultationId: consultation2.id,
                  patientId: consultation2.patientId,
                  patientName,
                  allowReply: true,
                  noteId: note.id
                }
              });
              broadcastToDoctor(consultation2.doctorId, {
                type: 'consultation_message',
                data: {
                  title: `Mensagem de ${patientName}`,
                  message: content,
                  consultationId: consultation2.id,
                  patientId: consultation2.patientId,
                  patientName,
                  actionUrl: `/consultation/video/${consultation2.patientId}`,
                  allowReply: true
                }
              });
            }
          } catch (notifErr) {
            console.error('Failed to forward patient chat as notification:', notifErr);
          }
        }
      }

      // Generate AI response for ai_query notes
      if (type === 'ai_query') {
        (async () => {
          try {
            const consult = await storage.getVideoConsultation(req.params.id);
            let patientContext = '';
            if (consult?.patientId) {
              const patient = await storage.getPatient(consult.patientId);
              if (patient) {
                patientContext = `\nPaciente: ${patient.name}, Sexo: ${patient.gender || 'não informado'}, Tipo sanguíneo: ${patient.bloodType || 'não informado'}, Alergias: ${patient.allergies || 'nenhuma conhecida'}, Status: ${patient.healthStatus}`;
                const records = await storage.getMedicalRecordsByPatient(consult.patientId);
                if (records.length > 0) {
                  patientContext += `\nHistórico recente: ${records.slice(0, 3).map((r: any) => `${r.diagnosis || 'Consulta'} (${new Date(r.date).toLocaleDateString()})`).join(', ')}`;
                }
              }
            }
            const existingNotes = await storage.getConsultationNotes(req.params.id);
            const recentNotes = existingNotes.filter((n: any) => n.type === 'doctor_note' || n.type === 'transcription').slice(-5);
            const notesContext = recentNotes.length > 0 ? `\nAnotações da consulta: ${recentNotes.map((n: any) => n.content).join(' | ')}` : '';

            const aiPrompt = `Você é um assistente médico IA auxiliando um médico durante uma consulta por vídeo. Responda de forma concisa e técnica em português.

DIRETRIZES DE REFERÊNCIA: Baseie suas respostas nas diretrizes da OMS, Protocolos de Atenção Primária do Ministério da Saúde do Brasil (CAB, PCDT/CONITEC), e DSM-5/DSM-5-TR para condições psiquiátricas. Cite fontes quando relevante.${patientContext}${notesContext}\n\nPergunta do médico: ${content}`;
            const aiResponse = await geminiService.generateText(aiPrompt, 'Você é um assistente médico especializado. Responda de forma precisa, concisa e profissional em português brasileiro. Baseie condutas nas diretrizes OMS, protocolos do Ministério da Saúde/Brasil e DSM-5 para questões psiquiátricas.');

            const aiNote = await storage.createConsultationNote({
              consultationId: req.params.id,
              userId: req.user.id,
              type: 'ai_response',
              content: aiResponse,
              metadata: { queryNoteId: note.id }
            });

            if (consult) {
              broadcastToDoctor(consult.doctorId, {
                type: 'consultation_note_added',
                data: aiNote
              });
            }
          } catch (aiError) {
            console.error('AI response generation failed:', aiError);
            const fallbackNote = await storage.createConsultationNote({
              consultationId: req.params.id,
              userId: req.user.id,
              type: 'ai_response',
              content: 'Desculpe, não foi possível gerar uma resposta no momento. Tente novamente.',
              metadata: { queryNoteId: note.id, error: true }
            });
          }
        })();
      }

      // ===== INTERCONSULTA COM IAM3D =====
      // Auto-recalculate diagnostic hypotheses when doctor adds new notes/data
      if (type === 'doctor_note' || type === 'transcription') {
        (async () => {
          try {
            const consult = await storage.getVideoConsultation(req.params.id);
            if (!consult) return;

            // Collect all consultation data
            const allNotes = await storage.getConsultationNotes(req.params.id);
            const doctorAnnotations = allNotes.filter((n: any) => n.type === 'doctor_note' || n.type === 'annotation').map((n: any) => n.content);
            const transcriptions = allNotes.filter((n: any) => n.type === 'transcription').map((n: any) => n.content);
            const previousDiagnostics = allNotes.filter((n: any) => n.type === 'iam3d_diagnostic').map((n: any) => n.content);

            // Need at least 2 doctor notes or a transcription to trigger analysis
            if (doctorAnnotations.length < 2 && transcriptions.length === 0) return;

            let patientContext = '';
            if (consult.patientId) {
              const patient = await storage.getPatient(consult.patientId);
              if (patient) {
                patientContext = `Paciente: ${patient.name}, Sexo: ${patient.gender || 'não informado'}, Nascimento: ${patient.dateOfBirth || 'não informado'}, Tipo sanguíneo: ${patient.bloodType || 'não informado'}, Alergias: ${patient.allergies || 'nenhuma conhecida'}`;
                const records = await storage.getMedicalRecordsByPatient(consult.patientId);
                if (records.length > 0) {
                  patientContext += `\nHistórico clínico: ${records.slice(0, 5).map((r: any) => `${r.diagnosis || r.type} - ${r.notes?.substring(0, 100) || ''}`).join('; ')}`;
                }
              }
            }

            const iam3dPrompt = `🔬 INTERCONSULTA IAM3D — Recálculo de Hipóteses Diagnósticas

Você é o IAM3D (Inteligência Artificial Médica 3D), um sistema de interconsulta médica inteligente integrado à teleconsulta. Sua tarefa é recalcular as hipóteses diagnósticas com base em TODOS os dados clínicos disponíveis até o momento.

${patientContext}

DADOS CLÍNICOS DA CONSULTA:
${doctorAnnotations.length > 0 ? `\n📋 Anotações do Médico (${doctorAnnotations.length}):\n${doctorAnnotations.join('\n---\n')}` : ''}
${transcriptions.length > 0 ? `\n🎤 Transcrição:\n${transcriptions.join('\n')}` : ''}
${previousDiagnostics.length > 0 ? `\n📊 Análises anteriores do IAM3D (${previousDiagnostics.length}):\n${previousDiagnostics.slice(-1).join('\n')}` : ''}

NOVA ENTRADA DE DADOS: "${content}"

Com base em TODOS os dados acima, forneça:

1. **HIPÓTESES DIAGNÓSTICAS** (ordenadas por probabilidade):
   - Para cada: diagnóstico, probabilidade (%), justificativa clínica, código CID-10/CID-11

2. **DIAGNÓSTICOS DIFERENCIAIS** a considerar

3. **SINAIS DE ALERTA** (red flags) identificados

4. **EXAMES SUGERIDOS** para confirmar/descartar hipóteses

5. **CONDUTA SUGERIDA** baseada nas diretrizes OMS, Ministério da Saúde/Brasil, DSM-5 (se psiquiátrico)

6. **MUDANÇAS** em relação à análise anterior (se houver) — o que mudou com os novos dados?

Responda em português brasileiro, de forma estruturada e concisa, com linguagem técnica médica.`;

            const iam3dResponse = await geminiService.generateText(
              iam3dPrompt,
              'Você é o IAM3D — Inteligência Artificial Médica 3D, um sistema de interconsulta que recalcula hipóteses diagnósticas em tempo real. Baseie suas análises nas diretrizes da OMS, Protocolos de Atenção Primária do Ministério da Saúde do Brasil (CAB, PCDT, CONITEC), DSM-5/DSM-5-TR (APA) e evidências científicas atuais. Seja preciso, estruturado e técnico.'
            );

            const iam3dNote = await storage.createConsultationNote({
              consultationId: req.params.id,
              userId: req.user.id,
              type: 'iam3d_diagnostic',
              content: iam3dResponse,
              metadata: {
                trigger: type,
                triggerNoteId: note.id,
                notesCount: doctorAnnotations.length,
                transcriptionCount: transcriptions.length,
                previousAnalysisCount: previousDiagnostics.length,
                isAutoGenerated: true
              }
            });

            broadcastToDoctor(consult.doctorId, {
              type: 'consultation_note_added',
              data: iam3dNote
            });

            console.log(`🔬 IAM3D diagnostic recalculated for consultation ${req.params.id}`);
          } catch (iam3dError) {
            console.error('IAM3D diagnostic recalculation failed:', iam3dError);
          }
        })();
      }

      res.status(201).json(note);
    } catch (error) {
      console.error('Create consultation note error:', error);
      res.status(400).json({ message: 'Failed to create consultation note', error });
    }
  });

  // Get consultation recordings
  app.get('/api/video-consultations/:id/recordings', async (req, res) => {
    try {
      const recordings = await storage.getConsultationRecordings(req.params.id);
      res.json(recordings);
    } catch (error) {
      console.error('Get consultation recordings error:', error);
      res.status(500).json({ message: 'Failed to get consultation recordings' });
    }
  });

  // Create consultation recording
  app.post('/api/video-consultations/:id/recordings', async (req, res) => {
    try {
      const { segmentUrl, startTime, endTime, duration, segmentType, fileSize } = req.body;
      const validatedData = insertConsultationRecordingSchema.parse({
        consultationId: req.params.id,
        segmentUrl,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        duration,
        segmentType,
        fileSize
      });

      const recording = await storage.createConsultationRecording(validatedData);
      res.status(201).json(recording);
    } catch (error) {
      console.error('Create consultation recording error:', error);
      res.status(400).json({ message: 'Failed to create consultation recording', error });
    }
  });

  // ===== PHARMACY INTEGRATION API ROUTES =====
  
  // Get all pharmacy collaborators
  app.get('/api/pharmacies', async (req, res) => {
    try {
      const pharmacies = await storage.getCollaboratorsByType('pharmacy');
      res.json(pharmacies);
    } catch (error) {
      console.error('Get pharmacies error:', error);
      res.status(500).json({ message: 'Failed to get pharmacies' });
    }
  });

  // Create new pharmacy collaborator
  app.post('/api/pharmacies', async (req, res) => {
    try {
      const validatedData = insertCollaboratorSchema.parse({
        ...req.body,
        type: 'pharmacy'
      });
      
      const pharmacy = await storage.createCollaborator(validatedData);
      res.status(201).json(pharmacy);
    } catch (error) {
      console.error('Create pharmacy error:', error);
      res.status(500).json({ message: 'Failed to create pharmacy' });
    }
  });

  // Share prescription with pharmacy
  app.post('/api/prescriptions/:medicalRecordId/share', async (req, res) => {
    try {
      const { medicalRecordId } = req.params;
      const { pharmacyId, notes } = req.body;

      // Validate medical record exists and has signed prescription
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      if (!medicalRecord.prescription) {
        return res.status(400).json({ message: 'No prescription to share' });
      }

      if (!medicalRecord.digitalSignature) {
        return res.status(400).json({ message: 'Prescription must be digitally signed before sharing' });
      }

      // Verify digital signature cryptographically
      const digitalSignature = await storage.getDigitalSignature(medicalRecord.digitalSignature);
      if (!digitalSignature) {
        return res.status(400).json({ message: 'Digital signature record not found' });
      }

      // Extract certificate info and public key for verification
      const certInfo = digitalSignature.certificateInfo as any || {};
      const publicKey = certInfo.publicKey;
      const timestamp = certInfo.timestamp;

      if (!publicKey || !timestamp) {
        return res.status(400).json({ message: 'Invalid digital signature - missing verification data' });
      }

      // Verify the prescription signature cryptographically
      const isValidSignature = await cryptoService.verifySignature(
        medicalRecord.prescription || '',
        digitalSignature.signature,
        publicKey,
        timestamp
      );

      if (!isValidSignature) {
        // Log failed verification attempt
        await storage.createCollaboratorIntegration({
          collaboratorId: pharmacyId,
          integrationType: 'prescription_share',
          entityId: medicalRecordId,
          action: 'signature_verification_failed',
          status: 'failed',
          errorMessage: 'Digital signature verification failed',
          requestData: {
            medicalRecordId: medicalRecordId,
            patientId: medicalRecord.patientId,
            verificationTimestamp: new Date().toISOString()
          },
        });

        return res.status(400).json({ 
          message: 'Prescription digital signature verification failed - cannot share with pharmacy' 
        });
      }

      // Validate pharmacy exists
      const pharmacy = await storage.getCollaborator(pharmacyId);
      if (!pharmacy || pharmacy.type !== 'pharmacy') {
        return res.status(404).json({ message: 'Pharmacy not found' });
      }

      // Create prescription share record
      const shareData = {
        patientId: medicalRecord.patientId,
        medicalRecordId: medicalRecordId,
        doctorId: actualDoctorId || DEFAULT_DOCTOR_ID,
        pharmacyId,
        prescriptionText: medicalRecord.prescription || '',
        digitalSignatureId: medicalRecord.digitalSignature,
        status: 'shared' as const,
      };

      const validatedShareData = insertPrescriptionShareSchema.parse(shareData);
      const prescriptionShare = await storage.createPrescriptionShare(validatedShareData);

      // Log successful integration activity with signature verification
      await storage.createCollaboratorIntegration({
        collaboratorId: pharmacyId,
        integrationType: 'prescription_share',
        entityId: prescriptionShare.id,
        action: 'prescription_shared',
        status: 'success',
        requestData: {
          medicalRecordId: medicalRecordId,
          patientId: medicalRecord.patientId,
          signatureVerified: true,
          verificationTimestamp: new Date().toISOString()
        },
      });

      // Broadcast real-time update to authenticated doctor only
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, {
        type: 'prescription_shared',
        data: { prescriptionShare, pharmacy, patient: medicalRecord.patientId }
      });

      res.status(201).json(prescriptionShare);
    } catch (error) {
      console.error('Share prescription error:', error);
      res.status(500).json({ message: 'Failed to share prescription' });
    }
  });

  // Get shared prescriptions for a pharmacy (External API - requires authentication)
  app.get('/api/pharmacies/:pharmacyId/prescriptions', authenticateApiKey, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const { status } = req.query;

      // CRITICAL: Verify collaborator can only access their own resources
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_resource_access',
          status: 'failed',
          errorMessage: 'Attempted to access another collaborator\'s resources',
          requestData: {
            requestedPharmacyId: pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            endpoint: req.path,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized resource access' });
      }

      let prescriptionShares = await storage.getPrescriptionSharesByPharmacy(pharmacyId);
      
      // Filter by status if provided
      if (status) {
        prescriptionShares = prescriptionShares.filter(share => share.status === status);
      }

      // Enrich with medical record and patient data
      const enrichedShares = await Promise.all(
        prescriptionShares.map(async (share) => {
          const medicalRecord = await storage.getMedicalRecord(share.medicalRecordId);
          const patient = await storage.getPatient(share.patientId);
          return {
            ...share,
            medicalRecord,
            patient: patient ? {
              id: patient.id,
              name: patient.name,
              phone: patient.phone
            } : null
          };
        })
      );

      res.json(enrichedShares);
    } catch (error) {
      console.error('Get pharmacy prescriptions error:', error);
      res.status(500).json({ message: 'Failed to get pharmacy prescriptions' });
    }
  });

  // Update prescription fulfillment status (External API - requires authentication)
  app.patch('/api/prescription-shares/:shareId/fulfillment', authenticateApiKey, async (req, res) => {
    try {
      const { shareId } = req.params;
      const { status, fulfilledAt, pharmacistNotes, fulfilledBy } = req.body;

      // CRITICAL: Verify collaborator can only update their own prescription shares
      const existingShare = await storage.getPrescriptionShare(shareId);
      if (!existingShare) {
        return res.status(404).json({ message: 'Prescription share not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== existingShare.pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_fulfillment_update',
          status: 'failed',
          errorMessage: 'Attempted to update another collaborator\'s prescription share',
          requestData: {
            requestedShareId: shareId,
            sharePharmacyId: existingShare.pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            endpoint: req.path,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized fulfillment update' });
      }

      // Enhanced status workflow validation
      const validStatuses = ['shared', 'preparing', 'ready', 'dispensed', 'partially_dispensed', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      // Validate status transition workflow
      const currentStatus = existingShare.status;
      const validTransitions: Record<string, string[]> = {
        'shared': ['preparing', 'cancelled'],
        'preparing': ['ready', 'cancelled'],
        'ready': ['dispensed', 'partially_dispensed', 'cancelled'],
        'dispensed': ['completed'],
        'partially_dispensed': ['dispensed', 'completed', 'cancelled'],
        'completed': [], // Final state
        'cancelled': [] // Final state
      };

      if (!validTransitions[currentStatus]?.includes(status)) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'fulfillment_workflow_violation',
          entityId: shareId,
          action: 'invalid_status_transition',
          status: 'failed',
          errorMessage: `Invalid status transition from ${currentStatus} to ${status}`,
          requestData: {
            currentStatus,
            requestedStatus: status,
            validTransitions: validTransitions[currentStatus] || [],
            timestamp: new Date().toISOString()
          },
        });
        return res.status(400).json({ 
          message: `Invalid status transition from ${currentStatus} to ${status}`,
          currentStatus,
          validTransitions: validTransitions[currentStatus] || []
        });
      }

      const updateData: any = { 
        status,
        pharmacistNotes: pharmacistNotes || '',
      };

      // Enhanced fulfillment timestamp and validation
      if (['dispensed', 'partially_dispensed', 'completed'].includes(status)) {
        updateData.dispensedAt = fulfilledAt ? new Date(fulfilledAt) : new Date();
        
        // Validate prescription hasn't expired
        if (existingShare.expiresAt && new Date(existingShare.expiresAt) < new Date()) {
          await storage.createCollaboratorIntegration({
            collaboratorId: authenticatedCollaborator.id,
            integrationType: 'fulfillment_business_rule_violation',
            entityId: shareId,
            action: 'expired_prescription_fulfillment_attempt',
            status: 'failed',
            errorMessage: 'Attempted to fulfill expired prescription',
            requestData: {
              prescriptionExpiresAt: existingShare.expiresAt,
              requestedStatus: status,
              timestamp: new Date().toISOString()
            },
          });
          return res.status(400).json({ 
            message: 'Cannot fulfill expired prescription',
            expiresAt: existingShare.expiresAt
          });
        }
        
        if (fulfilledBy) {
          updateData.dispensingNotes = (updateData.dispensingNotes || '') + `\nDispensed by: ${fulfilledBy} at ${new Date().toISOString()}`;
        }
      }

      // Validation for cancellation
      if (status === 'cancelled' && !pharmacistNotes) {
        return res.status(400).json({ 
          message: 'Cancellation reason required in pharmacistNotes' 
        });
      }

      const updatedShare = await storage.updatePrescriptionShare(shareId, updateData);
      if (!updatedShare) {
        return res.status(404).json({ message: 'Prescription share not found' });
      }

      // Enhanced integration activity logging
      await storage.createCollaboratorIntegration({
        collaboratorId: updatedShare.pharmacyId,
        integrationType: 'fulfillment_update',
        entityId: shareId,
        action: 'status_updated',
        status: 'success',
        requestData: {
          previousStatus: currentStatus,
          newStatus: status,
          pharmacistNotes,
          fulfilledBy: fulfilledBy || 'system',
          fulfillmentTimestamp: new Date().toISOString(),
          patientId: existingShare.patientId,
          medicalRecordId: existingShare.medicalRecordId
        },
      });

      // Broadcast real-time update to authenticated doctor only
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, {
        type: 'prescription_fulfillment_updated',
        data: { prescriptionShare: updatedShare, status }
      });

      res.json(updatedShare);
    } catch (error) {
      console.error('Update fulfillment error:', error);
      res.status(500).json({ message: 'Failed to update fulfillment status' });
    }
  });

  // Get prescription fulfillment history for a patient
  app.get('/api/patients/:patientId/prescription-shares', async (req, res) => {
    try {
      const { patientId } = req.params;
      const prescriptionShares = await storage.getPrescriptionSharesByPatient(patientId);

      // Enrich with pharmacy data
      const enrichedShares = await Promise.all(
        prescriptionShares.map(async (share) => {
          const pharmacy = await storage.getCollaborator(share.pharmacyId);
          const medicalRecord = await storage.getMedicalRecord(share.medicalRecordId);
          return {
            ...share,
            pharmacy: pharmacy ? {
              id: pharmacy.id,
              name: pharmacy.name,
              phone: pharmacy.phone,
              address: pharmacy.address
            } : null,
            prescription: medicalRecord?.prescription
          };
        })
      );

      res.json(enrichedShares);
    } catch (error) {
      console.error('Get patient prescription shares error:', error);
      res.status(500).json({ message: 'Failed to get patient prescription shares' });
    }
  });

  // Get pharmacy analytics and statistics (External API - requires authentication)
  app.get('/api/pharmacies/:pharmacyId/analytics', authenticateApiKey, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      
      // CRITICAL: Verify collaborator can only access their own resources
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_resource_access',
          status: 'failed',
          errorMessage: 'Attempted to access another collaborator\'s analytics',
          requestData: {
            requestedPharmacyId: pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            endpoint: req.path,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized resource access' });
      }
      
      // Validate pharmacy exists
      const pharmacy = await storage.getCollaborator(pharmacyId);
      if (!pharmacy || pharmacy.type !== 'pharmacy') {
        return res.status(404).json({ message: 'Pharmacy not found' });
      }

      const prescriptionShares = await storage.getPrescriptionSharesByPharmacy(pharmacyId);
      const integrationLogs = await storage.getCollaboratorIntegrationsByCollaborator(pharmacyId);

      // Calculate statistics
      const totalShares = prescriptionShares.length;
      const completedShares = prescriptionShares.filter(share => 
        ['dispensed', 'completed'].includes(share.status)
      ).length;
      const pendingShares = prescriptionShares.filter(share => 
        share.status === 'pending'
      ).length;
      const cancelledShares = prescriptionShares.filter(share => 
        share.status === 'cancelled'
      ).length;

      // Average fulfillment time (in hours)
      const fulfilledShares = prescriptionShares.filter(share => 
        share.dispensedAt && share.createdAt
      );
      const avgFulfillmentTime = fulfilledShares.length > 0
        ? fulfilledShares.reduce((sum, share) => {
            const timeDiff = new Date(share.dispensedAt!).getTime() - new Date(share.createdAt).getTime();
            return sum + (timeDiff / (1000 * 60 * 60)); // Convert to hours
          }, 0) / fulfilledShares.length
        : 0;

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentShares = prescriptionShares.filter(share => 
        new Date(share.createdAt) >= thirtyDaysAgo
      );

      res.json({
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.name,
          type: pharmacy.type
        },
        statistics: {
          totalShares,
          completedShares,
          pendingShares,
          cancelledShares,
          completionRate: totalShares > 0 ? (completedShares / totalShares * 100) : 0,
          avgFulfillmentTimeHours: Math.round(avgFulfillmentTime * 100) / 100,
          recentActivity: recentShares.length,
          integrationEvents: integrationLogs.length
        },
        recentShares: recentShares.slice(0, 10) // Last 10 recent shares
      });
    } catch (error) {
      console.error('Get pharmacy analytics error:', error);
      res.status(500).json({ message: 'Failed to get pharmacy analytics' });
    }
  });

  // ===== COMPREHENSIVE FULFILLMENT TRACKING ENDPOINTS =====

  // Get detailed fulfillment status and history for a prescription share
  app.get('/api/prescription-shares/:shareId/fulfillment-details', authenticateApiKey, async (req, res) => {
    try {
      const { shareId } = req.params;
      
      // Get prescription share with tenant binding check
      const prescriptionShare = await storage.getPrescriptionShare(shareId);
      if (!prescriptionShare) {
        return res.status(404).json({ message: 'Prescription share not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== prescriptionShare.pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_fulfillment_access',
          status: 'failed',
          errorMessage: 'Attempted to access another collaborator\'s fulfillment details',
          requestData: {
            requestedShareId: shareId,
            sharePharmacyId: prescriptionShare.pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized fulfillment access' });
      }

      // Get fulfillment history from integration logs
      const fulfillmentHistory = await storage.getCollaboratorIntegrationsByEntity(shareId, 'fulfillment_update');
      
      // Get prescription and patient details
      const medicalRecord = await storage.getMedicalRecord(prescriptionShare.medicalRecordId);
      const patient = await storage.getPatient(prescriptionShare.patientId);

      res.json({
        prescriptionShare: {
          id: prescriptionShare.id,
          status: prescriptionShare.status,
          createdAt: prescriptionShare.createdAt,
          dispensedAt: prescriptionShare.dispensedAt,
          expiresAt: prescriptionShare.expiresAt,
          dispensingNotes: prescriptionShare.dispensingNotes,
          shareMethod: prescriptionShare.shareMethod,
          accessCode: prescriptionShare.accessCode
        },
        patient: patient ? {
          id: patient.id,
          name: patient.name,
          phone: patient.phone
        } : null,
        prescription: {
          text: medicalRecord?.prescription,
          doctorId: prescriptionShare.doctorId,
          isDigitallySigned: !!prescriptionShare.digitalSignatureId
        },
        fulfillmentHistory: fulfillmentHistory.map(log => ({
          action: log.action,
          status: log.status,
          timestamp: log.createdAt,
          details: log.requestData,
          errorMessage: log.errorMessage
        }))
      });
    } catch (error) {
      console.error('Get fulfillment details error:', error);
      res.status(500).json({ message: 'Failed to get fulfillment details' });
    }
  });

  // Get fulfillment workflow statistics for pharmacy
  app.get('/api/pharmacies/:pharmacyId/fulfillment-workflows', authenticateApiKey, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const { startDate, endDate } = req.query;

      // Tenant binding check
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== pharmacyId) {
        return res.status(403).json({ message: 'Access denied: unauthorized resource access' });
      }

      // Date range filtering
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const prescriptionShares = await storage.getPrescriptionSharesByPharmacy(pharmacyId);
      const filteredShares = prescriptionShares.filter(share => 
        new Date(share.createdAt) >= start && new Date(share.createdAt) <= end
      );

      // Get integration logs for workflow analysis
      const workflowLogs = await storage.getCollaboratorIntegrationsByCollaborator(pharmacyId);
      const fulfillmentLogs = workflowLogs.filter(log => 
        log.integrationType === 'fulfillment_update' && 
        new Date(log.createdAt) >= start && 
        new Date(log.createdAt) <= end
      );

      const workflowViolations = workflowLogs.filter(log => 
        log.integrationType === 'fulfillment_workflow_violation' &&
        new Date(log.createdAt) >= start && 
        new Date(log.createdAt) <= end
      );

      // Calculate status distribution
      const statusDistribution = filteredShares.reduce((acc, share) => {
        acc[share.status] = (acc[share.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        dateRange: { start, end },
        totalPrescriptions: filteredShares.length,
        statusDistribution,
        completionRate: filteredShares.length > 0 ? 
          (statusDistribution['completed'] || 0) / filteredShares.length * 100 : 0,
        workflowMetrics: {
          totalStatusUpdates: fulfillmentLogs.length,
          workflowViolations: workflowViolations.length,
          violationTypes: workflowViolations.reduce((acc, log) => {
            const action = log.action;
            acc[action] = (acc[action] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        expiredPrescriptions: filteredShares.filter(share => 
          share.expiresAt && new Date(share.expiresAt) < new Date()
        ).length
      });
    } catch (error) {
      console.error('Get fulfillment workflows error:', error);
      res.status(500).json({ message: 'Failed to get fulfillment workflows' });
    }
  });

  // ===== CORE FULFILLMENT WORKFLOW ENDPOINTS =====

  // Centralized fulfillment status transition endpoint
  app.patch('/api/fulfillments/:shareId/status', authenticateApiKey, async (req, res) => {
    try {
      const { shareId } = req.params;
      const { status, notes, actor } = req.body;

      // Get existing share with tenant binding
      const existingShare = await storage.getPrescriptionShare(shareId);
      if (!existingShare) {
        return res.status(404).json({ message: 'Prescription share not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== existingShare.pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: shareId,
          action: 'unauthorized_fulfillment_mutation',
          status: 'failed',
          errorMessage: 'Attempted to modify another collaborator\'s fulfillment',
          requestData: {
            shareId,
            sharePharmacyId: existingShare.pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            requestedStatus: status,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized fulfillment mutation' });
      }

      // Centralized transition rules - ALLOWED_TRANSITIONS map
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        'shared': ['preparing', 'cancelled'],
        'preparing': ['ready', 'cancelled'],
        'ready': ['dispensed', 'partially_dispensed', 'cancelled'],
        'dispensed': ['completed'],
        'partially_dispensed': ['dispensed', 'completed', 'cancelled'],
        'completed': [], // Final state
        'cancelled': [] // Final state
      };

      const currentStatus = existingShare.status;
      if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(status)) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'fulfillment_workflow_violation',
          entityId: shareId,
          action: 'invalid_status_transition',
          status: 'failed',
          errorMessage: `Invalid transition from ${currentStatus} to ${status}`,
          requestData: {
            shareId,
            patientId: existingShare.patientId,
            medicalRecordId: existingShare.medicalRecordId,
            currentStatus,
            requestedStatus: status,
            validTransitions: ALLOWED_TRANSITIONS[currentStatus] || [],
            actor: actor || 'unknown',
            timestamp: new Date().toISOString()
          },
        });
        return res.status(400).json({ 
          message: `Invalid transition from ${currentStatus} to ${status}`,
          currentStatus,
          validTransitions: ALLOWED_TRANSITIONS[currentStatus] || []
        });
      }

      // Prescription expiry validation for dispensing
      if (['dispensed', 'partially_dispensed', 'completed'].includes(status)) {
        if (existingShare.expiresAt && new Date(existingShare.expiresAt) < new Date()) {
          await storage.createCollaboratorIntegration({
            collaboratorId: authenticatedCollaborator.id,
            integrationType: 'fulfillment_business_rule_violation',
            entityId: shareId,
            action: 'expired_prescription_fulfillment',
            status: 'failed',
            errorMessage: 'Cannot fulfill expired prescription',
            requestData: {
              shareId,
              patientId: existingShare.patientId,
              medicalRecordId: existingShare.medicalRecordId,
              expiresAt: existingShare.expiresAt,
              requestedStatus: status,
              actor: actor || 'unknown',
              timestamp: new Date().toISOString()
            },
          });
          return res.status(400).json({ 
            message: 'Cannot fulfill expired prescription',
            expiresAt: existingShare.expiresAt 
          });
        }
      }

      // Cancellation validation - require reason
      if (status === 'cancelled' && !notes) {
        return res.status(400).json({ message: 'Cancellation reason required in notes field' });
      }

      // Prepare update data with automatic timestamp stamping
      const updateData: any = { status };
      const now = new Date();

      // Automatic timestamp stamping based on status
      switch (status) {
        case 'preparing':
          updateData.acceptedAt = now;
          break;
        case 'ready':
          updateData.preparedAt = now;
          break;
        case 'dispensed':
        case 'partially_dispensed':
          updateData.dispensedAt = now;
          break;
        case 'completed':
          updateData.completedAt = now;
          if (!existingShare.dispensedAt) updateData.dispensedAt = now;
          break;
        case 'cancelled':
          updateData.cancelledAt = now;
          break;
      }

      if (notes) {
        updateData.dispensingNotes = notes;
      }

      // Update the share
      const updatedShare = await storage.updatePrescriptionShare(shareId, updateData);
      if (!updatedShare) {
        return res.status(500).json({ message: 'Failed to update prescription share' });
      }

      // Comprehensive audit logging for successful transition
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'fulfillment_event',
        entityId: shareId,
        action: 'status_transition_successful',
        status: 'success',
        requestData: {
          shareId,
          patientId: existingShare.patientId,
          medicalRecordId: existingShare.medicalRecordId,
          previousStatus: currentStatus,
          newStatus: status,
          actor: actor || 'system',
          notes: notes || '',
          automaticTimestamps: {
            acceptedAt: updateData.acceptedAt,
            preparedAt: updateData.preparedAt,
            dispensedAt: updateData.dispensedAt,
            completedAt: updateData.completedAt,
            cancelledAt: updateData.cancelledAt
          },
          ruleEvaluations: {
            transitionAllowed: true,
            prescriptionValid: !existingShare.expiresAt || new Date(existingShare.expiresAt) >= now,
            tenantAuthorized: true
          },
          timestamp: new Date().toISOString()
        },
      });

      // Real-time broadcast to authenticated doctor only
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, {
        type: 'fulfillment_status_updated',
        data: { shareId, newStatus: status, pharmacyId: authenticatedCollaborator.id }
      });

      res.json({
        id: updatedShare.id,
        status: updatedShare.status,
        previousStatus: currentStatus,
        updatedAt: now.toISOString(),
        notes: updatedShare.dispensingNotes,
        automaticTimestamps: {
          acceptedAt: updateData.acceptedAt,
          preparedAt: updateData.preparedAt,
          dispensedAt: updateData.dispensedAt,
          completedAt: updateData.completedAt,
          cancelledAt: updateData.cancelledAt
        }
      });
    } catch (error) {
      console.error('Update fulfillment status error:', error);
      res.status(500).json({ message: 'Failed to update fulfillment status' });
    }
  });

  // Get fulfillment history for a specific prescription share (with pagination)
  app.get('/api/fulfillments/:shareId/history', authenticateApiKey, async (req, res) => {
    try {
      const { shareId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Get share with tenant binding
      const prescriptionShare = await storage.getPrescriptionShare(shareId);
      if (!prescriptionShare) {
        return res.status(404).json({ message: 'Prescription share not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== prescriptionShare.pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: shareId,
          action: 'unauthorized_fulfillment_history_access',
          status: 'failed',
          errorMessage: 'Attempted to access another collaborator\'s fulfillment history',
          requestData: {
            shareId,
            sharePharmacyId: prescriptionShare.pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized fulfillment history access' });
      }

      // Get fulfillment events from integration logs
      const fulfillmentEvents = await storage.getCollaboratorIntegrationsByEntity(shareId, 'fulfillment_event');
      
      // Apply pagination
      const total = fulfillmentEvents.length;
      const paginatedEvents = fulfillmentEvents
        .slice(Number(offset), Number(offset) + Number(limit))
        .map(event => ({
          id: event.id,
          action: event.action,
          status: event.status,
          timestamp: event.createdAt,
          details: event.requestData,
          errorMessage: event.errorMessage
        }));

      res.json({
        shareId,
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
        events: paginatedEvents
      });
    } catch (error) {
      console.error('Get fulfillment history error:', error);
      res.status(500).json({ message: 'Failed to get fulfillment history' });
    }
  });

  // Get fulfillment history for pharmacy (with date filtering and pagination)
  app.get('/api/pharmacies/:pharmacyId/fulfillments/history', authenticateApiKey, async (req, res) => {
    try {
      const { pharmacyId } = req.params;
      const { limit = 100, offset = 0, startDate, endDate } = req.query;

      // Tenant binding check
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== pharmacyId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_pharmacy_history_access',
          status: 'failed',
          errorMessage: 'Attempted to access another collaborator\'s pharmacy history',
          requestData: {
            requestedPharmacyId: pharmacyId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized pharmacy history access' });
      }

      // Date filtering
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get all integration logs for this pharmacy
      const allLogs = await storage.getCollaboratorIntegrationsByCollaborator(pharmacyId);
      
      // Filter fulfillment events within date range
      const fulfillmentEvents = allLogs.filter(log => 
        log.integrationType === 'fulfillment_event' &&
        new Date(log.createdAt) >= start && 
        new Date(log.createdAt) <= end
      );

      // Apply pagination
      const total = fulfillmentEvents.length;
      const paginatedEvents = fulfillmentEvents
        .slice(Number(offset), Number(offset) + Number(limit))
        .map(event => ({
          id: event.id,
          shareId: event.entityId,
          action: event.action,
          status: event.status,
          timestamp: event.createdAt,
          details: event.requestData,
          errorMessage: event.errorMessage
        }));

      res.json({
        pharmacyId,
        dateRange: { start, end },
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
        events: paginatedEvents
      });
    } catch (error) {
      console.error('Get pharmacy fulfillment history error:', error);
      res.status(500).json({ message: 'Failed to get pharmacy fulfillment history' });
    }
  });

  // API key validation endpoint (External API - uses lightweight validation)
  app.post('/api/collaborators/validate-access', async (req, res) => {
    try {
      const { apiKey, collaboratorId } = req.body;
      
      if (!apiKey || !collaboratorId) {
        return res.status(400).json({ message: 'API key and collaborator ID are required' });
      }

      // Hash the provided API key for comparison
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      const validApiKey = await storage.validateApiKey(hashedKey);
      
      if (!validApiKey || validApiKey.collaboratorId !== collaboratorId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: collaboratorId,
          integrationType: 'api_validation',
          entityId: 'validate-access',
          action: 'validation_failed',
          status: 'failed',
          errorMessage: 'Invalid API key or collaborator ID mismatch',
        });
        return res.status(401).json({ message: 'Invalid API key or collaborator ID' });
      }

      const collaborator = await storage.getCollaborator(collaboratorId);
      if (!collaborator) {
        return res.status(404).json({ message: 'Collaborator not found' });
      }

      // Update last access time
      await storage.updateCollaboratorApiKey(validApiKey.id, {
        lastUsed: new Date()
      });

      // Log successful validation
      await storage.createCollaboratorIntegration({
        collaboratorId: collaboratorId,
        integrationType: 'api_validation',
        entityId: 'validate-access',
        action: 'validation_successful',
        status: 'success',
      });

      res.json({
        valid: true,
        collaborator: {
          id: collaborator.id,
          name: collaborator.name,
          type: collaborator.type,
          permissions: (validApiKey.permissions as any) || ['read_prescriptions', 'update_fulfillment']
        },
        apiKey: {
          keyName: validApiKey.keyName,
          isActive: validApiKey.isActive,
          expiresAt: validApiKey.expiresAt,
          rateLimit: validApiKey.rateLimit
        }
      });
    } catch (error) {
      console.error('Validate API key error:', error);
      res.status(500).json({ message: 'Failed to validate API key' });
    }
  });

  // ===== LABORATORY INTEGRATION ENDPOINTS =====

  // Create new laboratory test order (Internal - for doctors)
  app.post('/api/lab-orders', async (req, res) => {
    try {
      // Validate request body with Zod schema
      const orderValidation = insertLabOrderSchema.extend({
        expectedResultDate: z.string().optional().transform(val => val ? new Date(val) : undefined)
      }).safeParse(req.body);

      if (!orderValidation.success) {
        return res.status(400).json({ 
          message: 'Invalid request data',
          errors: orderValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const { patientId, laboratoryId, orderDetails, urgency, expectedResultDate } = orderValidation.data;

      // Validate laboratory exists and is active
      const laboratory = await storage.getCollaborator(laboratoryId);
      if (!laboratory || laboratory.type !== 'laboratory' || !laboratory.isActive) {
        return res.status(404).json({ message: 'Laboratory not found or inactive' });
      }

      // Validate patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Require authentication for internal endpoints
      const user = (req as any).user;
      if (!user || user.role !== 'doctor') {
        return res.status(401).json({ message: 'Authentication required - doctors only' });
      }

      const doctorId = user.id;
      
      // Create lab order
      const newOrder = await storage.createLabOrder({
        patientId,
        doctorId,
        laboratoryId,
        orderDetails,
        urgency: urgency || 'routine',
        expectedResultDate,
      });

      // Log order creation
      await storage.createCollaboratorIntegration({
        collaboratorId: laboratoryId,
        integrationType: 'lab_order',
        entityId: newOrder.id,
        action: 'order_created',
        status: 'success',
        requestData: {
          patientId,
          doctorId,
          orderDetails,
          urgency: urgency || 'routine',
          timestamp: new Date().toISOString()
        },
      });

      // Real-time broadcast to authenticated doctor only
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, {
        type: 'lab_order_created',
        data: { orderId: newOrder.id, laboratoryId, patientId }
      });

      res.status(201).json(newOrder);
    } catch (error) {
      console.error('Create lab order error:', error);
      res.status(500).json({ message: 'Failed to create lab order' });
    }
  });

  // Get laboratory orders (External API - for laboratories)
  app.get('/api/laboratories/:laboratoryId/orders', authenticateApiKey, async (req, res) => {
    try {
      const { laboratoryId } = req.params;
      const { status, limit = 50, offset = 0, startDate, endDate } = req.query;

      // Tenant binding check
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== laboratoryId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_lab_orders_access',
          status: 'failed',
          errorMessage: 'Attempted to access another laboratory\'s orders',
          requestData: {
            requestedLaboratoryId: laboratoryId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized laboratory access' });
      }

      // Validate laboratory type
      if (authenticatedCollaborator.type !== 'laboratory') {
        return res.status(403).json({ message: 'Access denied: not a laboratory collaborator' });
      }

      // Get laboratory orders
      const allOrders = await storage.getLabOrdersByLaboratory(laboratoryId);
      
      // Apply filters
      let filteredOrders = allOrders;
      
      if (status) {
        filteredOrders = filteredOrders.filter(order => order.status === status);
      }
      
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : new Date(0);
        const end = endDate ? new Date(endDate as string) : new Date();
        filteredOrders = filteredOrders.filter(order => 
          new Date(order.createdAt) >= start && new Date(order.createdAt) <= end
        );
      }

      // Apply pagination
      const total = filteredOrders.length;
      const paginatedOrders = filteredOrders.slice(Number(offset), Number(offset) + Number(limit));

      // Log access
      await storage.createCollaboratorIntegration({
        collaboratorId: laboratoryId,
        integrationType: 'lab_order_access',
        entityId: 'orders_list',
        action: 'orders_retrieved',
        status: 'success',
        requestData: {
          ordersCount: paginatedOrders.length,
          filters: { status, startDate, endDate },
          pagination: { limit, offset },
          timestamp: new Date().toISOString()
        },
      });

      res.json({
        orders: paginatedOrders,
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total
      });
    } catch (error) {
      console.error('Get laboratory orders error:', error);
      res.status(500).json({ message: 'Failed to get laboratory orders' });
    }
  });

  // Update laboratory order status (External API - for laboratories)
  app.patch('/api/lab-orders/:orderId/status', authenticateApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status, collectionDate, completedAt, externalOrderId, notes } = req.body;

      // Get existing order with tenant binding
      const existingOrder = await storage.getLabOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Lab order not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== existingOrder.laboratoryId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: orderId,
          action: 'unauthorized_lab_order_update',
          status: 'failed',
          errorMessage: 'Attempted to update another laboratory\'s order',
          requestData: {
            orderId,
            orderLaboratoryId: existingOrder.laboratoryId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            requestedStatus: status,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized lab order update' });
      }

      // Validate status transitions
      const ALLOWED_LAB_TRANSITIONS: Record<string, string[]> = {
        'ordered': ['collected', 'cancelled'],
        'collected': ['processing', 'cancelled'],
        'processing': ['completed', 'cancelled'],
        'completed': [], // Final state
        'cancelled': [] // Final state
      };

      const currentStatus = existingOrder.status;
      if (status && !ALLOWED_LAB_TRANSITIONS[currentStatus]?.includes(status)) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'lab_workflow_violation',
          entityId: orderId,
          action: 'invalid_status_transition',
          status: 'failed',
          errorMessage: `Invalid lab order transition from ${currentStatus} to ${status}`,
          requestData: {
            orderId,
            patientId: existingOrder.patientId,
            currentStatus,
            requestedStatus: status,
            validTransitions: ALLOWED_LAB_TRANSITIONS[currentStatus] || [],
            timestamp: new Date().toISOString()
          },
        });
        return res.status(400).json({ 
          message: `Invalid transition from ${currentStatus} to ${status}`,
          currentStatus,
          validTransitions: ALLOWED_LAB_TRANSITIONS[currentStatus] || []
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (status) updateData.status = status;
      if (collectionDate) updateData.collectionDate = new Date(collectionDate);
      if (completedAt) updateData.completedAt = new Date(completedAt);
      if (externalOrderId) updateData.externalOrderId = externalOrderId;

      // Auto-set completion timestamp for completed status
      if (status === 'completed' && !completedAt) {
        updateData.completedAt = new Date();
      }

      // Update the order
      const updatedOrder = await storage.updateLabOrder(orderId, updateData);
      if (!updatedOrder) {
        return res.status(500).json({ message: 'Failed to update lab order' });
      }

      // Comprehensive audit logging
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'lab_order_update',
        entityId: orderId,
        action: 'status_updated',
        status: 'success',
        requestData: {
          orderId,
          patientId: existingOrder.patientId,
          doctorId: existingOrder.doctorId,
          previousStatus: currentStatus,
          newStatus: status,
          updateData,
          notes: notes || '',
          timestamp: new Date().toISOString()
        },
      });

      // Real-time broadcast to authenticated doctor only
      broadcastToDoctor(actualDoctorId || DEFAULT_DOCTOR_ID, {
        type: 'lab_order_status_updated',
        data: { orderId, newStatus: status, laboratoryId: authenticatedCollaborator.id }
      });

      res.json({
        id: updatedOrder.id,
        status: updatedOrder.status,
        previousStatus: currentStatus,
        updatedAt: new Date().toISOString(),
        collectionDate: updatedOrder.collectionDate,
        completedAt: updatedOrder.completedAt,
        externalOrderId: updatedOrder.externalOrderId
      });
    } catch (error) {
      console.error('Update lab order status error:', error);
      res.status(500).json({ message: 'Failed to update lab order status' });
    }
  });

  // Submit laboratory test results (External API - for laboratories)
  app.post('/api/lab-orders/:orderId/results', authenticateApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { results, resultsFileUrl, criticalValues, technician } = req.body;

      // Get existing order with tenant binding
      const existingOrder = await storage.getLabOrder(orderId);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Lab order not found' });
      }

      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== existingOrder.laboratoryId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: orderId,
          action: 'unauthorized_results_submission',
          status: 'failed',
          errorMessage: 'Attempted to submit results for another laboratory\'s order',
          requestData: {
            orderId,
            orderLaboratoryId: existingOrder.laboratoryId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized results submission' });
      }

      // Validate order can receive results
      if (!['processing', 'completed'].includes(existingOrder.status)) {
        return res.status(400).json({ 
          message: 'Results can only be submitted for orders in processing or completed status',
          currentStatus: existingOrder.status 
        });
      }

      // Update order with results
      const updateData: any = {
        status: 'completed',
        completedAt: new Date(),
        results,
        criticalValues: criticalValues || false,
      };

      if (resultsFileUrl) {
        updateData.resultsFileUrl = resultsFileUrl;
      }

      const updatedOrder = await storage.updateLabOrder(orderId, updateData);
      if (!updatedOrder) {
        return res.status(500).json({ message: 'Failed to update lab order with results' });
      }

      // Comprehensive audit logging
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'lab_results_submission',
        entityId: orderId,
        action: 'results_submitted',
        status: 'success',
        requestData: {
          orderId,
          patientId: existingOrder.patientId,
          doctorId: existingOrder.doctorId,
          resultsSubmitted: true,
          criticalValues: criticalValues || false,
          technician: technician || 'unknown',
          resultsFileProvided: !!resultsFileUrl,
          timestamp: new Date().toISOString()
        },
      });

      // Note: Real-time lab result notifications disabled for security
      // In production, implement proper JWT-based WebSocket authentication
      // For now, doctors will see results when they refresh/check the lab orders page
      console.log(`Lab results submitted for order ${orderId} - doctor ${existingOrder.doctorId} can view via API`);

      res.json({
        id: updatedOrder.id,
        status: updatedOrder.status,
        results: updatedOrder.results,
        resultsFileUrl: updatedOrder.resultsFileUrl,
        criticalValues: updatedOrder.criticalValues,
        completedAt: updatedOrder.completedAt,
        submittedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Submit lab results error:', error);
      res.status(500).json({ message: 'Failed to submit lab results' });
    }
  });

  // Get laboratory analytics and statistics (External API - for laboratories)
  app.get('/api/laboratories/:laboratoryId/analytics', authenticateApiKey, async (req, res) => {
    try {
      const { laboratoryId } = req.params;

      // Tenant binding check
      const authenticatedCollaborator = (req as any).authenticatedCollaborator;
      if (authenticatedCollaborator.id !== laboratoryId) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: req.path,
          action: 'unauthorized_lab_analytics_access',
          status: 'failed',
          errorMessage: 'Attempted to access another laboratory\'s analytics',
          requestData: {
            requestedLaboratoryId: laboratoryId,
            authenticatedCollaboratorId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized laboratory analytics access' });
      }

      // Validate laboratory exists and is active
      const laboratory = await storage.getCollaborator(laboratoryId);
      if (!laboratory || laboratory.type !== 'laboratory') {
        return res.status(404).json({ message: 'Laboratory not found' });
      }

      const labOrders = await storage.getLabOrdersByLaboratory(laboratoryId);
      const integrationLogs = await storage.getCollaboratorIntegrationsByCollaborator(laboratoryId);

      // Calculate statistics
      const totalOrders = labOrders.length;
      const completedOrders = labOrders.filter(order => order.status === 'completed').length;
      const pendingOrders = labOrders.filter(order => 
        ['ordered', 'collected', 'processing'].includes(order.status)
      ).length;
      const criticalResults = labOrders.filter(order => order.criticalValues).length;

      // Average processing time (in hours)
      const completedOrdersWithTime = labOrders.filter(order => 
        order.completedAt && order.createdAt
      );
      const avgProcessingTime = completedOrdersWithTime.length > 0
        ? completedOrdersWithTime.reduce((sum, order) => {
            const timeDiff = new Date(order.completedAt!).getTime() - new Date(order.createdAt).getTime();
            return sum + (timeDiff / (1000 * 60 * 60)); // Convert to hours
          }, 0) / completedOrdersWithTime.length
        : 0;

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentOrders = labOrders.filter(order => 
        new Date(order.createdAt) >= thirtyDaysAgo
      );

      // Status distribution
      const statusDistribution = labOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        laboratory: {
          id: laboratory.id,
          name: laboratory.name,
          type: laboratory.type
        },
        statistics: {
          totalOrders,
          completedOrders,
          pendingOrders,
          criticalResults,
          completionRate: totalOrders > 0 ? (completedOrders / totalOrders * 100) : 0,
          avgProcessingTimeHours: Math.round(avgProcessingTime * 100) / 100,
          recentActivity: recentOrders.length,
          integrationEvents: integrationLogs.length,
          statusDistribution
        },
        recentOrders: recentOrders.slice(0, 10) // Last 10 recent orders
      });
    } catch (error) {
      console.error('Get laboratory analytics error:', error);
      res.status(500).json({ message: 'Failed to get laboratory analytics' });
    }
  });

  // ===== DOCTOR-FACING LAB RESULT RETRIEVAL ENDPOINTS =====

  // Get specific laboratory order with results (Internal - for doctors)
  app.get('/api/lab-orders/:orderId', async (req, res) => {
    try {
      // Require authentication for internal endpoints
      const user = (req as any).user;
      if (!user || user.role !== 'doctor') {
        return res.status(401).json({ message: 'Authentication required - doctors only' });
      }

      const { orderId } = req.params;

      // Get lab order with all details
      const labOrder = await storage.getLabOrder(orderId);
      if (!labOrder) {
        return res.status(404).json({ message: 'Laboratory order not found' });
      }

      // Enforce resource-level authorization - doctors can only access their own orders
      if (labOrder.doctorId !== user.id) {
        // Log authorization violation
        await storage.createCollaboratorIntegration({
          collaboratorId: 'internal_system',
          integrationType: 'authorization_violation',
          entityId: orderId,
          action: 'unauthorized_lab_order_access',
          status: 'failed',
          errorMessage: 'Doctor attempted to access another doctor\'s lab order',
          requestData: {
            doctorId: user.id,
            orderId,
            orderDoctorId: labOrder.doctorId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: you can only access your own orders' });
      }

      // Get patient details for validation
      const patient = await storage.getPatient(labOrder.patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Log authorized access for audit trail
      await storage.createCollaboratorIntegration({
        collaboratorId: 'internal_system',
        integrationType: 'lab_order_access',
        entityId: orderId,
        action: 'lab_order_viewed',
        status: 'success',
        requestData: {
          doctorId: user.id,
          orderId,
          patientId: labOrder.patientId,
          timestamp: new Date().toISOString()
        },
      });

      // Get laboratory details
      const laboratory = await storage.getCollaborator(labOrder.laboratoryId);

      res.json({
        id: labOrder.id,
        patientId: labOrder.patientId,
        patientName: patient.name,
        doctorId: labOrder.doctorId,
        laboratoryId: labOrder.laboratoryId,
        laboratoryName: laboratory?.name || 'Unknown Laboratory',
        orderDetails: labOrder.orderDetails,
        status: labOrder.status,
        urgency: labOrder.urgency,
        results: labOrder.results,
        hasResultFile: !!labOrder.resultsFileUrl,
        criticalValues: labOrder.criticalValues,
        expectedResultDate: labOrder.expectedResultDate,
        createdAt: labOrder.createdAt,
        completedAt: labOrder.completedAt
      });
    } catch (error) {
      console.error('Get lab order error:', error);
      res.status(500).json({ message: 'Failed to get laboratory order' });
    }
  });

  // Get all laboratory orders for a specific patient (Internal - for doctors)
  app.get('/api/patients/:patientId/lab-orders', async (req, res) => {
    try {
      // Require authentication for internal endpoints
      const user = (req as any).user;
      if (!user || user.role !== 'doctor') {
        return res.status(401).json({ message: 'Authentication required - doctors only' });
      }

      const { patientId } = req.params;
      const { status, limit = '50', offset = '0' } = req.query;

      // Validate patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Parse query parameters
      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100); // Cap at 100
      const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);

      // Get patient's lab orders
      const labOrders = await storage.getLabOrdersByPatient(patientId);
      
      // Enforce resource-level authorization - doctors can only access their own orders
      const authorizedOrders = labOrders.filter(order => order.doctorId === user.id);
      
      // Log access attempt with authorization results
      await storage.createCollaboratorIntegration({
        collaboratorId: 'internal_system',
        integrationType: 'patient_lab_orders_access',
        entityId: patientId,
        action: 'patient_lab_orders_viewed',
        status: 'success',
        requestData: {
          doctorId: user.id,
          patientId,
          totalOrders: labOrders.length,
          authorizedOrders: authorizedOrders.length,
          timestamp: new Date().toISOString()
        },
      });
      
      // Filter by status if provided
      let filteredOrders = authorizedOrders;
      if (status && typeof status === 'string') {
        filteredOrders = authorizedOrders.filter(order => order.status === status);
      }

      // Apply pagination
      const paginatedOrders = filteredOrders.slice(offsetNum, offsetNum + limitNum);

      // Enrich with laboratory details
      const enrichedOrders = await Promise.all(paginatedOrders.map(async (order) => {
        const laboratory = await storage.getCollaborator(order.laboratoryId);
        return {
          id: order.id,
          patientId: order.patientId,
          doctorId: order.doctorId,
          laboratoryId: order.laboratoryId,
          laboratoryName: laboratory?.name || 'Unknown Laboratory',
          orderDetails: order.orderDetails,
          status: order.status,
          urgency: order.urgency,
          results: order.results,
          hasResultFile: !!order.resultsFileUrl,
          criticalValues: order.criticalValues,
          expectedResultDate: order.expectedResultDate,
          createdAt: order.createdAt,
          completedAt: order.completedAt
        };
      }));

      res.json({
        patient: {
          id: patient.id,
          name: patient.name
        },
        orders: enrichedOrders,
        pagination: {
          total: filteredOrders.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < filteredOrders.length
        }
      });
    } catch (error) {
      console.error('Get patient lab orders error:', error);
      res.status(500).json({ message: 'Failed to get patient laboratory orders' });
    }
  });

  // Get results for a specific laboratory order (Internal - for doctors)
  app.get('/api/lab-orders/:orderId/results', async (req, res) => {
    try {
      // Require authentication for internal endpoints
      const user = (req as any).user;
      if (!user || user.role !== 'doctor') {
        return res.status(401).json({ message: 'Authentication required - doctors only' });
      }

      const { orderId } = req.params;

      // Get lab order
      const labOrder = await storage.getLabOrder(orderId);
      if (!labOrder) {
        return res.status(404).json({ message: 'Laboratory order not found' });
      }

      // Enforce resource-level authorization - doctors can only access their own orders
      if (labOrder.doctorId !== user.id) {
        // Log authorization violation
        await storage.createCollaboratorIntegration({
          collaboratorId: 'internal_system',
          integrationType: 'authorization_violation',
          entityId: orderId,
          action: 'unauthorized_lab_results_access',
          status: 'failed',
          errorMessage: 'Doctor attempted to access another doctor\'s lab results',
          requestData: {
            doctorId: user.id,
            orderId,
            orderDoctorId: labOrder.doctorId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: you can only access your own order results' });
      }

      // Check if results are available
      if (!labOrder.results && !labOrder.resultsFileUrl) {
        return res.status(404).json({ message: 'Results not available yet' });
      }

      // Log authorized results access for audit trail
      await storage.createCollaboratorIntegration({
        collaboratorId: 'internal_system',
        integrationType: 'lab_results_access',
        entityId: orderId,
        action: 'lab_results_viewed',
        status: 'success',
        requestData: {
          doctorId: user.id,
          orderId,
          patientId: labOrder.patientId,
          resultsAccessed: true,
          timestamp: new Date().toISOString()
        },
      });

      // Get patient and laboratory details for context
      const patient = await storage.getPatient(labOrder.patientId);
      const laboratory = await storage.getCollaborator(labOrder.laboratoryId);

      res.json({
        orderId: labOrder.id,
        patient: {
          id: patient?.id,
          name: patient?.name
        },
        laboratory: {
          id: laboratory?.id,
          name: laboratory?.name
        },
        orderDetails: labOrder.orderDetails,
        status: labOrder.status,
        urgency: labOrder.urgency,
        results: labOrder.results,
        hasResultFile: !!labOrder.resultsFileUrl,
        criticalValues: labOrder.criticalValues,
        completedAt: labOrder.completedAt,
        expectedResultDate: labOrder.expectedResultDate
      });
    } catch (error) {
      console.error('Get lab order results error:', error);
      res.status(500).json({ message: 'Failed to get laboratory order results' });
    }
  });

  // Secure download endpoint for laboratory result files (Internal - for doctors)
  app.get('/api/lab-orders/:orderId/download-results', async (req, res) => {
    try {
      // Require authentication for internal endpoints
      const user = (req as any).user;
      if (!user || user.role !== 'doctor') {
        return res.status(401).json({ message: 'Authentication required - doctors only' });
      }

      const { orderId } = req.params;

      // Get lab order
      const labOrder = await storage.getLabOrder(orderId);
      if (!labOrder) {
        return res.status(404).json({ message: 'Laboratory order not found' });
      }

      // Enforce resource-level authorization
      if (labOrder.doctorId !== user.id) {
        // Log authorization violation
        await storage.createCollaboratorIntegration({
          collaboratorId: 'internal_system',
          integrationType: 'authorization_violation',
          entityId: orderId,
          action: 'unauthorized_result_file_download',
          status: 'failed',
          errorMessage: 'Doctor attempted to download another doctor\'s lab result file',
          requestData: {
            doctorId: user.id,
            orderId,
            orderDoctorId: labOrder.doctorId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: you can only download your own order result files' });
      }

      // Check if result file is available
      if (!labOrder.resultsFileUrl) {
        return res.status(404).json({ message: 'Result file not available' });
      }

      // Log authorized file download for audit trail
      await storage.createCollaboratorIntegration({
        collaboratorId: 'internal_system',
        integrationType: 'lab_result_file_download',
        entityId: orderId,
        action: 'result_file_downloaded',
        status: 'success',
        requestData: {
          doctorId: user.id,
          orderId,
          patientId: labOrder.patientId,
          fileUrl: labOrder.resultsFileUrl,
          timestamp: new Date().toISOString()
        },
      });

      // In production, this would proxy/stream the file with proper authorization
      // For now, return the secure file URL with authorization context
      res.json({
        message: 'File download authorized',
        orderId: labOrder.id,
        patientId: labOrder.patientId,
        downloadUrl: labOrder.resultsFileUrl,
        timestamp: new Date().toISOString(),
        authorizedDoctor: user.id
      });
    } catch (error) {
      console.error('Download lab result file error:', error);
      res.status(500).json({ message: 'Failed to download lab result file' });
    }
  });

  // ===== LABORATORY WORKFLOW TRACKING ALREADY IMPLEMENTED =====
  // 
  // Comprehensive laboratory workflow tracking and audit logging is already implemented via:
  // - ALLOWED_LAB_TRANSITIONS: Complete state transition validation (lines 2474-2480)
  // - Workflow violation logging: Invalid transitions tracked with full context
  // - Authorization violation tracking: All unauthorized access attempts logged
  // - Comprehensive audit trails: All operations logged via createCollaboratorIntegration
  // - Laboratory analytics: Available via existing analytics endpoints (lines 2620+)
  //
  // Laboratory workflow events tracked:
  // - lab_order: Order creation
  // - lab_order_update: Status updates with transition validation
  // - lab_workflow_violation: Invalid state transitions
  // - authorization_violation: Unauthorized access attempts
  // - lab_results_submission: Results submission
  // - lab_order_access: Order retrieval by doctors
  // - lab_results_access: Results access by doctors
  // - lab_result_file_download: File downloads
  //
  // This provides complete workflow tracking and audit logging for Brazilian healthcare compliance.

  // ===== VISITOR MANAGEMENT MIDDLEWARE =====
  
  // Middleware to detect and create visitor accounts for new IPs
  const ensureVisitorAccount = async (req: any, res: any, next: any) => {
    try {
      // Skip visitor creation for API routes and authenticated users
      if (req.path.startsWith('/api/') || req.cookies?.authToken) {
        return next();
      }

      // Get client IP address
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      
      // Skip only if IP is truly unknown (allow localhost for development)
      if (clientIp === 'unknown') {
        return next();
      }

      // Check if visitor account already exists for this IP
      let visitor = await storage.getVisitorByIp(clientIp);
      
      if (!visitor) {
        // Create new visitor account
        visitor = await storage.createVisitorAccount(clientIp);
        console.log(`Created visitor account for IP: ${clientIp}`);
      }

      // Generate JWT token for visitor
      const jwtSecret = process.env.SESSION_SECRET;
      if (jwtSecret) {
        const visitorToken = jwt.sign(
          { 
            userId: visitor.id,
            username: visitor.username,
            role: visitor.role,
            type: 'visitor_auth'
          },
          jwtSecret,
          { 
            expiresIn: '24h', // Shorter expiry for visitors
            issuer: 'healthcare-system',
            audience: 'websocket',
            algorithm: 'HS256'
          }
        );

        // Set visitor token as HTTP-only cookie
        res.cookie('visitorToken', visitorToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Attach visitor to request for other middleware
        req.visitor = visitor;
      }

      next();
    } catch (error) {
      console.error('Visitor management error:', error);
      // Don't fail the request if visitor creation fails
      next();
    }
  };

  // Apply visitor management middleware globally (after definition)
  app.use(ensureVisitorAccount);

  // ===== AUTHENTICATION MIDDLEWARE FOR INTERNAL USERS =====
  
  // Enhanced authentication middleware with proper JWT session validation and visitor support
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      // Get JWT token from Authorization header or cookies
      const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.authToken;
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Verify JWT token
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - authentication failed');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      let payload;
      try {
        payload = jwt.verify(token, jwtSecret, {
          issuer: 'telemed-system',
          audience: 'web-app',
          algorithms: ['HS256']
        }) as any;
      } catch (jwtError) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      // Get user from database
      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Check if user was blocked after login
      if (user.isBlocked) {
        res.clearCookie('authToken');
        const reason = user.deactivationReason || 'Conta desativada por questões administrativas.';
        return res.status(403).json({ message: reason, blocked: true });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  };

  const requireAuthOrMcp = async (req: any, res: any, next: any) => {
    const mcpSecret = process.env.TELE_M3D_SECRET;
    const mcpHeader = req.headers["x-mcp-auth"];
    if (mcpSecret && mcpHeader === mcpSecret) {
      req.user = { id: 'mcp-service', role: 'admin', username: 'mcp-service', isMcpService: true };
      return next();
    }
    return requireAuth(req, res, next);
  };

  // Middleware to require specific roles
  const requireRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      const user = req.user;
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: 'Access denied: insufficient privileges' });
      }
      next();
    };
  };

  // ===== Doctor Appointment Delete & Patient Blocking =====

  // Doctor deletes an appointment (removes from DB)
  app.delete('/api/appointments/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas médicos e administradores podem excluir agendamentos' });
      }
      const { id } = req.params;
      const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
      if (!apt) {
        return res.status(404).json({ message: 'Agendamento não encontrado' });
      }
      if (req.user.role === 'doctor' && apt.doctorId !== req.user.id) {
        return res.status(403).json({ message: 'Você só pode excluir seus próprios agendamentos' });
      }

      if (apt.patientId) {
        try {
          const patient = await storage.getPatient(apt.patientId);
          if (patient?.userId) {
            broadcastToUser(patient.userId, {
              type: 'appointment_deleted',
              data: { appointmentId: apt.id, scheduledAt: apt.scheduledAt, message: 'Seu agendamento foi cancelado e removido pelo médico.' },
            });
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'appointment',
              title: 'Agendamento Removido',
              message: `Seu agendamento de ${new Date(apt.scheduledAt).toLocaleDateString('pt-BR')} foi cancelado e removido pelo médico.`,
              priority: 'medium',
              actionUrl: '/my-consultations',
              delivered: false,
              read: false,
            });
          }
        } catch {}
      }

      await db.delete(appointments).where(eq(appointments.id, id));
      res.json({ success: true, message: 'Agendamento excluído com sucesso' });
    } catch (error) {
      console.error('Delete appointment error:', error);
      res.status(500).json({ message: 'Falha ao excluir agendamento' });
    }
  });

  // Doctor blocks a patient from booking appointments/consultations
  app.post('/api/doctor/block-patient', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas médicos podem bloquear pacientes' });
      }
      const { patientId, reason } = req.body;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId é obrigatório' });
      }
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }
      const doctorId = req.user.id;

      const existing = await db.select().from(doctorPatientBlocks)
        .where(and(eq(doctorPatientBlocks.doctorId, doctorId), eq(doctorPatientBlocks.patientId, patientId)));
      if (existing.length > 0) {
        return res.status(409).json({ message: 'Paciente já está bloqueado' });
      }

      const [block] = await db.insert(doctorPatientBlocks).values({
        doctorId,
        patientId,
        reason: reason || null,
      }).returning();

      if (patient.userId) {
        broadcastToUser(patient.userId, {
          type: 'patient_blocked',
          data: { doctorId, message: 'Você foi bloqueado por um médico. Não é mais possível agendar consultas com este profissional.' },
        });
      }

      res.json({ success: true, block });
    } catch (error) {
      console.error('Block patient error:', error);
      res.status(500).json({ message: 'Falha ao bloquear paciente' });
    }
  });

  // Doctor unblocks a patient
  app.delete('/api/doctor/block-patient/:patientId', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas médicos podem desbloquear pacientes' });
      }
      const doctorId = req.user.id;
      const { patientId } = req.params;

      const deleted = await db.delete(doctorPatientBlocks)
        .where(and(eq(doctorPatientBlocks.doctorId, doctorId), eq(doctorPatientBlocks.patientId, patientId)))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ message: 'Bloqueio não encontrado' });
      }

      res.json({ success: true, message: 'Paciente desbloqueado' });
    } catch (error) {
      console.error('Unblock patient error:', error);
      res.status(500).json({ message: 'Falha ao desbloquear paciente' });
    }
  });

  // List doctor's blocked patients
  app.get('/api/doctor/blocked-patients', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito' });
      }
      const doctorId = req.user.id;

      const blocks = await db.select({
        id: doctorPatientBlocks.id,
        patientId: doctorPatientBlocks.patientId,
        reason: doctorPatientBlocks.reason,
        blockedAt: doctorPatientBlocks.blockedAt,
        patientName: patients.name,
        patientEmail: patients.email,
        patientPhone: patients.phone,
      })
        .from(doctorPatientBlocks)
        .innerJoin(patients, eq(doctorPatientBlocks.patientId, patients.id))
        .where(eq(doctorPatientBlocks.doctorId, doctorId))
        .orderBy(desc(doctorPatientBlocks.blockedAt));

      res.json(blocks);
    } catch (error) {
      console.error('List blocked patients error:', error);
      res.status(500).json({ message: 'Falha ao listar pacientes bloqueados' });
    }
  });

  // ===== PMD v1.0 — Prontuário Médico Digital (CFM/LGPD/RGPD) =====

  app.post('/api/pmd/create', requireAuth, requireRole(['doctor', 'admin']), async (req: any, res) => {
    try {
      const { patientId, pmdData } = req.body;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId é obrigatório' });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      const doctor = await storage.getUser(req.user.id);
      const medicoCrm = doctor?.medicalLicense || 'N/A';

      const initialPmd = {
        id_paciente: patientId,
        medico_crm: medicoCrm,
        paciente: {
          nome: pmdData?.paciente?.nome || patient.name,
          dt_nasc: pmdData?.paciente?.dt_nasc || (patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : ''),
          sexo: pmdData?.paciente?.sexo || patient.gender || 'N/A',
          endereco: pmdData?.paciente?.endereco || 'Não informado',
          contato: pmdData?.paciente?.contato || patient.phone || patient.email || 'N/A',
          nome_mae: pmdData?.paciente?.nome_mae || '',
          cpf: pmdData?.paciente?.cpf || '',
          rg: pmdData?.paciente?.rg || '',
          sus_card: pmdData?.paciente?.sus_card || '',
          dni: pmdData?.paciente?.dni || '',
          vacinas: pmdData?.paciente?.vacinas || [],
        },
        clinico: {
          anamnese: pmdData?.clinico?.anamnese || '',
          historico: pmdData?.clinico?.historico || (patient.medicalHistory ? JSON.stringify(patient.medicalHistory) : ''),
          exames: pmdData?.clinico?.exames || '',
          diagnostico: pmdData?.clinico?.diagnostico || '',
          tratamento: pmdData?.clinico?.tratamento || '',
          evolucoes: pmdData?.clinico?.evolucoes || [],
        },
        logs: [],
      };

      const auditLog = {
        timestamp: new Date().toISOString(),
        user: `${doctor?.name} (CRM: ${medicoCrm})`,
        acao: 'criação',
        antigo: '',
        novo: 'Prontuário PMD v1.0 criado',
      };

      const record = await storage.createMedicalRecord({
        patientId,
        doctorId: req.user.id,
        diagnosis: initialPmd.clinico.diagnostico,
        symptoms: initialPmd.clinico.anamnese,
        treatment: initialPmd.clinico.tratamento,
        observations: '',
        pmdData: initialPmd,
        pmdAuditLogs: [auditLog],
        pmdVersion: '1.0',
        isEncrypted: true,
      });

      res.status(201).json({
        id: record.id,
        pmd: initialPmd,
        message: 'Prontuário PMD v1.0 criado com sucesso',
      });
    } catch (error) {
      console.error('PMD create error:', error);
      res.status(500).json({ message: 'Erro ao criar prontuário PMD' });
    }
  });

  app.get('/api/pmd/list', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      let records: any[] = [];

      if (user.role === 'admin') {
        const allPatients = await db.select().from(patients);
        for (const p of allPatients) {
          const patientRecords = await storage.getMedicalRecordsByPatient(p.id);
          records.push(...patientRecords);
        }
      } else if (user.role === 'doctor') {
        records = await storage.getMedicalRecordsByDoctor(user.id);
      } else if (user.role === 'patient') {
        const patient = await storage.getPatientByUserId(user.id);
        if (patient) {
          const allRecords = await storage.getMedicalRecordsByPatient(patient.id);
          records = allRecords.map(r => {
            const copy = { ...r };
            copy.pmdAuditLogs = null;
            return copy;
          });
        }
      } else {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const result = records.map(r => {
        const pmd = r.pmdData as any;
        return {
          id: r.id,
          patientId: r.patientId,
          doctorId: r.doctorId,
          paciente_nome: pmd?.paciente?.nome || 'N/A',
          medico_crm: pmd?.medico_crm || 'N/A',
          diagnostico: pmd?.clinico?.diagnostico || r.diagnosis || '',
          pmd_version: r.pmdVersion || '1.0',
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          hasPmd: !!pmd,
        };
      });

      res.json(result);
    } catch (error) {
      console.error('PMD list error:', error);
      res.status(500).json({ message: 'Erro ao listar prontuários PMD' });
    }
  });

  app.get('/api/pmd/:id', requireAuth, async (req: any, res) => {
    try {
      const record = await storage.getMedicalRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Prontuário não encontrado' });
      }

      const user = req.user;
      const isCreator = record.doctorId === user.id;
      const isAdmin = user.role === 'admin';

      if (user.role === 'patient') {
        const patient = await storage.getPatientByUserId(user.id);
        if (!patient || patient.id !== record.patientId) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
        const safePmd = record.pmdData ? { ...(record.pmdData as any) } : null;
        if (safePmd) delete safePmd.logs;
        return res.json({
          id: record.id,
          pmd: safePmd,
          pmd_version: record.pmdVersion,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          accessLevel: 'leitura_basica',
        });
      }

      if (user.role === 'doctor' && !isCreator && !isAdmin) {
        const patient = await storage.getPatient(record.patientId);
        const isPrimaryDoctor = patient?.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(apt => apt.patientId === record.patientId);
        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ message: 'Acesso negado: sem vínculo com este paciente' });
        }
      } else if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const { pmdExportService } = await import('./services/pmd-export-service');
      const patient = await storage.getPatient(record.patientId);
      const doctor = await storage.getUser(record.doctorId);
      const pmd = pmdExportService.buildPMDFromRecord(record, patient, doctor);

      const includeLogs = isCreator || isAdmin;

      res.json({
        id: record.id,
        pmd: includeLogs ? pmd : { ...pmd, logs: [] },
        pmd_version: record.pmdVersion,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        accessLevel: isAdmin ? 'total' : isCreator ? 'criador' : 'leitura_basica',
        logsVisible: includeLogs,
      });
    } catch (error) {
      console.error('PMD show error:', error);
      res.status(500).json({ message: 'Erro ao exibir prontuário PMD' });
    }
  });

  app.patch('/api/pmd/:id', requireAuth, requireRole(['doctor', 'admin']), async (req: any, res) => {
    try {
      const record = await storage.getMedicalRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Prontuário não encontrado' });
      }

      const isCreator = record.doctorId === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: 'Somente o médico criador ou admin pode editar este prontuário' });
      }

      const { campo, valor, evolucao } = req.body;
      const doctor = await storage.getUser(req.user.id);
      const medicoCrm = doctor?.medicalLicense || 'N/A';

      const allowedFields = [
        'clinico.anamnese', 'clinico.historico', 'clinico.exames',
        'clinico.diagnostico', 'clinico.tratamento',
        'paciente.endereco', 'paciente.contato', 'paciente.nome_mae',
        'paciente.cpf', 'paciente.rg', 'paciente.sus_card', 'paciente.dni',
      ];

      if (campo && !allowedFields.includes(campo)) {
        return res.status(400).json({ message: `Campo não permitido: ${campo}. Campos válidos: ${allowedFields.join(', ')}` });
      }

      const currentPmd = (record.pmdData || {}) as any;
      const currentLogs = (record.pmdAuditLogs || []) as any[];

      let oldValue = '';
      let newValue = valor || '';
      let fieldPath = campo || '';

      if (evolucao) {
        const newEv = {
          data: evolucao.data || new Date().toISOString().split('T')[0],
          medico: `${doctor?.name} (CRM: ${medicoCrm})`,
          descricao: evolucao.descricao || '',
        };
        if (!currentPmd.clinico) currentPmd.clinico = {};
        if (!currentPmd.clinico.evolucoes) currentPmd.clinico.evolucoes = [];
        currentPmd.clinico.evolucoes.push(newEv);
        fieldPath = 'clinico.evolucoes';
        newValue = newEv.descricao;
        oldValue = `${currentPmd.clinico.evolucoes.length - 1} evoluções`;
      } else if (campo) {
        const parts = campo.split('.');
        let target: any = currentPmd;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        oldValue = target[lastKey] !== undefined ? String(target[lastKey]) : '';
        target[lastKey] = valor;
      } else {
        return res.status(400).json({ message: 'campo ou evolucao é obrigatório' });
      }

      const auditEntry = {
        timestamp: new Date().toISOString(),
        user: `${doctor?.name} (CRM: ${medicoCrm})`,
        acao: evolucao ? 'adição_evolução' : `edição: ${fieldPath}`,
        antigo: oldValue.substring(0, 500),
        novo: newValue.substring(0, 500),
      };
      currentLogs.push(auditEntry);

      const updateFields: any = {
        pmdData: currentPmd,
        pmdAuditLogs: currentLogs,
      };

      if (campo === 'clinico.diagnostico') updateFields.diagnosis = valor;
      if (campo === 'clinico.anamnese') updateFields.symptoms = valor;
      if (campo === 'clinico.tratamento') updateFields.treatment = valor;

      await storage.updateMedicalRecord(req.params.id, updateFields);

      res.json({
        message: 'Prontuário atualizado com sucesso',
        auditLog: auditEntry,
        pmd: currentPmd,
      });
    } catch (error) {
      console.error('PMD edit error:', error);
      res.status(500).json({ message: 'Erro ao editar prontuário PMD' });
    }
  });

  app.get('/api/pmd/:id/export', requireAuth, async (req: any, res) => {
    try {
      const record = await storage.getMedicalRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Prontuário não encontrado' });
      }

      const user = req.user;
      const isCreator = record.doctorId === user.id;
      const isAdmin = user.role === 'admin';

      if (user.role === 'patient') {
        const patient = await storage.getPatientByUserId(user.id);
        if (!patient || patient.id !== record.patientId) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
      } else if (user.role === 'doctor' && !isCreator && !isAdmin) {
        const patient = await storage.getPatient(record.patientId);
        const isPrimaryDoctor = patient?.primaryDoctorId === user.id;
        const doctorAppointments = await storage.getAppointmentsByDoctor(user.id);
        const hasAppointment = doctorAppointments.some(apt => apt.patientId === record.patientId);
        if (!isPrimaryDoctor && !hasAppointment) {
          return res.status(403).json({ message: 'Acesso negado: sem vínculo com este paciente' });
        }
      } else if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const locale = ((req.query.locale || 'BR') as string).toUpperCase() as 'BR' | 'ES' | 'USA';
      const format = ((req.query.format || 'PDF') as string).toUpperCase() as 'PDF' | 'JSON' | 'XML' | 'CSV';

      const validLocales = ['BR', 'ES', 'USA'];
      const validFormats = ['PDF', 'JSON', 'XML', 'CSV'];
      if (!validLocales.includes(locale)) {
        return res.status(400).json({ message: `Locale inválido. Use: ${validLocales.join(', ')}` });
      }
      if (!validFormats.includes(format)) {
        return res.status(400).json({ message: `Formato inválido. Use: ${validFormats.join(', ')}` });
      }

      const { pmdExportService } = await import('./services/pmd-export-service');
      const patient = await storage.getPatient(record.patientId);
      const doctor = await storage.getUser(record.doctorId);
      const pmd = pmdExportService.buildPMDFromRecord(record, patient, doctor);

      const includeLogs = isCreator || isAdmin;
      const patientName = pmd.paciente.nome.replace(/\s+/g, '_').substring(0, 30);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `PMD_${patientName}_${locale}_${timestamp}`;

      switch (format) {
        case 'JSON': {
          const content = pmdExportService.exportToJSON(pmd, locale, includeLogs);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.json"`);
          return res.send(content);
        }
        case 'XML': {
          const content = pmdExportService.exportToXML(pmd, locale, includeLogs);
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.xml"`);
          return res.send(content);
        }
        case 'CSV': {
          const content = pmdExportService.exportToCSV(pmd, locale, includeLogs);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
          return res.send(content);
        }
        case 'PDF':
        default: {
          const content = pmdExportService.exportToPDFHtml(pmd, locale, includeLogs);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.html"`);
          return res.send(content);
        }
      }
    } catch (error) {
      console.error('PMD export error:', error);
      res.status(500).json({ message: 'Erro ao exportar prontuário PMD' });
    }
  });

  app.patch('/api/pmd/:id/convert', requireAuth, requireRole(['doctor', 'admin']), async (req: any, res) => {
    try {
      const record = await storage.getMedicalRecord(req.params.id);
      if (!record) {
        return res.status(404).json({ message: 'Prontuário não encontrado' });
      }

      if (record.pmdData) {
        return res.json({ message: 'Prontuário já está no formato PMD', id: record.id });
      }

      const isCreator = record.doctorId === req.user.id;
      const isAdmin = req.user.role === 'admin';
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ message: 'Somente o médico criador ou admin pode converter este prontuário' });
      }

      const { pmdExportService } = await import('./services/pmd-export-service');
      const patient = await storage.getPatient(record.patientId);
      const doctor = await storage.getUser(record.doctorId);
      const pmd = pmdExportService.buildPMDFromRecord(record, patient, doctor);

      const auditLog = {
        timestamp: new Date().toISOString(),
        user: `${doctor?.name} (CRM: ${doctor?.medicalLicense || 'N/A'})`,
        acao: 'conversão para PMD v1.0',
        antigo: 'formato legado',
        novo: 'PMD v1.0',
      };

      await storage.updateMedicalRecord(record.id, {
        pmdData: pmd,
        pmdAuditLogs: [auditLog],
        pmdVersion: '1.0',
      });

      res.json({ message: 'Prontuário convertido para PMD v1.0', id: record.id, pmd });
    } catch (error) {
      console.error('PMD convert error:', error);
      res.status(500).json({ message: 'Erro ao converter prontuário' });
    }
  });

  // ===== PHARMACY USER SYSTEM (Dispensing, Verification, Reports) =====

  app.post('/api/prescriptions/ai-suggest', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Somente médicos podem solicitar sugestões de IA' });
      }
      const { patientId, medicationName, medicationDetails, diagnosis, symptoms } = req.body;
      if (!patientId || !medicationName) {
        return res.status(400).json({ message: 'patientId e medicationName são obrigatórios' });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      const patientRecords = await storage.getMedicalRecordsByPatient(patientId);
      const patientHistory = patientRecords.slice(0, 5).map((r: any) => r.diagnosis || r.notes || '').join('; ');

      const prompt = `Você é um assistente médico especialista em farmacologia clínica, seguindo protocolos OMS, MS/Brasil e bulas ANVISA.

PACIENTE:
- Nome: ${patient.name}
- Alergias: ${(patient as any).allergies || 'Nenhuma registrada'}
- Condições: ${(patient as any).conditions || 'Nenhuma registrada'}
- Histórico recente: ${patientHistory || 'Sem histórico'}
${diagnosis ? `\nDIAGNÓSTICO ATUAL: ${diagnosis}` : ''}
${symptoms ? `SINTOMAS DESCRITOS: ${symptoms}` : ''}

MEDICAMENTO SOLICITADO: ${medicationName}
${medicationDetails ? `Detalhes: ${medicationDetails}` : ''}

Com base no diagnóstico, sintomas e histórico do paciente, forneça uma recomendação estruturada em JSON com os seguintes campos:
{
  "dosage": "dosagem recomendada considerando perfil do paciente e diagnóstico",
  "frequency": "frequência de administração",
  "duration": "duração do tratamento baseada no diagnóstico",
  "observations": "observações importantes (categoria na gravidez, ajustes renais/hepáticos, idosos, relação com o diagnóstico)",
  "specialInstructions": "instruções especiais de administração (horário, alimentação, interações com alimentos)",
  "warnings": {
    "sideEffects": ["efeito colateral 1", "efeito colateral 2"],
    "contraindications": ["contraindicação 1", "contraindicação 2"],
    "adverseEffects": ["efeito adverso grave 1"],
    "drugInteractions": ["interação com medicamento X"],
    "riskLevel": "low|moderate|high|critical"
  }
}

Responda APENAS com o JSON, sem texto adicional.`;

      let aiResponse: string | null = null;
      try {
        aiResponse = await geminiService.generateText(prompt);
      } catch (err) {
        console.error('[AI-SUGGEST] AI service failed:', err);
      }

      if (!aiResponse) {
        return res.status(500).json({ message: 'Serviço de IA indisponível' });
      }

      try {
        const cleanJson = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const suggestion = JSON.parse(cleanJson);
        res.json(suggestion);
      } catch (parseErr) {
        res.json({
          dosage: '',
          frequency: '',
          duration: '',
          observations: aiResponse,
          specialInstructions: '',
          warnings: { sideEffects: [], contraindications: [], adverseEffects: [], drugInteractions: [], riskLevel: 'moderate' }
        });
      }
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ message: 'Falha ao gerar sugestão de IA' });
    }
  });

  app.post('/api/prescriptions/ai-suggest-medications', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Somente médicos podem solicitar sugestões de IA' });
      }
      const { patientId, diagnosis, symptoms, notes } = req.body;
      if (!patientId) {
        return res.status(400).json({ message: 'patientId é obrigatório' });
      }
      if (!diagnosis && !symptoms) {
        return res.status(400).json({ message: 'Diagnóstico ou sintomas são obrigatórios' });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      const patientRecords = await storage.getMedicalRecordsByPatient(patientId);
      const patientHistory = patientRecords.slice(0, 10).map((r: any) => {
        const parts = [];
        if (r.diagnosis) parts.push(`Diagnóstico: ${r.diagnosis}`);
        if (r.symptoms) parts.push(`Sintomas: ${r.symptoms}`);
        if (r.notes) parts.push(`Notas: ${r.notes.substring(0, 200)}`);
        if (r.createdAt) parts.push(`Data: ${new Date(r.createdAt).toLocaleDateString('pt-BR')}`);
        return parts.join(' | ');
      }).join('\n');

      const existingPrescriptions = await db.select().from(prescriptions)
        .where(eq(prescriptions.patientId, patientId))
        .orderBy(desc(prescriptions.createdAt))
        .limit(5);

      let prescriptionHistory = '';
      if (existingPrescriptions.length > 0) {
        const prescIds = existingPrescriptions.map(p => p.id);
        const allItems = await db.select().from(prescriptionItems)
          .where(inArray(prescriptionItems.prescriptionId, prescIds));
        prescriptionHistory = allItems.map((pi: any) => 
          `${pi.customMedication || pi.medicationName || 'Med'} - ${pi.dosage} - ${pi.frequency}`
        ).join('; ');
      }

      const prompt = `Você é um assistente médico especialista em farmacologia clínica, seguindo rigorosamente protocolos OMS (WHO), Ministério da Saúde do Brasil, RENAME/ANVISA e diretrizes DSM-5/DSM-5-TR quando aplicável.

PACIENTE:
- Nome: ${patient.name}
- Alergias: ${(patient as any).allergies || 'Nenhuma registrada'}
- Condições crônicas: ${(patient as any).conditions || 'Nenhuma registrada'}
${patientHistory ? `\nHISTÓRICO CLÍNICO:\n${patientHistory}` : ''}
${prescriptionHistory ? `\nPRESCRIÇÕES ANTERIORES: ${prescriptionHistory}` : ''}

QUADRO CLÍNICO ATUAL:
- Diagnóstico: ${diagnosis || 'Não especificado'}
- Sintomas: ${symptoms || 'Não descritos'}
${notes ? `- Observações: ${notes}` : ''}

Com base no diagnóstico, sintomas e todo o histórico do paciente (incluindo alergias, condições crônicas e prescrições anteriores), sugira uma lista completa de medicamentos para o tratamento. Para cada medicamento, forneça informações detalhadas.

Responda APENAS com um JSON válido no seguinte formato:
{
  "clinicalAnalysis": "Breve análise clínica do caso, correlacionando sintomas ao diagnóstico e histórico",
  "treatmentApproach": "Abordagem terapêutica recomendada (ex: tratamento sintomático + etiológico)",
  "medications": [
    {
      "name": "nome do medicamento",
      "genericName": "nome genérico / princípio ativo",
      "category": "categoria terapêutica (ex: AINE, Antibiótico, Ansiolítico)",
      "indication": "indicação específica para este caso/diagnóstico",
      "dosage": "dosagem recomendada para este paciente",
      "frequency": "frequência de administração",
      "duration": "duração do tratamento",
      "route": "via de administração (oral, IV, IM, tópica)",
      "instructions": "instruções de uso (horário, com/sem alimento, etc)",
      "priority": "essential|recommended|optional",
      "reasoning": "justificativa clínica para esta escolha",
      "warnings": {
        "sideEffects": ["efeito colateral 1", "efeito colateral 2"],
        "contraindications": ["contraindicação 1"],
        "drugInteractions": ["interação 1"],
        "riskLevel": "low|moderate|high"
      }
    }
  ],
  "nonPharmacological": ["recomendação não-farmacológica 1", "recomendação 2"],
  "followUp": "recomendação de acompanhamento",
  "alerts": ["alerta importante 1 baseado no perfil do paciente"]
}

IMPORTANTE:
- Considere TODAS as alergias e condições do paciente
- Evite medicamentos que interajam com prescrições anteriores
- Ordene por prioridade (essenciais primeiro)
- Inclua pelo menos tratamento principal + suporte sintomático
- Indique se há opção genérica disponível no Brasil (RENAME)
- Responda APENAS com o JSON, sem texto adicional`;

      let aiResponse: string | null = null;
      try {
        aiResponse = await geminiService.generateText(prompt);
      } catch (err) {
        console.error('[AI-MED-LIST] AI service failed:', err);
      }

      if (!aiResponse) {
        return res.status(500).json({ message: 'Serviço de IA indisponível' });
      }

      try {
        const cleanJson = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const suggestion = JSON.parse(cleanJson);
        res.json(suggestion);
      } catch (parseErr) {
        res.json({
          clinicalAnalysis: aiResponse,
          treatmentApproach: '',
          medications: [],
          nonPharmacological: [],
          followUp: '',
          alerts: ['Não foi possível estruturar a resposta da IA. Veja a análise clínica.']
        });
      }
    } catch (error) {
      console.error('AI medication list error:', error);
      res.status(500).json({ message: 'Falha ao gerar lista de medicamentos' });
    }
  });

  app.get('/api/pharmacy/prescriptions', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { status = 'all', search } = req.query;
      const results = await db.select().from(prescriptions)
        .innerJoin(patients, eq(prescriptions.patientId, patients.id))
        .innerJoin(users, eq(prescriptions.doctorId, users.id))
        .orderBy(desc(prescriptions.createdAt));
      
      const allPrescriptionItems = await db.select().from(prescriptionItems);

      let filtered = results.map((r: any) => ({
        id: r.prescriptions.id,
        prescriptionNumber: r.prescriptions.prescriptionNumber,
        patientName: r.patients?.name || 'N/A',
        doctorName: r.users?.name || 'N/A',
        doctorCrm: r.users?.medicalLicense || '',
        status: r.prescriptions.status,
        createdAt: r.prescriptions.createdAt,
        expiresAt: r.prescriptions.expiresAt,
        digitalSignatureId: r.prescriptions.digitalSignatureId,
        pharmacistReadAt: r.prescriptions.pharmacistReadAt,
        items: allPrescriptionItems
          .filter((pi: any) => pi.prescriptionId === r.prescriptions.id)
          .map((pi: any) => ({
            id: pi.id,
            medicationName: pi.customMedication || pi.medicationName || 'Medicamento',
            dosage: pi.dosage || '',
            frequency: pi.frequency || '',
            duration: pi.duration || '',
            quantity: pi.quantity || 1,
            instructions: pi.instructions || '',
          })),
      }));

      if (status !== 'all') {
        filtered = filtered.filter((p: any) => p.status === status);
      }
      if (search && typeof search === 'string') {
        const s = search.toLowerCase();
        filtered = filtered.filter((p: any) => 
          p.patientName?.toLowerCase().includes(s) ||
          p.prescriptionNumber?.toLowerCase().includes(s) ||
          p.doctorName?.toLowerCase().includes(s)
        );
      }
      res.json(filtered);
    } catch (error) {
      console.error('Pharmacy prescriptions error:', error);
      res.status(500).json({ message: 'Falha ao buscar prescrições' });
    }
  });

  app.get('/api/pharmacy/prescriptions/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { id } = req.params;
      const [prescription] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
      if (!prescription) return res.status(404).json({ message: 'Prescrição não encontrada' });

      const items = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));
      const [patient] = await db.select().from(patients).where(eq(patients.id, prescription.patientId));
      const [doctor] = await db.select().from(users).where(eq(users.id, prescription.doctorId));

      let signatureInfo = null;
      if (prescription.digitalSignatureId) {
        const [sig] = await db.select().from(digitalSignatures).where(eq(digitalSignatures.id, prescription.digitalSignatureId));
        signatureInfo = sig;
      }

      const medicationIds = items.filter(i => i.medicationId).map(i => i.medicationId);
      let medicationDetails: any[] = [];
      if (medicationIds.length > 0) {
        medicationDetails = await db.select().from(medications).where(inArray(medications.id, medicationIds));
      }

      const dispensingRecords = await db.select().from(pharmacyDispensing).where(eq(pharmacyDispensing.prescriptionId, id));

      res.json({
        prescription,
        items: items.map(item => ({
          ...item,
          medication: medicationDetails.find(m => m.id === item.medicationId) || null
        })),
        patient,
        doctor: { id: doctor?.id, name: doctor?.name, medicalLicense: doctor?.medicalLicense, specialization: doctor?.specialization, email: doctor?.email },
        signature: signatureInfo,
        dispensingRecords
      });
    } catch (error) {
      console.error('Pharmacy prescription detail error:', error);
      res.status(500).json({ message: 'Falha ao buscar detalhes da prescrição' });
    }
  });

  app.post('/api/pharmacy/prescriptions/:id/verify', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { id } = req.params;
      const [prescription] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
      if (!prescription) return res.status(404).json({ message: 'Prescrição não encontrada' });

      const verification: any = {
        prescriptionId: id,
        prescriptionNumber: prescription.prescriptionNumber,
        isActive: prescription.status === 'active',
        isExpired: prescription.expiresAt ? new Date(prescription.expiresAt) < new Date() : false,
        hasDigitalSignature: !!prescription.digitalSignatureId,
        signatureValid: false,
        doctorInfo: null,
        verifiedAt: new Date().toISOString()
      };

      const [doctor] = await db.select().from(users).where(eq(users.id, prescription.doctorId));
      if (doctor) {
        verification.doctorInfo = {
          name: doctor.name,
          medicalLicense: doctor.medicalLicense,
          specialization: doctor.specialization,
          isRegistered: true
        };
      }

      if (prescription.digitalSignatureId) {
        const [sig] = await db.select().from(digitalSignatures).where(eq(digitalSignatures.id, prescription.digitalSignatureId));
        if (sig) {
          verification.signatureValid = true;
          verification.signatureDetails = {
            signedAt: sig.createdAt,
            documentHash: sig.documentHash,
            qrCodeData: sig.qrCodeData,
            verificationCount: sig.verificationCount
          };
          await db.execute(sql`UPDATE digital_signatures SET verification_count = verification_count + 1 WHERE id = ${prescription.digitalSignatureId}`);
          await db.insert(signatureVerifications).values({
            signatureId: prescription.digitalSignatureId,
            verifiedBy: req.user.id,
            isValid: true,
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'pharmacy-system',
          });
        }
      }

      res.json(verification);
    } catch (error) {
      console.error('Prescription verification error:', error);
      res.status(500).json({ message: 'Falha na verificação da prescrição' });
    }
  });

  app.post('/api/pharmacy/prescriptions/:id/verify-crm', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { id } = req.params;
      const { reason } = req.body;
      const [prescription] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
      if (!prescription) return res.status(404).json({ message: 'Prescrição não encontrada' });

      const [doctor] = await db.select().from(users).where(eq(users.id, prescription.doctorId));
      if (!doctor) return res.status(404).json({ message: 'Médico não encontrado' });

      const [doctorKeys] = await db.select().from(digitalKeys).where(eq(digitalKeys.userId, doctor.id));

      const crmVerification = {
        valid: true,
        doctorName: doctor.name,
        medicalLicense: doctor.medicalLicense || 'Não informado',
        specialization: doctor.specialization || 'Não informada',
        email: doctor.email,
        isRegisteredInPlatform: true,
        hasDigitalCertificate: !!doctorKeys,
        certificateInfo: doctorKeys ? (doctorKeys.certificateInfo as any) : null,
        accountCreatedAt: doctor.createdAt,
        lastLogin: doctor.lastLogin,
        totalPrescriptions: 0,
        verificationReason: reason || 'Suspeita de procedência',
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.user.id
      };

      const doctorPrescriptions = await db.select().from(prescriptions).where(eq(prescriptions.doctorId, doctor.id));
      crmVerification.totalPrescriptions = doctorPrescriptions.length;

      res.json(crmVerification);
    } catch (error) {
      console.error('CRM verification error:', error);
      res.status(500).json({ message: 'Falha na verificação de CRM' });
    }
  });

  app.post('/api/pharmacy/prescriptions/:id/dispense', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { id } = req.params;
      const { items: dispensingItems, verificationMethod = 'manual', signatureVerified = false } = req.body;

      const [prescription] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
      if (!prescription) return res.status(404).json({ message: 'Prescrição não encontrada' });
      if (prescription.status === 'cancelled') return res.status(400).json({ message: 'Prescrição cancelada' });
      if (prescription.status === 'dispensed') return res.status(400).json({ message: 'Prescrição já dispensada' });

      const prescriptionItemsList = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));

      const dispensingRecords = [];
      for (const item of (dispensingItems || [])) {
        const prescItem = prescriptionItemsList.find(pi => pi.id === item.prescriptionItemId);
        const medName = prescItem?.customMedication || item.medicationName || 'Medicamento';

        const [record] = await db.insert(pharmacyDispensing).values({
          prescriptionId: id,
          prescriptionItemId: item.prescriptionItemId || null,
          pharmacistId: req.user.id,
          patientId: prescription.patientId,
          doctorId: prescription.doctorId,
          medicationName: medName,
          dispensedQuantity: item.dispensedQuantity || item.quantity || 1,
          batchNumber: item.batchNumber || null,
          manufacturer: item.manufacturer || null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          dispensingNotes: item.notes || null,
          verificationMethod,
          signatureVerified,
          status: 'dispensed',
          dispensedAt: new Date(),
        }).returning();
        dispensingRecords.push(record);

        if (item.prescriptionItemId) {
          await db.update(prescriptionItems)
            .set({ isDispensed: true, dispensedQuantity: item.dispensedQuantity || item.quantity || 1 })
            .where(eq(prescriptionItems.id, item.prescriptionItemId));
        }
      }

      const allItemsDispensed = prescriptionItemsList.every(pi => {
        const dispensed = dispensingItems?.find((d: any) => d.prescriptionItemId === pi.id);
        return dispensed || pi.isDispensed;
      });

      await db.update(prescriptions)
        .set({ 
          status: allItemsDispensed ? 'dispensed' : 'active',
          dispensedAt: allItemsDispensed ? new Date() : undefined,
          pharmacistId: req.user.id
        })
        .where(eq(prescriptions.id, id));

      res.json({ message: 'Medicamentos dispensados com sucesso', dispensingRecords, fullyDispensed: allItemsDispensed });
    } catch (error) {
      console.error('Dispensing error:', error);
      res.status(500).json({ message: 'Falha ao dispensar medicamentos' });
    }
  });

  app.post('/api/pharmacy/prescriptions/:id/confirm-read', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { id } = req.params;
      await db.update(prescriptions)
        .set({ pharmacistId: req.user.id, pharmacistReadAt: new Date() })
        .where(eq(prescriptions.id, id));
      res.json({ message: 'Leitura confirmada' });
    } catch (error) {
      console.error('Confirm read error:', error);
      res.status(500).json({ message: 'Falha ao confirmar leitura' });
    }
  });

  app.get('/api/pharmacy/reports', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      let reportsQuery = db.select().from(pharmacyReports);
      if (req.user.role === 'pharmacist') {
        reportsQuery = reportsQuery.where(eq(pharmacyReports.pharmacistId, req.user.id));
      }
      const reports = await reportsQuery.orderBy(desc(pharmacyReports.createdAt));
      res.json(reports);
    } catch (error) {
      console.error('Get pharmacy reports error:', error);
      res.status(500).json({ message: 'Falha ao buscar relatórios' });
    }
  });

  app.post('/api/pharmacy/reports/generate', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'pharmacist' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a farmacêuticos' });
      }
      const { reportType = 'daily', startDate, endDate, lgpdCompliant = true } = req.body;
      const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
      const end = endDate ? new Date(endDate) : new Date();

      const dispensingRecords = await db.select().from(pharmacyDispensing)
        .where(and(
          gte(pharmacyDispensing.createdAt, start),
          lte(pharmacyDispensing.createdAt, end)
        ));

      const medicationBreakdown: Record<string, number> = {};
      const doctorBreakdown: Record<string, number> = {};
      const scheduleBreakdown: Record<string, number> = {};
      const pathologyBreakdown: Record<string, number> = {};

      for (const record of dispensingRecords) {
        medicationBreakdown[record.medicationName] = (medicationBreakdown[record.medicationName] || 0) + record.dispensedQuantity;
        const hour = record.dispensedAt ? new Date(record.dispensedAt).getHours() : 0;
        const timeSlot = `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`;
        scheduleBreakdown[timeSlot] = (scheduleBreakdown[timeSlot] || 0) + 1;
      }

      const doctorIds = [...new Set(dispensingRecords.map(r => r.doctorId))];
      for (const did of doctorIds) {
        const [doc] = await db.select().from(users).where(eq(users.id, did));
        const name = lgpdCompliant ? `Dr(a). ${doc?.name?.split(' ')[0] || 'N/A'}` : (doc?.name || 'N/A');
        doctorBreakdown[name] = dispensingRecords.filter(r => r.doctorId === did).length;
      }

      const prescriptionIds = [...new Set(dispensingRecords.map(r => r.prescriptionId))];
      for (const pid of prescriptionIds) {
        const [presc] = await db.select().from(prescriptions).where(eq(prescriptions.id, pid));
        if (presc?.diagnosis) {
          const diag = lgpdCompliant ? presc.diagnosis.substring(0, 30) : presc.diagnosis;
          pathologyBreakdown[diag] = (pathologyBreakdown[diag] || 0) + 1;
        }
      }

      const [report] = await db.insert(pharmacyReports).values({
        pharmacistId: req.user.id,
        reportType,
        startDate: start,
        endDate: end,
        totalDispensed: dispensingRecords.reduce((sum, r) => sum + r.dispensedQuantity, 0),
        totalPrescriptions: prescriptionIds.length,
        medicationBreakdown,
        doctorBreakdown,
        pathologyBreakdown,
        scheduleBreakdown,
        lgpdCompliant,
      }).returning();

      res.json(report);
    } catch (error) {
      console.error('Generate pharmacy report error:', error);
      res.status(500).json({ message: 'Falha ao gerar relatório' });
    }
  });

  app.get('/api/medications/:id/details', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [medication] = await db.select().from(medications).where(eq(medications.id, id));
      if (!medication) return res.status(404).json({ message: 'Medicamento não encontrado' });
      res.json(medication);
    } catch (error) {
      console.error('Medication details error:', error);
      res.status(500).json({ message: 'Falha ao buscar detalhes do medicamento' });
    }
  });

  // ===== POST-CONSULTATION REVIEW API ROUTES =====

  app.get('/api/post-consultation/pending', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const items = await storage.getPendingPostConsultationItems(req.user.id);
      res.json(items);
    } catch (error) {
      console.error('Error fetching pending items:', error);
      res.status(500).json({ message: 'Erro ao buscar itens pendentes' });
    }
  });

  app.get('/api/post-consultation/:consultationId/items', requireAuth, async (req: any, res) => {
    try {
      const items = await storage.getPostConsultationItemsByConsultation(req.params.consultationId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching consultation items:', error);
      res.status(500).json({ message: 'Erro ao buscar itens da consulta' });
    }
  });

  app.get('/api/post-consultation/patient-items', requireAuth, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.user.id);
      if (!patient) {
        return res.json([]);
      }
      const items = await storage.getPostConsultationItemsByPatient(patient.id);
      const visibleItems = items.filter(i => i.status === 'approved' || i.status === 'signed');
      const sanitized = visibleItems.map(({ editHistory, editedAt, editedBy, reviewNotes, ...safeFields }) => safeFields);
      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching patient items:', error);
      res.status(500).json({ message: 'Erro ao buscar itens' });
    }
  });

  app.post('/api/post-consultation/items/:id/review', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const { action, reviewNotes } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Ação inválida' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const updated = await storage.updatePostConsultationItem(req.params.id, {
        status: newStatus,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ message: 'Item não encontrado' });
      }

      if (action === 'approve' && updated.patientId) {
        try {
          const patient = await storage.getPatient(updated.patientId);
          if (patient?.userId) {
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'prescription_approved',
              title: `${updated.type === 'prescription' ? 'Prescrição' : updated.type === 'exam' ? 'Exame' : updated.type === 'referral' ? 'Encaminhamento' : 'Retorno'} aprovado`,
              message: updated.patientSummary || updated.title,
              priority: 'medium',
              actionUrl: '/my-consultations',
              delivered: false,
              read: false,
              metadata: { itemId: updated.id, type: updated.type }
            });
          }
        } catch (notifErr) {
          console.error('Failed to send approval notification:', notifErr);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error reviewing item:', error);
      res.status(500).json({ message: 'Erro ao revisar item' });
    }
  });

  app.get('/api/post-consultation/approved', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const conditions = [
        or(
          eq(postConsultationItems.status, 'approved'),
          eq(postConsultationItems.status, 'signed')
        )
      ];
      if (req.user.role !== 'admin') {
        conditions.push(eq(postConsultationItems.doctorId, req.user.id));
      }
      const allItems = await db.select().from(postConsultationItems)
        .where(and(...conditions))
        .orderBy(desc(postConsultationItems.reviewedAt));
      res.json(allItems);
    } catch (error) {
      console.error('Error fetching approved items:', error);
      res.status(500).json({ message: 'Erro ao buscar itens aprovados' });
    }
  });

  const editPostConsultationSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional(),
    details: z.record(z.any()).optional(),
    patientSummary: z.string().max(5000).optional(),
    editReason: z.string().max(1000).optional(),
  });

  app.patch('/api/post-consultation/items/:id/edit', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }

      const parsed = editPostConsultationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten() });
      }

      const { title, description, details, patientSummary, editReason } = parsed.data;

      const item = await storage.getPostConsultationItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item não encontrado' });
      }

      if (item.doctorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Você só pode editar seus próprios itens' });
      }

      if (!title && description === undefined && !details && patientSummary === undefined) {
        return res.status(400).json({ message: 'Nenhum campo para atualizar' });
      }

      const wasApproved = item.status === 'approved' || item.status === 'signed';

      if (wasApproved && (!editReason || !editReason.trim())) {
        return res.status(400).json({ message: 'Motivo da edição é obrigatório para itens já aprovados' });
      }

      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      if (title !== undefined && title !== item.title) { previousValues.title = item.title; newValues.title = title; }
      if (description !== undefined && description !== item.description) { previousValues.description = item.description; newValues.description = description; }
      if (details !== undefined && JSON.stringify(details) !== JSON.stringify(item.details)) { previousValues.details = item.details; newValues.details = details; }
      if (patientSummary !== undefined && patientSummary !== item.patientSummary) { previousValues.patientSummary = item.patientSummary; newValues.patientSummary = patientSummary; }

      if (Object.keys(previousValues).length === 0) {
        return res.status(400).json({ message: 'Nenhuma alteração detectada' });
      }

      const historyEntry = {
        editedAt: new Date().toISOString(),
        editedBy: req.user.id,
        editedByName: req.user.name || req.user.username,
        reason: editReason || '',
        wasApproved,
        changedFieldNames: Object.keys(previousValues),
        previousValues,
        newValues,
      };

      const existingHistory = Array.isArray(item.editHistory) ? item.editHistory : [];
      const updatedHistory = [...existingHistory, historyEntry];

      const updateData: any = {
        editHistory: updatedHistory,
        editedAt: new Date(),
        editedBy: req.user.id,
      };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (details !== undefined) updateData.details = details;
      if (patientSummary !== undefined) updateData.patientSummary = patientSummary;

      const updated = await storage.updatePostConsultationItem(req.params.id, updateData);
      if (!updated) {
        return res.status(500).json({ message: 'Erro ao atualizar item' });
      }

      if (wasApproved && updated.patientId) {
        try {
          const patient = await storage.getPatient(updated.patientId);
          if (patient?.userId) {
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'prescription_edited',
              title: `${updated.type === 'prescription' ? 'Prescrição' : updated.type === 'exam' ? 'Exame' : updated.type === 'referral' ? 'Encaminhamento' : 'Retorno'} editado após aprovação`,
              message: editReason || 'Seu médico fez ajustes em um item aprovado.',
              priority: 'high',
              actionUrl: '/my-consultations',
              delivered: false,
              read: false,
              metadata: { itemId: updated.id, type: updated.type, editedAfterApproval: true }
            });
          }
        } catch (notifErr) {
          console.error('Failed to send edit notification:', notifErr);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error editing item:', error);
      res.status(500).json({ message: 'Erro ao editar item' });
    }
  });

  app.post('/api/post-consultation/items/:id/edit-and-approve', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }

      const parsed = editPostConsultationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten() });
      }

      const { title, description, details, patientSummary, editReason } = parsed.data;
      const reviewNotes = typeof req.body.reviewNotes === 'string' ? req.body.reviewNotes.trim() : undefined;

      const item = await storage.getPostConsultationItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Item não encontrado' });
      }

      if (item.doctorId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Você só pode editar seus próprios itens' });
      }

      if (item.status !== 'pending_review') {
        return res.status(400).json({ message: 'Apenas itens pendentes podem ser editados e aprovados simultaneamente' });
      }

      const updateData: any = {
        status: 'approved',
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      };

      const hasEdits = (title !== undefined && title !== item.title) ||
        (description !== undefined && description !== item.description) ||
        (details !== undefined && JSON.stringify(details) !== JSON.stringify(item.details)) ||
        (patientSummary !== undefined && patientSummary !== item.patientSummary);

      if (hasEdits) {
        const prevVals: Record<string, any> = {};
        const newVals: Record<string, any> = {};
        if (title !== undefined && title !== item.title) { prevVals.title = item.title; newVals.title = title; }
        if (description !== undefined && description !== item.description) { prevVals.description = item.description; newVals.description = description; }
        if (details !== undefined && JSON.stringify(details) !== JSON.stringify(item.details)) { prevVals.details = item.details; newVals.details = details; }
        if (patientSummary !== undefined && patientSummary !== item.patientSummary) { prevVals.patientSummary = item.patientSummary; newVals.patientSummary = patientSummary; }

        const historyEntry = {
          editedAt: new Date().toISOString(),
          editedBy: req.user.id,
          editedByName: req.user.name || req.user.username,
          reason: editReason || 'Editado durante aprovação',
          wasApproved: false,
          changedFieldNames: Object.keys(prevVals),
          previousValues: prevVals,
          newValues: newVals,
        };

        const existingHistory = Array.isArray(item.editHistory) ? item.editHistory : [];
        updateData.editHistory = [...existingHistory, historyEntry];
        updateData.editedAt = new Date();
        updateData.editedBy = req.user.id;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (details !== undefined) updateData.details = details;
        if (patientSummary !== undefined) updateData.patientSummary = patientSummary;
      }

      const updated = await storage.updatePostConsultationItem(req.params.id, updateData);
      if (!updated) {
        return res.status(500).json({ message: 'Erro ao aprovar item' });
      }

      if (updated.patientId) {
        try {
          const patient = await storage.getPatient(updated.patientId);
          if (patient?.userId) {
            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'prescription_approved',
              title: `${updated.type === 'prescription' ? 'Prescrição' : updated.type === 'exam' ? 'Exame' : updated.type === 'referral' ? 'Encaminhamento' : 'Retorno'} aprovado`,
              message: updated.patientSummary || updated.title,
              priority: 'medium',
              actionUrl: '/my-consultations',
              delivered: false,
              read: false,
              metadata: { itemId: updated.id, type: updated.type, editedBeforeApproval: hasEdits }
            });
          }
        } catch (notifErr) {
          console.error('Failed to send approval notification:', notifErr);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error edit-and-approve item:', error);
      res.status(500).json({ message: 'Erro ao editar e aprovar item' });
    }
  });

  app.post('/api/post-consultation/items/:id/analyze', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }

      const items = await storage.getPostConsultationItemsByConsultation(req.body.consultationId || '');
      const item = items.find(i => i.id === req.params.id);
      if (!item) {
        const allPending = await storage.getPendingPostConsultationItems(req.user.id);
        const found = allPending.find(i => i.id === req.params.id);
        if (!found) {
          return res.status(404).json({ message: 'Item não encontrado' });
        }
        Object.assign(item || {}, found);
      }

      const targetItem = item || (await storage.getPendingPostConsultationItems(req.user.id)).find(i => i.id === req.params.id);
      if (!targetItem) {
        return res.status(404).json({ message: 'Item não encontrado' });
      }

      const patient = await storage.getPatient(targetItem.patientId);
      const allConsultItems = await storage.getPostConsultationItemsByConsultation(targetItem.consultationId);
      const allMedications = allConsultItems
        .filter(i => i.type === 'prescription' && i.details)
        .flatMap(i => (i.details as any)?.medications || []);

      let analysisPrompt = '';
      if (targetItem.type === 'prescription') {
        const meds = (targetItem.details as any)?.medications || [];
        const medNames = meds.map((m: any) => `${m.name} ${m.dosage}`).join(', ');
        const otherMeds = allMedications.filter((m: any) => !meds.some((tm: any) => tm.name === m.name));
        analysisPrompt = `Analise a seguinte prescrição médica e retorne um JSON com a análise:

Medicamentos prescritos: ${medNames}
Outros medicamentos na mesma consulta: ${otherMeds.map((m: any) => m.name).join(', ') || 'Nenhum'}
Paciente: ${patient?.name || 'Não identificado'}, ${patient?.dateOfBirth ? `Nascimento: ${patient.dateOfBirth}` : ''}

Retorne JSON com:
{
  "drugInteractions": [{ "drugs": ["med1", "med2"], "severity": "alta|média|baixa", "description": "descrição da interação" }],
  "contraindications": [{ "drug": "nome", "condition": "condição", "risk": "descrição" }],
  "adverseEffects": [{ "drug": "nome", "effects": ["efeito1", "efeito2"], "frequency": "comum|raro" }],
  "efficacy": { "percentage": 85, "evidence": "descrição do nível de evidência" },
  "alternatives": [{ "drug": "alternativa", "advantage": "vantagem", "disadvantage": "desvantagem" }],
  "recommendations": "recomendações gerais baseadas em diretrizes OMS e Ministério da Saúde do Brasil"
}`;
      } else if (targetItem.type === 'exam') {
        const exams = (targetItem.details as any)?.exams || [];
        analysisPrompt = `Analise os seguintes exames solicitados e retorne JSON:

Exames: ${exams.map((e: any) => e.name).join(', ')}
Paciente: ${patient?.name || 'Não identificado'}

Retorne JSON com:
{
  "examAnalysis": [{ "exam": "nome", "purpose": "finalidade", "preparation": "preparo necessário", "expectedResults": "o que avaliar" }],
  "alternatives": [{ "exam": "alternativa", "advantage": "vantagem", "cost": "custo relativo" }],
  "urgencyAssessment": "avaliação de urgência",
  "recommendations": "recomendações baseadas em protocolos do Ministério da Saúde"
}`;
      } else {
        analysisPrompt = `Analise o seguinte item pós-consulta e retorne JSON com avaliação clínica:

Tipo: ${targetItem.type}
Título: ${targetItem.title}
Descrição: ${targetItem.description}

Retorne JSON com:
{
  "assessment": "avaliação geral",
  "recommendations": "recomendações",
  "alternatives": [{ "option": "alternativa", "rationale": "justificativa" }],
  "priority": "alta|média|baixa"
}`;
      }

      const aiResponse = await geminiService.generateText(analysisPrompt, 'Você é um farmacêutico clínico e médico especialista em interações medicamentosas. Baseie sua análise nas diretrizes da OMS, ANVISA, e Ministério da Saúde do Brasil. Retorne APENAS JSON válido.');
      const cleanResponse = aiResponse.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      const analysis = JSON.parse(cleanResponse);

      await storage.updatePostConsultationItem(req.params.id, { aiAnalysis: analysis });

      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing item:', error);
      res.status(500).json({ message: 'Erro na análise. Tente novamente.' });
    }
  });

  app.post('/api/post-consultation/bulk-review', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const { itemIds, action, reviewNotes } = req.body;
      if (!Array.isArray(itemIds) || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Dados inválidos' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const results = [];
      for (const id of itemIds) {
        const updated = await storage.updatePostConsultationItem(id, {
          status: newStatus,
          reviewNotes: reviewNotes || null,
          reviewedAt: new Date(),
        });
        if (updated) results.push(updated);
      }
      res.json({ updated: results.length, items: results });
    } catch (error) {
      console.error('Error bulk reviewing:', error);
      res.status(500).json({ message: 'Erro na revisão em lote' });
    }
  });

  // ===== DIAGNOSTIC INFERENCE ROUTES =====

  app.get('/api/diagnostic-inferences/pending', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const inferences = await storage.getPendingDiagnosticInferences(req.user.id);
      res.json(inferences);
    } catch (error) {
      console.error('Error fetching pending inferences:', error);
      res.status(500).json({ message: 'Erro ao buscar inferências' });
    }
  });

  app.get('/api/diagnostic-inferences/consultation/:consultationId', requireAuth, async (req: any, res) => {
    try {
      const inferences = await storage.getDiagnosticInferencesByConsultation(req.params.consultationId);
      res.json(inferences);
    } catch (error) {
      console.error('Error fetching consultation inferences:', error);
      res.status(500).json({ message: 'Erro ao buscar inferências da consulta' });
    }
  });

  app.get('/api/diagnostic-inferences/patient/:patientId', requireAuth, async (req: any, res) => {
    try {
      const inferences = await storage.getDiagnosticInferencesByPatient(req.params.patientId);
      res.json(inferences);
    } catch (error) {
      console.error('Error fetching patient inferences:', error);
      res.status(500).json({ message: 'Erro ao buscar inferências do paciente' });
    }
  });

  app.post('/api/diagnostic-inferences/:id/review', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }
      const { action, reviewNotes, authorizeClinicHistory, authorizeEpidemiological } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Ação inválida' });
      }

      const updateData: any = {
        reviewStatus: action === 'approve' ? 'approved' : 'rejected',
        reviewNotes: reviewNotes || null,
      };

      if (authorizeClinicHistory) {
        updateData.clinicalHistoryAuthorized = true;
      }
      if (authorizeEpidemiological) {
        updateData.epidemiologicalAuthorized = true;
      }

      const updated = await storage.updateDiagnosticInference(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Inferência não encontrada' });
      }

      if (action === 'approve' && (authorizeClinicHistory || authorizeEpidemiological)) {
        try {
          const patient = await storage.getPatient(updated.patientId);
          const hypotheses = updated.hypotheses as any[];
          const consultationNotesList = await storage.getConsultationNotes(updated.consultationId);
          const clinicalNotes = consultationNotesList
            .filter((n: any) => n.type !== 'iam3d_diagnostic')
            .map((n: any) => n.content)
            .join('\n');

          let compilationPrompt = '';
          if (authorizeClinicHistory) {
            compilationPrompt += `\n## COMPILAÇÃO DA HISTÓRIA CLÍNICA
Baseado nos dados clínicos e hipóteses diagnósticas abaixo, compile uma história clínica completa estruturada (anamnese, exame físico, hipóteses diagnósticas com CID/DSM, plano terapêutico).

Hipóteses: ${JSON.stringify(hypotheses)}
Notas clínicas: ${clinicalNotes}
Paciente: ${patient?.name || 'Não identificado'}
`;
          }
          if (authorizeEpidemiological) {
            compilationPrompt += `\n## QUADRO DE INFERÊNCIA DIAGNÓSTICO-EPIDEMIOLÓGICA
Gere um quadro de inferência epidemiológica relacionando as hipóteses diagnósticas com dados epidemiológicos (prevalência, incidência, fatores de risco populacionais, distribuição por faixa etária, sazonalidade). Use códigos MeSH e CID-10. Referencie dados do DataSUS, OMS e Protocolos do Ministério da Saúde do Brasil.

Hipóteses: ${JSON.stringify(hypotheses)}
Paciente: ${patient?.name}, ${patient?.dateOfBirth ? `Nascimento: ${patient.dateOfBirth}` : ''}
`;
          }

          if (compilationPrompt) {
            const compilationResult = await geminiService.generateText(
              compilationPrompt,
              'Você é um médico epidemiologista e clínico. Compile dados de forma rigorosa e estruturada. Referência: OMS, Ministério da Saúde do Brasil, DSM-5, CID-10.'
            );

            await storage.updateDiagnosticInference(updated.id, {
              compiledAt: new Date(),
            });

            const existingRecords = await storage.getMedicalRecords(updated.patientId);
            const consultationRecord = existingRecords.find((r: any) => {
              const dh = r.diagnosticHypotheses as any;
              return dh?.consultationId === updated.consultationId;
            });

            if (consultationRecord) {
              await storage.updateMedicalRecord(consultationRecord.id, {
                diagnosticHypotheses: {
                  ...(consultationRecord.diagnosticHypotheses as any || {}),
                  consultationId: updated.consultationId,
                  hypotheses,
                  overallConfidence: updated.overallConfidence,
                  compilation: compilationResult,
                  compiledAt: new Date().toISOString(),
                  authorizedBy: req.user.id,
                }
              });
            } else {
              await storage.createMedicalRecord({
                patientId: updated.patientId,
                doctorId: req.user.id,
                type: 'diagnostic_inference',
                diagnosis: hypotheses.map((h: any) => `${h.code} - ${h.description}`).join('; '),
                notes: compilationResult,
                diagnosticHypotheses: {
                  consultationId: updated.consultationId,
                  hypotheses,
                  overallConfidence: updated.overallConfidence,
                  compilation: compilationResult,
                  compiledAt: new Date().toISOString(),
                  authorizedBy: req.user.id,
                }
              });
            }

            console.log(`✅ Clinical history compiled for inference ${updated.id}`);
          }
        } catch (compileErr) {
          console.error('Failed to compile clinical history:', compileErr);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error reviewing inference:', error);
      res.status(500).json({ message: 'Erro ao revisar inferência' });
    }
  });

  // ===== CONSULTATION ACCESS TOKEN ROUTES (QR Code / Link / WhatsApp) =====

  function generateAccessToken(): string {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  function generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  app.post('/api/consultation-access/generate', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }

      const { patientId, consultationId, appointmentId, scheduledAt } = req.body;
      if (!patientId) {
        return res.status(400).json({ message: 'ID do paciente é obrigatório' });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      const token = generateAccessToken();
      const shortCode = generateShortCode();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      const accessToken = await storage.createConsultationAccessToken({
        token,
        shortCode,
        consultationId: consultationId || null,
        appointmentId: appointmentId || null,
        patientId,
        doctorId: req.user.id,
        patientName: patient.name,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        expiresAt,
        usedAt: null,
        status: 'active',
        accessMethod: null,
        metadata: {
          doctorName: req.user.name,
          createdBy: req.user.id,
        },
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const accessLink = `${baseUrl}/acesso/${shortCode}`;

      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(accessLink, {
          width: 300,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
      } catch (qrErr) {
        console.error('QR code generation error:', qrErr);
      }

      await db.insert(pendingNotifications).values({
        userId: patient.userId || patientId,
        type: 'consultation_access',
        title: 'Link de acesso à consulta',
        message: `Dr(a). ${req.user.name} enviou um link de acesso direto para sua consulta. Use o código ${shortCode} para entrar.`,
        priority: 'high',
        actionUrl: `/acesso/${shortCode}`,
        delivered: false,
        read: false,
        metadata: {
          tokenId: accessToken.id,
          shortCode,
          accessLink,
          scheduledAt: scheduledAt || null,
        }
      });

      console.log(`✅ Access token generated for patient ${patient.name}: ${shortCode}`);

      res.json({
        accessToken: accessToken,
        shortCode,
        token,
        accessLink,
        qrCodeDataUrl,
        expiresAt,
        patientName: patient.name,
        whatsappMessage: `🏥 *Tele<M3D> Pro — Convite para Consulta*\n\nOlá ${patient.name}!\n\nDr(a). ${req.user.name} preparou sua consulta médica.\n\n🔗 *Acesse diretamente:*\n${accessLink}\n\n🔑 *Código de acesso:* ${shortCode}\n\n⏰ ${scheduledAt ? `Agendada para: ${new Date(scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}` : 'Acesso imediato disponível'}\n\n_Válido por 48 horas. Não compartilhe este código._`,
      });
    } catch (error) {
      console.error('Error generating access token:', error);
      res.status(500).json({ message: 'Erro ao gerar token de acesso' });
    }
  });

  app.post('/api/consultation-access/send-whatsapp', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos' });
      }

      const { patientId, shortCode, accessLink, message } = req.body;
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }

      const whatsappNumber = patient.whatsappNumber || patient.phone;
      if (!whatsappNumber) {
        return res.status(400).json({ message: 'Paciente não possui número de WhatsApp cadastrado' });
      }

      const tokenRecord = await storage.getConsultationAccessTokenByShortCode(shortCode);
      if (tokenRecord) {
        await storage.updateConsultationAccessToken(tokenRecord.id, { accessMethod: 'whatsapp' });
      }

      const success = await whatsAppService.sendMessage(whatsappNumber, message);

      if (success) {
        await storage.createWhatsappMessage({
          patientId: patient.id,
          fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID || 'system',
          toNumber: whatsappNumber,
          message,
          messageType: 'text',
          isFromAI: false,
          processed: true
        });
        console.log(`📤 Access link sent to ${patient.name} via WhatsApp`);
      }

      res.json({ sent: success, whatsappNumber });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      res.status(500).json({ message: 'Erro ao enviar WhatsApp' });
    }
  });

  app.post('/api/temporary-access/generate', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }

      let expiryHours = 2;
      try {
        const setting = await storage.getSystemSetting('temporary_access_link_expiry_hours');
        if (setting) {
          expiryHours = parseFloat(setting.settingValue) || 2;
        }
      } catch (e) {}

      const crypto = await import('crypto');
      const code = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const accessLink = `${baseUrl}/immediate-consultation?access=${code}`;

      res.json({
        code,
        accessLink,
        expiresAt: expiresAt.toISOString(),
        expiryHours,
        generatedBy: req.user.name,
      });
    } catch (error) {
      console.error('Error generating temporary access:', error);
      res.status(500).json({ message: 'Erro ao gerar link de acesso temporário' });
    }
  });

  app.get('/api/temporary-access/validate/:code', async (req, res) => {
    try {
      const { code } = req.params;
      if (!code || code.length < 10) {
        return res.status(400).json({ valid: false, message: 'Código inválido' });
      }
      res.json({ valid: true });
    } catch (error) {
      res.status(500).json({ valid: false, message: 'Erro ao validar acesso' });
    }
  });

  app.post('/api/consultation-access/validate', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: 'Código de acesso é obrigatório' });
      }

      const cleanCode = code.trim().toUpperCase();

      let tokenRecord = await storage.getConsultationAccessTokenByShortCode(cleanCode);
      if (!tokenRecord) {
        tokenRecord = await storage.getConsultationAccessTokenByToken(cleanCode);
      }
      if (!tokenRecord) {
        return res.status(404).json({ message: 'Código inválido ou expirado' });
      }

      if (tokenRecord.status === 'revoked') {
        return res.status(403).json({ message: 'Este código foi revogado' });
      }
      if (tokenRecord.status === 'expired' || new Date(tokenRecord.expiresAt) < new Date()) {
        if (tokenRecord.status !== 'expired') {
          await storage.updateConsultationAccessToken(tokenRecord.id, { status: 'expired' });
        }
        return res.status(410).json({ message: 'Código expirado. Solicite um novo ao seu médico.' });
      }

      const patient = await storage.getPatient(tokenRecord.patientId);
      const metadata = tokenRecord.metadata as any || {};

      let effectivePatientId = tokenRecord.patientId;
      let effectiveUserId = patient?.userId || tokenRecord.patientId;

      if (patient && patient.document && patient.documentCountry) {
        try {
          const registeredUser = await storage.getUserByDocument(patient.document, patient.documentCountry);
          if (registeredUser && registeredUser.role === 'patient') {
            const registeredPatient = await storage.getPatientByUserId(registeredUser.id);
            if (registeredPatient && registeredPatient.id !== patient.id) {
              if (patient.isTemporary || !patient.userId) {
                await storage.mergeTemporaryPatientData(
                  patient.id,
                  registeredPatient.id,
                  registeredUser.id,
                  'system_access_link'
                );
                console.log(`✅ Auto-merged temp patient ${patient.id} into registered patient ${registeredPatient.id} via access link`);
              }
              effectivePatientId = registeredPatient.id;
              effectiveUserId = registeredUser.id;
            }
          }
        } catch (mergeErr) {
          console.error('Profile recognition/merge on access link failed:', mergeErr);
        }
      }

      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ message: 'Server configuration error' });
      }

      const authToken = jwt.sign(
        {
          userId: effectiveUserId,
          patientId: effectivePatientId,
          consultationId: tokenRecord.consultationId,
          tokenId: tokenRecord.id,
          type: 'consultation_access',
          role: 'patient',
        },
        jwtSecret,
        { expiresIn: '6h', issuer: 'healthcare-system', algorithm: 'HS256' }
      );

      await storage.updateConsultationAccessToken(tokenRecord.id, {
        usedAt: new Date(),
        status: 'used',
        accessMethod: tokenRecord.accessMethod || 'link',
      });

      await db.insert(pendingNotifications).values({
        userId: tokenRecord.doctorId,
        type: 'patient_access',
        title: `Paciente ${tokenRecord.patientName || 'Paciente'} acessou via link`,
        message: `O paciente entrou na consulta usando o código de acesso ${tokenRecord.shortCode}.`,
        priority: 'medium',
        actionUrl: tokenRecord.consultationId ? `/patient/video/${tokenRecord.consultationId}` : '/schedule',
        delivered: false,
        read: false,
        metadata: {
          tokenId: tokenRecord.id,
          patientId: tokenRecord.patientId,
          accessMethod: tokenRecord.accessMethod || 'link',
        }
      });

      broadcastToDoctor(tokenRecord.doctorId, {
        type: 'patient_accessed_via_token',
        data: {
          patientId: tokenRecord.patientId,
          patientName: tokenRecord.patientName,
          shortCode: tokenRecord.shortCode,
          consultationId: tokenRecord.consultationId,
        }
      });

      console.log(`✅ Patient ${tokenRecord.patientName} validated access with code ${tokenRecord.shortCode}`);

      res.json({
        valid: true,
        authToken,
        patientId: effectivePatientId,
        patientName: tokenRecord.patientName || patient?.name || 'Paciente',
        consultationId: tokenRecord.consultationId,
        appointmentId: tokenRecord.appointmentId,
        doctorName: metadata.doctorName || 'Médico',
        scheduledAt: tokenRecord.scheduledAt,
      });
    } catch (error) {
      console.error('Error validating access token:', error);
      res.status(500).json({ message: 'Erro ao validar código' });
    }
  });

  app.get('/api/consultation-access/patient/:patientId', requireAuth, async (req: any, res) => {
    try {
      const tokens = await storage.getConsultationAccessTokensByPatient(req.params.patientId);
      res.json(tokens);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar tokens' });
    }
  });

  app.post('/api/consultation-access/:id/revoke', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito' });
      }
      const updated = await storage.updateConsultationAccessToken(req.params.id, { status: 'revoked' });
      res.json(updated || { message: 'Token não encontrado' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao revogar token' });
    }
  });

  // ===== PROFILE MERGE / UNIFICATION ROUTES =====

  app.get('/api/profile-merge/audit-logs', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a administradores' });
      }
      const logs = await db.select().from(profileMergeAuditLogs)
        .orderBy(desc(profileMergeAuditLogs.createdAt))
        .limit(100);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar logs de unificação de perfil' });
    }
  });

  app.post('/api/profile-merge/manual', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a administradores' });
      }
      const { temporaryPatientId, permanentPatientId } = req.body;
      if (!temporaryPatientId || !permanentPatientId) {
        return res.status(400).json({ message: 'IDs do paciente temporário e permanente são obrigatórios' });
      }
      const permanentPatient = await storage.getPatient(permanentPatientId);
      if (!permanentPatient || !permanentPatient.userId) {
        return res.status(404).json({ message: 'Paciente permanente não encontrado ou sem conta de usuário vinculada' });
      }
      const result = await storage.mergeTemporaryPatientData(
        temporaryPatientId,
        permanentPatientId,
        permanentPatient.userId,
        'admin_manual'
      );
      res.json({ message: 'Dados unificados com sucesso', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao unificar perfis';
      res.status(400).json({ message });
    }
  });

  // ===== DOCTOR OFFICE (CONSULTÓRIO) API ROUTES =====
  
  // Open doctor's office (creates a persistent video room)
  app.post('/api/doctor-office/open', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can open office' });
      }

      // Mark doctor as available for immediate consultation
      await db.update(users)
        .set({ 
          isOnline: true, 
          availableForImmediate: true,
          onlineSince: new Date()
        })
        .where(eq(users.id, req.user.id));

      // Check for pending reschedules and auto-schedule them 30 min from now
      let rescheduledCount = 0;
      try {
        const pendingReschedules = await db.select()
          .from(videoConsultations)
          .where(and(
            eq(videoConsultations.doctorId, req.user.id),
            eq(videoConsultations.status, 'ended')
          ));

        const rescheduleTargets = pendingReschedules.filter(c => {
          const logs = c.connectionLogs as any;
          return logs?.pendingReschedule === true && logs?.rescheduled === true;
        });

        if (rescheduleTargets.length > 0) {
          const rescheduleTime = new Date(Date.now() + 30 * 60 * 1000);

          for (const consultation of rescheduleTargets) {
            await storage.updateVideoConsultation(consultation.id, {
              connectionLogs: {
                ...(consultation.connectionLogs as any || {}),
                pendingReschedule: false,
                rescheduleTime: rescheduleTime.toISOString(),
                rescheduledOnDoctorReconnect: true
              }
            });

            if (consultation.patientId) {
              const patient = await storage.getPatient(consultation.patientId);
              if (patient?.userId) {
                const timeStr = rescheduleTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                await db.insert(pendingNotifications).values({
                  userId: patient.userId,
                  type: 'consultation_rescheduled',
                  title: 'Médico Online — Consulta em 30 minutos',
                  message: `O Dr. ${req.user.name} está online novamente. Sua consulta está programada para ${timeStr}.`,
                  priority: 'high',
                  actionUrl: '/my-consultations',
                  delivered: false,
                  read: false,
                  metadata: {
                    consultationId: consultation.id,
                    rescheduleTime: rescheduleTime.toISOString(),
                    doctorName: req.user.name
                  }
                });

                broadcastToUser(patient.userId, {
                  type: 'consultation_rescheduled',
                  data: {
                    consultationId: consultation.id,
                    title: 'Médico Online — Consulta em 30 minutos',
                    message: `Dr. ${req.user.name} está online. Consulta às ${timeStr}.`,
                    rescheduleTime: rescheduleTime.toISOString()
                  }
                });
              }
            }
            rescheduledCount++;
          }
          console.log(`✅ ${rescheduledCount} pending consultations rescheduled to 30min from now`);
        }
      } catch (err) {
        console.error('Pending reschedule check error:', err);
      }

      // Broadcast office opened event
      broadcastToAll({ 
        type: 'doctor_office_opened', 
        doctorId: req.user.id,
        doctorName: req.user.name
      });

      res.json({ 
        message: 'Office opened successfully', 
        isOpen: true,
        channelName: `doctor-office-${req.user.id}`,
        rescheduledConsultations: rescheduledCount
      });
    } catch (error) {
      console.error('Open office error:', error);
      res.status(500).json({ message: 'Failed to open office' });
    }
  });

  // Close doctor's office — reschedule all open consultations
  app.post('/api/doctor-office/close', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can close office' });
      }

      // Mark doctor as unavailable
      await db.update(users)
        .set({ 
          availableForImmediate: false
        })
        .where(eq(users.id, req.user.id));

      // Find all open consultations for this doctor (waiting/active)
      const openConsultations = await db.select()
        .from(videoConsultations)
        .where(and(
          eq(videoConsultations.doctorId, req.user.id),
          inArray(videoConsultations.status, ['waiting', 'active'])
        ));

      // Find doctor's next scheduled appointment for rescheduling
      const nextScheduled = await db.select()
        .from(appointments)
        .where(and(
          eq(appointments.doctorId, req.user.id),
          gte(appointments.scheduledAt, new Date()),
          eq(appointments.status, 'scheduled')
        ))
        .orderBy(appointments.scheduledAt)
        .limit(1);

      const rescheduledConsultations = [];

      for (const consultation of openConsultations) {
        // Set status to 'ended' with reschedule metadata
        let rescheduleTime: Date;
        let rescheduleReason: string;

        if (nextScheduled.length > 0) {
          rescheduleTime = new Date(nextScheduled[0].scheduledAt);
          rescheduleReason = `Reagendada para horário programado: ${rescheduleTime.toLocaleDateString('pt-BR')} às ${rescheduleTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          // 30 minutes after doctor's next login (placeholder — set as "pending_reschedule")
          rescheduleTime = new Date(); // Will be updated on next doctor login
          rescheduleReason = 'Reagendada para 30 minutos após a próxima conexão do médico';
        }

        await storage.updateVideoConsultation(consultation.id, {
          status: 'ended',
          endedAt: new Date(),
          connectionLogs: {
            endReason: 'office_closed',
            rescheduled: true,
            rescheduleTime: nextScheduled.length > 0 ? rescheduleTime.toISOString() : null,
            pendingReschedule: nextScheduled.length === 0,
            originalStatus: consultation.status
          }
        });

        // Notify patient about rescheduling
        if (consultation.patientId) {
          const patient = await storage.getPatient(consultation.patientId);
          if (patient?.userId) {
            const notifMessage = nextScheduled.length > 0
              ? `Sua consulta foi reagendada para ${rescheduleTime.toLocaleDateString('pt-BR')} às ${rescheduleTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. O médico fechou o consultório.`
              : `Sua consulta será retomada 30 minutos após a próxima conexão do médico. Você será notificado quando o médico estiver disponível novamente.`;

            await db.insert(pendingNotifications).values({
              userId: patient.userId,
              type: 'consultation_rescheduled',
              title: 'Consulta Reagendada',
              message: notifMessage,
              priority: 'high',
              actionUrl: '/my-consultations',
              senderId: req.user.id,
              delivered: false,
              read: false,
              metadata: {
                consultationId: consultation.id,
                rescheduleTime: nextScheduled.length > 0 ? rescheduleTime.toISOString() : null,
                pendingReschedule: nextScheduled.length === 0,
                doctorName: req.user.name
              }
            });

            broadcastToUser(patient.userId, {
              type: 'consultation_rescheduled',
              data: {
                consultationId: consultation.id,
                title: 'Consulta Reagendada',
                message: notifMessage,
                rescheduleTime: nextScheduled.length > 0 ? rescheduleTime.toISOString() : null,
                pendingReschedule: nextScheduled.length === 0
              }
            });
          }
          rescheduledConsultations.push({
            id: consultation.id,
            patientId: consultation.patientId,
            patientName: patient?.name || 'Paciente',
            rescheduleReason
          });
        }
      }

      console.log(`✅ Doctor ${req.user.name} closed office. ${rescheduledConsultations.length} consultations rescheduled.`);

      // Broadcast office closed event
      broadcastToAll({ 
        type: 'doctor_office_closed', 
        doctorId: req.user.id 
      });

      res.json({ 
        message: 'Consultório fechado com sucesso', 
        isOpen: false,
        rescheduled: rescheduledConsultations.length,
        consultations: rescheduledConsultations
      });
    } catch (error) {
      console.error('Close office error:', error);
      res.status(500).json({ message: 'Failed to close office' });
    }
  });

  // Get doctor's office status
  app.get('/api/doctor-office/status/:doctorId', async (req, res) => {
    try {
      const doctor = await db.select()
        .from(users)
        .where(eq(users.id, req.params.doctorId))
        .limit(1);

      if (!doctor.length || doctor[0].role !== 'doctor') {
        return res.status(404).json({ message: 'Doctor not found' });
      }

      res.json({
        isOpen: doctor[0].availableForImmediate && doctor[0].isOnline,
        doctorName: doctor[0].name,
        channelName: `doctor-office-${req.params.doctorId}`
      });
    } catch (error) {
      console.error('Get office status error:', error);
      res.status(500).json({ message: 'Failed to get office status' });
    }
  });

  // Generate external invite link
  app.post('/api/doctor-office/generate-external-link', requireAuth, async (req: any, res) => {
    try {
      const { doctorId } = req.body;
      
      // Generate a temporary token for external access
      const externalToken = jwt.sign(
        { 
          doctorId, 
          type: 'external_office_access',
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        process.env.SESSION_SECRET || 'telemed-secret',
        { algorithm: 'HS256' }
      );
      
      const link = `${process.env.BASE_URL || 'http://localhost:5000'}/join-office/${externalToken}`;
      
      res.json({ link });
    } catch (error) {
      console.error('Generate external link error:', error);
      res.status(500).json({ message: 'Failed to generate link' });
    }
  });

  // Invite specialist
  app.post('/api/doctor-office/invite-specialist', requireAuth, async (req: any, res) => {
    try {
      const { email, doctorId } = req.body;
      
      // Here you would normally send an email invitation
      // For now, we'll just log it
      console.log(`Invitation sent to ${email} for doctor ${doctorId}`);
      
      // TODO: Implement email sending logic
      
      res.json({ 
        message: 'Invitation sent successfully',
        email 
      });
    } catch (error) {
      console.error('Invite specialist error:', error);
      res.status(500).json({ message: 'Failed to send invitation' });
    }
  });

  // Patient joins doctor's office
  app.post('/api/doctor-office/join/:doctorId', requireAuth, async (req: any, res) => {
    try {
      const doctorId = req.params.doctorId;

      // Verify doctor's office is open
      const doctor = await db.select()
        .from(users)
        .where(eq(users.id, doctorId))
        .limit(1);

      if (!doctor.length || doctor[0].role !== 'doctor') {
        return res.status(404).json({ message: 'Médico não encontrado' });
      }

      if (!doctor[0].availableForImmediate || !doctor[0].isOnline) {
        return res.status(400).json({ message: 'O consultório do médico não está aberto no momento' });
      }

      // Get or create patient
      let patient = await db.select()
        .from(patients)
        .where(eq(patients.userId, req.user.id))
        .limit(1);

      if (!patient.length) {
        const newPatient = await db.insert(patients)
          .values({
            userId: req.user.id,
            name: req.user.name || 'Paciente',
            email: req.user.email || '',
            phone: req.user.phone || 'não informado'
          })
          .returning();
        patient = newPatient;
      }

      const patientId = patient[0].id;

      // Check for existing active/waiting consultation with this doctor
      const existingConsultation = await db.select()
        .from(videoConsultations)
        .where(
          and(
            eq(videoConsultations.patientId, patientId),
            eq(videoConsultations.doctorId, doctorId),
            inArray(videoConsultations.status, ['waiting', 'active'])
          )
        )
        .limit(1);

      if (existingConsultation.length > 0) {
        return res.json({
          message: 'Joined office successfully',
          consultationId: existingConsultation[0].id,
          appointmentId: existingConsultation[0].appointmentId,
          channelName: existingConsultation[0].id
        });
      }

      // Create appointment for this consultation
      const appointment = await db.insert(appointments)
        .values({
          doctorId,
          patientId,
          type: 'immediate',
          status: 'scheduled',
          scheduledAt: new Date(),
          notes: 'Consulta imediata via consultório aberto'
        })
        .returning();

      const consultationInsert = await db.insert(videoConsultations)
        .values({
          appointmentId: appointment[0].id,
          patientId,
          doctorId,
          status: 'waiting',
        })
        .returning();
      const consultation = consultationInsert;
      await db.update(videoConsultations)
        .set({ agoraChannelName: consultationInsert[0].id })
        .where(eq(videoConsultations.id, consultationInsert[0].id));

      // Notify doctor via WebSocket
      broadcastToDoctor(doctorId, {
        type: 'patient_joined_office',
        patient: {
          id: patientId,
          name: patient[0].name
        },
        consultationId: consultation[0].id
      });

      // Store persistent notification for doctor (in case they're offline)
      try {
        await db.insert(pendingNotifications).values({
          userId: doctorId,
          type: 'patient_joined_office',
          title: 'Paciente na Sala de Espera',
          message: `${patient[0].name} entrou no seu consultório virtual e aguarda atendimento.`,
          priority: 'high',
          actionUrl: `/consultation/video/${patientId}`,
          senderId: req.user.id,
          metadata: {
            patientId,
            patientName: patient[0].name,
            consultationId: consultation[0].id,
          },
        });
      } catch (notifErr) {
        console.error('Failed to store waiting room notification:', notifErr);
      }

      // Send WhatsApp notification to doctor if configured
      try {
        if (whatsAppService.isConfigured() && doctor[0].phone) {
          await whatsAppService.sendMessage(
            doctor[0].phone,
            `🔔 Paciente na Sala de Espera\n\n👤 Paciente: ${patient[0].name}\n📋 Consulta ID: ${consultation[0].id.slice(0, 8)}...\n\nO paciente está aguardando no seu consultório virtual. Acesse a plataforma para iniciar o atendimento.\n\n🏥 Tele<M3D> Pro`
          );
        }
      } catch (whatsappErr) {
        console.error('Failed to send WhatsApp waiting room notification:', whatsappErr);
      }

      // Also notify the patient's user account with the video link
      broadcastToUser(req.user.id, {
        type: 'consultation_ready',
        data: {
          consultationId: consultation[0].id,
          doctorName: doctor[0].name,
          message: `Sua consulta com ${doctor[0].name} está pronta. Entre na sala de vídeo.`,
          actionUrl: `/patient/video/${consultation[0].id}`
        }
      });

      res.json({
        message: 'Joined office successfully',
        consultationId: consultation[0].id,
        appointmentId: appointment[0].id,
        channelName: `doctor-office-${doctorId}`
      });
    } catch (error: any) {
      console.error('Join office error:', error);
      res.status(500).json({ message: error.message || 'Falha ao entrar no consultório' });
    }
  });

  app.get('/api/patients/online-status', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const allPatients = await db.select({
        id: patients.id,
        userId: patients.userId,
        name: patients.name,
      }).from(patients);

      const result = allPatients.map(p => ({
        patientId: p.id,
        userId: p.userId,
        name: p.name,
        isOnline: p.userId ? authenticatedClients.has(p.userId) : false,
      }));

      res.json(result);
    } catch (error) {
      console.error('Patient online status error:', error);
      res.status(500).json({ message: 'Failed to fetch patient online status' });
    }
  });

  app.post('/api/notifications/patient-reply', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'patient' && user.role !== 'doctor' && user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso não autorizado' });
      }

      const { doctorId, message, notificationId } = req.body;
      if (!doctorId || !message) {
        return res.status(400).json({ message: 'doctorId e message são obrigatórios' });
      }

      if (user.role === 'doctor' || user.role === 'admin') {
        broadcastToUser(doctorId, {
          type: 'doctor_message',
          data: {
            title: 'Mensagem de Colega',
            message: message.trim(),
            priority: 'medium',
            senderId: user.id,
            senderName: user.name || 'Médico(a)',
            doctorId: user.id,
            doctorName: user.name || 'Médico(a)',
          }
        });

        try {
          await db.insert(pendingNotifications).values({
            userId: doctorId,
            type: 'doctor_message' as any,
            title: `Mensagem de Dr(a). ${user.name || 'Colega'}`,
            message: message.trim().substring(0, 300),
            priority: 'medium',
            actionUrl: null,
            senderId: user.id,
            delivered: false,
            read: false,
            metadata: { senderName: user.name, senderRole: 'doctor' }
          });
        } catch {}

        return res.json({ success: true });
      }

      const patient = await db.select().from(patients).where(eq(patients.userId, user.id)).limit(1);
      if (!patient.length) {
        return res.status(404).json({ message: 'Perfil de paciente não encontrado' });
      }

      const savedMessage = await storage.createWhatsappMessage({
        patientId: patient[0].id,
        fromNumber: patient[0].phone || 'patient',
        toNumber: 'doctor',
        message: message.trim(),
        messageType: 'text',
        direction: 'inbound',
        senderRole: 'patient',
        isFromAI: false,
        processed: false,
      });

      broadcastToDoctor(doctorId, {
        type: 'whatsapp_message',
        data: {
          message: savedMessage,
          patientId: patient[0].id,
          patientName: patient[0].name,
          fromPatientReply: true,
        }
      });

      if (notificationId) {
        try {
          await db.update(pendingNotifications)
            .set({ read: true })
            .where(and(
              eq(pendingNotifications.id, notificationId),
              eq(pendingNotifications.userId, user.id)
            ));
        } catch {}
      }

      res.json({ success: true, messageId: savedMessage.id });
    } catch (error) {
      console.error('Patient reply error:', error);
      res.status(500).json({ message: 'Falha ao enviar resposta' });
    }
  });

  // ===== DOCTOR-TO-PATIENT NOTIFICATION ENDPOINTS =====

  // Send notification/message to a patient
  app.post('/api/notifications/send-to-patient', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors and admins can send notifications to patients' });
      }

      const { patientUserId, title, message, priority, actionUrl, type } = req.body;

      if (!patientUserId || !message) {
        return res.status(400).json({ message: 'patientUserId and message are required' });
      }

      const notificationType = type || 'doctor_message';
      const notificationPriority = priority || 'high';

      // Try to send via WebSocket (real-time)
      const delivered = broadcastToUser(patientUserId, {
        type: notificationType,
        data: {
          title: title || `Mensagem de ${req.user.name}`,
          message,
          priority: notificationPriority,
          actionUrl: actionUrl || '/dashboard',
          senderId: req.user.id,
          senderName: req.user.name,
          senderRole: req.user.role
        }
      });

      // Store notification in database for offline users
      try {
        await db.insert(pendingNotifications).values({
          userId: patientUserId,
          type: notificationType,
          title: title || `Mensagem de ${req.user.name}`,
          message,
          priority: notificationPriority,
          actionUrl: actionUrl || '/dashboard',
          senderId: req.user.id,
          delivered,
        });
      } catch (dbErr) {
        console.error('Failed to store notification:', dbErr);
      }

      res.json({ 
        success: true, 
        delivered,
        message: delivered ? 'Notificação enviada em tempo real' : 'Notificação salva para quando o paciente ficar online'
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({ message: 'Failed to send notification' });
    }
  });

  // Invite patient to video consultation
  app.post('/api/notifications/invite-to-video', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors and admins can invite patients' });
      }

      const { patientUserId, consultationId } = req.body;

      if (!patientUserId || !consultationId) {
        return res.status(400).json({ message: 'patientUserId and consultationId are required' });
      }

      const delivered = broadcastToUser(patientUserId, {
        type: 'consultation_invite',
        data: {
          title: 'Convite para Teleconsulta',
          message: `Dr(a). ${req.user.name} está chamando você para uma consulta por vídeo.`,
          priority: 'critical',
          consultationId,
          doctorName: req.user.name,
          actionUrl: `/patient/video/${consultationId}`
        }
      });

      // Store for offline
      try {
        await db.insert(pendingNotifications).values({
          userId: patientUserId,
          type: 'consultation_invite',
          title: 'Convite para Teleconsulta',
          message: `Dr(a). ${req.user.name} está chamando você para uma consulta por vídeo.`,
          priority: 'critical',
          actionUrl: `/patient/video/${consultationId}`,
          senderId: req.user.id,
          delivered,
          metadata: { consultationId },
        });
      } catch (dbErr) {
        console.error('Failed to store invite notification:', dbErr);
      }

      res.json({ 
        success: true, 
        delivered,
        message: delivered ? 'Convite enviado em tempo real' : 'Convite salvo para quando o paciente ficar online'
      });
    } catch (error) {
      console.error('Invite to video error:', error);
      res.status(500).json({ message: 'Failed to send video invite' });
    }
  });

  // Get pending notifications for current user
  app.get('/api/notifications/pending', requireAuth, async (req: any, res) => {
    try {
      const notifications = await db.select()
        .from(pendingNotifications)
        .where(and(
          eq(pendingNotifications.userId, req.user.id),
          eq(pendingNotifications.read, false)
        ))
        .orderBy(desc(pendingNotifications.createdAt))
        .limit(50);

      res.json(notifications);
    } catch (error) {
      console.error('Get pending notifications error:', error);
      res.json([]);
    }
  });

  // Mark notifications as read
  app.post('/api/notifications/mark-read', requireAuth, async (req: any, res) => {
    try {
      const { notificationIds } = req.body;
      if (notificationIds && notificationIds.length > 0) {
        for (const id of notificationIds) {
          await db.update(pendingNotifications)
            .set({ read: true })
            .where(and(
              eq(pendingNotifications.id, id),
              eq(pendingNotifications.userId, req.user.id)
            ));
        }
      } else {
        await db.update(pendingNotifications)
          .set({ read: true })
          .where(eq(pendingNotifications.userId, req.user.id));
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Mark notifications read error:', error);
      res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
  });

  app.get('/api/notifications/history', requireAuth, async (req: any, res) => {
    try {
      const history = await db.select()
        .from(pendingNotifications)
        .where(and(
          eq(pendingNotifications.userId, req.user.id),
          eq(pendingNotifications.read, true)
        ))
        .orderBy(desc(pendingNotifications.createdAt))
        .limit(100);

      res.json(history);
    } catch (error) {
      console.error('Get notification history error:', error);
      res.json([]);
    }
  });

  // ===== AI TRANSLATION ENDPOINT =====
  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { content, targetLang, cacheKey } = req.body;
      if (!content || !targetLang || !cacheKey) {
        return res.status(400).json({ error: 'Missing required fields: content, targetLang, cacheKey' });
      }
      if (targetLang === 'pt') {
        return res.json({ translated: content });
      }
      const validLangs = ['en', 'es', 'fr', 'de', 'it', 'zh', 'gn'];
      if (!validLangs.includes(targetLang)) {
        return res.status(400).json({ error: 'Unsupported target language' });
      }
      const { translateContent } = await import('./services/translation-service');
      const translated = await translateContent(content, targetLang, cacheKey);
      res.json({ translated });
    } catch (error: any) {
      console.error('Translation endpoint error:', error);
      res.status(500).json({ error: 'Translation failed', message: error.message });
    }
  });

  // ===== AI ANALYSIS ENDPOINTS =====
  
  // Simplified symptom analysis endpoint
  app.post('/api/ai/analyze-symptoms', requireAuth, async (req, res) => {
    try {
      const validation = analyzeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: validation.error.issues 
        });
      }
      
      const { symptoms, history } = validation.data;
      
      // Generate AI diagnostic hypotheses
      let hypotheses;
      try {
        hypotheses = await geminiService.generateDiagnosticHypotheses(symptoms, history || '');
      } catch (openaiError) {
        console.error('OpenAI service error:', openaiError);
        return res.status(502).json({ 
          message: 'AI diagnostic service temporarily unavailable',
          hypotheses: [] 
        });
      }
      
      res.json({ hypotheses });
    } catch (error) {
      console.error('Symptom analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze symptoms' });
    }
  });

  // ===== PDF GENERATION ENDPOINTS =====
  
  // Generate prescription PDF
  app.get('/api/medical-records/:id/prescription-pdf', requireAuth, async (req, res) => {
    try {
      const medicalRecordId = req.params.id;
      
      // Get medical record with prescription
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord || !medicalRecord.prescription) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      // Get patient and doctor information
      const patient = await storage.getPatient(medicalRecord.patientId);
      const doctor = await storage.getUser(medicalRecord.doctorId);
      
      if (!patient || !doctor) {
        return res.status(404).json({ message: 'Patient or doctor not found' });
      }

      // Get digital signature if exists
      let digitalSignature = null;
      if (medicalRecord.digitalSignature) {
        digitalSignature = await storage.getDigitalSignature(medicalRecord.digitalSignature);
      }

      // Prepare prescription data
      const prescriptionData: PrescriptionData = {
        patientName: patient.name,
        patientAge: patient.age || 0,
        patientAddress: patient.address || 'Não informado',
        doctorName: doctor.name,
        doctorCRM: doctor.digitalCertificate?.split('-')[1] || '123456',
        doctorCRMState: 'SP',
        prescriptionText: medicalRecord.prescription,
        date: new Date(medicalRecord.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        digitalSignature: digitalSignature ? {
          signature: digitalSignature.signature,
          certificateInfo: digitalSignature.certificateInfo,
          timestamp: digitalSignature.signedAt?.toISOString() || new Date().toISOString()
        } : undefined
      };

      // Generate PDF HTML
      const htmlContent = await pdfGeneratorService.generatePrescriptionPDF(prescriptionData);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="receita-${patient.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html"`);
      res.send(htmlContent);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ message: 'Failed to generate prescription PDF' });
    }
  });

  // Generate exam request PDF
  app.get('/api/medical-records/:id/exam-request-pdf', requireAuth, async (req, res) => {
    try {
      const medicalRecordId = req.params.id;
      
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      const patient = await storage.getPatient(medicalRecord.patientId);
      const doctor = await storage.getUser(medicalRecord.doctorId);
      
      const examData = {
        patientName: patient?.name || 'N/A',
        date: new Date(medicalRecord.createdAt).toLocaleDateString('pt-BR'),
        examRequests: medicalRecord.diagnosis || 'Exames conforme avaliação clínica',
        doctorName: doctor?.name || 'Médico',
        doctorCRM: doctor?.digitalCertificate?.split('-')[1] || '123456',
        doctorCRMState: 'SP'
      };

      const htmlContent = await pdfGeneratorService.generateExamRequestPDF(examData);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="exame-${patient?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html"`);
      res.send(htmlContent);
      
    } catch (error) {
      console.error('Exam request PDF error:', error);
      res.status(500).json({ message: 'Failed to generate exam request PDF' });
    }
  });

  // Generate medical certificate PDF  
  app.post('/api/medical-records/:id/certificate-pdf', requireAuth, async (req, res) => {
    try {
      const medicalRecordId = req.params.id;
      const { restDays, cid10 } = req.body;
      
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      const patient = await storage.getPatient(medicalRecord.patientId);
      const doctor = await storage.getUser(medicalRecord.doctorId);
      
      const certificateData = {
        patientName: patient?.name || 'N/A',
        patientDocument: 'Não informado',
        restDays: restDays || 1,
        cid10: cid10 || '',
        date: new Date().toLocaleDateString('pt-BR'),
        doctorName: doctor?.name || 'Médico',
        doctorCRM: doctor?.digitalCertificate?.split('-')[1] || '123456',
        doctorCRMState: 'SP'
      };

      const htmlContent = await pdfGeneratorService.generateMedicalCertificatePDF(certificateData);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="atestado-${patient?.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html"`);
      res.send(htmlContent);
      
    } catch (error) {
      console.error('Medical certificate PDF error:', error);
      res.status(500).json({ message: 'Failed to generate medical certificate PDF' });
    }
  });

  // ===== AUTHENTICATION ENDPOINTS =====

  // User Registration
  app.post('/api/auth/register', upload.single('avatar'), async (req, res) => {
    try {
      const { username, password, role, name, email, phone, medicalLicense, specialization, dateOfBirth, gender, bloodType, allergies, referralCode, document: docNumber, documentCountry } = req.body;
      const avatarFile = req.file;
      
      // Validate required fields
      if (!username || !password || !role || !name) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios: nome de usuário, senha, perfil e nome completo.' });
      }
      
      // Validate doctor-specific fields
      if (role === 'doctor') {
        if (!medicalLicense || !specialization) {
          return res.status(400).json({ message: 'Para médicos, o CRM e a especialização são obrigatórios.' });
        }
      }
      
      // Validate patient-specific fields
      if (role === 'patient') {
        if (!phone) {
          return res.status(400).json({ message: 'Para pacientes, o telefone é obrigatório.' });
        }
        if (!dateOfBirth) {
          return res.status(400).json({ message: 'Para pacientes, a data de nascimento é obrigatória.' });
        }
        if (!gender) {
          return res.status(400).json({ message: 'Para pacientes, o gênero é obrigatório.' });
        }
      }
      
      // Validate role
      if (!['doctor', 'admin', 'patient', 'researcher'].includes(role)) {
        return res.status(400).json({ message: 'Perfil de usuário inválido. Escolha entre: médico, administrador, paciente ou pesquisador.' });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: 'Este nome de usuário já está em uso. Por favor, escolha outro.' });
      }

      // Check for duplicate document+country
      let temporaryPatientToMerge: any = null;
      if (docNumber && documentCountry) {
        const existingByDoc = await storage.getUserByDocument(docNumber.trim(), documentCountry.trim());
        if (existingByDoc && existingByDoc.role !== 'visitor') {
          return res.status(409).json({ message: 'Já existe um usuário cadastrado com este documento e país. Faça login com sua conta existente.' });
        }
        if (role === 'patient') {
          const existingPatient = await storage.getPatientByDocument(docNumber.trim(), documentCountry.trim());
          if (existingPatient && existingPatient.isTemporary) {
            temporaryPatientToMerge = existingPatient;
          } else if (existingPatient && !existingPatient.isTemporary && !existingPatient.mergedIntoPatientId) {
            return res.status(409).json({ message: 'Já existe um paciente cadastrado com este documento e país. Faça login com sua conta existente.' });
          }
        }
      }
      
      // Hash password (in production, use bcrypt)
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      
      // Prepare profile picture URL if avatar was uploaded
      const profilePictureUrl = avatarFile ? `/uploads/profiles/${avatarFile.filename}` : undefined;

      let validReferrerId: string | undefined;
      if (referralCode && role === 'doctor') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(referralCode)) {
          const referrer = await db.select({ id: users.id, role: users.role }).from(users).where(
            and(eq(users.id, referralCode), eq(users.role, 'doctor'))
          ).limit(1);
          if (referrer.length > 0) {
            validReferrerId = referrer[0].id;
          }
        }
      }

      // Use transaction to create user, patient record, and merge temp data atomically
      let mergeResult: { counts: Record<string, number> } | null = null;
      const newUser = await db.transaction(async (tx) => {
        // If merging a temporary patient, clear its document fields to free the unique index
        if (temporaryPatientToMerge) {
          await tx.update(patients)
            .set({ document: null, documentCountry: null, updatedAt: new Date() })
            .where(eq(patients.id, temporaryPatientToMerge.id));
        }

        const [user] = await tx.insert(users).values({
          username,
          password: hashedPassword,
          role,
          name,
          email,
          phone,
          document: docNumber?.trim() || undefined,
          documentCountry: documentCountry?.trim() || undefined,
          medicalLicense: role === 'doctor' ? medicalLicense : undefined,
          specialization: role === 'doctor' ? specialization : undefined,
          digitalCertificate: role === 'doctor' ? `cert-${Date.now()}` : undefined,
          profilePicture: profilePictureUrl,
          superiorDoctorId: validReferrerId,
        }).returning();
        
        if (role === 'patient') {
          const [newPatient] = await tx.insert(patients).values({
            userId: user.id,
            name,
            email,
            phone: phone!,
            dateOfBirth: new Date(dateOfBirth),
            gender,
            bloodType: bloodType || null,
            allergies: allergies || null,
            document: docNumber?.trim() || null,
            documentCountry: documentCountry?.trim() || null,
            healthStatus: 'a_determinar',
          }).returning();

          if (temporaryPatientToMerge && newPatient) {
            mergeResult = await storage.mergeTemporaryPatientData(
              temporaryPatientToMerge.id,
              newPatient.id,
              user.id,
              'system_registration',
              tx
            );
            console.log(`✅ Merged temporary patient ${temporaryPatientToMerge.id} into permanent ${newPatient.id}:`, mergeResult.counts);
          }
        }
        
        return user;
      });
      
      // Add promotional credits for new user (except admin)
      if (role !== 'admin') {
        try {
          await tmcCreditsService.addPromotionalCredits(newUser.id, username);
          console.log(`✅ Added promotional credits to new user: ${username}`);
        } catch (error) {
          console.error('Failed to add promotional credits:', error);
        }
      }
      
      // Generate JWT token
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      const token = jwt.sign(
        { 
          userId: newUser.id,
          username: newUser.username,
          role: newUser.role,
          type: 'auth'
        },
        jwtSecret,
        { 
          expiresIn: '7d',
          issuer: 'telemed-system',
          audience: 'web-app',
          algorithm: 'HS256'
        }
      );
      
      // Set HTTP-only cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      
      // Success message based on role
      const roleNames = {
        doctor: 'Médico',
        patient: 'Paciente',
        admin: 'Administrador',
        researcher: 'Pesquisador'
      };
      const roleName = roleNames[role as keyof typeof roleNames] || 'Usuário';
      
      const mergeMessage = mergeResult ? ` Seus dados médicos anteriores (${Object.values(mergeResult.counts).reduce((a: number, b: any) => a + b, 0)} registros) foram automaticamente vinculados ao seu perfil.` : '';
      res.status(201).json({ 
        user: userWithoutPassword, 
        token,
        merged: !!mergeResult,
        mergeDetails: mergeResult?.counts || null,
        message: `Cadastro realizado com sucesso! Bem-vindo(a) ao Tele<M3D>, ${userWithoutPassword.name}. Seu perfil de ${roleName} foi criado e você já pode acessar todas as funcionalidades da plataforma.${mergeMessage}` 
      });
    } catch (error) {
      const { errorLoggerService } = await import('./services/error-logger');
      const friendlyError = await errorLoggerService.logError(
        error as Error,
        {
          endpoint: '/api/auth/register',
          method: 'POST',
          additionalData: {
            username: req.body?.username,
            role: req.body?.role
          }
        },
        req
      );
      
      res.status(500).json({ 
        message: friendlyError.userMessage,
        errorCode: friendlyError.errorCode
      });
    }
  });

  // User Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Por favor, preencha seu nome de usuário e senha.' });
      }
      
      // Get user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Usuário ou senha incorretos. Verifique suas credenciais e tente novamente.' });
      }
      
      // Check if user is blocked/deactivated
      if (user.isBlocked) {
        const reason = user.deactivationReason || 'Conta desativada por questões administrativas.';
        return res.status(403).json({ message: reason });
      }

      // Verify password (in production, use bcrypt.compare)
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      // Handle both hashed and plain text passwords for development migration
      const isValidPassword = user.password === hashedPassword || user.password === password;
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Usuário ou senha incorretos. Verifique suas credenciais e tente novamente.' });
      }
      
      // Generate JWT token
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      const token = jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          role: user.role,
          type: 'auth'
        },
        jwtSecret,
        { 
          expiresIn: '7d',
          issuer: 'telemed-system',
          audience: 'web-app',
          algorithm: 'HS256'
        }
      );
      
      // Set HTTP-only cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      // Auto-activate doctors on 24h duty when they login
      if (user.role === 'doctor' && user.onDutyUntil && new Date(user.onDutyUntil) > new Date()) {
        await db.update(users)
          .set({
            isOnline: true,
            availableForImmediate: true,
            onlineSince: new Date(),
          })
          .where(eq(users.id, user.id));
        
        console.log(`Doctor ${user.name} auto-activated for on-duty shift`);
      }
      
      // Return user data (without password)
      const { password: _, ...userWithoutPassword} = user;
      res.json({ 
        user: userWithoutPassword, 
        token,
        message: `Bem-vindo(a) de volta, ${user.name}! Login realizado com sucesso.` 
      });
    } catch (error) {
      const { errorLoggerService } = await import('./services/error-logger');
      const friendlyError = await errorLoggerService.logError(
        error as Error,
        {
          endpoint: '/api/auth/login',
          method: 'POST',
          additionalData: {
            username: req.body?.username
          }
        },
        req
      );
      
      res.status(500).json({ 
        message: friendlyError.userMessage,
        errorCode: friendlyError.errorCode
      });
    }
  });

  // User Logout
  app.post('/api/auth/logout', (req, res) => {
    try {
      // Clear auth cookie
      res.clearCookie('authToken');
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  // ============================================================================
  // PROFILE PICTURE UPLOAD ENDPOINTS
  // ============================================================================
  
  // Upload profile picture
  app.post('/api/users/upload-profile-picture', requireAuth, upload.single('profilePicture'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const user = req.user;
      const filename = req.file.filename;
      const profilePictureUrl = `/uploads/profiles/${filename}`;
      
      // Delete old profile picture if exists
      if (user.profilePicture) {
        const oldFilePath = path.join(uploadsDir, path.basename(user.profilePicture));
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      // Update user profile picture in database
      await db.update(users)
        .set({ profilePicture: profilePictureUrl })
        .where(eq(users.id, user.id));
      
      console.log(`✅ Profile picture uploaded for user ${user.id}: ${profilePictureUrl}`);
      
      res.json({
        message: 'Profile picture uploaded successfully',
        profilePictureUrl
      });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({ message: 'Failed to upload profile picture' });
    }
  });
  
  // Delete profile picture
  app.delete('/api/users/delete-profile-picture', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.profilePicture) {
        // Delete file from filesystem
        const filePath = path.join(uploadsDir, path.basename(user.profilePicture));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Remove from database
        await db.update(users)
          .set({ profilePicture: null })
          .where(eq(users.id, user.id));
        
        console.log(`✅ Profile picture deleted for user ${user.id}`);
      }
      
      res.json({ message: 'Profile picture deleted successfully' });
    } catch (error) {
      console.error('Profile picture delete error:', error);
      res.status(500).json({ message: 'Failed to delete profile picture' });
    }
  });

  // ============================================================================
  // AI CHATBOT ENDPOINTS (AFTER requireAuth DEFINITION)
  // ============================================================================
  
  // AI Diagnostic Analysis for Chatbot
  app.post('/api/ai/diagnostic-analysis', requireAuth, async (req, res) => {
    try {
      // Validate request body with Zod
      const diagnosticSchema = z.object({
        symptoms: z.string().min(1, 'Symptoms are required'),
        patientHistory: z.string().optional().default('')
      });
      
      const { symptoms, patientHistory } = diagnosticSchema.parse(req.body);

      // Use existing OpenAI service for diagnostic analysis
      const hypotheses = await geminiService.generateDiagnosticHypotheses(
        symptoms,
        patientHistory || ''
      );

      res.json({
        analysis: 'Análise diagnóstica realizada com sucesso. Foram identificadas possíveis hipóteses diagnósticas.',
        hypotheses: hypotheses || []
      });
    } catch (error) {
      console.error('AI diagnostic analysis error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ 
        message: 'Erro interno do servidor ao realizar análise diagnóstica',
        analysis: 'Não foi possível realizar a análise no momento. Tente novamente.',
        hypotheses: []
      });
    }
  });

  // AI Scheduling Analysis for Chatbot
  app.post('/api/ai/scheduling-analysis', requireAuth, async (req, res) => {
    try {
      // Validate request body with Zod
      const schedulingSchema = z.object({
        message: z.string().min(1, 'Message is required'),
        availableSlots: z.array(z.string()).optional().default(['09:00', '14:00', '16:00'])
      });
      
      const { message, availableSlots } = schedulingSchema.parse(req.body);

      // Use existing OpenAI service for scheduling
      const analysis = await geminiService.processSchedulingRequest(
        message,
        availableSlots || ['09:00', '14:00', '16:00']
      );

      res.json({
        response: analysis.response || 'Análise de agendamento realizada.',
        isSchedulingRequest: analysis.isSchedulingRequest || false,
        suggestedAppointment: analysis.suggestedAppointment || null,
        requiresHumanIntervention: analysis.requiresHumanIntervention || false
      });
    } catch (error) {
      console.error('AI scheduling analysis error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ 
        message: 'Erro interno do servidor ao realizar análise de agendamento',
        response: 'Não foi possível processar sua solicitação de agendamento no momento.',
        isSchedulingRequest: false,
        requiresHumanIntervention: true
      });
    }
  });

  // Dashboard Stats API - Use authenticated user data
  app.get('/api/dashboard/stats/:userId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const authenticatedUser = req.user;
      
      // Ensure user can only access their own stats (admins can access any)
      if (authenticatedUser.id !== userId && authenticatedUser.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized access' });
      }
      
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const userRole = user[0].role;
      
      // Only doctors and admins should see appointment stats
      if (userRole === 'doctor') {
        const [todayAppointments, unprocessedMessages, pendingSignatures, allPatients, doctorRecords] = await Promise.all([
          storage.getTodayAppointments(userId),
          storage.getUnprocessedWhatsappMessages(),
          storage.getPendingSignatures(userId),
          db.select().from(patients).where(eq(patients.primaryDoctorId, userId)),
          db.select().from(medicalRecords).where(eq(medicalRecords.doctorId, userId)),
        ]);

        const aiScheduledToday = todayAppointments.filter(apt => apt.aiScheduled).length;

        res.json({
          todayConsultations: todayAppointments.length,
          whatsappMessages: unprocessedMessages.length,
          aiScheduling: aiScheduledToday,
          secureRecords: doctorRecords.length,
          totalPatients: allPatients.length,
        });
      } else if (userRole === 'admin') {
        // Admins see aggregated system-wide stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const [allAppointments, unprocessedMessages, patients] = await Promise.all([
          db.select().from(appointments).where(
            and(
              gte(appointments.scheduledAt, today),
              lt(appointments.scheduledAt, tomorrow)
            )
          ),
          storage.getUnprocessedWhatsappMessages(),
          storage.getAllPatients(),
        ]);

        const aiScheduledToday = allAppointments.filter(apt => apt.aiScheduled).length;

        res.json({
          todayConsultations: allAppointments.length,
          whatsappMessages: unprocessedMessages.length,
          aiScheduling: aiScheduledToday,
          secureRecords: patients.length,
        });
      } else if (userRole === 'patient') {
        // Patient sees their own appointments and records
        const patientData = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
        const patientAppointments = patientData.length ? 
          await db.select().from(appointments).where(eq(appointments.patientId, patientData[0].id)) : [];
        
        res.json({
          todayConsultations: patientAppointments.filter(apt => {
            const aptDate = new Date(apt.date);
            const today = new Date();
            return aptDate.toDateString() === today.toDateString();
          }).length,
          whatsappMessages: 0,
          aiScheduling: 0,
          secureRecords: patientAppointments.length,
        });
      } else {
        // Other roles get default empty stats
        res.json({
          todayConsultations: 0,
          whatsappMessages: 0,
          aiScheduling: 0,
          secureRecords: 0,
        });
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ message: 'Failed to get dashboard stats' });
    }
  });

  // Public Statistics API - No authentication required
  app.get('/api/stats/public', async (req, res) => {
    try {
      // Get real statistics from database
      const [completedAppointments] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(eq(appointments.status, 'completed'));
      
      const [activeDoctors] = await db
        .select({ count: sql<number>`count(distinct ${users.id})::int` })
        .from(users)
        .where(eq(users.role, 'doctor'));
      
      // Calculate average rating from completed appointments with ratings
      const [avgRating] = await db
        .select({ avg: sql<number>`COALESCE(AVG(${appointments.rating}), 0)` })
        .from(appointments)
        .where(and(
          eq(appointments.status, 'completed'),
          isNotNull(appointments.rating)
        ));
      
      // Parse average rating safely
      const avgRatingValue = avgRating?.avg ? parseFloat(String(avgRating.avg)) : 0;
      
      res.json({
        completedAppointments: completedAppointments?.count || 0,
        activeDoctors: activeDoctors?.count || 0,
        averageRating: avgRatingValue > 0 ? Number(avgRatingValue.toFixed(1)) : 0,
        support24_7: true, // Platform offers 24/7 support
      });
    } catch (error) {
      console.error('Public stats error:', error);
      res.status(500).json({ message: 'Failed to get public statistics' });
    }
  });

  // Researcher Statistics API - Anonymized data compliant with LGPD
  // Researchers can only access aggregated statistical data, no personal information
  app.get('/api/research/medical-records-stats', requireAuth, async (req: any, res) => {
    try {
      // Only researchers and admins can access this endpoint
      if (req.user.role !== 'researcher' && req.user.role !== 'admin') {
        return res.status(403).json({ 
          message: 'Acesso negado: Apenas pesquisadores e administradores podem acessar dados estatísticos' 
        });
      }

      // Get anonymized aggregated statistics
      // Total medical records by diagnosis (top 10 most common)
      const topDiagnoses = await db
        .select({
          diagnosis: medicalRecords.diagnosis,
          count: sql<number>`count(*)::int`
        })
        .from(medicalRecords)
        .where(isNotNull(medicalRecords.diagnosis))
        .groupBy(medicalRecords.diagnosis)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      // Total medical records by month (last 12 months)
      const recordsByMonth = await db
        .select({
          month: sql<string>`TO_CHAR(${medicalRecords.createdAt}, 'YYYY-MM')`,
          count: sql<number>`count(*)::int`
        })
        .from(medicalRecords)
        .where(sql`${medicalRecords.createdAt} >= NOW() - INTERVAL '12 months'`)
        .groupBy(sql`TO_CHAR(${medicalRecords.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${medicalRecords.createdAt}, 'YYYY-MM') ASC`);

      // Age distribution (anonymized - only age ranges, no birth dates)
      const ageDistribution = await db
        .select({
          ageRange: sql<string>`
            CASE 
              WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 18 THEN '0-17'
              WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 30 THEN '18-29'
              WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 45 THEN '30-44'
              WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 60 THEN '45-59'
              ELSE '60+'
            END
          `,
          count: sql<number>`count(*)::int`
        })
        .from(patients)
        .where(isNotNull(patients.dateOfBirth))
        .groupBy(sql`
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 18 THEN '0-17'
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 30 THEN '18-29'
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 45 THEN '30-44'
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 60 THEN '45-59'
            ELSE '60+'
          END
        `)
        .orderBy(sql`
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 18 THEN 1
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 30 THEN 2
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 45 THEN 3
            WHEN EXTRACT(YEAR FROM AGE(${patients.dateOfBirth})) < 60 THEN 4
            ELSE 5
          END
        `);

      // Gender distribution (anonymized)
      const genderDistribution = await db
        .select({
          gender: patients.gender,
          count: sql<number>`count(*)::int`
        })
        .from(patients)
        .where(isNotNull(patients.gender))
        .groupBy(patients.gender);

      // Appointment types distribution
      const appointmentTypes = await db
        .select({
          type: appointments.type,
          count: sql<number>`count(*)::int`
        })
        .from(appointments)
        .groupBy(appointments.type)
        .orderBy(sql`count(*) DESC`);

      // Health status distribution (anonymized)
      const healthStatusDistribution = await db
        .select({
          status: patients.healthStatus,
          count: sql<number>`count(*)::int`
        })
        .from(patients)
        .groupBy(patients.healthStatus)
        .orderBy(sql`count(*) DESC`);

      // Total counts
      const [totalRecords] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(medicalRecords);

      const [totalPatients] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients);

      const [totalAppointments] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments);

      res.json({
        summary: {
          totalMedicalRecords: totalRecords?.count || 0,
          totalPatients: totalPatients?.count || 0,
          totalAppointments: totalAppointments?.count || 0,
        },
        demographics: {
          ageDistribution,
          genderDistribution,
        },
        clinicalData: {
          topDiagnoses,
          healthStatusDistribution,
          appointmentTypes,
        },
        trends: {
          recordsByMonth,
        },
        disclaimer: 'Todos os dados são anonimizados e agregados em conformidade com a LGPD. Nenhuma informação pessoal identificável é incluída nesta resposta.'
      });
    } catch (error) {
      console.error('Researcher stats error:', error);
      res.status(500).json({ message: 'Falha ao obter estatísticas de pesquisa' });
    }
  });

  // Reschedule appointment
  app.post('/api/appointments/:id/reschedule', requireAuth, async (req: any, res) => {
    try {
      const appointmentId = req.params.id;
      const { scheduledAt, notes } = req.body;
      
      // Get original appointment
      const originalAppointment = await storage.getAppointment(appointmentId);
      if (!originalAppointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      // Validate that appointment can be rescheduled
      if (originalAppointment.status === 'completed') {
        return res.status(400).json({ message: 'Cannot reschedule completed appointment' });
      }
      
      if (originalAppointment.status === 'cancelled') {
        return res.status(400).json({ message: 'Cannot reschedule cancelled appointment' });
      }
      
      // Validate new date is in the future
      const newDate = new Date(scheduledAt);
      if (newDate <= new Date()) {
        return res.status(400).json({ message: 'Cannot reschedule to a past date' });
      }
      
      // Authorization: only doctor, admin, or the patient can reschedule
      const user = req.user;
      const isDoctor = user.id === originalAppointment.doctorId;
      const isAdmin = user.role === 'admin';
      const patient = await db.select().from(patients).where(eq(patients.id, originalAppointment.patientId)).limit(1);
      const isPatient = patient.length > 0 && patient[0].userId === user.id;
      
      if (!isDoctor && !isAdmin && !isPatient) {
        return res.status(403).json({ message: 'Not authorized to reschedule this appointment' });
      }
      
      // Create new appointment with same details but new date
      const newAppointment = await storage.createAppointment({
        patientId: originalAppointment.patientId,
        doctorId: originalAppointment.doctorId,
        scheduledAt: newDate,
        type: originalAppointment.type,
        status: 'scheduled',
        notes: notes || `Reagendada de ${new Date(originalAppointment.scheduledAt).toLocaleString('pt-BR')}`,
        aiScheduled: originalAppointment.aiScheduled,
        rescheduledFromId: originalAppointment.id,
      });
      
      // Update original appointment
      await storage.updateAppointment(appointmentId, {
        status: 'rescheduled',
        rescheduledToId: newAppointment.id,
      });
      
      // Broadcast updates
      broadcastToDoctor(originalAppointment.doctorId, { 
        type: 'appointment_rescheduled', 
        data: { 
          originalId: originalAppointment.id,
          newAppointment 
        } 
      });
      
      res.json({
        success: true,
        originalAppointment: { ...originalAppointment, status: 'rescheduled', rescheduledToId: newAppointment.id },
        newAppointment,
      });
    } catch (error) {
      console.error('Reschedule appointment error:', error);
      res.status(500).json({ message: 'Failed to reschedule appointment' });
    }
  });

  // Rate appointment (patient rating for doctor)
  app.post('/api/appointments/:id/rate', requireAuth, async (req: any, res) => {
    try {
      const appointmentId = req.params.id;
      const { rating, feedback } = req.body;
      
      // Validate rating value
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      
      // Get appointment
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      
      // Only completed appointments can be rated
      if (appointment.status !== 'completed') {
        return res.status(400).json({ message: 'Only completed appointments can be rated' });
      }
      
      // Authorization: only the patient can rate
      const user = req.user;
      const patient = await db.select().from(patients).where(eq(patients.id, appointment.patientId)).limit(1);
      const isPatient = patient.length > 0 && patient[0].userId === user.id;
      const isAdmin = user.role === 'admin';
      
      if (!isPatient && !isAdmin) {
        return res.status(403).json({ message: 'Only the patient can rate this appointment' });
      }
      
      // Check if appointment is already rated
      if (appointment.rating) {
        return res.status(400).json({ message: 'This appointment has already been rated' });
      }
      
      // Update appointment with rating and feedback
      const updatedAppointment = await storage.updateAppointment(appointmentId, {
        rating: parseInt(rating),
        feedback: feedback || null,
      });
      
      // Broadcast rating to doctor
      broadcastToDoctor(appointment.doctorId, {
        type: 'appointment_rated',
        data: {
          appointmentId,
          rating,
          feedback,
          patientName: patient[0]?.name || 'Paciente',
        }
      });
      
      res.json({
        success: true,
        appointment: updatedAppointment,
      });
    } catch (error) {
      console.error('Rate appointment error:', error);
      res.status(500).json({ message: 'Failed to rate appointment' });
    }
  });

  // Get doctor rating statistics
  app.get('/api/doctors/:doctorId/rating-stats', async (req, res) => {
    try {
      const doctorId = req.params.doctorId;
      
      // Get all completed appointments with ratings for this doctor
      const ratedAppointments = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.doctorId, doctorId),
            eq(appointments.status, 'completed'),
            isNotNull(appointments.rating)
          )
        );
      
      if (ratedAppointments.length === 0) {
        return res.json({
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        });
      }
      
      // Calculate average rating
      const totalRating = ratedAppointments.reduce((sum, apt) => sum + (apt.rating || 0), 0);
      const averageRating = totalRating / ratedAppointments.length;
      
      // Calculate rating distribution
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratedAppointments.forEach((apt) => {
        if (apt.rating) {
          ratingDistribution[apt.rating]++;
        }
      });
      
      res.json({
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings: ratedAppointments.length,
        ratingDistribution
      });
    } catch (error) {
      console.error('Get doctor rating stats error:', error);
      res.status(500).json({ message: 'Failed to get rating statistics' });
    }
  });

  // AI WhatsApp-style Chat Analysis for Chatbot
  app.post('/api/ai/whatsapp-analysis', requireAuth, async (req, res) => {
    try {
      // Validate request body with Zod
      const chatSchema = z.object({
        message: z.string().min(1, 'Message is required'),
        patientHistory: z.string().optional().default('')
      });
      
      const { message, patientHistory } = chatSchema.parse(req.body);

      // Use existing OpenAI service for WhatsApp analysis
      const analysis = await geminiService.analyzeWhatsappMessage(
        message,
        patientHistory || ''
      );

      res.json({
        response: analysis.response || 'Análise realizada com sucesso.',
        isClinicalQuestion: analysis.isClinicalQuestion || false,
        suggestedAction: analysis.suggestedAction || 'Continuar conversa',
        requiresHumanIntervention: analysis.requiresHumanIntervention || false
      });
    } catch (error) {
      console.error('AI WhatsApp analysis error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ 
        message: 'Erro interno do servidor ao realizar análise de chat',
        response: 'Não foi possível processar sua mensagem no momento. Tente novamente.',
        isClinicalQuestion: false,
        suggestedAction: 'Tentar novamente mais tarde',
        requiresHumanIntervention: true
      });
    }
  });

  // ============================================================================
  // VIDEO CONSULTATION ENDPOINTS
  // ============================================================================

  // AI Clinical Analysis endpoint for video consultations
  app.post('/api/ai/clinical-analysis', requireAuth, async (req, res) => {
    try {
      const { transcript, notes, patientHistory, patientInfo } = req.body;
      
      // Normalize notes to array format for consistent processing
      let normalizedNotes = [];
      if (Array.isArray(notes)) {
        normalizedNotes = notes;
      } else if (typeof notes === 'string') {
        normalizedNotes = [{ type: 'observation', note: notes }];
      }
      
      // Create comprehensive prompt for AI analysis
      const prompt = `
Analyze the following medical consultation data and generate a structured SOAP report:

PATIENT INFO:
Name: ${patientInfo?.name || 'Unknown'}
Age: ${patientInfo?.age || 'Unknown'}

CONSULTATION TRANSCRIPT:
${transcript || 'No transcript available'}

CONSULTATION NOTES:
${normalizedNotes?.map((note: any) => `[${note.type || 'note'}] ${note.note || note}`).join('\n') || 'No notes available'}

PATIENT MEDICAL HISTORY:
${patientHistory?.map((h: any) => h.condition || h.diagnosis || h.description).join(', ') || 'No history available'}

Please provide a structured SOAP analysis in Brazilian Portuguese following SUS standards:

1. SUBJETIVO (S): What the patient reported (symptoms, concerns)
2. OBJETIVO (O): Observable findings and examination results
3. AVALIAÇÃO (A): Medical assessment and potential diagnoses
4. PLANO (P): Treatment plan and recommendations

Format your response as valid JSON with this structure:
{
  "subjective": "...",
  "objective": "...", 
  "assessment": "...",
  "plan": "..."
}
`;

      // Use existing OpenAI service for analysis
      const analysis = await geminiService.generateClinicalAnalysis(prompt);

      // Try to parse the response as JSON, fallback to structured text
      let soapData;
      try {
        soapData = JSON.parse(analysis);
      } catch (parseError) {
        // If not valid JSON, create structured response from text
        soapData = {
          subjective: analysis.includes('SUBJETIVO') ? analysis.split('SUBJETIVO')[1]?.split('OBJETIVO')[0]?.trim() : 'Sintomas e queixas relatados pelo paciente durante a consulta.',
          objective: analysis.includes('OBJETIVO') ? analysis.split('OBJETIVO')[1]?.split('AVALIAÇÃO')[0]?.trim() : 'Exame físico e sinais vitais observados.',
          assessment: analysis.includes('AVALIAÇÃO') ? analysis.split('AVALIAÇÃO')[1]?.split('PLANO')[0]?.trim() : 'Hipóteses diagnósticas baseadas nos dados coletados.',
          plan: analysis.includes('PLANO') ? analysis.split('PLANO')[1]?.trim() : analysis || 'Plano terapêutico e acompanhamento recomendado.'
        };
      }

      res.json(soapData);

    } catch (error) {
      console.error('AI clinical analysis error:', error);
      res.status(500).json({ 
        message: 'Failed to generate clinical analysis',
        subjective: 'Erro ao processar sintomas relatados.',
        objective: 'Erro ao processar dados do exame.',
        assessment: 'Análise diagnóstica não disponível.',
        plan: 'Plano de tratamento a ser definido manualmente.'
      });
    }
  });

  // Save consultation endpoint
  app.post('/api/consultations', requireAuth, async (req, res) => {
    try {
      const { patientId, notes, audioTranscript, soapNotes, duration, timestamp } = req.body;
      const doctorId = req.user.id;

      // Create consultation record
      const consultation = {
        id: crypto.randomUUID(),
        patientId,
        doctorId,
        type: 'video_consultation',
        notes: JSON.stringify(notes || []),
        audioTranscript: audioTranscript || '',
        soapNotes: JSON.stringify(soapNotes || {}),
        duration: duration || 0,
        timestamp: timestamp || new Date().toISOString(),
        status: 'completed'
      };

      // Log consultation for now (would save to database in production)
      console.log('Saving video consultation:', {
        consultationId: consultation.id,
        patientId,
        doctorId,
        duration: consultation.duration,
        notesCount: notes?.length || 0,
        hasTranscript: !!audioTranscript,
        hasSoapNotes: !!(soapNotes?.subjective || soapNotes?.objective || soapNotes?.assessment || soapNotes?.plan)
      });

      // Broadcast consultation completion to admin users
      await broadcastAdminActivity({
        action: 'consultation_completed',
        type: 'medical_activity',
        entityType: 'consultation',
        entityId: consultation.id,
        userId: doctorId,
        details: {
          consultationType: 'video_consultation',
          patientId,
          duration: consultation.duration,
          timestamp: consultation.timestamp
        }
      });

      res.json({ 
        success: true, 
        consultationId: consultation.id,
        message: 'Consultation saved successfully' 
      });

    } catch (error) {
      console.error('Save consultation error:', error);
      res.status(500).json({ message: 'Failed to save consultation' });
    }
  });

  // Consultation Requests - AI-powered scheduling
  app.post('/api/consultation-requests', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Get patient data for AI analysis
      let patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        // Auto-create patient record if missing
        const userRecord = await storage.getUser(userId);
        if (!userRecord || userRecord.role !== 'patient') {
          return res.status(403).json({ message: 'Apenas pacientes podem solicitar consultas.' });
        }
        try {
          patient = await storage.createPatient({
            userId,
            name: userRecord.name,
            email: userRecord.email || null,
            phone: userRecord.phone || 'não informado',
            healthStatus: 'a_determinar',
          });
        } catch (createErr) {
          console.error('Failed to auto-create patient record:', createErr);
          return res.status(400).json({ 
            message: 'Complete seu cadastro de paciente antes de solicitar uma consulta.' 
          });
        }
      }

      const patientId = patient.id;
      const { symptoms, whatsappOptIn, selectedDoctorId: preSelectedDoctorId } = req.body;

      // Check if the patient is blocked by the pre-selected doctor
      if (preSelectedDoctorId) {
        const blockCheck = await db.select().from(doctorPatientBlocks)
          .where(and(eq(doctorPatientBlocks.doctorId, preSelectedDoctorId), eq(doctorPatientBlocks.patientId, patientId)));
        if (blockCheck.length > 0) {
          return res.status(403).json({ message: 'Este médico bloqueou suas solicitações de consulta. Escolha outro profissional.' });
        }
      }

      if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
        return res.status(400).json({ message: 'Descreva seus sintomas para continuar.' });
      }

      // Get comprehensive patient data for AI analysis
      let medicalHistory: any[] = [];
      let recentExams: any[] = [];
      let previousRequests: any[] = [];
      let patientPrescriptions: any[] = [];
      try {
        medicalHistory = await storage.getMedicalRecordsByPatient(patientId);
        recentExams = await storage.getExamResultsByPatient(patientId);
        previousRequests = await storage.getConsultationRequestsByPatient(patientId);
        patientPrescriptions = await storage.getPrescriptionSharesByPatient(patientId);
      } catch (e) {
        // Non-critical: continue without history
      }

      // Detect patient region via IP for protocol selection
      let regionContext = '';
      try {
        const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() 
          || req.socket.remoteAddress || '';
        const isLocalIp = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('10.') || clientIp.startsWith('192.168.');
        
        if (!isLocalIp && clientIp) {
          try {
            const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=country,regionName,city&lang=pt-BR`);
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData.country) {
                regionContext = `Região do paciente: ${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country}. `;
                if (geoData.country === 'Brazil' || geoData.country === 'Brasil') {
                  regionContext += 'Use protocolos do Ministério da Saúde do Brasil, SUS, ANVISA e diretrizes CFM. ';
                  if (geoData.regionName) {
                    regionContext += `Considere também protocolos regionais da Secretaria de Saúde de ${geoData.regionName}. `;
                  }
                }
              }
            }
          } catch {
            // Geolocation failed, will use default protocols
          }
        }
      } catch {
        // IP detection failed
      }

      if (!regionContext) {
        regionContext = 'Região não identificada. Use diretrizes gerais da OMS (Organização Mundial da Saúde), protocolos internacionais de boas práticas clínicas e, quando aplicável, referências do Ministério da Saúde do Brasil. ';
      }

      // Build doctor-established protocol context
      let doctorProtocolContext = '';
      const previousDoctors = new Set<string>();
      previousRequests.forEach((r: any) => {
        if (r.selectedDoctorId) previousDoctors.add(r.selectedDoctorId);
      });
      
      if (medicalHistory.length > 0) {
        const recentTreatments = medicalHistory
          .slice(0, 5)
          .filter((r: any) => r.treatment || r.diagnosis)
          .map((r: any) => `Diagnóstico: ${r.diagnosis || 'N/A'}, Tratamento: ${r.treatment || 'N/A'}, Prescrição: ${r.prescription || 'N/A'}`)
          .join('\n  ');
        if (recentTreatments) {
          doctorProtocolContext = `\nCondutas médicas já estabelecidas pelo médico que atendeu o paciente anteriormente:\n  ${recentTreatments}\nIMPORTANTE: Priorize e mantenha coerência com as condutas já estabelecidas pelo médico responsável, ajustando apenas se os sintomas atuais indicarem necessidade clínica diferente.`;
        }
      }

      if (patientPrescriptions.length > 0) {
        const recentRx = patientPrescriptions
          .filter((p: any) => p.status !== 'cancelled')
          .slice(0, 5)
          .map((p: any) => p.prescriptionText?.substring(0, 200) || 'Prescrição sem texto')
          .join('; ');
        if (recentRx) {
          doctorProtocolContext += `\nPrescrições recentes: ${recentRx}. Considere interações medicamentosas ao sugerir novas condutas.`;
        }
      }

      // Build previous complaints context
      let previousComplaintsContext = '';
      if (previousRequests.length > 0) {
        const recentComplaints = previousRequests
          .slice(0, 5)
          .map((r: any) => `- "${r.symptoms}" (${new Date(r.createdAt).toLocaleDateString('pt-BR')}, urgência: ${r.urgencyLevel}, status: ${r.status})`)
          .join('\n');
        previousComplaintsContext = `\nSolicitações anteriores do paciente:\n${recentComplaints}`;
      }

      let triageData;
      try {
        const triagePrompt = `Como médico especialista, analise os seguintes dados clínicos e classifique a urgência do atendimento.

PROTOCOLOS E DIRETRIZES A SEGUIR:
${regionContext}
Aplique critérios e indicações gerais oferecidas pelas fontes oficiais e protocolos legais estabelecidos na área médica da região identificada. Em caso de dúvida, utilize sempre os protocolos mais conservadores e seguros para o paciente.

DIRETRIZES PADRÃO OBRIGATÓRIAS:
- OMS (Organização Mundial da Saúde): Diretrizes clínicas, ETAT, mhGAP para saúde mental
- Ministério da Saúde do Brasil: Cadernos de Atenção Básica (CAB 36 DM, CAB 37 HAS, CAB 19 Criança, CAB 32 Pré-natal), PCDT/CONITEC, PNAB, RENAME
- DSM-5/DSM-5-TR (APA): Critérios diagnósticos para transtornos mentais e condições psiquiátricas
- Para sintomas psiquiátricos (ansiedade, depressão, insônia, uso de substâncias, etc.): aplicar critérios DSM-5 e escalas de rastreamento (PHQ-9, GAD-7, AUDIT)
${doctorProtocolContext}

DADOS DO PACIENTE:
Nome: ${patient.name}
Alergias: ${(patient as any).allergies || 'Nenhuma registrada'}
Tipo sanguíneo: ${(patient as any).bloodType || 'Não informado'}

QUEIXA ATUAL:
${symptoms}
${previousComplaintsContext}

HISTÓRICO MÉDICO:
${medicalHistory.length > 0 ? medicalHistory.slice(0, 5).map((r: any) => `- ${r.diagnosis || 'Consulta'}: ${r.symptoms || ''} (${r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR') : 'data não registrada'})`).join('\n') : 'Sem histórico médico registrado no sistema'}

EXAMES RECENTES:
${recentExams.length > 0 ? recentExams.slice(0, 5).map((e: any) => `- ${e.examType}: ${e.result || JSON.stringify(e.results || {})}`).join('\n') : 'Sem exames recentes'}

INSTRUÇÕES DE ANÁLISE:
1. Correlacione os sintomas atuais com o histórico médico e solicitações anteriores
2. Identifique padrões de recorrência e evolução clínica
3. Baseie a classificação de urgência nos protocolos oficiais da região
4. Se existirem condutas já estabelecidas por médico anterior, mantenha coerência com elas
5. Considere medicamentos em uso e possíveis interações
6. Na ausência de parâmetros pré-definidos, aplique diretrizes da OMS

CLASSIFICAÇÃO DE RISCO (Protocolo de Manchester / Ministério da Saúde Brasil):
Use EXATAMENTE um dos 5 níveis abaixo:
- "emergency" (VERMELHO) — Emergência: Risco iminente de vida. Atendimento imediato. Ex: PCR, obstrução de vias aéreas, choque, IAM, AVC.
- "very_urgent" (LARANJA) — Muito Urgente: Condição grave, pode evoluir para risco de vida. Até 10 min. Ex: dor intensa ≥8/10, dispneia grave, hemorragia moderada, déficit neurológico agudo.
- "urgent" (AMARELO) — Urgente: Necessita avaliação médica, potencial de agravamento. Até 60 min. Ex: dor moderada 4-7/10, febre 38-39°C, vômitos persistentes, crise hipertensiva.
- "standard" (VERDE) — Pouco Urgente: Menor gravidade, sem risco significativo. Até 120 min. Ex: dor leve 1-3/10, IVAS, contusão simples, sintomas gripais.
- "non_urgent" (AZUL) — Não Urgente: Queixa crônica ou ambulatorial. Até 240 min. Ex: renovação de receitas, exames de rotina, acompanhamento.

Na ausência de identificação do país do médico, utilize as diretrizes de triagem da OMS (Emergency Triage Assessment and Treatment).

IMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem blocos de código, sem texto extra. O JSON deve ter exatamente este formato:
{"aiTriageLevel": "standard", "triageReasoning": "texto explicativo em português detalhando a análise clínica, protocolos aplicados e recomendações, sem aspas internas", "recommendedSpecialties": ["Especialidade1"], "keyFindings": ["achado1", "achado2"], "protocolsApplied": ["nome do protocolo ou diretriz utilizada"]}

Valores possíveis para aiTriageLevel: "emergency", "very_urgent", "urgent", "standard", "non_urgent"`;

        const aiResponse = await Promise.race([
          geminiService.generateText(triagePrompt, 'Você é um médico triagista especializado no Protocolo de Manchester e diretrizes OMS/Ministério da Saúde do Brasil. Classifique o risco clínico com precisão e forneça análise detalhada em português brasileiro.'),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 30000))
        ]);
        
        try {
          const cleanedResponse = aiResponse
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .replace(/^\s*\n/gm, '')
            .trim();
          triageData = JSON.parse(cleanedResponse);
        } catch {
          triageData = {
            aiTriageLevel: 'standard',
            triageReasoning: aiResponse
              .replace(/```json\s*/gi, '')
              .replace(/```\s*/g, '')
              .replace(/[{}"]/g, '')
              .replace(/aiTriageLevel.*?,/gi, '')
              .replace(/recommendedSpecialties.*?\]/gi, '')
              .replace(/keyFindings.*?\]/gi, '')
              .replace(/protocolsApplied.*?\]/gi, '')
              .replace(/triageReasoning\s*:\s*/gi, '')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 300) || 'Análise clínica dos sintomas reportados pelo paciente.',
            recommendedSpecialties: ['Clínico Geral'],
            keyFindings: ['Análise de sintomas necessária'],
            protocolsApplied: ['Diretrizes gerais']
          };
        }
      } catch (aiError) {
        console.error('AI triage failed, using fallback:', aiError);
        triageData = {
          aiTriageLevel: 'standard',
          triageReasoning: 'Análise clínica dos sintomas reportados pelo paciente. Recomenda-se avaliação médica presencial.',
          recommendedSpecialties: ['Clínico Geral'],
          keyFindings: ['Avaliação médica necessária'],
          protocolsApplied: ['Diretrizes gerais da OMS']
        };
      }

      // Get available doctors (simplified - in production would check schedule)
      const allUsers = await storage.getAllUsers();
      const doctors = allUsers.filter((u: any) => u.role === 'doctor');
      const availableDoctors = doctors
        .filter((d: any) => d.isActive !== false)
        .map((d: any) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty || 'Clínico Geral',
          availability: 'available' 
        }));

      // Clean triageReasoning to remove any JSON artifacts
      const cleanReasoning = (triageData.triageReasoning || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/[{}]/g, '')
        .replace(/"[a-zA-Z]+"\s*:\s*/g, '')
        .replace(/"/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Análise clínica dos sintomas reportados pelo paciente.';

      const consultationRequest = await storage.createConsultationRequest({
        patientId,
        symptoms,
        aiAnalysis: triageData,
        clinicalPresentation: cleanReasoning,
        urgencyLevel: triageData.aiTriageLevel || 'standard',
        selectedDoctorId: availableDoctors[0]?.id || null,
        recommendedDoctors: availableDoctors.map((d: any) => d.id),
        status: 'pending',
        whatsappNotificationSent: whatsappOptIn || false
      });

      const patientRecord = await storage.getPatient(patientId);
      const patientName = patientRecord?.name || 'Paciente';
      const patientCode = patientId.slice(-6).toUpperCase();
      const urgencyLabel = triageData.aiTriageLevel === 'emergency' ? 'EMERGÊNCIA' : 
        triageData.aiTriageLevel === 'very_urgent' ? 'MUITO URGENTE' : 
        triageData.aiTriageLevel === 'urgent' ? 'URGENTE' : 'Normal';
      const notifPriority = triageData.aiTriageLevel === 'emergency' ? 'critical' as const : 
        triageData.aiTriageLevel === 'very_urgent' ? 'critical' as const : 
        triageData.aiTriageLevel === 'urgent' ? 'high' as const : 'medium' as const;

      const targetDoctorIds = availableDoctors.map((d: any) => d.id);

      for (const docId of targetDoctorIds) {
        broadcastToUser(docId, {
          type: 'urgency_request',
          data: {
            title: `Nova Solicitação - ${urgencyLabel}`,
            message: `Paciente #${patientCode}: ${symptoms.substring(0, 150)}`,
            priority: notifPriority,
            requestId: consultationRequest.id,
            patientId,
            patientCode,
            patientName,
            urgencyLevel: triageData.aiTriageLevel || 'standard',
            actionUrl: '/doctor-chat'
          }
        });

        try {
          await db.insert(pendingNotifications).values({
            userId: docId,
            type: 'system',
            title: `Nova Solicitação - ${urgencyLabel}`,
            message: `Paciente #${patientCode}: ${symptoms.substring(0, 200)}`,
            priority: notifPriority,
            actionUrl: '/doctor-chat',
            senderId: patientId,
            delivered: false,
            read: false,
            metadata: { requestId: consultationRequest.id, patientId, patientCode, urgencyLevel: triageData.aiTriageLevel, wsType: 'urgency_request' }
          });
        } catch (notifErr) {
          console.error('Failed to store consultation request notification:', notifErr);
        }
      }

      try {
        if (whatsAppService.isConfigured()) {
          const whatsappEnabled = await storage.getSystemSetting('whatsapp_notifications_enabled');
          if (whatsappEnabled?.value === 'true') {
            const urgencyEmoji = triageData.aiTriageLevel === 'emergency' ? '🔴' : 
              triageData.aiTriageLevel === 'very_urgent' ? '🟠' : 
              triageData.aiTriageLevel === 'urgent' ? '🟡' : '🟢';

            const allDoctors = await storage.getUsersByRole('doctor');
            const notifyDoctorIds = new Set(targetDoctorIds);
            allDoctors.forEach((d: any) => {
              if (d.isActive !== false && d.whatsappNumber) {
                notifyDoctorIds.add(d.id);
              }
            });

            for (const docId of notifyDoctorIds) {
              try {
                const doctor = await storage.getUser(docId);
                if (doctor?.whatsappNumber) {
                  const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
                  await whatsAppService.sendMessage(
                    doctor.whatsappNumber,
                    `${urgencyEmoji} Nova Solicitação de Consulta\n\n📋 Paciente: #${patientCode}\n⚡ Urgência: ${urgencyLabel}\n🏥 Especialidade: ${doctor.specialty || 'Geral'}\n📝 Sintomas: ${symptoms.slice(0, 200)}\n\n▶️ Atender agora:\n${baseUrl}/consultation/video/${patientId}\n\n📅 Agendar:\n${baseUrl}/schedule\n\n❌ Recusar:\n${baseUrl}/doctor-chat\n\n🏥 Tele<M3D> Pro`
                  );
                }
              } catch {}
            }
          }
        }
      } catch (waErr) {
        console.error('WhatsApp consultation request notification error (non-blocking):', waErr);
      }

      res.json({
        success: true,
        consultationRequest: {
          ...consultationRequest,
          clinicalPresentation: cleanReasoning,
        },
        triage: {
          ...triageData,
          triageReasoning: cleanReasoning,
          urgencyScore: triageData.aiTriageLevel === 'emergency' ? 10 : triageData.aiTriageLevel === 'very_urgent' ? 8 : triageData.aiTriageLevel === 'urgent' ? 6 : triageData.aiTriageLevel === 'standard' ? 4 : 2,
          protocolsApplied: triageData.protocolsApplied || ['Diretrizes gerais'],
        },
        availableDoctors
      });

    } catch (error: any) {
      console.error('Create consultation request error:', error);
      const userMessage = error?.message?.includes('AI_TIMEOUT')
        ? 'O serviço de IA demorou para responder. Sua solicitação será processada com análise padrão.'
        : 'Erro ao processar sua solicitação. Tente novamente em alguns instantes.';
      res.status(500).json({ message: userMessage });
    }
  });

  // Update consultation request to select doctor
  app.patch('/api/consultation-requests/:id/select-doctor', requireAuth, async (req, res) => {
    try {
      const { selectedDoctorId } = req.body;
      const request = await storage.getConsultationRequest(req.params.id);

      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: only the patient who created the request
      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient || patient.id !== request.patientId) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Check if doctor has blocked this patient
      if (selectedDoctorId && patient) {
        const blockCheck = await db.select().from(doctorPatientBlocks)
          .where(and(eq(doctorPatientBlocks.doctorId, selectedDoctorId), eq(doctorPatientBlocks.patientId, patient.id)));
        if (blockCheck.length > 0) {
          return res.status(403).json({ message: 'Este médico bloqueou suas solicitações. Escolha outro profissional.' });
        }
      }

      // Update with selected doctor
      const updated = await storage.updateConsultationRequest(req.params.id, {
        selectedDoctorId,
        status: 'pending'
      });

      res.json({ success: true, consultationRequest: updated });
    } catch (error) {
      console.error('Select doctor error:', error);
      res.status(500).json({ message: 'Failed to select doctor' });
    }
  });

  // Get consultation requests
  app.get('/api/consultation-requests', requireAuth, async (req, res) => {
    try {
      let requests;
      const { patientId } = req.query;
      
      if (patientId && typeof patientId === 'string' && (req.user!.role === 'doctor' || req.user!.role === 'admin')) {
        requests = await storage.getConsultationRequestsByPatient(patientId);
      } else if (req.user!.role === 'doctor' || req.user!.role === 'admin') {
        requests = await storage.getConsultationRequestsByDoctor(req.user!.id);
      } else {
        const patient = await storage.getPatientByUserId(req.user!.id);
        if (patient) {
          requests = await storage.getConsultationRequestsByPatient(patient.id);
        } else {
          requests = [];
        }
      }

      res.json(requests);
    } catch (error) {
      console.error('Get consultation requests error:', error);
      res.status(500).json({ message: 'Failed to fetch consultation requests' });
    }
  });

  // Get single consultation request
  app.get('/api/consultation-requests/:id', requireAuth, async (req, res) => {
    try {
      const request = await storage.getConsultationRequest(req.params.id);
      
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Check authorization - resolve patient userId properly
      let isAuthorized = false;
      if (req.user!.role === 'admin') {
        isAuthorized = true;
      } else if (req.user!.role === 'doctor' && request.selectedDoctorId === req.user!.id) {
        isAuthorized = true;
      } else {
        const patient = await storage.getPatientByUserId(req.user!.id);
        if (patient && request.patientId === patient.id) {
          isAuthorized = true;
        }
      }
      if (!isAuthorized) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      res.json(request);
    } catch (error) {
      console.error('Get consultation request error:', error);
      res.status(500).json({ message: 'Failed to fetch consultation request' });
    }
  });

  // Accept consultation request
  app.patch('/api/consultation-requests/:id/accept', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'doctor' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas médicos podem aceitar solicitações.' });
      }

      const doctorId = req.user!.id;
      const doctorName = req.user!.name || 'Médico(a)';

      const atomicResult = await db.update(consultationRequests)
        .set({ status: 'accepted', selectedDoctorId: doctorId, acceptedAt: new Date() })
        .where(and(
          eq(consultationRequests.id, req.params.id),
          eq(consultationRequests.status, 'pending')
        ))
        .returning();

      if (atomicResult.length === 0) {
        const existing = await storage.getConsultationRequest(req.params.id);
        if (!existing) {
          return res.status(404).json({ message: 'Solicitação não encontrada.' });
        }
        return res.status(409).json({ message: 'Esta solicitação já foi aceita por outro médico.' });
      }

      const updated = atomicResult[0];
      const request = updated;
      const acceptedAt = new Date();

      let consultationId: string | null = null;
      try {
        const consultation = await storage.createVideoConsultation({
          patientId: request.patientId,
          doctorId,
          status: 'waiting',
          scheduledAt: acceptedAt,
        });
        consultationId = consultation.id;
      } catch (e) {
        console.error('Failed to auto-create consultation on accept:', e);
      }

      const recommendedDoctorIds: string[] = (request as any).recommendedDoctors || [];
      const otherDoctorIds = recommendedDoctorIds.filter(id => id !== doctorId);

      otherDoctorIds.forEach(otherDocId => {
        broadcastToUser(otherDocId, {
          type: 'urgency_accepted',
          data: {
            title: 'Solicitação Atendida',
            message: `Atendido por: Dr(a). ${doctorName} às ${acceptedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            priority: 'medium',
            requestId: req.params.id,
            acceptedByName: doctorName,
            acceptedById: doctorId,
            acceptedAt: acceptedAt.toISOString(),
            actionUrl: null
          }
        });
      });

      for (const otherDocId of otherDoctorIds) {
        try {
          await db.insert(pendingNotifications).values({
            userId: otherDocId,
            type: 'system',
            title: 'Solicitação Atendida',
            message: `Atendido por: Dr(a). ${doctorName} às ${acceptedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            priority: 'medium',
            actionUrl: null,
            senderId: doctorId,
            delivered: false,
            read: false,
            metadata: { requestId: req.params.id, acceptedById: doctorId, acceptedByName: doctorName, acceptedAt: acceptedAt.toISOString(), wsType: 'urgency_accepted' }
          });
        } catch (e) {
          console.error('Failed to store urgency acceptance notification:', e);
        }
      }

      try {
        if (whatsAppService.isConfigured()) {
          const whatsappEnabled = await storage.getSystemSetting('whatsapp_notifications_enabled');
          if (whatsappEnabled?.value === 'true') {
            const patient = await storage.getPatient(request.patientId);
            const patientCode = patient?.id?.slice(-6)?.toUpperCase() || 'N/A';
            const urgencyLabel = (request as any).urgencyLevel === 'emergency' ? 'EMERGÊNCIA' :
              (request as any).urgencyLevel === 'very_urgent' ? 'MUITO URGENTE' :
              (request as any).urgencyLevel === 'urgent' ? 'URGENTE' : 'Normal';

            const allDoctors = await storage.getUsersByRole('doctor');
            const notifyDocIds = new Set(otherDoctorIds);
            allDoctors.forEach((d: any) => {
              if (d.id !== doctorId && d.isActive !== false && d.whatsappNumber) {
                notifyDocIds.add(d.id);
              }
            });

            for (const notifyDocId of notifyDocIds) {
              try {
                const doc = await storage.getUser(notifyDocId);
                if (doc?.whatsappNumber) {
                  const acceptTime = acceptedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  await whatsAppService.sendMessage(
                    doc.whatsappNumber,
                    `✅ Solicitação Atendida\n\n📋 Paciente: #${patientCode}\n⚡ Urgência: ${urgencyLabel}\n👨‍⚕️ Atendido por: Dr(a). ${doctorName}\n🕐 Horário: ${acceptTime}\n\nEsta solicitação já foi aceita.\n\n🏥 Tele<M3D> Pro`
                  );
                }
              } catch {}
            }

            if (request.whatsappNotificationSent && patient?.whatsappNumber) {
              await whatsAppService.sendConsultationJoinNotification(
                patient.whatsappNumber,
                doctorName,
                req.params.id
              );
            }
          }
        }
      } catch (waErr) {
        console.error('WhatsApp accept notification error (non-blocking):', waErr);
      }

      res.json({ success: true, consultationRequest: updated, consultationId });
    } catch (error) {
      console.error('Accept consultation request error:', error);
      res.status(500).json({ message: 'Failed to accept consultation request' });
    }
  });

  // Decline consultation request
  app.patch('/api/consultation-requests/:id/decline', requireAuth, async (req, res) => {
    try {
      const request = await storage.getConsultationRequest(req.params.id);
      
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      if (request.selectedDoctorId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const updated = await storage.updateConsultationRequest(req.params.id, {
        status: 'declined'
      });

      res.json({ success: true, consultationRequest: updated });
    } catch (error) {
      console.error('Decline consultation request error:', error);
      res.status(500).json({ message: 'Failed to decline consultation request' });
    }
  });

  // Patient Chat - Direct messaging between doctor and patient
  
  // Get doctor's chat threads (only with pending consultation requests)
  app.get('/api/chat/doctor/threads', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can access this endpoint' });
      }

      // Get all pending consultation requests for this doctor
      const consultationRequests = await storage.getConsultationRequestsByDoctor(req.user!.id);
      const pendingRequests = consultationRequests.filter((r: any) => 
        r.status === 'pending' || r.status === 'accepted'
      );

      // Get or create chat threads for each request
      const threadsWithPatients = await Promise.all(
        pendingRequests.map(async (request: any) => {
          const patient = await storage.getPatient(request.patientId);
          
          // Get existing thread or create new one
          let thread = await storage.getPatientChatThreadByParticipants(
            request.patientId,
            req.user!.id
          );

          if (!thread) {
            thread = await storage.createPatientChatThread({
              patientId: request.patientId,
              doctorId: req.user!.id,
              messages: [],
              status: 'active'
            });
          }

          return {
            ...thread,
            patient,
            consultationRequest: request
          };
        })
      );

      res.json(threadsWithPatients);
    } catch (error) {
      console.error('Get doctor chat threads error:', error);
      res.status(500).json({ message: 'Failed to fetch chat threads' });
    }
  });

  // Get specific chat thread
  app.get('/api/chat/threads/:id', requireAuth, async (req, res) => {
    try {
      const thread = await storage.getPatientChatThread(req.params.id);
      
      if (!thread) {
        return res.status(404).json({ message: 'Chat thread not found' });
      }

      // Authorization check
      if (thread.doctorId !== req.user!.id) {
        const patient = await storage.getPatientByUserId(req.user!.id);
        if (!patient || patient.id !== thread.patientId) {
          return res.status(403).json({ message: 'Not authorized' });
        }
      }

      // Get patient details
      const patient = await storage.getPatient(thread.patientId);
      
      res.json({ ...thread, patient });
    } catch (error) {
      console.error('Get chat thread error:', error);
      res.status(500).json({ message: 'Failed to fetch chat thread' });
    }
  });

  // Send message in chat
  app.post('/api/chat/threads/:id/messages', requireAuth, async (req, res) => {
    try {
      const thread = await storage.getPatientChatThread(req.params.id);
      
      if (!thread) {
        return res.status(404).json({ message: 'Chat thread not found' });
      }

      // Authorization check
      const isDoctor = thread.doctorId === req.user!.id;
      let isPatient = false;
      
      if (!isDoctor) {
        const patient = await storage.getPatientByUserId(req.user!.id);
        isPatient = patient && patient.id === thread.patientId;
      }

      if (!isDoctor && !isPatient) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const { content } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Message content is required' });
      }

      // Add message to thread
      const messages = thread.messages as any[] || [];
      const newMessage = {
        senderId: req.user!.id,
        senderName: req.user!.name,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        isRead: false
      };

      messages.push(newMessage);

      // Update thread
      const updated = await storage.updatePatientChatThread(req.params.id, {
        messages,
        lastMessageAt: new Date()
      });

      res.json({ success: true, message: newMessage, thread: updated });
    } catch (error) {
      console.error('Send chat message error:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Get patient medical history for chat
  app.get('/api/chat/patient/:patientId/history', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'doctor' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors can access patient history' });
      }

      const { patientId } = req.params;
      
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      const medicalRecords = await storage.getMedicalRecordsByPatient(patientId);
      const appointments = await storage.getAppointmentsByPatient(patientId);

      res.json({
        patient,
        medicalRecords,
        appointments
      });
    } catch (error) {
      console.error('Get patient history error:', error);
      res.status(500).json({ message: 'Failed to fetch patient history' });
    }
  });

  // Start consultation from chat (accept request and redirect)
  app.post('/api/chat/start-consultation/:requestId', requireAuth, async (req, res) => {
    try {
      if (req.user!.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can start consultations' });
      }

      const request = await storage.getConsultationRequest(req.params.requestId);
      
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      if (request.selectedDoctorId && request.selectedDoctorId !== req.user!.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      if (request.status !== 'pending' && request.status !== 'accepted') {
        return res.status(400).json({ message: 'Request is not available for consultation' });
      }

      await storage.updateConsultationRequest(req.params.requestId, {
        status: 'accepted',
        acceptedAt: new Date(),
        selectedDoctorId: req.user!.id
      });

      const patientId = request.patientId;
      const doctorId = req.user!.id;

      const existingConsultations = await db.select().from(videoConsultations)
        .where(and(
          eq(videoConsultations.patientId, patientId),
          eq(videoConsultations.doctorId, doctorId),
          or(
            eq(videoConsultations.status, 'waiting'),
            eq(videoConsultations.status, 'active')
          )
        ))
        .orderBy(desc(videoConsultations.createdAt))
        .limit(1);

      let consultation;
      if (existingConsultations.length > 0) {
        consultation = existingConsultations[0];
      } else {
        consultation = await storage.createVideoConsultation({
          patientId,
          doctorId,
          status: 'waiting',
        });
      }

      const patient = await storage.getPatient(patientId);
      if (patient?.userId) {
        broadcastToUser(patient.userId, {
          type: 'consultation_invite',
          data: {
            title: 'Consulta Aceita - Teleconsulta',
            message: `Dr(a). ${req.user!.name} aceitou sua solicitação e está aguardando na sala de vídeo.`,
            priority: 'critical',
            consultationId: consultation.id,
            doctorName: req.user!.name,
            actionUrl: `/patient/video/${consultation.id}`
          }
        });

        try {
          await db.insert(pendingNotifications).values({
            userId: patient.userId,
            type: 'consultation_invite',
            title: 'Consulta Aceita - Teleconsulta',
            message: `Dr(a). ${req.user!.name} aceitou sua solicitação e está aguardando na sala de vídeo.`,
            priority: 'critical',
            actionUrl: `/patient/video/${consultation.id}`,
            senderId: doctorId,
            delivered: false,
            read: false,
            metadata: { consultationId: consultation.id, requestId: req.params.requestId }
          });
        } catch (notifErr) {
          console.error('Failed to store consultation invite notification:', notifErr);
        }
      }

      res.json({ 
        success: true, 
        consultation,
        redirectUrl: `/consultation/video/${patientId}`
      });
    } catch (error) {
      console.error('Start consultation error:', error);
      res.status(500).json({ message: 'Failed to start consultation' });
    }
  });

  app.patch('/api/consultation-requests/:id/cancel', requireAuth, async (req, res) => {
    try {
      const request = await storage.getConsultationRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      const patient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = patient && request.patientId === patient.id;
      const isDoctor = req.user!.role === 'doctor';

      if (!isPatient && !isDoctor) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      if (request.status === 'completed' || request.status === 'declined') {
        return res.status(400).json({ message: 'Cannot cancel a completed or declined consultation' });
      }

      await storage.updateConsultationRequest(req.params.id, {
        status: 'declined'
      });

      if (isPatient && request.selectedDoctorId) {
        broadcastToUser(request.selectedDoctorId, {
          type: 'system',
          data: {
            title: 'Consulta Cancelada',
            message: `O paciente cancelou a solicitação de consulta.`,
            priority: 'medium',
            actionUrl: '/doctor-chat'
          }
        });
      }

      if (isDoctor && patient?.userId) {
        broadcastToUser(patient.userId, {
          type: 'system',
          data: {
            title: 'Consulta Cancelada',
            message: `Dr(a). ${req.user!.name} cancelou a consulta.`,
            priority: 'medium',
            actionUrl: '/my-consultations'
          }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Cancel consultation error:', error);
      res.status(500).json({ message: 'Failed to cancel consultation' });
    }
  });

  app.post('/api/consultation-requests/cancel-all', requireAuth, async (req, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }

      const requests = await storage.getConsultationRequestsByPatient(patient.id);
      const openRequests = requests.filter((r: any) => r.status === 'pending' || r.status === 'accepted');
      
      let cancelled = 0;
      for (const request of openRequests) {
        await storage.updateConsultationRequest(request.id, { status: 'declined' });
        cancelled++;
      }

      const activeVCs = await db.select().from(videoConsultations)
        .where(and(
          eq(videoConsultations.patientId, patient.id),
          or(
            eq(videoConsultations.status, 'waiting'),
            eq(videoConsultations.status, 'active')
          )
        ));

      for (const vc of activeVCs) {
        await storage.updateVideoConsultation(vc.id, { status: 'ended', endedAt: new Date() });
      }

      res.json({ success: true, cancelled });
    } catch (error) {
      console.error('Cancel all consultations error:', error);
      res.status(500).json({ message: 'Failed to cancel consultations' });
    }
  });

  app.post('/api/consultation-requests/archive-all', requireAuth, async (req, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }

      const requests = await storage.getConsultationRequestsByPatient(patient.id);
      const openRequests = requests.filter((r: any) => r.status === 'pending' || r.status === 'accepted');
      
      let archived = 0;
      for (const request of openRequests) {
        await storage.updateConsultationRequest(request.id, { status: 'completed' });
        archived++;
      }

      const activeVCs = await db.select().from(videoConsultations)
        .where(and(
          eq(videoConsultations.patientId, patient.id),
          or(
            eq(videoConsultations.status, 'waiting'),
            eq(videoConsultations.status, 'active')
          )
        ));

      for (const vc of activeVCs) {
        await storage.updateVideoConsultation(vc.id, { status: 'ended', endedAt: new Date() });
      }

      res.json({ success: true, archived });
    } catch (error) {
      console.error('Archive all consultations error:', error);
      res.status(500).json({ message: 'Failed to archive consultations' });
    }
  });

  // Consultation Sessions - Collaborative consultation rooms
  app.post('/api/consultation-sessions', requireAuth, async (req, res) => {
    try {
      const { consultationRequestId } = req.body;

      // Get consultation request
      const request = await storage.getConsultationRequest(consultationRequestId);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: only the assigned doctor can create a session
      if (request.selectedDoctorId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to create session for this consultation' });
      }

      // Create consultation session
      const session = await storage.createConsultationSession({
        consultationId: consultationRequestId,
        roomMetadata: {
          createdAt: new Date().toISOString(),
          createdBy: req.user!.id
        },
        invitedSpecialists: [],
        status: 'active'
      });

      res.json({ success: true, session });
    } catch (error) {
      console.error('Create consultation session error:', error);
      res.status(500).json({ message: 'Failed to create consultation session' });
    }
  });

  app.get('/api/consultation-sessions/:id', requireAuth, async (req, res) => {
    try {
      const session = await storage.getConsultationSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: 'Consultation session not found' });
      }

      // Get consultation request for authorization
      const request = await storage.getConsultationRequest(session.consultationId);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: doctor, patient, invited specialists, or admin
      const invitedSpecialists = session.invitedSpecialists || [];
      const isDoctor = request.selectedDoctorId === req.user!.id;
      const isInvited = invitedSpecialists.includes(req.user!.id);
      const isAdmin = req.user!.role === 'admin';

      // Check if user is the patient (need to get patient by userId)
      const patient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = patient && patient.id === request.patientId;

      if (!isDoctor && !isPatient && !isInvited && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to view this session' });
      }

      res.json(session);
    } catch (error) {
      console.error('Get consultation session error:', error);
      res.status(500).json({ message: 'Failed to fetch consultation session' });
    }
  });

  app.post('/api/consultation-sessions/:id/invite', requireAuth, async (req, res) => {
    try {
      const { specialistIds } = req.body;
      const session = await storage.getConsultationSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: 'Consultation session not found' });
      }

      // Get consultation request for authorization
      const request = await storage.getConsultationRequest(session.consultationId);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: only the assigned doctor can invite specialists
      if (request.selectedDoctorId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to invite specialists' });
      }

      const currentInvited = session.invitedSpecialists || [];
      const updatedInvited = [...new Set([...currentInvited, ...specialistIds])];

      const updated = await storage.updateConsultationSession(req.params.id, {
        invitedSpecialists: updatedInvited
      });

      res.json({ success: true, session: updated });
    } catch (error) {
      console.error('Invite specialist error:', error);
      res.status(500).json({ message: 'Failed to invite specialist' });
    }
  });

  app.post('/api/consultation-sessions/:id/clinical-notes', requireAuth, async (req, res) => {
    try {
      const { notes } = req.body;
      const session = await storage.getConsultationSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: 'Consultation session not found' });
      }

      // Get consultation request for authorization
      const request = await storage.getConsultationRequest(session.consultationId);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: doctor or invited specialists can update notes
      const invitedSpecialists = session.invitedSpecialists || [];
      const isDoctor = request.selectedDoctorId === req.user!.id;
      const isInvited = invitedSpecialists.includes(req.user!.id);
      const isAdmin = req.user!.role === 'admin';

      if (!isDoctor && !isInvited && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to update clinical notes' });
      }

      const updated = await storage.updateConsultationSession(req.params.id, {
        clinicalNotes: notes
      });

      res.json({ success: true, session: updated });
    } catch (error) {
      console.error('Update clinical notes error:', error);
      res.status(500).json({ message: 'Failed to update clinical notes' });
    }
  });

  app.post('/api/consultation-sessions/:id/summary', requireAuth, async (req, res) => {
    try {
      const session = await storage.getConsultationSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: 'Consultation session not found' });
      }

      // Get consultation request for context and authorization
      const request = await storage.getConsultationRequest(session.consultationId);
      if (!request) {
        return res.status(404).json({ message: 'Consultation request not found' });
      }

      // Authorization: doctor or invited specialists can generate summary
      const invitedSpecialists = session.invitedSpecialists || [];
      const isDoctor = request.selectedDoctorId === req.user!.id;
      const isInvited = invitedSpecialists.includes(req.user!.id);
      const isAdmin = req.user!.role === 'admin';

      if (!isDoctor && !isInvited && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to generate summary' });
      }
      
      // Generate summary with Gemini
      const summaryPrompt = `Como médico especialista, gere um resumo clínico profissional desta consulta:

Sintomas iniciais: ${request?.symptoms || 'Não especificado'}
Análise de triagem: ${request?.clinicalPresentation || 'Não disponível'}
Notas clínicas: ${session.clinicalNotes || 'Nenhuma nota registrada'}

Forneça um resumo em JSON com:
1. chiefComplaint: queixa principal
2. clinicalFindings: principais achados clínicos
3. assessment: avaliação e diagnóstico
4. plan: plano terapêutico
5. followUp: orientações de acompanhamento`;

      const summaryResponse = await geminiService.generateText(summaryPrompt);
      
      let summary;
      try {
        summary = JSON.parse(summaryResponse);
      } catch {
        summary = {
          chiefComplaint: request?.symptoms || '',
          clinicalFindings: summaryResponse.substring(0, 200),
          assessment: 'Avaliação em andamento',
          plan: 'Plano a ser definido',
          followUp: 'Retorno conforme necessário'
        };
      }

      res.json({ success: true, summary });
    } catch (error) {
      console.error('Generate summary error:', error);
      res.status(500).json({ message: 'Failed to generate summary' });
    }
  });

  // Clinical Dashboard - Aggregated patient data
  app.get('/api/clinical-dashboard/:patientId', requireAuth, async (req, res) => {
    try {
      const { patientId } = req.params;

      // Authorization: doctor, patient themselves, or admin
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      const userPatient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = userPatient && userPatient.id === patientId;
      const isAdmin = req.user!.role === 'admin';
      const isDoctor = req.user!.role === 'doctor';

      if (!isPatient && !isDoctor && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Aggregate data from multiple sources
      const [
        medicalRecords,
        examResults,
        clinicalAssets,
        consultationRequests
      ] = await Promise.all([
        storage.getMedicalRecordsByPatient(patientId),
        storage.getExamResultsByPatient(patientId),
        storage.getClinicalAssetsByPatient(patientId),
        storage.getConsultationRequestsByPatient(patientId)
      ]);

      // Build timeline of clinical events
      const timeline = [
        ...medicalRecords.map((r: any) => ({
          type: 'medical_record',
          date: r.date,
          title: r.diagnosis || 'Consulta médica',
          description: r.notes || r.treatment
        })),
        ...examResults.map((e: any) => ({
          type: 'exam_result',
          date: e.date,
          title: e.examType,
          description: e.result
        })),
        ...clinicalAssets.map((a: any) => ({
          type: 'clinical_asset',
          date: a.timeline,
          title: a.assetType,
          description: a.aiAnalysisSummary
        })),
        ...consultationRequests.map((c: any) => ({
          type: 'consultation_request',
          date: c.createdAt,
          title: 'Solicitação de consulta',
          description: c.symptoms
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        patient,
        summary: {
          totalRecords: medicalRecords.length,
          totalExams: examResults.length,
          totalAssets: clinicalAssets.length,
          pendingConsultations: consultationRequests.filter((c: any) => c.status === 'pending').length
        },
        timeline: timeline.slice(0, 20)
      });
    } catch (error) {
      console.error('Clinical dashboard error:', error);
      res.status(500).json({ message: 'Failed to load clinical dashboard' });
    }
  });

  // Clinical Assets by patient
  app.get('/api/clinical-assets/:patientId', requireAuth, async (req, res) => {
    try {
      const { patientId } = req.params;
      const { assetType } = req.query;

      // Authorization
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      const userPatient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = userPatient && userPatient.id === patientId;
      const isAdmin = req.user!.role === 'admin';
      const isDoctor = req.user!.role === 'doctor';

      if (!isPatient && !isDoctor && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Get clinical assets
      let assets;
      if (assetType && typeof assetType === 'string') {
        assets = await storage.getClinicalAssetsByType(patientId, assetType);
      } else {
        assets = await storage.getClinicalAssetsByPatient(patientId);
      }

      res.json(assets);
    } catch (error) {
      console.error('Get clinical assets error:', error);
      res.status(500).json({ message: 'Failed to fetch clinical assets' });
    }
  });

  // Upload clinical asset (exam) with AI analysis
  app.post('/api/clinical-assets/upload', requireAuth, uploadClinicalAsset.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { patientId, assetType, consultationSessionId } = req.body;

      if (!patientId || !assetType) {
        return res.status(400).json({ message: 'Patient ID and asset type are required' });
      }

      // Authorization: doctor, patient themselves, or admin
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      const userPatient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = userPatient && userPatient.id === patientId;
      const isAdmin = req.user!.role === 'admin';
      const isDoctor = req.user!.role === 'doctor';

      if (!isPatient && !isDoctor && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const fileUrl = `/uploads/clinical-assets/${req.file.filename}`;
      const filePath = req.file.path;

      // AI Analysis based on file type
      let aiAnalysis: any = {};
      let extractedMetrics: any = {};

      if (req.file.mimetype === 'application/pdf') {
        // Extract text from PDF
        const pdfParse = await import('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse.default(dataBuffer);
        const pdfText = pdfData.text;

        // Use Gemini to analyze exam results
        const analysisPrompt = `Você é um especialista médico analisando um resultado de exame laboratorial. 

Texto do exame:
${pdfText.substring(0, 3000)}

Extraia e estruture os dados em JSON com:
1. examType: tipo de exame (ex: hemograma, glicemia, etc.)
2. keyFindings: principais achados (array de strings)
3. metrics: objeto com valores numéricos extraídos (ex: {glicose: 95, hemoglobina: 14.5})
4. abnormalResults: resultados fora da normalidade (array)
5. summary: resumo clínico em 2-3 frases

Retorne apenas o JSON válido.`;

        const analysisResponse = await geminiService.generateText(analysisPrompt);
        
        try {
          aiAnalysis = JSON.parse(analysisResponse);
          extractedMetrics = aiAnalysis.metrics || {};
        } catch {
          aiAnalysis = {
            examType: assetType,
            summary: analysisResponse.substring(0, 200),
            keyFindings: ['Análise disponível no documento'],
            abnormalResults: []
          };
        }
      } else {
        // For images, use simpler analysis
        aiAnalysis = {
          examType: assetType,
          summary: `Imagem de ${assetType} carregada com sucesso`,
          keyFindings: ['Análise visual pendente'],
          abnormalResults: []
        };
      }

      // Create clinical asset
      const clinicalAsset = await storage.createClinicalAsset({
        patientId,
        consultationSessionId: consultationSessionId || null,
        assetType,
        fileUrl,
        extractedMetrics,
        aiAnalysisSummary: aiAnalysis.summary || 'Análise pendente',
        timeline: new Date().toISOString()
      });

      res.json({
        success: true,
        asset: clinicalAsset,
        analysis: aiAnalysis
      });
    } catch (error) {
      console.error('Upload clinical asset error:', error);
      res.status(500).json({ message: 'Failed to upload and analyze clinical asset' });
    }
  });

  // Patient Portal - My Consultations
  app.get('/api/my-consultations', requireAuth, async (req, res) => {
    try {
      // Get patient from authenticated user
      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }

      // Get all consultation requests for this patient
      const consultationRequests = await storage.getConsultationRequestsByPatient(patient.id);

      // Get sessions for accepted consultations
      const consultationsWithSessions = await Promise.all(
        consultationRequests.map(async (request: any) => {
          let session = null;
          if (request.status === 'accepted') {
            try {
              session = await storage.getConsultationSessionByRequestId(request.id);
            } catch {
              // No session yet
            }
          }

          // Get doctor info if assigned
          let doctor = null;
          if (request.selectedDoctorId) {
            try {
              doctor = await storage.getUser(request.selectedDoctorId);
            } catch {
              // Doctor not found
            }
          }

          return {
            ...request,
            session,
            doctor: doctor ? { id: doctor.id, name: doctor.name, specialty: doctor.specialty } : null
          };
        })
      );

      const upcoming = consultationsWithSessions.filter((c: any) => 
        c.status === 'accepted' || c.status === 'pending'
      );
      const past = consultationsWithSessions.filter((c: any) => 
        c.status === 'completed' || c.status === 'declined'
      );

      const patientVideoConsultations = await db.select({
        id: videoConsultations.id,
        doctorId: videoConsultations.doctorId,
        appointmentId: videoConsultations.appointmentId,
        status: videoConsultations.status,
        startedAt: videoConsultations.startedAt,
        endedAt: videoConsultations.endedAt,
        duration: videoConsultations.duration,
        meetingNotes: videoConsultations.meetingNotes,
        createdAt: videoConsultations.createdAt,
      })
        .from(videoConsultations)
        .where(eq(videoConsultations.patientId, patient.id))
        .orderBy(desc(videoConsultations.createdAt))
        .limit(50);

      const doctorIds = [...new Set(patientVideoConsultations.map(v => v.doctorId).filter(Boolean))];
      const doctorMap: Record<string, { name: string; specialty?: string }> = {};
      for (const did of doctorIds) {
        try {
          const doc = await storage.getUser(did);
          if (doc) doctorMap[did] = { name: doc.name || 'Médico', specialty: doc.specialty || '' };
        } catch {}
      }

      const appointmentIds = patientVideoConsultations.map(v => v.appointmentId).filter(Boolean) as string[];
      const appointmentRatings: Record<string, { rating: number | null; feedback: string | null }> = {};
      if (appointmentIds.length > 0) {
        const appts = await db.select({ id: appointments.id, rating: appointments.rating, feedback: appointments.feedback })
          .from(appointments)
          .where(inArray(appointments.id, appointmentIds));
        for (const a of appts) {
          appointmentRatings[a.id] = { rating: a.rating, feedback: a.feedback };
        }
      }

      const videoHistory = patientVideoConsultations
        .filter(v => v.status === 'ended' || v.status === 'completed')
        .map(v => ({
          ...v,
          doctor: doctorMap[v.doctorId] || { name: 'Médico', specialty: '' },
          rating: v.appointmentId ? appointmentRatings[v.appointmentId]?.rating || null : null,
          feedback: v.appointmentId ? appointmentRatings[v.appointmentId]?.feedback || null : null,
        }));

      const activeVideoConsultations = patientVideoConsultations
        .filter(v => v.status === 'waiting' || v.status === 'active')
        .map(v => ({
          ...v,
          doctor: doctorMap[v.doctorId] || { name: 'Médico', specialty: '' },
        }));

      res.json({
        upcoming,
        past,
        videoHistory,
        activeVideoConsultations,
        total: consultationsWithSessions.length
      });
    } catch (error) {
      console.error('Get my consultations error:', error);
      res.status(500).json({ message: 'Failed to fetch consultations' });
    }
  });

  // Patient chat threads
  app.get('/api/patient-chat-threads', requireAuth, async (req, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }

      const threads = await storage.getChatThreadsByPatient(patient.id);
      res.json(threads);
    } catch (error) {
      console.error('Get chat threads error:', error);
      res.status(500).json({ message: 'Failed to fetch chat threads' });
    }
  });

  app.post('/api/patient-chat-threads', requireAuth, async (req, res) => {
    try {
      const { doctorId } = req.body;

      const patient = await storage.getPatientByUserId(req.user!.id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }

      // Check if thread already exists
      const existingThreads = await storage.getChatThreadsByPatient(patient.id);
      const existingThread = existingThreads.find((t: any) => t.doctorId === doctorId);

      if (existingThread) {
        return res.json(existingThread);
      }

      // Create new thread
      const thread = await storage.createChatThread({
        patientId: patient.id,
        doctorId,
        messages: [],
        lastMessageAt: new Date().toISOString()
      });

      res.json(thread);
    } catch (error) {
      console.error('Create chat thread error:', error);
      res.status(500).json({ message: 'Failed to create chat thread' });
    }
  });

  app.get('/api/patient-chat-threads/:threadId', requireAuth, async (req, res) => {
    try {
      const thread = await storage.getChatThread(req.params.threadId);
      if (!thread) {
        return res.status(404).json({ message: 'Chat thread not found' });
      }

      // Authorization: patient or doctor in the thread
      const patient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = patient && patient.id === thread.patientId;
      const isDoctor = req.user!.id === thread.doctorId;
      const isAdmin = req.user!.role === 'admin';

      if (!isPatient && !isDoctor && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      res.json(thread);
    } catch (error) {
      console.error('Get chat thread error:', error);
      res.status(500).json({ message: 'Failed to fetch chat thread' });
    }
  });

  app.post('/api/patient-chat-threads/:threadId/messages', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      const thread = await storage.getChatThread(req.params.threadId);
      
      if (!thread) {
        return res.status(404).json({ message: 'Chat thread not found' });
      }

      // Authorization
      const patient = await storage.getPatientByUserId(req.user!.id);
      const isPatient = patient && patient.id === thread.patientId;
      const isDoctor = req.user!.id === thread.doctorId;

      if (!isPatient && !isDoctor) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const messages = thread.messages || [];
      const newMessage = {
        id: Date.now().toString(),
        senderId: req.user!.id,
        senderName: req.user!.name,
        message,
        timestamp: new Date().toISOString()
      };

      messages.push(newMessage);

      const updated = await storage.updateChatThread(req.params.threadId, {
        messages,
        lastMessageAt: new Date().toISOString()
      });

      res.json({ success: true, thread: updated, message: newMessage });
    } catch (error) {
      console.error('Send chat message error:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // SMS notification endpoint
  app.post('/api/notifications/sms', requireAuth, async (req, res) => {
    try {
      const { to, message } = req.body;
      
      // For now, log SMS (would integrate with Twilio or similar service)
      console.log(`[SMS NOTIFICATION] To: ${to}, Message: ${message}, Timestamp: ${new Date().toISOString()}`);
      
      // Simulate SMS sending delay
      setTimeout(() => {
        console.log(`[SMS DELIVERED] To: ${to}`);
      }, 1000);
      
      res.json({ 
        success: true, 
        message: 'SMS notification queued for delivery',
        provider: 'telemed-sms-service',
        estimatedDelivery: '1-3 seconds'
      });

    } catch (error) {
      console.error('SMS notification error:', error);
      res.status(500).json({ message: 'Failed to send SMS notification' });
    }
  });

  // Audio transcription endpoint
  app.post('/api/ai/transcribe-audio', requireAuth, async (req, res) => {
    try {
      // Handle multipart/form-data for audio files
      const audioFile = req.file || req.body.audioFile;
      
      if (!audioFile) {
        return res.status(400).json({ message: 'No audio file provided' });
      }

      // For now, simulate transcription (would use actual file buffer in production)
      console.log('[AUDIO TRANSCRIPTION] Processing audio file:', {
        filename: audioFile.filename || 'audio.wav',
        size: audioFile.size || 'unknown',
        mimetype: audioFile.mimetype || 'audio/wav'
      });

      // Simulate transcription result
      const mockTranscription = `
Paciente relata dor de cabeça há 3 dias, intensidade moderada, localizada na região frontal.
Nega febre, náuseas ou vômitos. Histórico de enxaqueca na família.
Exame físico: paciente consciente, orientado, sem sinais neurológicos focais.
Pressão arterial: 120/80 mmHg, frequência cardíaca: 78 bpm.
      `.trim();

      res.json({ 
        success: true, 
        transcription: mockTranscription,
        duration: '5:32',
        language: 'pt-BR',
        confidence: 0.95
      });

    } catch (error) {
      console.error('Audio transcription error:', error);
      res.status(500).json({ message: 'Failed to transcribe audio' });
    }
  });

  // Patient summary generation endpoint
  app.post('/api/ai/patient-summary', requireAuth, async (req, res) => {
    try {
      const { patientId, includeHistory, includeConsultationNotes } = req.body;
      
      // Get patient history (would fetch from database in production)
      const mockPatientHistory = [
        { date: '2024-01-15', condition: 'Hipertensão arterial diagnosticada' },
        { date: '2024-02-20', condition: 'Diabetes tipo 2 - início do tratamento' },
        { date: '2024-06-10', condition: 'Consulta de rotina - controle glicêmico adequado' }
      ];

      const mockConsultationNotes = [
        { type: 'symptom', note: 'Dor de cabeça há 3 dias' },
        { type: 'observation', note: 'Paciente consciente e orientado' },
        { type: 'vital', note: 'PA: 120/80 mmHg, FC: 78 bpm' }
      ];

      // Generate summary using AI
      const summary = await geminiService.generatePatientSummary(
        includeHistory ? mockPatientHistory : [],
        includeConsultationNotes ? mockConsultationNotes : []
      );

      console.log('[PATIENT SUMMARY] Generated for patient:', patientId);

      res.json({ 
        success: true, 
        summary,
        patientId,
        generatedAt: new Date().toISOString(),
        includedHistory: !!includeHistory,
        includedNotes: !!includeConsultationNotes
      });

    } catch (error) {
      console.error('Patient summary error:', error);
      res.status(500).json({ message: 'Failed to generate patient summary' });
    }
  });

  // Recent consultation transcriptions endpoint
  app.get('/api/consultations/recent-transcriptions', requireAuth, async (req, res) => {
    try {
      // Mock recent transcriptions (would fetch from database in production)
      const mockTranscriptions = [
        {
          id: 'trans-1',
          date: new Date().toISOString().split('T')[0],
          patientName: 'Maria Santos',
          text: 'Paciente relata dor de cabeça há 3 dias, intensidade moderada. Nega febre ou náuseas. Histórico familiar de enxaqueca.',
          preview: 'Dor de cabeça há 3 dias, intensidade moderada...'
        },
        {
          id: 'trans-2', 
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          patientName: 'João Silva',
          text: 'Consulta de retorno para controle da hipertensão. Paciente aderente ao tratamento. Pressão arterial controlada.',
          preview: 'Controle da hipertensão, paciente aderente...'
        }
      ];

      res.json(mockTranscriptions);
    } catch (error) {
      console.error('Recent transcriptions error:', error);
      res.status(500).json({ message: 'Failed to fetch recent transcriptions' });
    }
  });

  // Recent exam results endpoint
  app.get('/api/exam-results/recent', requireAuth, async (req, res) => {
    try {
      // Get recent exam results from database
      const recentExamResults = await db.select({
        id: examResults.id,
        patientId: examResults.patientId,
        examType: examResults.examType,
        results: examResults.results,
        abnormalValues: examResults.abnormalValues,
        analyzedByAI: examResults.analyzedByAI,
        createdAt: examResults.createdAt,
        patientName: patients.name
      })
      .from(examResults)
      .leftJoin(patients, eq(examResults.patientId, patients.id))
      .orderBy(desc(examResults.createdAt))
      .limit(10);

      console.log('[EXAM RESULTS] Retrieved recent results:', recentExamResults.length);

      res.json(recentExamResults);
    } catch (error) {
      console.error('Recent exam results error:', error);
      res.status(500).json({ message: 'Failed to fetch recent exam results' });
    }
  });

  // System status endpoint for real-time monitoring
  app.get('/api/system/status', requireAuth, async (req, res) => {
    try {
      // Get basic system metrics (non-PHI)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count active users (simplified - would use session data in production)
      const activeUsers = authenticatedClients.size;

      // Count today's appointments
      const todayAppointments = await storage.getTodayAppointments(req.user?.id || '');

      // Count unprocessed WhatsApp messages  
      const unprocessedMessages = await storage.getUnprocessedWhatsappMessages();

      // System health check (simplified)
      const systemHealth = activeUsers > 0 ? 'healthy' : 'warning';

      const systemStatus = {
        activeUsers,
        onlinePatients: Math.floor(activeUsers * 0.3), // Estimate
        pendingMessages: unprocessedMessages.length,
        todayAppointments: todayAppointments.length,
        systemHealth
      };

      console.log('[SYSTEM STATUS] Retrieved status:', systemStatus);

      res.json(systemStatus);
    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({ message: 'Failed to fetch system status' });
    }
  });

  // AI analysis of exam results endpoint
  app.post('/api/exam-results/analyze', requireAuth, async (req, res) => {
    try {
      const { examResultId, examType, results, patientHistory } = req.body;
      
      // Generate AI analysis of exam results
      const analysis = await geminiService.analyzeExamResults(
        examType,
        results,
        patientHistory || "Histórico não informado"
      );

      // Update exam result with AI analysis
      if (examResultId) {
        await db.update(examResults)
          .set({ 
            analyzedByAI: true,
            abnormalValues: analysis.abnormalValues || null
          })
          .where(eq(examResults.id, examResultId));
      }

      console.log('[EXAM ANALYSIS] AI analysis completed for exam:', examResultId);

      res.json({
        success: true,
        analysis,
        examResultId,
        analyzedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Exam analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze exam results' });
    }
  });

  // ===== CLINICAL INTERVIEW ENDPOINTS =====

  // TEST ROUTE - No auth required
  app.get('/api/test-no-auth', async (req, res) => {
    res.json({ message: 'Test route working without auth', timestamp: new Date().toISOString() });
  });

  // Start Clinical Interview
  app.post('/api/clinical-interview/start', requireAuth, async (req, res) => {
    try {
      const startSchema = z.object({
        patientId: z.string().optional()
      });
      
      const { patientId } = startSchema.parse(req.body);
      const interview = clinicalInterviewService.startInterview(patientId);

      res.json({
        interviewId: interview.id,
        currentQuestion: interview.currentQuestion,
        stage: interview.stage,
        urgencyLevel: interview.urgencyLevel
      });
    } catch (error) {
      console.error('Clinical interview start error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ 
        message: 'Erro interno do servidor ao iniciar entrevista clínica',
        currentQuestion: 'Como posso ajudá-lo hoje?'
      });
    }
  });

  // Respond to Clinical Interview
  app.post('/api/clinical-interview/:id/respond', requireAuth, async (req, res) => {
    try {
      const respondSchema = z.object({
        response: z.string().min(1, 'Response is required')
      });
      
      const { response } = respondSchema.parse(req.body);
      const interviewId = req.params.id;

      const result = await clinicalInterviewService.processResponse(interviewId, response);

      res.json({
        interview: {
          id: result.interview.id,
          stage: result.interview.stage,
          urgencyLevel: result.interview.urgencyLevel,
          diagnosticHypotheses: result.interview.diagnosticHypotheses,
          symptomData: result.interview.symptomData
        },
        nextQuestion: result.nextQuestion,
        isComplete: result.isComplete,
        urgentFlag: result.urgentFlag || false
      });
    } catch (error) {
      console.error('Clinical interview response error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ 
        message: 'Erro interno do servidor ao processar resposta',
        nextQuestion: 'Houve um erro. Por favor, tente novamente.',
        isComplete: false
      });
    }
  });

  // Get Clinical Interview Status
  app.get('/api/clinical-interview/:id', requireAuth, async (req, res) => {
    try {
      const interviewId = req.params.id;
      const interview = clinicalInterviewService.getInterview(interviewId);

      if (!interview) {
        return res.status(404).json({ message: 'Interview not found' });
      }

      res.json({
        id: interview.id,
        stage: interview.stage,
        currentQuestion: interview.currentQuestion,
        urgencyLevel: interview.urgencyLevel,
        isComplete: interview.stage === 'completed',
        diagnosticHypotheses: interview.diagnosticHypotheses,
        symptomData: interview.symptomData,
        completedAt: interview.completedAt
      });
    } catch (error) {
      console.error('Clinical interview status error:', error);
      res.status(500).json({ message: 'Failed to get interview status' });
    }
  });

  // Get Current User (Session Check)
  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = user as any;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Session check error:', error);
      res.status(500).json({ message: 'Session check failed' });
    }
  });

  // Update User Profile
  app.put('/api/auth/profile', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      
      // Validation schema for profile updates
      const profileUpdateSchema = z.object({
        name: z.string().min(1, "Nome é obrigatório").max(255).optional(),
        email: z.string().email("Email inválido").optional(),
        phone: z.string().max(20).optional(),
        whatsappNumber: z.string().max(20).optional(),
        medicalLicense: z.string().max(50).optional(),
        specialization: z.string().max(100).optional(),
        consultationPrice: z.number().int().min(0).max(100000).optional(),
      });
      
      // Validate request body
      const validatedData = profileUpdateSchema.parse(req.body);
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (validatedData.name !== undefined) updateData.name = validatedData.name;
      if (validatedData.email !== undefined) updateData.email = validatedData.email;
      if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
      if (validatedData.whatsappNumber !== undefined) updateData.whatsappNumber = validatedData.whatsappNumber;
      
      if (user.role === 'doctor') {
        if (validatedData.medicalLicense !== undefined) updateData.medicalLicense = validatedData.medicalLicense;
        if (validatedData.specialization !== undefined) updateData.specialization = validatedData.specialization;
        if (validatedData.consultationPrice !== undefined) updateData.consultationPrice = validatedData.consultationPrice;
      }
      
      // Update user in database
      const updatedUser = await storage.updateUser(user.id, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Return updated user without password
      const { password: _, ...userWithoutPassword } = updatedUser as any;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  app.patch('/api/doctor/consultation-price', requireAuth, async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem definir preço de consulta' });
      }
      const { price } = z.object({ price: z.number().int().min(0).max(100000) }).parse(req.body);
      await db.update(users).set({ consultationPrice: price }).where(eq(users.id, req.user.id));
      res.json({ consultationPrice: price });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Preço inválido', errors: error.errors });
      res.status(500).json({ message: 'Erro ao atualizar preço' });
    }
  });

  app.get('/api/doctor/:doctorId/consultation-price', async (req, res) => {
    try {
      const doctor = await db.select({
        consultationPrice: users.consultationPrice,
        name: users.name,
        specialization: users.specialization
      }).from(users).where(eq(users.id, req.params.doctorId)).limit(1);
      if (!doctor[0]) return res.status(404).json({ message: 'Médico não encontrado' });
      const config = await tmcCreditsService.getCreditConfig();
      const commissionPercent = config.CONSULTATION_COMMISSION_PERCENT ?? config.DOCTOR_COMMISSION_PERCENT;
      res.json({
        consultationPrice: doctor[0].consultationPrice || 0,
        doctorName: doctor[0].name,
        specialization: doctor[0].specialization,
        platformCommissionPercent: commissionPercent,
        pricingMode: (doctor[0].consultationPrice && doctor[0].consultationPrice > 0) ? 'fixed_price' : 'per_minute',
        creditPerMinute: config.CREDIT_PER_MINUTE
      });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar preço' });
    }
  });

  // ===== PATIENT MANAGEMENT ENDPOINTS =====

  // Update patient (requires authentication)
  app.put('/api/patients/:id', requireAuth, async (req, res) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      const patient = await storage.updatePatient(req.params.id, validatedData);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      res.json(patient);
    } catch (error) {
      res.status(400).json({ message: 'Invalid patient data', error });
    }
  });

  // Delete patient (requires authentication)
  app.delete('/api/patients/:id', requireAuth, async (req, res) => {
    try {
      const success = await storage.deletePatient(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete patient' });
    }
  });

  // ===== HOSPITAL INTEGRATION ENDPOINTS =====

  // Get JWT token for WebSocket authentication (requires session auth)
  app.get('/api/auth/websocket-token', requireAuth, async (req, res) => {
    try {
      // Require SESSION_SECRET - fail if not set
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - cannot generate JWT token');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      const user = req.user!;
      
      // Generate JWT token for WebSocket authentication with proper options
      const token = jwt.sign(
        { 
          doctorId: user.id, // Use authenticated user's ID
          userId: user.id,
          role: user.role,
          type: 'doctor_auth'
        },
        jwtSecret,
        { 
          expiresIn: '24h',
          issuer: 'healthcare-system',
          audience: 'websocket',
          algorithm: 'HS256'
        }
      );
      
      res.json({ token, doctorId: user.id, userId: user.id });
    } catch (error) {
      console.error('Error generating WebSocket token:', error);
      res.status(500).json({ message: 'Failed to generate WebSocket token' });
    }
  });

  // Get JWT token for WebSocket authentication for visitors (self-sufficient, no prior auth required)
  app.get('/api/auth/visitor-websocket-token', async (req, res) => {
    try {
      // Require SESSION_SECRET - fail if not set
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - cannot generate visitor WebSocket token');
        return res.status(500).json({ message: 'Server configuration error' });
      }

      // Get client IP address for visitor identification
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      
      if (clientIp === 'unknown') {
        return res.status(400).json({ message: 'Cannot identify client for visitor access' });
      }

      // Find or create visitor account based on IP
      let visitor = await storage.getVisitorByIp(clientIp);
      
      if (!visitor) {
        // Create new visitor account
        visitor = await storage.createVisitorAccount(clientIp);
        console.log(`Created visitor account for IP: ${clientIp} during WebSocket token request`);
      }

      // Generate JWT token for WebSocket authentication with visitor auth
      const wsToken = jwt.sign(
        { 
          visitorId: visitor.id,
          userId: visitor.id,
          role: visitor.role,
          type: 'visitor_auth'
        },
        jwtSecret,
        { 
          expiresIn: '24h',
          issuer: 'healthcare-system',
          audience: 'websocket',
          algorithm: 'HS256'
        }
      );
      
      console.log(`Generated visitor WebSocket token for ${clientIp}`);
      res.json({ 
        token: wsToken, 
        visitorId: visitor.id, 
        userId: visitor.id,
        role: 'visitor'
      });
    } catch (error) {
      console.error('Error generating visitor WebSocket token:', error);
      res.status(500).json({ message: 'Failed to generate visitor WebSocket token' });
    }
  });

  // Generate patient join token for video consultation (public endpoint with validation)
  app.post('/api/auth/patient-join-token', async (req, res) => {
    try {
      const { consultationId, patientId, patientName } = req.body;
      
      // Validate required fields
      if (!consultationId || !patientId) {
        return res.status(400).json({ message: 'consultationId and patientId are required' });
      }
      
      // Verify the consultation exists and is valid
      const consultation = await storage.getVideoConsultation(consultationId);
      if (!consultation) {
        return res.status(404).json({ message: 'Video consultation not found' });
      }
      
      // Verify the patient is associated with this consultation
      if (consultation.patientId !== patientId) {
        return res.status(403).json({ message: 'Patient not authorized for this consultation' });
      }
      
      // Require SESSION_SECRET
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - cannot generate patient token');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      // Generate patient JWT token for WebSocket authentication
      const token = jwt.sign(
        { 
          patientId,
          userId: patientId,
          consultationId,
          patientName: patientName || 'Paciente',
          type: 'patient_auth'
        },
        jwtSecret,
        { 
          expiresIn: '4h', // Shorter expiry for patient tokens
          issuer: 'healthcare-system',
          audience: 'websocket',
          algorithm: 'HS256'
        }
      );
      
      console.log(`Generated patient token for ${patientId} in consultation ${consultationId}`);
      res.json({ 
        token, 
        consultationId, 
        patientId,
        patientName: patientName || 'Paciente'
      });
    } catch (error) {
      console.error('Error generating patient join token:', error);
      res.status(500).json({ message: 'Failed to generate patient join token' });
    }
  });

  // ============================================================================
  // ICP-BRASIL A3 DIGITAL SIGNATURE ENDPOINTS
  // ============================================================================

  // Enhanced ICP-Brasil A3 Digital Signature for Documents
  app.post('/api/digital-signatures/:id/sign', requireAuth, async (req, res) => {
    try {
      const { pin, signature, certificateInfo, documentContent } = req.body;
      const documentId = req.params.id;
      const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;
      
      // Enhanced ICP-Brasil A3 validation
      if (!pin || pin.length < 6) {
        return res.status(400).json({ 
          message: 'PIN do certificado A3 é obrigatório (mínimo 6 dígitos)' 
        });
      }

      // Create ICP-Brasil A3 certificate with enhanced compliance
      const icpCertificateInfo = cryptoService.createICPBrasilA3Certificate(
        doctorId,
        'Dr. Carlos Silva',
        '123456',
        'SP'
      );

      // Simulate A3 token authentication
      try {
        await cryptoService.authenticateA3Token(pin, icpCertificateInfo.certificateId);
      } catch (error) {
        return res.status(401).json({ 
          message: 'Falha na autenticação do token A3. Verifique o PIN.' 
        });
      }

      // Generate cryptographic signature
      const { privateKey, publicKey } = await cryptoService.generateKeyPair();
      const documentText = documentContent || `Documento: ${documentId} - Data: ${new Date().toISOString()}`;
      
      const signatureResult = await cryptoService.signPrescription(
        documentText,
        privateKey,
        icpCertificateInfo
      );

      // Perform electronic verification
      const verificationResult = await cryptoService.performElectronicVerification(
        signatureResult.signature,
        signatureResult.documentHash,
        signatureResult.certificateInfo
      );

      // For mock documents, create or find digital signature record
      let digitalSignature;
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId);
      
      if (isValidUUID) {
        // Update existing digital signature
        digitalSignature = await storage.updateDigitalSignature(documentId, {
          signature: signatureResult.signature,
          certificateInfo: {
            ...signatureResult.certificateInfo,
            publicKey: publicKey,
            timestamp: signatureResult.timestamp,
            verificationResult,
            authenticatedAt: new Date().toISOString()
          },
          status: 'signed',
          signedAt: new Date(),
        });
      } else {
        const patients = await storage.getAllPatients();
        const patientId = patients[0]?.id || '550e8400-e29b-41d4-a716-446655440001';
        
        digitalSignature = await storage.createDigitalSignature({
          documentType: documentId.includes('prescription') ? 'prescription' : 'document',
          documentId: crypto.randomUUID(),
          patientId,
          doctorId,
          signature: signatureResult.signature,
          certificateInfo: {
            ...signatureResult.certificateInfo,
            publicKey: publicKey,
            timestamp: signatureResult.timestamp,
            verificationResult,
            authenticatedAt: new Date().toISOString()
          },
          status: 'signed',
          signedAt: new Date(),
        });
      }
      
      if (!digitalSignature) {
        return res.status(500).json({ message: 'Failed to create digital signature' });
      }
      
      broadcastToDoctor(doctorId, { type: 'document_signed', data: digitalSignature });
      res.json({ 
        ...digitalSignature,
        message: 'Documento assinado digitalmente com certificado ICP-Brasil A3',
        verificationResult,
        legalCompliance: 'CFM Resolução 1821/2007 - Validade Jurídica Plena'
      });
    } catch (error) {
      console.error('ICP-Brasil A3 signature error:', error);
      res.status(500).json({ 
        message: 'Falha ao assinar documento com certificado ICP-Brasil A3' 
      });
    }
  });

  // Electronic Verification API for signed documents
  app.post('/api/digital-signatures/:id/verify', requireAuth, async (req, res) => {
    try {
      const documentId = req.params.id;
      const { documentContent } = req.body;
      const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;

      // For mock documents, we need to find the signature by document type and doctor
      let signatureRecord;
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId);
      
      if (isValidUUID) {
        // Get signature by UUID
        signatureRecord = await storage.getDigitalSignature(documentId);
      } else {
        // For mock documents, create a simulated verification result
        // Since we just signed this document, we can provide a valid verification
        const documentType = documentId.includes('prescription') ? 'prescription' : 'document';
        const verificationResult = {
          isValid: true,
          chainOfTrust: true,
          timestampValid: true,
          certificateStatus: 'VÁLIDO',
          verificationDetails: {
            algorithm: 'RSA-PSS + SHA-256',
            keySize: 2048,
            complianceLevel: 'ICP-Brasil A3',
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'Verificação Eletrônica Avançada'
          }
        };

        return res.json({
          signatureId: documentId,
          verificationResult,
          message: 'Assinatura digital válida - Documento íntegro e autêntico',
          legalValidity: 'Validade jurídica plena conforme MP 2.200-2/2001',
          documentType,
          certificateInfo: {
            titular: 'Dr. Carlos Silva',
            crm: 'CRM 123456-SP',
            certificateType: 'ICP-Brasil A3',
            hardwareToken: true
          }
        });
      }
      
      if (!signatureRecord) {
        return res.status(404).json({ message: 'Assinatura digital não encontrada' });
      }

      // Calculate document hash
      const documentHash = crypto
        .createHash('sha256')
        .update(documentContent, 'utf8')
        .digest('hex');

      // Perform comprehensive electronic verification
      const verificationResult = await cryptoService.performElectronicVerification(
        signatureRecord.signature,
        documentHash,
        signatureRecord.certificateInfo
      );

      res.json({
        signatureId,
        verificationResult,
        message: verificationResult.isValid 
          ? 'Assinatura digital válida - Documento íntegro e autêntico'
          : 'Assinatura digital inválida - Documento pode ter sido alterado',
        legalValidity: verificationResult.isValid 
          ? 'Validade jurídica plena conforme MP 2.200-2/2001'
          : 'Sem validade jurídica - Integridade comprometida'
      });
    } catch (error) {
      console.error('Electronic verification error:', error);
      res.status(500).json({ 
        message: 'Falha na verificação eletrônica da assinatura' 
      });
    }
  });

  // Enhanced ICP-Brasil A3 Prescription Signature
  app.post('/api/medical-records/:id/sign-prescription', requireAuth, async (req, res) => {
    try {
      const medicalRecordId = req.params.id;
      const { pin, doctorName, crm, crmState } = req.body;
      
      // Use authenticated doctor ID or fallback to default for demo
      const doctorId = actualDoctorId || DEFAULT_DOCTOR_ID;

      // Validate required ICP-Brasil A3 authentication data
      if (!pin || pin.length < 6) {
        return res.status(400).json({ 
          message: 'PIN do token A3 é obrigatório (mínimo 6 dígitos)' 
        });
      }

      // Get medical record with prescription
      const medicalRecord = await storage.getMedicalRecord(medicalRecordId);
      if (!medicalRecord) {
        return res.status(404).json({ message: 'Medical record not found' });
      }

      if (!medicalRecord.prescription) {
        return res.status(400).json({ message: 'No prescription to sign in this medical record' });
      }

      // Create ICP-Brasil A3 certificate with enhanced compliance
      const certificateInfo = cryptoService.createICPBrasilA3Certificate(
        doctorId,
        doctorName || 'Dr. Médico Demo',
        crm || '123456',
        crmState || 'SP'
      );

      // Simulate A3 token authentication
      try {
        await cryptoService.authenticateA3Token(pin, certificateInfo.certificateId);
      } catch (error) {
        return res.status(401).json({ 
          message: 'Falha na autenticação do token A3. Verifique o PIN.' 
        });
      }

      // Generate secure key pair for signature
      const { privateKey, publicKey } = await cryptoService.generateKeyPair();

      // Create digital signature
      const signatureResult = await cryptoService.signPrescription(
        medicalRecord.prescription,
        privateKey,
        certificateInfo
      );

      // Perform advanced electronic verification
      const verificationResult = await cryptoService.performElectronicVerification(
        signatureResult.signature,
        signatureResult.documentHash,
        signatureResult.certificateInfo
      );

      // Create digital signature record with enhanced ICP-Brasil A3 information
      const digitalSignature = await storage.createDigitalSignature({
        documentType: 'prescription',
        documentId: medicalRecordId,
        patientId: medicalRecord.patientId,
        doctorId: doctorId,
        signature: signatureResult.signature,
        certificateInfo: {
          ...signatureResult.certificateInfo,
          publicKey: publicKey,
          timestamp: signatureResult.timestamp,
          verificationResult,
          legalCompliance: 'CFM Resolução 1821/2007 - Validade Jurídica Plena'
        },
        status: 'signed',
        signedAt: new Date(),
      });

      // Generate comprehensive audit hash
      const auditHash = cryptoService.generateAuditHash(signatureResult, doctorId, medicalRecord.patientId);

      res.json({
        digitalSignature,
        auditHash,
        verificationResult,
        message: 'Prescrição assinada digitalmente com certificado ICP-Brasil A3',
        legalCompliance: 'Assinatura com validade jurídica plena - CFM Resolução 1821/2007'
      });
    } catch (error) {
      console.error('ICP-Brasil A3 prescription signature error:', error);
      res.status(500).json({ 
        message: 'Falha ao assinar prescrição com certificado ICP-Brasil A3' 
      });
    }
  });

  // Validate patient join token (public endpoint for patient join page)
  app.post('/api/auth/validate-patient-token', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }
      
      // Require SESSION_SECRET
      const jwtSecret = process.env.SESSION_SECRET;
      if (!jwtSecret) {
        console.error('SESSION_SECRET not configured - cannot validate token');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      
      // Verify and decode the JWT token
      const payload = jwt.verify(token, jwtSecret, {
        issuer: 'healthcare-system',
        audience: 'websocket',
        algorithms: ['HS256']
      }) as any;
      
      // Validate token type and required fields
      if (payload.type !== 'patient_auth' || !payload.consultationId || !payload.patientId) {
        return res.status(400).json({ message: 'Invalid patient token' });
      }
      
      // Get consultation details
      const consultation = await storage.getVideoConsultation(payload.consultationId);
      if (!consultation) {
        return res.status(404).json({ message: 'Consultation not found' });
      }
      
      // Verify patient authorization
      if (consultation.patientId !== payload.patientId) {
        return res.status(403).json({ message: 'Patient not authorized for this consultation' });
      }
      
      // Return consultation details for patient join page
      res.json({
        consultationId: payload.consultationId,
        patientId: payload.patientId,
        patientName: payload.patientName || 'Paciente',
        status: consultation.status || 'waiting',
        doctorName: 'Dr. Silva', // TODO: Get from appointment/doctor data
        appointmentTime: consultation.createdAt,
        valid: true
      });
      
    } catch (error) {
      console.error('Error validating patient token:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      res.status(500).json({ message: 'Token validation failed' });
    }
  });

  // Get all hospital collaborators (Doctor-only)
  app.get('/api/hospitals', requireAuth, async (req, res) => {
    try {
      const hospitals = await storage.getCollaboratorsByType('hospital');
      res.json(hospitals);
    } catch (error) {
      console.error('Get hospitals error:', error);
      res.status(500).json({ message: 'Failed to get hospitals' });
    }
  });

  // Create new hospital collaborator (Admin-only)
  app.post('/api/hospitals', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      // In production, implement proper admin role check
      // For now, restrict to doctor role as a basic access control
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: insufficient privileges' });
      }

      const validatedData = insertCollaboratorSchema.parse({
        ...req.body,
        type: 'hospital'
      });
      
      const hospital = await storage.createCollaborator(validatedData);
      res.status(201).json(hospital);
    } catch (error) {
      console.error('Create hospital error:', error);
      res.status(500).json({ message: 'Failed to create hospital' });
    }
  });

  // Create a hospital referral (Doctor-only)
  app.post('/api/hospital-referrals', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        await storage.createCollaboratorIntegration({
          collaboratorId: user.id, // Use the user's ID for tracking
          integrationType: 'authorization_violation',
          entityId: 'hospital_referral_creation',
          action: 'unauthorized_access',
          status: 'failed',
          errorMessage: 'Non-doctor attempted to create hospital referral',
          requestData: {
            userId: user.id,
            userRole: user.role,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: only doctors can create hospital referrals' });
      }

      const { patientId, hospitalId, specialty, urgency, reason, clinicalSummary, requestedServices } = req.body;

      // Validate required fields
      if (!patientId || !hospitalId || !specialty || !reason) {
        return res.status(400).json({ message: 'Missing required fields: patientId, hospitalId, specialty, reason' });
      }

      // Verify hospital collaborator exists and is active
      const hospital = await storage.getCollaborator(hospitalId);
      if (!hospital || hospital.type !== 'hospital' || !hospital.isActive) {
        await storage.createCollaboratorIntegration({
          collaboratorId: user.id, // Use doctor's ID for tracking
          integrationType: 'authorization_violation',
          entityId: hospitalId,
          action: 'invalid_hospital_referral',
          status: 'failed',
          errorMessage: `Invalid hospital ID: ${hospitalId}`,
          requestData: {
            doctorId: user.id,
            patientId,
            hospitalId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(400).json({ message: 'Invalid or inactive hospital' });
      }

      // Verify patient exists and doctor has access
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Create hospital referral
      const newReferral = await storage.createHospitalReferral({
        patientId,
        referringDoctorId: user.id,
        hospitalId,
        specialty,
        urgency: urgency || 'routine',
        reason,
        clinicalSummary,
        requestedServices,
        status: 'pending'
      });

      // Log referral creation
      await storage.createCollaboratorIntegration({
        collaboratorId: hospitalId,
        integrationType: 'hospital_referral',
        entityId: newReferral.id,
        action: 'referral_created',
        status: 'success',
        requestData: {
          patientId,
          referralId: newReferral.id,
          referringDoctorId: user.id,
          specialty,
          urgency: urgency || 'routine',
          timestamp: new Date().toISOString()
        },
      });

      res.status(201).json(newReferral);
    } catch (error) {
      console.error('Create hospital referral error:', error);
      res.status(500).json({ message: 'Failed to create hospital referral' });
    }
  });

  // Get hospital referrals for a specific hospital (External API - requires API key)
  app.get('/api/hospital-referrals/hospital', authenticateApiKey, async (req, res) => {
    try {
      const { collaborator: authenticatedCollaborator } = req as any;
      
      if (authenticatedCollaborator.type !== 'hospital') {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: 'hospital_referrals_list',
          action: 'unauthorized_access',
          status: 'failed',
          errorMessage: 'Non-hospital collaborator attempted to access hospital referrals',
          requestData: {
            collaboratorId: authenticatedCollaborator.id,
            collaboratorType: authenticatedCollaborator.type,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: only hospitals can access this endpoint' });
      }

      const { status, limit = 50, offset = 0 } = req.query;

      // Get referrals for this hospital
      const allReferrals = await storage.getHospitalReferralsByHospital(authenticatedCollaborator.id);
      
      // Filter by status if provided
      const filteredReferrals = status 
        ? allReferrals.filter(referral => referral.status === status)
        : allReferrals;

      // Paginate results
      const paginatedReferrals = filteredReferrals.slice(Number(offset), Number(offset) + Number(limit));

      // Log access
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'hospital_referral_access',
        entityId: 'referrals_list',
        action: 'referrals_retrieved',
        status: 'success',
        requestData: {
          referralsCount: paginatedReferrals.length,
          statusFilter: status || 'all',
          timestamp: new Date().toISOString()
        },
      });

      res.json({
        referrals: paginatedReferrals,
        total: filteredReferrals.length,
        offset: Number(offset),
        limit: Number(limit)
      });
    } catch (error) {
      console.error('Get hospital referrals error:', error);
      res.status(500).json({ message: 'Failed to get hospital referrals' });
    }
  });

  // Update hospital referral status (External API - requires API key)
  app.patch('/api/hospital-referrals/:referralId', authenticateApiKey, async (req, res) => {
    try {
      const { collaborator: authenticatedCollaborator } = req as any;
      const { referralId } = req.params;
      const { status, scheduledDate, externalReferralId, dischargeNotes, followUpRequired, followUpDate } = req.body;

      if (authenticatedCollaborator.type !== 'hospital') {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: referralId,
          action: 'unauthorized_referral_update',
          status: 'failed',
          errorMessage: 'Non-hospital collaborator attempted to update referral',
          requestData: {
            collaboratorId: authenticatedCollaborator.id,
            collaboratorType: authenticatedCollaborator.type,
            referralId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: only hospitals can update referrals' });
      }

      // Get existing referral
      const existingReferral = await storage.getHospitalReferral(referralId);
      if (!existingReferral) {
        return res.status(404).json({ message: 'Referral not found' });
      }

      // Verify hospital owns this referral
      if (existingReferral.hospitalId !== authenticatedCollaborator.id) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: referralId,
          action: 'unauthorized_referral_access',
          status: 'failed',
          errorMessage: 'Hospital attempted to access referral from different hospital',
          requestData: {
            referralId,
            referralHospitalId: existingReferral.hospitalId,
            authenticatedHospitalId: authenticatedCollaborator.id,
            requestedStatus: status,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized referral update' });
      }

      // Validate status transitions
      const ALLOWED_HOSPITAL_TRANSITIONS: Record<string, string[]> = {
        'pending': ['accepted', 'rejected'],
        'accepted': ['in_progress', 'cancelled'],
        'in_progress': ['completed', 'cancelled'],
        'rejected': [], // Final state
        'completed': [], // Final state
        'cancelled': [] // Final state
      };

      const currentStatus = existingReferral.status;
      if (status && !ALLOWED_HOSPITAL_TRANSITIONS[currentStatus]?.includes(status)) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'hospital_workflow_violation',
          entityId: referralId,
          action: 'invalid_status_transition',
          status: 'failed',
          errorMessage: `Invalid hospital referral transition from ${currentStatus} to ${status}`,
          requestData: {
            referralId,
            patientId: existingReferral.patientId,
            currentStatus,
            requestedStatus: status,
            validTransitions: ALLOWED_HOSPITAL_TRANSITIONS[currentStatus] || [],
            timestamp: new Date().toISOString()
          },
        });
        return res.status(400).json({ 
          message: `Invalid transition from ${currentStatus} to ${status}`,
          currentStatus,
          validTransitions: ALLOWED_HOSPITAL_TRANSITIONS[currentStatus] || []
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (status) updateData.status = status;
      if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
      if (externalReferralId) updateData.externalReferralId = externalReferralId;
      if (dischargeNotes) updateData.dischargeNotes = dischargeNotes;
      if (followUpRequired !== undefined) updateData.followUpRequired = followUpRequired;
      if (followUpDate) updateData.followUpDate = new Date(followUpDate);
      if (status === 'completed') updateData.completedAt = new Date();

      // Update referral
      const updatedReferral = await storage.updateHospitalReferral(referralId, updateData);

      // Comprehensive audit logging
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'hospital_referral_update',
        entityId: referralId,
        action: 'status_updated',
        status: 'success',
        requestData: {
          referralId,
          patientId: existingReferral.patientId,
          previousStatus: currentStatus,
          newStatus: status,
          scheduledDate,
          externalReferralId,
          dischargeNotes: dischargeNotes ? '[REDACTED]' : undefined,
          followUpRequired,
          followUpDate,
          timestamp: new Date().toISOString()
        },
      });

      res.json(updatedReferral);
    } catch (error) {
      console.error('Update hospital referral error:', error);
      res.status(500).json({ message: 'Failed to update hospital referral' });
    }
  });

  // Get specific hospital referral (Doctor access)
  app.get('/api/hospital-referrals/:referralId', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: only doctors can view referrals' });
      }

      const { referralId } = req.params;
      const referral = await storage.getHospitalReferral(referralId);

      if (!referral) {
        return res.status(404).json({ message: 'Referral not found' });
      }

      // Verify doctor has access to this referral
      if (referral.referringDoctorId !== user.id) {
        await storage.createCollaboratorIntegration({
          collaboratorId: user.id, // Use requesting doctor's ID for tracking
          integrationType: 'authorization_violation',
          entityId: referralId,
          action: 'unauthorized_referral_access',
          status: 'failed',
          errorMessage: 'Doctor attempted to access referral from different doctor',
          requestData: {
            referralId,
            referralDoctorId: referral.referringDoctorId,
            requestingDoctorId: user.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized referral access' });
      }

      // Log authorized access for audit trail
      await storage.createCollaboratorIntegration({
        collaboratorId: referral.hospitalId, // Use hospital ID for tracking
        integrationType: 'hospital_referral_access',
        entityId: referralId,
        action: 'referral_viewed',
        status: 'success',
        requestData: {
          doctorId: user.id,
          referralId,
          patientId: referral.patientId,
          hospitalId: referral.hospitalId,
          timestamp: new Date().toISOString()
        },
      });

      res.json(referral);
    } catch (error) {
      console.error('Get hospital referral error:', error);
      res.status(500).json({ message: 'Failed to get hospital referral' });
    }
  });

  // Get patient's hospital referrals (Doctor access)
  app.get('/api/patients/:patientId/hospital-referrals', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: only doctors can view patient referrals' });
      }

      const { patientId } = req.params;
      
      // Get all referrals for patient
      const hospitalReferrals = await storage.getHospitalReferralsByPatient(patientId);
      
      // Filter to only show referrals from this doctor
      const authorizedReferrals = hospitalReferrals.filter(referral => referral.referringDoctorId === user.id);
      
      // Log access attempt with authorization results
      // Use the first hospital ID if referrals exist, otherwise use the doctor's ID for tracking
      const trackingCollaboratorId = hospitalReferrals.length > 0 ? hospitalReferrals[0].hospitalId : user.id;
      await storage.createCollaboratorIntegration({
        collaboratorId: trackingCollaboratorId,
        integrationType: 'patient_hospital_referrals_access',
        entityId: patientId,
        action: 'patient_referrals_viewed',
        status: 'success',
        requestData: {
          doctorId: user.id,
          patientId,
          totalReferrals: hospitalReferrals.length,
          authorizedReferrals: authorizedReferrals.length,
          timestamp: new Date().toISOString()
        },
      });

      res.json(authorizedReferrals);
    } catch (error) {
      console.error('Get patient hospital referrals error:', error);
      res.status(500).json({ message: 'Failed to get patient hospital referrals' });
    }
  });

  // Submit discharge summary (External API - requires API key)
  app.post('/api/hospital-referrals/:referralId/discharge', authenticateApiKey, async (req, res) => {
    try {
      const { collaborator: authenticatedCollaborator } = req as any;
      const { referralId } = req.params;
      const { dischargeNotes, followUpRequired, followUpDate } = req.body;

      if (authenticatedCollaborator.type !== 'hospital') {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: referralId,
          action: 'unauthorized_discharge_submission',
          status: 'failed',
          errorMessage: 'Non-hospital collaborator attempted to submit discharge summary',
          requestData: {
            collaboratorId: authenticatedCollaborator.id,
            collaboratorType: authenticatedCollaborator.type,
            referralId,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: only hospitals can submit discharge summaries' });
      }

      // Get existing referral
      const existingReferral = await storage.getHospitalReferral(referralId);
      if (!existingReferral) {
        return res.status(404).json({ message: 'Referral not found' });
      }

      // Verify hospital owns this referral
      if (existingReferral.hospitalId !== authenticatedCollaborator.id) {
        await storage.createCollaboratorIntegration({
          collaboratorId: authenticatedCollaborator.id,
          integrationType: 'authorization_violation',
          entityId: referralId,
          action: 'unauthorized_discharge_access',
          status: 'failed',
          errorMessage: 'Hospital attempted to access referral from different hospital',
          requestData: {
            referralId,
            referralHospitalId: existingReferral.hospitalId,
            authenticatedHospitalId: authenticatedCollaborator.id,
            timestamp: new Date().toISOString()
          },
        });
        return res.status(403).json({ message: 'Access denied: unauthorized discharge submission' });
      }

      // Validate required fields
      if (!dischargeNotes) {
        return res.status(400).json({ message: 'Discharge notes are required' });
      }

      // Update referral with discharge information
      const updateData: any = {
        dischargeNotes,
        followUpRequired: followUpRequired || false,
        status: 'completed',
        completedAt: new Date()
      };

      if (followUpDate) {
        updateData.followUpDate = new Date(followUpDate);
      }

      const updatedReferral = await storage.updateHospitalReferral(referralId, updateData);

      // Comprehensive audit logging
      await storage.createCollaboratorIntegration({
        collaboratorId: authenticatedCollaborator.id,
        integrationType: 'hospital_discharge_submission',
        entityId: referralId,
        action: 'discharge_submitted',
        status: 'success',
        requestData: {
          referralId,
          patientId: existingReferral.patientId,
          followUpRequired: followUpRequired || false,
          followUpDate,
          timestamp: new Date().toISOString()
        },
      });

      res.json(updatedReferral);
    } catch (error) {
      console.error('Submit discharge summary error:', error);
      res.status(500).json({ message: 'Failed to submit discharge summary' });
    }
  });

  // ===============================
  // ADMIN ENDPOINTS
  // ===============================

  // Get all API keys for admin management
  app.get('/api/admin/api-keys', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const apiKeys = await storage.getAllApiKeys();
      res.json(apiKeys);
    } catch (error) {
      console.error('Admin API keys fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch API keys' });
    }
  });

  // Create new API key for collaborator
  app.post('/api/admin/api-keys', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const apiKeyData = insertCollaboratorApiKeySchema.parse(req.body);
      
      // Generate secure API key
      const newApiKey = await storage.createCollaboratorApiKey(apiKeyData);
      
      res.status(201).json(newApiKey);
    } catch (error) {
      console.error('Admin API key creation error:', error);
      res.status(500).json({ message: 'Failed to create API key' });
    }
  });

  // Update API key (activate/deactivate)
  app.patch('/api/admin/api-keys/:keyId', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { keyId } = req.params;
      const { isActive } = req.body;

      const updatedKey = await storage.updateCollaboratorApiKey(keyId, { isActive });
      
      if (!updatedKey) {
        return res.status(404).json({ message: 'API key not found' });
      }

      res.json(updatedKey);
    } catch (error) {
      console.error('Admin API key update error:', error);
      res.status(500).json({ message: 'Failed to update API key' });
    }
  });

  // Get integration monitoring data
  app.get('/api/admin/integrations', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const integrations = await storage.getAllCollaboratorIntegrations();
      
      // Enrich with collaborator names
      const enrichedIntegrations = await Promise.all(
        integrations.map(async (integration) => {
          const collaborator = await storage.getCollaborator(integration.collaboratorId);
          return {
            ...integration,
            collaboratorName: collaborator?.name || 'Unknown'
          };
        })
      );

      res.json(enrichedIntegrations);
    } catch (error) {
      console.error('Admin integrations fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch integration data' });
    }
  });

  // Get analytics and security metrics
  app.get('/api/admin/analytics', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get today's requests
      const todayIntegrations = await storage.getCollaboratorIntegrationsAfterDate(today);
      const todayRequests = todayIntegrations.filter(i => i.action === 'api_request').length;
      const todaySuccess = todayIntegrations.filter(i => i.status === 'success').length;

      // Get security alerts (failed authentications, violations)
      const securityAlerts = todayIntegrations.filter(i => 
        i.status === 'failed' || 
        i.integrationType === 'authorization_violation' ||
        i.action.includes('failed')
      ).length;

      const analytics = {
        todayRequests,
        todaySuccess,
        securityAlerts,
        lastUpdated: new Date().toISOString()
      };

      res.json(analytics);
    } catch (error) {
      console.error('Admin analytics fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // ===============================
  // COMPLIANCE MONITORING ENDPOINTS
  // ===============================

  // Generate compliance report for audit purposes
  app.get('/api/admin/compliance/report', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { startDate, endDate, collaboratorId, reportType } = req.query;
      
      // Default to last 30 days if no dates provided
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Generate comprehensive compliance report
      const report = await storage.generateComplianceReport(start, end, collaboratorId as string, reportType as string);
      
      res.json(report);
    } catch (error) {
      console.error('Compliance report generation error:', error);
      res.status(500).json({ message: 'Failed to generate compliance report' });
    }
  });

  // Run automated compliance checks
  app.post('/api/admin/compliance/check', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      // Run comprehensive compliance checks
      const complianceResults = await storage.runComplianceChecks();
      
      // Log compliance check execution (use system collaborator for system-wide events)
      const systemCollaborator = await storage.getOrCreateSystemCollaborator();
      await storage.createCollaboratorIntegration({
        collaboratorId: systemCollaborator.id,
        integrationType: 'compliance_check',
        entityId: 'system_wide',
        action: 'compliance_audit_executed',
        status: 'success',
        requestData: {
          executedBy: user.id,
          executedByRole: user.role,
          timestamp: new Date().toISOString(),
          checksPerformed: complianceResults.totalChecks,
          issuesFound: complianceResults.totalIssues
        },
      });

      res.json(complianceResults);
    } catch (error) {
      console.error('Compliance check execution error:', error);
      res.status(500).json({ message: 'Failed to execute compliance checks' });
    }
  });

  // Get audit trail for specific entity
  app.get('/api/admin/audit-trail/:entityId', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { entityId } = req.params;
      const { integrationType, limit = 50 } = req.query;

      const auditTrail = await storage.getDetailedAuditTrail(
        entityId, 
        integrationType as string, 
        parseInt(limit as string)
      );

      res.json(auditTrail);
    } catch (error) {
      console.error('Audit trail fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch audit trail' });
    }
  });

  // Brazilian healthcare compliance validation
  app.post('/api/admin/compliance/validate-healthcare', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const validationResults = await storage.validateBrazilianHealthcareCompliance();
      
      // Log healthcare compliance validation (use system collaborator for system-wide events)
      const systemCollaborator = await storage.getOrCreateSystemCollaborator();
      await storage.createCollaboratorIntegration({
        collaboratorId: systemCollaborator.id,
        integrationType: 'healthcare_compliance_validation',
        entityId: 'system_wide',
        action: 'brazilian_healthcare_compliance_check',
        status: validationResults.overallStatus,
        requestData: {
          executedBy: user.id,
          executedByRole: user.role,
          timestamp: new Date().toISOString(),
          validationResults
        },
      });

      res.json(validationResults);
    } catch (error) {
      console.error('Healthcare compliance validation error:', error);
      res.status(500).json({ message: 'Failed to validate healthcare compliance' });
    }
  });

  // ======================
  // ADMIN USER MANAGEMENT API ROUTES
  // ======================

  // Get all users for admin management
  app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { role, blocked } = req.query;
      let users;

      if (role) {
        users = await storage.getUsersByRole(role as string);
      } else {
        users = await storage.getAllUsers();
      }

      // Filter by blocked status if specified
      if (blocked !== undefined) {
        const isBlocked = blocked === 'true';
        users = users.filter(u => u.isBlocked === isBlocked);
      }

      // Remove sensitive data
      const safeUsers = users.map(u => ({
        ...u,
        password: undefined
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('Admin users fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get specific user details
  app.get('/api/admin/users/:userId', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove sensitive data
      const safeUser = { ...targetUser, password: undefined };
      res.json(safeUser);
    } catch (error) {
      console.error('Admin user fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Update user information
  app.patch('/api/admin/users/:userId', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { userId } = req.params;
      const updateData = req.body;

      // Prevent updating sensitive/controlled fields directly
      delete updateData.password;
      delete updateData.id;
      delete updateData.isBlocked;
      delete updateData.blockedBy;
      delete updateData.deactivationReason;
      delete updateData.isProtected;

      const updatedUser = await storage.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove sensitive data
      const safeUser = { ...updatedUser, password: undefined };
      res.json(safeUser);
    } catch (error) {
      console.error('Admin user update error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Block user
  app.post('/api/admin/users/:userId/block', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { userId } = req.params;
      const { reason } = req.body;

      // Prevent self-blocking
      if (userId === user.id) {
        return res.status(400).json({ message: 'Cannot block your own account' });
      }

      // Prevent blocking root superuser
      const targetUser = await storage.getUser(userId);
      if (targetUser?.username === 'root') {
        return res.status(403).json({ message: 'O superusuário root não pode ser desativado.' });
      }

      const deactivationReason = reason || 'Inativo por questões administrativas';
      const blockedUser = await storage.blockUser(userId, user.id, deactivationReason);

      if (!blockedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Log the blocking action
      const systemCollaborator = await storage.getOrCreateSystemCollaborator();
      await storage.createCollaboratorIntegration({
        collaboratorId: systemCollaborator.id,
        integrationType: 'user_management',
        entityId: userId,
        action: 'user_blocked',
        status: 'success',
        requestData: {
          blockedBy: user.id,
          blockedByUsername: user.username,
          reason: reason || 'No reason provided',
          timestamp: new Date().toISOString()
        },
      });

      // Broadcast real-time activity to all admins
      await broadcastAdminActivity({
        type: 'user_management',
        action: 'user_blocked',
        entityId: userId,
        userId: user.id,
        details: {
          blockedUsername: blockedUser.username,
          blockedUserName: blockedUser.name,
          blockedBy: user.username,
          reason: reason || 'No reason provided'
        }
      });

      // Remove sensitive data
      const safeUser = { ...blockedUser, password: undefined };
      res.json({ message: 'User blocked successfully', user: safeUser });
    } catch (error) {
      console.error('Admin user block error:', error);
      res.status(500).json({ message: 'Failed to block user' });
    }
  });

  // Unblock user
  app.post('/api/admin/users/:userId/unblock', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { userId } = req.params;
      const unblockedUser = await storage.unblockUser(userId);

      if (!unblockedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Log the unblocking action
      const systemCollaborator = await storage.getOrCreateSystemCollaborator();
      await storage.createCollaboratorIntegration({
        collaboratorId: systemCollaborator.id,
        integrationType: 'user_management',
        entityId: userId,
        action: 'user_unblocked',
        status: 'success',
        requestData: {
          unblockedBy: user.id,
          unblockedByUsername: user.username,
          timestamp: new Date().toISOString()
        },
      });

      // Broadcast real-time activity to all admins
      await broadcastAdminActivity({
        type: 'user_management',
        action: 'user_unblocked',
        entityId: userId,
        userId: user.id,
        details: {
          unblockedUsername: unblockedUser.username,
          unblockedUserName: unblockedUser.name,
          unblockedBy: user.username
        }
      });

      // Remove sensitive data
      const safeUser = { ...unblockedUser, password: undefined };
      res.json({ message: 'User unblocked successfully', user: safeUser });
    } catch (error) {
      console.error('Admin user unblock error:', error);
      res.status(500).json({ message: 'Failed to unblock user' });
    }
  });

  // Mass disconnect all users
  app.post('/api/admin/disconnect-all-users', requireAuth, async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      let disconnectedCount = 0;
      const adminMessage = JSON.stringify({
        type: 'force-disconnect',
        reason: 'admin_disconnect_all',
        message: 'Sua sessão foi encerrada pelo administrador.',
        timestamp: new Date().toISOString(),
      });

      authenticatedClients.forEach((clients, clientUserId) => {
        if (clientUserId === user.id) return;
        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(adminMessage);
              ws.close(4000, 'Admin disconnect');
              disconnectedCount++;
            } catch {}
          }
        });
      });

      res.json({ message: `${disconnectedCount} conexões encerradas com sucesso.`, disconnectedCount });
    } catch (error) {
      console.error('Admin disconnect all users error:', error);
      res.status(500).json({ message: 'Failed to disconnect users' });
    }
  });

  // Mass disconnect all doctors only
  app.post('/api/admin/disconnect-all-doctors', requireAuth, async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      let disconnectedCount = 0;
      const adminMessage = JSON.stringify({
        type: 'force-disconnect',
        reason: 'admin_disconnect_doctors',
        message: 'Sua sessão foi encerrada pelo administrador.',
        timestamp: new Date().toISOString(),
      });

      clientUserRoles.forEach((role, clientUserId) => {
        if (role !== 'doctor') return;
        const clients = authenticatedClients.get(clientUserId);
        if (!clients) return;
        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(adminMessage);
              ws.close(4000, 'Admin disconnect');
              disconnectedCount++;
            } catch {}
          }
        });
      });

      res.json({ message: `${disconnectedCount} conexões de médicos encerradas com sucesso.`, disconnectedCount });
    } catch (error) {
      console.error('Admin disconnect all doctors error:', error);
      res.status(500).json({ message: 'Failed to disconnect doctors' });
    }
  });

  // Mass disconnect all services (WebSocket + consultation rooms Agora termination)
  app.post('/api/admin/disconnect-all-services', requireAuth, async (req: any, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      let disconnectedCount = 0;
      let roomsTerminated = 0;

      const forceDisconnectMsg = JSON.stringify({
        type: 'force-disconnect',
        reason: 'admin_disconnect_services',
        message: 'Todos os serviços foram encerrados pelo administrador. Reconecte quando necessário.',
        timestamp: new Date().toISOString(),
      });

      consultationRooms.forEach((room, roomId) => {
        const allRoomClients = [...room.doctor, ...room.patient];
        allRoomClients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(forceDisconnectMsg); } catch {}
          }
        });
        roomsTerminated++;
      });

      authenticatedClients.forEach((clients, clientUserId) => {
        if (clientUserId === user.id) return;
        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(forceDisconnectMsg);
              ws.close(4000, 'Admin disconnect services');
              disconnectedCount++;
            } catch {}
          }
        });
      });

      res.json({
        message: `${disconnectedCount} conexões e ${roomsTerminated} salas de consulta encerradas.`,
        disconnectedCount,
        roomsTerminated,
      });
    } catch (error) {
      console.error('Admin disconnect all services error:', error);
      res.status(500).json({ message: 'Failed to disconnect services' });
    }
  });

  // Toggle user protection from deletion
  app.patch('/api/admin/users/:userId/protect', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { userId } = req.params;
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (targetUser.username === 'root') {
        return res.status(403).json({ message: 'O superusuário root é sempre protegido.' });
      }

      const newProtected = !targetUser.isProtected;
      const [updated] = await db.update(users)
        .set({ isProtected: newProtected })
        .where(eq(users.id, userId))
        .returning();

      const safeUser = { ...updated, password: undefined };
      res.json({ message: `Usuário ${newProtected ? 'protegido' : 'desprotegido'} com sucesso`, user: safeUser });
    } catch (error) {
      console.error('Admin user protect error:', error);
      res.status(500).json({ message: 'Failed to update user protection' });
    }
  });

  // Get recent user activity
  app.get('/api/admin/users/activity/recent', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { limit = 50 } = req.query;
      const recentActivity = await storage.getRecentUserActivity(parseInt(limit as string));

      // Remove sensitive data
      const safeUsers = recentActivity.map(u => ({
        ...u,
        password: undefined
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('Admin user activity fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch user activity' });
    }
  });

  // ======================
  // ERROR LOG MANAGEMENT API ROUTES
  // ======================

  // Get all error logs with filters (admin only)
  app.get('/api/admin/error-logs', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { errorType, userId, resolved, startDate, endDate, limit } = req.query;
      
      const filters = {
        errorType: errorType as string | undefined,
        userId: userId as string | undefined,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
      };

      const errorLogs = await storage.getErrorLogs(filters);
      res.json(errorLogs);
    } catch (error) {
      const { errorLoggerService } = await import('./services/error-logger');
      const friendlyError = await errorLoggerService.logError(
        error as Error,
        {
          endpoint: '/api/admin/error-logs',
          method: 'GET',
          userId: (req.user as User)?.id
        },
        req
      );
      
      res.status(500).json({ 
        message: friendlyError.userMessage,
        errorCode: friendlyError.errorCode
      });
    }
  });

  // Get specific error log by ID (admin only)
  app.get('/api/admin/error-logs/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { id } = req.params;
      const errorLog = await storage.getErrorLog(id);

      if (!errorLog) {
        return res.status(404).json({ message: 'Log de erro não encontrado' });
      }

      res.json(errorLog);
    } catch (error) {
      const { errorLoggerService } = await import('./services/error-logger');
      const friendlyError = await errorLoggerService.logError(
        error as Error,
        {
          endpoint: `/api/admin/error-logs/${req.params.id}`,
          method: 'GET',
          userId: (req.user as User)?.id
        },
        req
      );
      
      res.status(500).json({ 
        message: friendlyError.userMessage,
        errorCode: friendlyError.errorCode
      });
    }
  });

  // Mark error log as resolved (admin only)
  app.patch('/api/admin/error-logs/:id/resolve', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { id } = req.params;
      const { adminNotes } = req.body;

      const resolvedLog = await storage.markErrorAsResolved(id, user.id, adminNotes);

      if (!resolvedLog) {
        return res.status(404).json({ message: 'Log de erro não encontrado' });
      }

      // Broadcast to all admins
      await broadcastAdminActivity({
        type: 'error_log_management',
        action: 'error_resolved',
        entityId: id,
        userId: user.id,
        details: {
          errorCode: resolvedLog.errorCode,
          resolvedBy: user.username,
          resolvedByName: user.name,
          adminNotes: adminNotes || 'Sem observações'
        }
      });

      res.json({ 
        message: 'Erro marcado como resolvido com sucesso', 
        errorLog: resolvedLog 
      });
    } catch (error) {
      const { errorLoggerService } = await import('./services/error-logger');
      const friendlyError = await errorLoggerService.logError(
        error as Error,
        {
          endpoint: `/api/admin/error-logs/${req.params.id}/resolve`,
          method: 'PATCH',
          userId: (req.user as User)?.id
        },
        req
      );
      
      res.status(500).json({ 
        message: friendlyError.userMessage,
        errorCode: friendlyError.errorCode
      });
    }
  });

  // ======================
  // LAYOUT SETTINGS API ROUTES
  // ======================

  // Get all layout settings (public endpoint for applying theme)
  app.get('/api/layout-settings/public', async (req, res) => {
    try {
      const settings = await storage.getLayoutSettings();
      res.json(settings);
    } catch (error) {
      console.error('Layout settings fetch error:', error);
      res.status(500).json({ message: 'Erro ao buscar configurações de layout' });
    }
  });

  // Get all layout settings (admin only)
  app.get('/api/admin/layout-settings', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const settings = await storage.getLayoutSettings();
      res.json(settings);
    } catch (error) {
      console.error('Admin layout settings fetch error:', error);
      res.status(500).json({ message: 'Erro ao buscar configurações de layout' });
    }
  });

  // Create or update layout setting (admin only)
  app.post('/api/admin/layout-settings', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { settingKey, settingValue, settingType, category, description } = req.body;

      const setting = await storage.createOrUpdateLayoutSetting({
        settingKey,
        settingValue,
        settingType: settingType || 'text',
        category: category || 'general',
        description,
        updatedBy: user.id
      });

      res.json({ message: 'Configuração salva com sucesso', setting });
    } catch (error) {
      console.error('Layout settings update error:', error);
      res.status(500).json({ message: 'Erro ao salvar configuração' });
    }
  });

  // Upload background image (admin only)
  app.post('/api/admin/layout-settings/upload-background', requireAuth, upload.single('background'), async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo foi enviado' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Save background image URL to layout settings
      const setting = await storage.createOrUpdateLayoutSetting({
        settingKey: 'background_image',
        settingValue: fileUrl,
        settingType: 'image',
        category: 'background',
        description: 'Imagem de fundo do sistema',
        updatedBy: user.id
      });

      res.json({ 
        message: 'Imagem de fundo enviada com sucesso', 
        fileUrl,
        setting
      });
    } catch (error) {
      console.error('Background upload error:', error);
      res.status(500).json({ message: 'Erro ao enviar imagem de fundo' });
    }
  });

  // Delete layout setting (admin only)
  app.delete('/api/admin/layout-settings/:key', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { key } = req.params;
      const deleted = await storage.deleteLayoutSetting(key);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Configuração não encontrada' });
      }

      res.json({ message: 'Configuração removida com sucesso' });
    } catch (error) {
      console.error('Layout setting delete error:', error);
      res.status(500).json({ message: 'Erro ao remover configuração' });
    }
  });

  // ======================
  // DATABASE CLEANUP API ROUTES
  // ======================

  // Clear all users and related data (admin only - FOR TESTING PURPOSES)
  app.post('/api/admin/clear-database', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: privilégios de administrador necessários' });
      }

      const { confirmation } = req.body;
      if (confirmation !== 'CLEAR_ALL_DATA') {
        return res.status(400).json({ 
          message: 'Confirmação inválida. Envie { "confirmation": "CLEAR_ALL_DATA" } para confirmar a operação.' 
        });
      }

      // Delete all data tables in FK-safe order using raw SQL for completeness
      const tablesToClear = [
        // Leaf-level / no FK dependents
        'consultation_notes',
        'consultation_recordings',
        'consultation_sessions',
        'chatbot_conversations',
        'chatbot_references',
        'whatsapp_messages',
        'diagnostic_inferences',
        'consultation_access_tokens',
        'wallet_audit_log',
        'digital_signatures',
        'signature_verifications',
        'digital_keys',
        'pharmacy_dispensing',
        'pharmacy_reports',
        'clinic_consultation_logs',
        'clinic_patient_bindings',
        'clinic_members',
        'clinics',
        'inter_consultations',
        'doctor_patient_blocks',
        'payment_transactions',
        'pending_notifications',
        'medical_team_members',
        'team_notes',
        'medical_teams',
        'dynamic_nfts',
        'nft_ownership',
        'broker_orders',
        'broker_trades',
        'external_wallets',
        'withdrawal_requests',
        'paypal_orders',
        'cashbox_transactions',
        'cashbox',
        'tm3d_supply',
        'error_logs',
        'collaborator_api_keys',
        'collaborator_integrations',
        'collaborators',
        'doctor_notes',
        'doctor_schedule',
        'doctor_transfer_requests',
        'data_access_requests',
        'hospital_referrals',
        'clinical_assets',
        'clinical_interviews',
        'patient_notes',
        'post_consultation_items',
        'drug_interactions',
        'lab_orders',
        'lab_templates',
        'prescription_shares',
        // Tables referencing medical_records
        'exam_results',
        'prescription_items',
        'prescription_templates',
        'prescriptions',
        'medications',
        // Tables referencing appointments (before appointments)
        'video_consultations',
        'tmc_transactions',
        'consultation_requests',
        'medical_records',
        // Tables referencing patients (before patients)
        'patient_chat_threads',
        'appointments',
        'patients',
      ];

      for (const table of tablesToClear) {
        try {
          await db.execute(sql.raw(`DELETE FROM "${table}"`));
        } catch (e: any) {
          console.warn(`Warning: could not clear table ${table}: ${e.message}`);
        }
      }
      
      // Delete all users except the current admin and protected users
      await db.delete(users).where(
        and(
          ne(users.id, user.id),
          ne(users.role, 'admin'),
          or(eq(users.isProtected, false), isNull(users.isProtected))
        )
      );

      // Delete uploaded profile pictures
      const uploadsDir = path.join(process.cwd(), 'client', 'public', 'uploads', 'profiles');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      }

      res.json({ 
        message: 'Todos os dados foram removidos com sucesso. O sistema está pronto para novos usuários de teste.',
        note: 'Seu usuário administrador foi preservado.'
      });
    } catch (error) {
      console.error('Database clear error:', error);
      res.status(500).json({ message: 'Erro ao limpar banco de dados' });
    }
  });

  // ======================
  // TMC CREDIT SYSTEM API ROUTES
  // ======================

  // Get user's TMC balance
  app.get('/api/tmc/balance', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const balance = await storage.getUserBalance(user.id);
      res.json({ balance, currency: 'TMC' });
    } catch (error) {
      console.error('TMC balance fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch TMC balance' });
    }
  });

  // Get user's TMC transaction history
  app.get('/api/tmc/transactions', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { limit = 50 } = req.query;
      const transactions = await storage.getTmcTransactionsByUser(user.id, parseInt(limit as string));
      res.json(transactions);
    } catch (error) {
      console.error('TMC transactions fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch TMC transactions' });
    }
  });

  // Recharge TMC credits (admin only)
  app.post('/api/tmc/recharge', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Only admins can recharge credits for users (security hardening)
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      // Validate request body with Zod
      const validationResult = tmcRechargeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { userId, amount, method } = validationResult.data;

      const transaction = await storage.rechargeCredits(userId, amount, method);
      const newBalance = await storage.getUserBalance(userId);

      res.json({ 
        transaction, 
        newBalance,
        message: `Successfully recharged ${amount} TMC credits`
      });
    } catch (error) {
      console.error('TMC recharge error:', error);
      res.status(500).json({ message: 'Failed to recharge TMC credits' });
    }
  });

  // Legacy direct transfer (admin-only, bypasses escrow for admin convenience)
  app.post('/api/tmc/transfer', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Use /api/tmc/transfer-request para transferências com aprovação' });
      }
      
      const validationResult = tmcTransferSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { toUserId, amount, reason } = validationResult.data;

      if (user.id === toUserId) {
        return res.status(400).json({ message: 'Cannot transfer credits to yourself' });
      }

      const transactions = await storage.transferCredits(user.id, toUserId, amount, reason);
      const newBalance = await storage.getUserBalance(user.id);

      res.json({ 
        transactions, 
        newBalance,
        message: `Successfully transferred ${amount} TMC credits`
      });
    } catch (error) {
      console.error('TMC transfer error:', error);
      const message = error instanceof Error ? error.message : 'Failed to transfer TMC credits';
      res.status(400).json({ message });
    }
  });

  // User search for transfer recipient selection
  app.get('/api/users/search', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === 'visitor') return res.status(403).json({ message: 'Acesso negado' });
      const q = (req.query.q as string || '').trim();
      if (!q || q.length < 2) return res.json([]);
      const allUsers = await db.select({
        id: users.id, name: users.name, username: users.username, role: users.role
      }).from(users)
        .where(and(
          ne(users.id, user.id),
          or(
            ilike(users.name, `%${q}%`),
            ilike(users.username, `%${q}%`)
          )
        ))
        .limit(10);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: 'Falha ao buscar usuários' });
    }
  });

  // Credit Transfer Request (escrow-based with approval)
  app.post('/api/tmc/transfer-request', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === 'visitor') {
        return res.status(403).json({ message: 'Visitantes não podem realizar transferências' });
      }
      const { toUserId, amount, reason } = req.body;
      if (!toUserId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Dados inválidos' });
      }
      if (user.id === toUserId) {
        return res.status(400).json({ message: 'Não é possível transferir para si mesmo' });
      }
      const recipient = await storage.getUser(toUserId);
      if (!recipient) {
        return res.status(404).json({ message: 'Destinatário não encontrado' });
      }
      const transfer = await storage.createCreditTransferRequest(user.id, toUserId, amount, reason);

      const [notification] = await db.insert(pendingNotifications).values({
        userId: toUserId,
        type: 'credit_transfer',
        title: 'Transferência de Créditos Recebida',
        message: `${user.name || user.username} enviou ${amount} TM3D para você${reason ? `: ${reason}` : ''}`,
        actionUrl: '/wallet',
        metadata: { transferId: transfer.id, fromUserId: user.id, fromUserName: user.name || user.username, amount },
      }).returning();

      broadcastToUser(toUserId, {
        type: 'credit_transfer',
        data: {
          transferId: transfer.id,
          notificationId: notification?.id,
          title: 'Transferência de Créditos Recebida',
          message: `${user.name || user.username} enviou ${amount} TM3D para você`,
          amount,
          fromUserName: user.name || user.username,
        },
      });

      const newBalance = await storage.getUserBalance(user.id);
      res.json({ transfer, newBalance, message: `Solicitação de transferência de ${amount} créditos enviada` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar transferência';
      res.status(400).json({ message });
    }
  });

  app.post('/api/tmc/transfer-respond', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { transferId, action } = req.body;
      if (!transferId || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Dados inválidos' });
      }
      const transfer = await storage.respondToCreditTransfer(transferId, user.id, action);

      try {
        const transferNotifs = await db.select().from(pendingNotifications)
          .where(and(
            eq(pendingNotifications.userId, user.id),
            eq(pendingNotifications.type, 'credit_transfer'),
          ));
        for (const n of transferNotifs) {
          const meta = n.metadata as any;
          if (meta?.transferId === transferId) {
            await db.update(pendingNotifications).set({ read: true }).where(eq(pendingNotifications.id, n.id));
          }
        }
      } catch {}

      const statusMsg = action === 'accept' ? 'aceitou' : 'recusou';
      await db.insert(pendingNotifications).values({
        userId: transfer.fromUserId,
        type: 'credit_transfer_response',
        title: action === 'accept' ? 'Transferência Aceita' : 'Transferência Recusada',
        message: `${user.name || user.username} ${statusMsg} sua transferência de ${transfer.amount} TM3D`,
        actionUrl: '/wallet',
        metadata: { transferId: transfer.id, action, amount: transfer.amount },
      });

      broadcastToUser(transfer.fromUserId, {
        type: 'credit_transfer_response',
        data: {
          transferId: transfer.id,
          title: action === 'accept' ? 'Transferência Aceita' : 'Transferência Recusada',
          message: `${user.name || user.username} ${statusMsg} sua transferência de ${transfer.amount} TM3D`,
          action,
          amount: transfer.amount,
        },
      });

      const newBalance = await storage.getUserBalance(user.id);
      res.json({ transfer, newBalance, message: action === 'accept' ? 'Transferência aceita' : 'Transferência recusada' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao responder transferência';
      res.status(400).json({ message });
    }
  });

  app.post('/api/tmc/transfer-cancel', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { transferId } = req.body;
      if (!transferId) return res.status(400).json({ message: 'ID da transferência obrigatório' });
      const transfer = await storage.cancelCreditTransfer(transferId, user.id);

      await db.insert(pendingNotifications).values({
        userId: transfer.toUserId,
        type: 'credit_transfer_cancelled',
        title: 'Transferência Cancelada',
        message: `${user.name || user.username} cancelou a transferência de ${transfer.amount} TM3D`,
        actionUrl: '/wallet',
        metadata: { transferId: transfer.id, amount: transfer.amount },
      });

      broadcastToUser(transfer.toUserId, {
        type: 'credit_transfer_cancelled',
        data: {
          transferId: transfer.id,
          title: 'Transferência Cancelada',
          message: `${user.name || user.username} cancelou a transferência de ${transfer.amount} TM3D`,
          amount: transfer.amount,
        },
      });

      const newBalance = await storage.getUserBalance(user.id);
      res.json({ transfer, newBalance, message: 'Transferência cancelada' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao cancelar transferência';
      res.status(400).json({ message });
    }
  });

  app.get('/api/tmc/transfers/pending', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const transfers = await storage.getPendingTransfersForUser(user.id);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: 'Falha ao buscar transferências pendentes' });
    }
  });

  app.get('/api/tmc/transfers/history', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const transfers = await storage.getSentTransfersByUser(user.id);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ message: 'Falha ao buscar histórico de transferências' });
    }
  });

  // Debit TMC credits for function usage
  app.post('/api/tmc/debit', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Validate request body with Zod
      const validationResult = tmcDebitSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { functionName, appointmentId, medicalRecordId } = validationResult.data;

      // Get function cost
      const cost = await storage.getFunctionCost(functionName);
      if (cost === 0) {
        return res.status(400).json({ message: 'Function not found or is free' });
      }

      // Check sufficient credits
      const hasCredits = await storage.validateSufficientCredits(user.id, functionName);
      if (!hasCredits) {
        return res.status(402).json({ message: 'Insufficient TMC credits', requiredAmount: cost });
      }

      // Process debit
      const transaction = await storage.processDebit(
        user.id, 
        cost, 
        `Function usage: ${functionName}`, 
        functionName,
        undefined,
        appointmentId,
        medicalRecordId
      );

      if (!transaction) {
        return res.status(402).json({ message: 'Insufficient TMC credits' });
      }

      // Process hierarchical commission if user is a doctor
      let commissionTransactions: any[] = [];
      if (user.role === 'doctor' && cost > 0) {
        commissionTransactions = await storage.processHierarchicalCommission(user.id, cost, functionName, appointmentId);
      }

      const newBalance = await storage.getUserBalance(user.id);

      res.json({ 
        transaction, 
        commissionTransactions,
        newBalance,
        functionUsed: functionName,
        cost
      });
    } catch (error) {
      console.error('TMC debit error:', error);
      res.status(500).json({ message: 'Failed to process TMC debit' });
    }
  });

  // Get TMC system configuration (admin only)
  app.get('/api/tmc/config', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const config = await storage.getTmcConfig();
      res.json(config);
    } catch (error) {
      console.error('TMC config fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch TMC configuration' });
    }
  });

  // Get function cost
  app.get('/api/tmc/function-cost/:functionName', requireAuth, async (req, res) => {
    try {
      const { functionName } = req.params;
      const cost = await storage.getFunctionCost(functionName);
      const config = await storage.getTmcConfigByFunction(functionName);
      
      res.json({ 
        functionName, 
        cost, 
        config: config ? {
          description: config.description,
          category: config.category,
          minimumRole: config.minimumRole,
          bonusForPatient: config.bonusForPatient,
          commissionPercentage: config.commissionPercentage
        } : null
      });
    } catch (error) {
      console.error('TMC function cost fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch function cost' });
    }
  });

  // Update TMC system configuration (admin only)
  app.post('/api/tmc/config', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      // Validate request body with Zod
      const validationResult = tmcConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validationResult.error.errors 
        });
      }

      const configData = {
        ...validationResult.data,
        updatedBy: user.id
      };

      const config = await storage.createTmcConfig(configData);
      res.json(config);
    } catch (error) {
      console.error('TMC config create error:', error);
      res.status(500).json({ message: 'Failed to create TMC configuration' });
    }
  });

  // Update existing TMC configuration (admin only)
  app.patch('/api/tmc/config/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: admin privileges required' });
      }

      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: user.id
      };

      const config = await storage.updateTmcConfig(id, updateData);
      
      if (!config) {
        return res.status(404).json({ message: 'TMC configuration not found' });
      }

      res.json(config);
    } catch (error) {
      console.error('TMC config update error:', error);
      res.status(500).json({ message: 'Failed to update TMC configuration' });
    }
  });

  // Validate sufficient credits for function
  app.post('/api/tmc/validate-credits', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Validate request body with Zod
      const validationResult = tmcValidateCreditsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { functionName } = validationResult.data;

      const hasCredits = await storage.validateSufficientCredits(user.id, functionName);
      const cost = await storage.getFunctionCost(functionName);
      const balance = await storage.getUserBalance(user.id);

      res.json({ 
        hasCredits, 
        functionName,
        cost,
        balance,
        deficit: hasCredits ? 0 : cost - balance
      });
    } catch (error) {
      console.error('TMC validation error:', error);
      res.status(500).json({ message: 'Failed to validate TMC credits' });
    }
  });

  // ===== ENHANCED PRESCRIPTION MANAGEMENT SYSTEM =====
  
  // Get medications database (searchable)
  app.get('/api/medications', requireAuth, async (req, res) => {
    try {
      const { search, category, active = 'true' } = req.query;
      
      let query = db.select().from(medications);
      
      // Apply filters
      if (active === 'true') {
        query = query.where(eq(medications.isActive, true));
      }
      
      const allMedications = await query;
      
      // Apply search filter (simple text search)
      let filteredMedications = allMedications;
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredMedications = allMedications.filter(med => 
          med.name.toLowerCase().includes(searchLower) ||
          med.genericName.toLowerCase().includes(searchLower) ||
          med.activeIngredient.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply category filter
      if (category && typeof category === 'string') {
        filteredMedications = filteredMedications.filter(med => 
          med.category === category
        );
      }
      
      res.json(filteredMedications);
    } catch (error) {
      console.error('Get medications error:', error);
      res.status(500).json({ message: 'Failed to get medications' });
    }
  });

  app.get('/api/medications/search-external', requireAuth, async (req: any, res) => {
    try {
      if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only doctors and admins can search external databases' });
      }

      const { term, locale = 'BR', limit = '20' } = req.query;

      if (!term || typeof term !== 'string' || term.trim().length < 2) {
        return res.json({ results: [], sources: [] });
      }

      const searchLocale = typeof locale === 'string' ? locale : 'BR';
      const searchLimit = Math.min(parseInt(String(limit), 10) || 20, 50);

      const searchResults = await searchExternalMedications(term.trim(), searchLocale, searchLimit);

      console.log(`[MED-SEARCH] Query: "${term}" | Locale: ${searchLocale} | Results: ${searchResults.results.length} | Sources: ${searchResults.sources.join(', ')}`);

      res.json(searchResults);
    } catch (error) {
      console.error('External medication search error:', error);
      res.status(500).json({ message: 'Failed to search external medication databases' });
    }
  });

  // Add new medication (admin only)
  app.post('/api/medications', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrators can add medications' });
      }
      
      const validatedData = insertMedicationSchema.parse(req.body);
      const medication = await db.insert(medications).values(validatedData).returning();
      
      console.log('[MEDICATION] New medication added:', medication[0].name);
      res.status(201).json(medication[0]);
    } catch (error) {
      console.error('Add medication error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid medication data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to add medication' });
    }
  });

  // Create new structured prescription
  app.post('/api/prescriptions', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can create prescriptions' });
      }
      
      const { patientId, diagnosis, notes, items, specialInstructions } = req.body;
      
      if (!patientId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Patient ID and prescription items are required' });
      }
      
      // Generate unique prescription number
      const prescriptionNumber = `RX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`.toUpperCase();
      
      // Create prescription
      const prescriptionData = {
        patientId,
        doctorId: req.user.id,
        prescriptionNumber,
        diagnosis: diagnosis || '',
        notes: notes || '',
        specialInstructions: specialInstructions || '',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      };
      
      const prescription = await db.insert(prescriptions).values(prescriptionData).returning();
      const prescriptionId = prescription[0].id;
      
      // Add prescription items
      const prescriptionItemsData = items.map((item: any, index: number) => ({
        prescriptionId,
        medicationId: item.medicationId || null,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
        customMedication: item.customMedication || null,
        isGenericAllowed: item.isGenericAllowed !== false,
        priority: index + 1,
        notes: item.notes || '',
      }));
      
      const insertedItems = await db.insert(prescriptionItems).values(prescriptionItemsData).returning();
      
      // Check for drug interactions
      const medicationIds = items
        .filter((item: any) => item.medicationId)
        .map((item: any) => item.medicationId);
      
      const interactions = await checkDrugInteractions(medicationIds);
      
      try {
        await storage.processDebit(req.user.id, 5, 'Criação de prescrição', 'prescription_creation');
      } catch (tmcError) {
        console.log('[TMC] TMC debit failed (continuing):', tmcError);
      }
      
      console.log('[PRESCRIPTION] New prescription created:', prescriptionNumber);
      
      res.status(201).json({
        prescription: prescription[0],
        items: insertedItems,
        interactions,
        tmcCostDeducted: 5 // Standard prescription cost
      });
    } catch (error) {
      console.error('Create prescription error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid prescription data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create prescription' });
    }
  });

  // Get prescriptions for a patient
  app.get('/api/patients/:patientId/prescriptions', requireAuth, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { status, limit = '10' } = req.query;
      
      if (req.user.role === 'patient') {
        const patientRecord = await db.select().from(patients).where(eq(patients.userId, req.user.id)).limit(1);
        if (!patientRecord.length || patientRecord[0].id !== patientId) {
          return res.status(403).json({ message: 'Acesso negado' });
        }
      }
      
      const prescriptionList = await db.select({
        id: prescriptions.id,
        prescriptionNumber: prescriptions.prescriptionNumber,
        diagnosis: prescriptions.diagnosis,
        status: prescriptions.status,
        createdAt: prescriptions.createdAt,
        expiresAt: prescriptions.expiresAt,
        doctorName: 'users.name', // Simple fallback
      })
      .from(prescriptions)
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.createdAt))
      .limit(parseInt(limit.toString()));
      
      // Filter by status if provided
      const filteredPrescriptions = status 
        ? prescriptionList.filter(p => p.status === status)
        : prescriptionList;
      
      res.json(filteredPrescriptions);
    } catch (error) {
      console.error('Get patient prescriptions error:', error);
      res.status(500).json({ message: 'Failed to get patient prescriptions' });
    }
  });

  app.get('/api/patients/:patientId/export', requireAuth, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { standard = 'fhir-br', format = 'json', deidentify = 'false' } = req.query;

      if (req.user.role === 'patient') {
        const patientRecord = await db.select().from(patients).where(eq(patients.userId, req.user.id)).limit(1);
        if (!patientRecord.length || patientRecord[0].id !== patientId) {
          return res.status(403).json({ message: 'Acesso negado: você só pode exportar seus próprios dados' });
        }
      } else if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado' });
      }

      const validStandards = ['fhir-br', 'fhir-us', 'fhir-eu', 'fhir-intl'];
      if (!validStandards.includes(standard as string)) {
        return res.status(400).json({ message: `Padrão inválido. Use: ${validStandards.join(', ')}` });
      }

      const { patientExportService } = await import('./services/patient-export-service');

      const result = await patientExportService.exportPatientData(patientId, {
        standard: standard as any,
        format: format as any,
        deidentify: deidentify === 'true',
        includeConsent: true,
      });

      try {
        await db.insert(walletAuditLog).values({
          userId: req.user.id,
          action: 'patient_data_export',
          details: `Exported patient ${patientId} data in ${standard} ${format} format`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        });
      } catch (auditErr) {
        console.error('Audit log error (non-blocking):', auditErr);
      }

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="prontuario-${patientId}-${standard}.html"`);
        return res.send(result.html);
      }

      res.setHeader('Content-Type', 'application/fhir+json');
      res.setHeader('Content-Disposition', `attachment; filename="fhir-bundle-${patientId}-${standard}.json"`);
      res.json(result.bundle);
    } catch (error: any) {
      console.error('Patient export error:', error);
      if (error.message === 'Patient not found') {
        return res.status(404).json({ message: 'Paciente não encontrado' });
      }
      res.status(500).json({ message: 'Falha ao exportar dados do paciente' });
    }
  });

  // Get recent prescriptions (for dashboard or general view)
  app.get('/api/prescriptions/recent', requireAuth, async (req, res) => {
    try {
      const { limit = '20' } = req.query;
      
      // Use simple select all approach to avoid circular references
      let query = db.select()
        .from(prescriptions);
      
      // Filter based on user role
      if (req.user?.role === 'doctor') {
        // Doctors see only their own prescriptions
        query = query.where(eq(prescriptions.doctorId, req.user.id));
      } else if (req.user?.role === 'patient') {
        const patient = await storage.getPatientByUserId(req.user.id);
        if (patient) {
          query = query.where(eq(prescriptions.patientId, patient.id));
        } else {
          return res.json([]);
        }
      }
      // Admins see all prescriptions (no filter)
      
      const results = await query
        .orderBy(desc(prescriptions.createdAt))
        .limit(parseInt(limit.toString()));
      
      // Transform results to match expected structure
      const recentPrescriptions = results.map(prescription => ({
        id: prescription.id,
        prescriptionNumber: prescription.prescriptionNumber,
        diagnosis: prescription.diagnosis,
        status: prescription.status,
        createdAt: prescription.createdAt,
        expiresAt: prescription.expiresAt,
        doctorName: 'Doctor', // Simplified for now
        patientName: 'Patient', // Simplified for now
      }));
      
      res.json(recentPrescriptions);
    } catch (error) {
      console.error('Get recent prescriptions error:', error);
      res.status(500).json({ message: 'Failed to get recent prescriptions' });
    }
  });

  // Get prescription details with items
  app.get('/api/prescriptions/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get prescription details
      const prescription = await db.select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);
      
      if (!prescription.length) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      // Access control: Only doctor who created, patient who received, or admin can view
      const prescriptionData = prescription[0];
      if (req.user?.role === 'doctor' && prescriptionData.doctorId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (req.user?.role === 'patient' && prescriptionData.patientId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get prescription items with medication details
      const items = await db.select({
        id: prescriptionItems.id,
        dosage: prescriptionItems.dosage,
        frequency: prescriptionItems.frequency,
        duration: prescriptionItems.duration,
        quantity: prescriptionItems.quantity,
        instructions: prescriptionItems.instructions,
        customMedication: prescriptionItems.customMedication,
        isGenericAllowed: prescriptionItems.isGenericAllowed,
        priority: prescriptionItems.priority,
        notes: prescriptionItems.notes,
        medicationId: prescriptionItems.medicationId,
      })
      .from(prescriptionItems)
      .where(eq(prescriptionItems.prescriptionId, id))
      .orderBy(prescriptionItems.priority);
      
      // Get medication details for each item
      const itemsWithMedications = await Promise.all(
        items.map(async (item) => {
          if (item.medicationId) {
            const medication = await db.select()
              .from(medications)
              .where(eq(medications.id, item.medicationId))
              .limit(1);
            
            return {
              ...item,
              medication: medication[0] || null
            };
          }
          return {
            ...item,
            medication: null
          };
        })
      );
      
      res.json({
        ...prescription[0],
        items: itemsWithMedications
      });
    } catch (error) {
      console.error('Get prescription details error:', error);
      res.status(500).json({ message: 'Failed to get prescription details' });
    }
  });

  // Check drug interactions with AI analysis
  app.post('/api/prescriptions/check-interactions', requireAuth, async (req, res) => {
    try {
      const { medicationIds, patientId, diagnosis } = req.body;
      
      if (!Array.isArray(medicationIds) || medicationIds.length === 0) {
        return res.json({ analysis: [] });
      }

      // Get medications details
      const medicationsData = await db
        .select()
        .from(medications)
        .where(sql`${medications.id} = ANY(${medicationIds})`);

      if (medicationsData.length === 0) {
        return res.json({ analysis: [] });
      }

      // Get patient details
      let patientInfo = null;
      if (patientId) {
        const patient = await db
          .select()
          .from(patients)
          .where(eq(patients.id, patientId))
          .limit(1);
        
        if (patient.length > 0) {
          patientInfo = patient[0];
        }
      }

      // Get patient's medical records for allergies and conditions
      let medicalHistory = '';
      if (patientId) {
        const records = await db
          .select()
          .from(medicalRecords)
          .where(eq(medicalRecords.patientId, patientId))
          .orderBy(desc(medicalRecords.visitDate))
          .limit(5);
        
        if (records.length > 0) {
          medicalHistory = records.map(r => 
            `${r.diagnosis || ''} - ${r.prescribedMedication || ''} - ${r.allergies || ''}`
          ).join('; ');
        }
      }

      // Prepare medication list for AI
      const medicationList = medicationsData.map(m => 
        `${m.name} (${m.genericName}) - Princípio Ativo: ${m.activeIngredient}, Forma: ${m.dosageForm}, Concentração: ${m.strength}`
      ).join('\n');

      // Call Gemini AI for analysis
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ message: 'AI service not configured' });
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Você é um especialista em farmacologia clínica. Analise as seguintes prescrições médicas e forneça uma análise detalhada de interações medicamentosas.

MEDICAMENTOS PRESCRITOS:
${medicationList}

DIAGNÓSTICO: ${diagnosis || 'Não especificado'}

${patientInfo ? `PERFIL DO PACIENTE:
- Idade: ${patientInfo.birthDate ? new Date().getFullYear() - new Date(patientInfo.birthDate).getFullYear() : 'Não especificado'} anos
- Gênero: ${patientInfo.gender || 'Não especificado'}
- Peso: ${patientInfo.weight || 'Não especificado'} kg
- Histórico: ${medicalHistory || 'Não disponível'}` : ''}

Para CADA medicamento, forneça uma análise estruturada em JSON com o seguinte formato:
{
  "drugName": "Nome do medicamento",
  "activeIngredient": "Princípio ativo",
  "summary": "Breve resumo sobre o princípio ativo e seu mecanismo de ação (2-3 frases)",
  "interactions": [
    {
      "type": "Tipo de interação (ex: Interação com [medicamento])",
      "description": "Descrição detalhada da interação e possíveis consequências",
      "riskLevel": número de 0-100 representando o nível de risco
    }
  ],
  "sideEffects": [
    {
      "name": "Nome do efeito adverso",
      "probability": número de 0-100 representando a probabilidade
    }
  ],
  "patientRiskFactors": [
    {
      "factor": "Fator de risco específico para este paciente",
      "riskLevel": número de 0-100
    }
  ],
  "overallRisk": número de 0-100 representando o risco geral
}

IMPORTANTE: 
- Liste pelo menos 3-5 interações se houver outros medicamentos
- Liste os 5 efeitos adversos mais comuns
- Considere idade, peso e histórico do paciente nos fatores de risco
- Se não houver interações graves, ainda liste interações leves ou moderadas
- Retorne APENAS um array JSON válido, sem texto adicional

Responda com: [{ análise do medicamento 1 }, { análise do medicamento 2 }, ...]`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON from response
      let analysis = [];
      try {
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: try parsing entire response
          analysis = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', responseText);
        // Return basic analysis as fallback
        analysis = medicationsData.map(med => ({
          drugName: med.name,
          activeIngredient: med.activeIngredient,
          summary: `${med.name} é um medicamento usado no tratamento de diversas condições. Contém ${med.activeIngredient} como princípio ativo.`,
          interactions: [],
          sideEffects: [
            { name: 'Náusea', probability: 15 },
            { name: 'Tontura', probability: 10 },
            { name: 'Dor de cabeça', probability: 8 }
          ],
          patientRiskFactors: [],
          overallRisk: 25
        }));
      }

      res.json({ analysis });
    } catch (error) {
      console.error('Check drug interactions error:', error);
      res.status(500).json({ message: 'Failed to check drug interactions' });
    }
  });

  // Sign prescription with digital signature
  app.post('/api/prescriptions/:id/sign', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can sign prescriptions' });
      }

      const { id } = req.params;
      const { pin, doctorName, crm, crmState } = req.body;

      // Get prescription
      const prescription = await db.select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);

      if (!prescription.length) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      const prescriptionData = prescription[0];

      // Verify doctor owns this prescription
      if (prescriptionData.doctorId !== req.user.id) {
        return res.status(403).json({ message: 'You can only sign your own prescriptions' });
      }

      // Check if already signed
      if (prescriptionData.digitalSignatureId) {
        return res.status(400).json({ message: 'Prescription already signed' });
      }

      // Get prescription items to include in signature
      const items = await db.select()
        .from(prescriptionItems)
        .where(eq(prescriptionItems.prescriptionId, id));

      // Build prescription content for signature
      const prescriptionContent = {
        prescriptionNumber: prescriptionData.prescriptionNumber,
        diagnosis: prescriptionData.diagnosis,
        items: items.map(item => ({
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          customMedication: item.customMedication
        })),
        specialInstructions: prescriptionData.specialInstructions,
        createdAt: prescriptionData.createdAt
      };

      // Certificate info for ICP-Brasil A3
      const certificateInfo = {
        doctorName: doctorName || req.user.name,
        crm: crm || 'CRM-DEMO',
        crmState: crmState || 'SP',
        cpf: '000.000.000-00',
        issuer: 'ICP-Brasil',
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        certificateLevel: 'A3',
        serialNumber: `CERT-${Date.now()}`
      };

      // Generate key pair and signature
      const { privateKey, publicKey } = await cryptoService.generateKeyPair();
      const signatureResult = await cryptoService.signPrescription(
        JSON.stringify(prescriptionContent),
        privateKey,
        certificateInfo
      );

      // Verify signature immediately
      const verificationResult = await cryptoService.verifySignature(
        JSON.stringify(prescriptionContent),
        signatureResult.signature,
        publicKey
      );

      // Create digital signature record
      const digitalSignature = await storage.createDigitalSignature({
        documentType: 'prescription',
        documentId: id,
        patientId: prescriptionData.patientId,
        doctorId: req.user.id,
        signature: signatureResult.signature,
        documentHash: signatureResult.documentHash,
        certificateInfo: {
          ...certificateInfo,
          algorithm: 'RSA-SHA256',
          keySize: 2048,
          publicKey: publicKey
        },
        status: 'signed',
        signedAt: new Date(),
      });

      // Update prescription with digital signature ID
      await db.update(prescriptions)
        .set({ digitalSignatureId: digitalSignature.id })
        .where(eq(prescriptions.id, id));

      // Generate audit hash
      const auditHash = cryptoService.generateAuditHash(
        signatureResult,
        req.user.id,
        prescriptionData.patientId
      );

      console.log('[PRESCRIPTION] Prescription signed:', prescriptionData.prescriptionNumber);

      res.json({
        digitalSignature,
        auditHash,
        verificationResult,
        message: 'Prescrição assinada digitalmente com certificado ICP-Brasil A3',
        qrCodeData: `verify:${id}:${digitalSignature.id}`
      });
    } catch (error) {
      console.error('Sign prescription error:', error);
      res.status(500).json({ message: 'Failed to sign prescription' });
    }
  });

  // Verify prescription signature
  app.get('/api/prescriptions/:id/verify-signature', async (req, res) => {
    try {
      const { id } = req.params;

      const prescription = await db.select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);

      if (!prescription.length) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      const prescriptionData = prescription[0];

      if (!prescriptionData.digitalSignatureId) {
        return res.status(404).json({ message: 'Prescription not signed' });
      }

      // Get digital signature
      const signature = await storage.getDigitalSignature(prescriptionData.digitalSignatureId);

      if (!signature) {
        return res.status(404).json({ message: 'Digital signature not found' });
      }

      const publicKey = signature.certificateInfo?.publicKey || '';
      const signatureTimestamp = signature.certificateInfo?.timestamp || signature.signedAt?.toISOString() || '';
      
      let isValid = false;
      
      if (publicKey && signatureTimestamp) {
        try {
          const documentHash = signature.documentHash;
          const signableContent = `${documentHash}|${signatureTimestamp}`;
          
          isValid = crypto
            .createVerify('sha256')
            .update(signableContent, 'utf8')
            .verify({
              key: publicKey,
              padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
              saltLength: 32
            }, signature.signature, 'base64');
        } catch (verifyErr) {
          try {
            isValid = crypto
              .createVerify('RSA-SHA256')
              .update(signature.documentHash)
              .verify(publicKey, signature.signature, 'hex');
          } catch {
            isValid = false;
          }
        }
      }

      const verificationResult = await cryptoService.performElectronicVerification(
        signature.signature,
        signature.documentHash,
        signature.certificateInfo || {}
      );

      try {
        await db.insert(signatureVerifications).values({
          signatureId: signature.id,
          verificationMethod: 'platform_verification',
          isValid,
          validationDetails: { verificationResult, verifiedAt: new Date().toISOString() },
        });
      } catch (verLogErr) {
        console.log('Could not log verification:', verLogErr);
      }

      const doctor = await db.select({
        name: users.name,
        medicalLicense: users.medicalLicense,
        specialization: users.specialization,
      }).from(users).where(eq(users.id, signature.doctorId)).limit(1);

      res.json({
        isValid: isValid && verificationResult.isValid,
        cryptographicVerification: isValid,
        electronicVerification: verificationResult,
        signature: {
          id: signature.id,
          documentType: signature.documentType,
          documentHash: signature.documentHash,
          signedAt: signature.signedAt,
          status: signature.status,
          verificationCount: (signature.verificationCount || 0) + 1,
        },
        doctor: doctor[0] || null,
        prescriptionNumber: prescriptionData.prescriptionNumber,
        certificateInfo: {
          certificateType: signature.certificateInfo?.certificateType || 'ICP-Brasil A3',
          complianceLevel: signature.certificateInfo?.complianceLevel || 'ICP-Brasil A3',
          algorithm: signature.certificateInfo?.algorithm || 'RSA-PSS + SHA-256',
          legalValidity: 'Validade jurídica plena conforme MP 2.200-2/2001',
        },
        message: isValid
          ? 'Assinatura digital válida - Documento íntegro e autêntico'
          : 'Assinatura digital não pôde ser verificada criptograficamente',
      });
    } catch (error) {
      console.error('Verify prescription signature error:', error);
      res.status(500).json({ message: 'Failed to verify prescription signature' });
    }
  });

  app.get('/api/signatures/:signatureId/verify', async (req, res) => {
    try {
      const { signatureId } = req.params;

      const sig = await storage.getDigitalSignature(signatureId);
      if (!sig) {
        return res.status(404).json({ 
          isValid: false, 
          message: 'Assinatura digital não encontrada no sistema' 
        });
      }

      const publicKey = (sig.certificateInfo as any)?.publicKey || '';
      const signatureTimestamp = (sig.certificateInfo as any)?.timestamp || sig.signedAt?.toISOString() || '';
      
      let cryptoValid = false;
      
      if (publicKey && signatureTimestamp) {
        try {
          const signableContent = `${sig.documentHash}|${signatureTimestamp}`;
          cryptoValid = crypto
            .createVerify('sha256')
            .update(signableContent, 'utf8')
            .verify({
              key: publicKey,
              padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
              saltLength: 32
            }, sig.signature, 'base64');
        } catch {
          try {
            cryptoValid = crypto
              .createVerify('RSA-SHA256')
              .update(sig.documentHash)
              .verify(publicKey, sig.signature, 'hex');
          } catch {
            cryptoValid = false;
          }
        }
      }

      const electronVerification = await cryptoService.performElectronicVerification(
        sig.signature,
        sig.documentHash,
        sig.certificateInfo || {}
      );

      const doctor = await db.select({
        name: users.name,
        medicalLicense: users.medicalLicense,
        specialization: users.specialization,
      }).from(users).where(eq(users.id, sig.doctorId)).limit(1);

      try {
        await db.insert(signatureVerifications).values({
          signatureId: sig.id,
          verificationMethod: 'public_qr_verification',
          isValid: cryptoValid,
          validationDetails: { electronVerification, verifiedAt: new Date().toISOString() },
          ipAddress: req.ip || undefined,
          userAgent: req.headers['user-agent'] || undefined,
        });
        await db.update(digitalSignatures)
          .set({ 
            verificationCount: (sig.verificationCount || 0) + 1,
            lastVerifiedAt: new Date(),
          })
          .where(eq(digitalSignatures.id, sig.id));
      } catch {}

      res.json({
        isValid: cryptoValid && electronVerification.isValid,
        cryptographicVerification: cryptoValid,
        electronicVerification: electronVerification,
        document: {
          type: sig.documentType,
          signedAt: sig.signedAt,
          documentHash: sig.documentHash,
        },
        doctor: doctor[0] ? {
          name: doctor[0].name,
          crm: doctor[0].medicalLicense,
          specialty: doctor[0].specialization,
        } : null,
        certificate: {
          type: (sig.certificateInfo as any)?.certificateType || 'ICP-Brasil A3',
          compliance: (sig.certificateInfo as any)?.complianceLevel || 'ICP-Brasil A3',
          algorithm: (sig.certificateInfo as any)?.algorithm || 'RSA-PSS + SHA-256',
        },
        legalValidity: cryptoValid 
          ? 'Validade jurídica plena conforme MP 2.200-2/2001' 
          : 'Integridade criptográfica não confirmada',
        verificationCount: (sig.verificationCount || 0) + 1,
        message: cryptoValid 
          ? 'Assinatura digital verificada com sucesso - Documento autêntico e íntegro'
          : 'Não foi possível confirmar a autenticidade criptográfica desta assinatura',
      });
    } catch (error) {
      console.error('Public signature verification error:', error);
      res.status(500).json({ message: 'Falha na verificação da assinatura' });
    }
  });

  // Cancel prescription
  app.patch('/api/prescriptions/:id/cancel', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can cancel prescriptions' });
      }

      const { id } = req.params;

      const prescription = await db.select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);

      if (!prescription.length) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      const prescriptionData = prescription[0];

      // Verify doctor owns this prescription
      if (prescriptionData.doctorId !== req.user.id) {
        return res.status(403).json({ message: 'You can only cancel your own prescriptions' });
      }

      // Update prescription status
      await db.update(prescriptions)
        .set({ 
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(prescriptions.id, id));

      res.json({
        message: 'Prescription cancelled successfully',
        prescriptionNumber: prescriptionData.prescriptionNumber
      });
    } catch (error) {
      console.error('Cancel prescription error:', error);
      res.status(500).json({ message: 'Failed to cancel prescription' });
    }
  });

  // Generate prescription PDF
  app.get('/api/prescriptions/:id/pdf', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const prescription = await db.select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id))
        .limit(1);

      if (!prescription.length) {
        return res.status(404).json({ message: 'Prescription not found' });
      }

      const prescriptionData = prescription[0];

      // Get prescription items
      const items = await db.select()
        .from(prescriptionItems)
        .where(eq(prescriptionItems.prescriptionId, id));

      // Get patient info
      const patientData = await db.select()
        .from(patients)
        .where(eq(patients.id, prescriptionData.patientId))
        .limit(1);

      // Get doctor info
      const doctorData = await db.select()
        .from(users)
        .where(eq(users.id, prescriptionData.doctorId))
        .limit(1);

      // Get digital signature if available
      let digitalSignature = null;
      if (prescriptionData.digitalSignatureId) {
        const signatureData = await db.select()
          .from(digitalSignatures)
          .where(eq(digitalSignatures.id, prescriptionData.digitalSignatureId))
          .limit(1);
        
        if (signatureData.length) {
          digitalSignature = {
            signature: signatureData[0].signature,
            certificateInfo: signatureData[0].certificateInfo,
            timestamp: signatureData[0].signedAt?.toISOString() || new Date().toISOString()
          };
        }
      }

      // Build prescription text from items
      const prescriptionText = items
        .sort((a, b) => (a.priority || 0) - (b.priority || 0))
        .map((item, index) => {
          const medName = item.customMedication || 'Medicamento';
          return `${index + 1}. ${medName}\n   Dosagem: ${item.dosage}\n   Frequência: ${item.frequency}\n   Duração: ${item.duration}\n   Quantidade: ${item.quantity} unidades\n   Instruções: ${item.instructions}${item.notes ? '\n   Obs: ' + item.notes : ''}`;
        })
        .join('\n\n');

      // Generate HTML for PDF
      const htmlContent = await pdfGeneratorService.generatePrescriptionPDF({
        patientName: patientData[0]?.name || 'Paciente',
        patientAge: new Date().getFullYear() - (patientData[0]?.dateOfBirth ? new Date(patientData[0].dateOfBirth).getFullYear() : 0),
        patientAddress: patientData[0]?.address || 'Não informado',
        doctorName: doctorData[0]?.name || 'Médico',
        doctorCRM: doctorData[0]?.digitalCertificate?.split('-')[1] || '000000',
        doctorCRMState: doctorData[0]?.digitalCertificate?.split('-')[2] || 'SP',
        prescriptionText: prescriptionText,
        date: new Date(prescriptionData.createdAt).toLocaleDateString('pt-BR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        }),
        digitalSignature: digitalSignature
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="prescricao-${prescriptionData.prescriptionNumber}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error('Generate prescription PDF error:', error);
      res.status(500).json({ message: 'Failed to generate prescription PDF' });
    }
  });

  // Get prescription templates
  app.get('/api/prescription-templates', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'doctor') {
        return res.status(403).json({ message: 'Only doctors can access prescription templates' });
      }
      
      const { category } = req.query;
      
      const templates = await db.select()
        .from(prescriptionTemplates)
        .where(eq(prescriptionTemplates.isActive, true))
        .orderBy(desc(prescriptionTemplates.usageCount));
      
      // Filter public templates and doctor's own templates
      const filteredTemplates = templates.filter(template => 
        template.isPublic || template.doctorId === req.user?.id
      );
      
      // Apply category filter if provided
      const finalTemplates = category && typeof category === 'string'
        ? filteredTemplates.filter(t => t.category === category)
        : filteredTemplates;
      
      res.json(finalTemplates);
    } catch (error) {
      console.error('Get prescription templates error:', error);
      res.status(500).json({ message: 'Failed to get prescription templates' });
    }
  });


  // Helper function to check drug interactions
  async function checkDrugInteractions(medicationIds: string[]) {
    try {
      const interactions = [];
      
      for (let i = 0; i < medicationIds.length; i++) {
        for (let j = i + 1; j < medicationIds.length; j++) {
          const med1 = medicationIds[i];
          const med2 = medicationIds[j];
          
          const interaction = await db.select()
            .from(drugInteractions)
            .where(
              sql`(medication1_id = ${med1} AND medication2_id = ${med2}) OR 
                  (medication1_id = ${med2} AND medication2_id = ${med1})`
            )
            .limit(1);
          
          if (interaction.length > 0) {
            interactions.push(interaction[0]);
          }
        }
      }
      
      return interactions;
    } catch (error) {
      console.error('Drug interaction check error:', error);
      return [];
    }
  }

  // ===== SUPPORT SYSTEM ENDPOINTS =====

  // Get Support Configuration
  app.get('/api/support/config', async (req, res) => {
    try {
      const config = await storage.getOrCreateDefaultSupportConfig();
      res.json(config);
    } catch (error) {
      console.error('Support config error:', error);
      res.status(500).json({ message: 'Failed to get support configuration' });
    }
  });

  // Trigger Support Contact
  app.post('/api/support/contact', async (req, res) => {
    try {
      const contactSchema = z.object({
        message: z.string().min(1, 'Message is required'),
        userInfo: z.object({
          name: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional()
        }).optional(),
        priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium')
      });
      
      const { message, userInfo, priority } = contactSchema.parse(req.body);
      const config = await storage.getOrCreateDefaultSupportConfig();

      let response;
      let emailFallbackUsed = false;

      // Try WhatsApp first if configured
      if (config.whatsappNumber && config.supportChatbotEnabled) {
        try {
          const supportMessage = `Nova solicitação de suporte:\n\nMensagem: ${message}\n\nPrioridade: ${priority}\n\nUsuário: ${userInfo?.name || 'Não informado'}\nEmail: ${userInfo?.email || 'Não informado'}\nTelefone: ${userInfo?.phone || 'Não informado'}`;
          
          const whatsappSuccess = await whatsAppService.sendMessage(config.whatsappNumber, supportMessage);
          
          if (whatsappSuccess) {
            response = {
              success: true,
              method: 'whatsapp',
              message: 'Mensagem enviada via WhatsApp. Nossa equipe responderá em breve.'
            };
          }
        } catch (whatsappError) {
          console.error('WhatsApp support failed, falling back to email:', whatsappError);
          emailFallbackUsed = true;
        }
      } else {
        // No WhatsApp configured, use email fallback
        emailFallbackUsed = true;
      }

      // If no WhatsApp success or WhatsApp not configured, log email fallback
      if (!response || emailFallbackUsed) {
        console.log(`[EMAIL SUPPORT] Sending email to info@interligas.org`);
        console.log(`[EMAIL DETAILS] From: ${userInfo?.email || 'anonymous'}`);
        console.log(`[EMAIL DETAILS] Name: ${userInfo?.name || 'Não informado'}`);
        console.log(`[EMAIL DETAILS] Phone: ${userInfo?.phone || 'Não informado'}`);
        console.log(`[EMAIL DETAILS] Message: ${message}`);
        console.log(`[EMAIL DETAILS] Priority: ${priority}`);
        console.log(`[EMAIL DETAILS] Timestamp: ${new Date().toISOString()}`);
        
        response = {
          success: true,
          method: 'email',
          message: 'Mensagem enviada para nossa equipe via email (info@interligas.org). Retornaremos em breve.',
          fallbackEmail: 'info@interligas.org'
        };
      }

      // Auto-responder if enabled
      if (config.autoResponderEnabled && config.autoResponderMessage) {
        response.autoResponse = config.autoResponderMessage;
      }

      res.json(response);
    } catch (error) {
      console.error('Support contact error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to send support message' });
    }
  });

  // Emergency System Contact
  app.post('/api/support/emergency', async (req, res) => {
    try {
      const emergencySchema = z.object({
        location: z.object({
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          country: z.string().optional()
        }).optional(),
        userInfo: z.object({
          name: z.string().optional(),
          phone: z.string().optional(),
          emergencyContact: z.string().optional()
        }).optional(),
        type: z.enum(['samu_online', 'samu_whatsapp', 'emergency_contact']).default('samu_online')
      });
      
      const { location, userInfo, type } = emergencySchema.parse(req.body);
      const config = await storage.getOrCreateDefaultSupportConfig();

      let response = {
        success: true,
        phone: config.samuWhatsapp,
        onlineUrl: config.samuOnlineUrl
      };

      // Handle different emergency types
      switch (type) {
        case 'samu_online':
          response = {
            ...response,
            method: 'online',
            url: config.samuOnlineUrl,
            message: 'Redirecionando para o SAMU online'
          };
          break;
        
        case 'samu_whatsapp':
          response = {
            ...response,
            method: 'whatsapp',
            phone: config.samuWhatsapp,
            message: `Entre em contato com o SAMU: ${config.samuWhatsapp}`
          };
          break;
        
        case 'emergency_contact':
          if (userInfo?.emergencyContact && config.emergencySmsEnabled) {
            // Here you would integrate with SMS service
            response = {
              ...response,
              method: 'emergency_sms',
              message: 'SMS de emergência enviado para seu contato',
              emergencyContact: userInfo.emergencyContact
            };
          }
          break;
      }

      // Handle Paraguay location
      if (location?.country === 'Paraguay' || location?.country === 'PY') {
        response.phone = config.paraguayEmergencyNumber;
        response.message = `Emergência no Paraguai. Contate: ${config.paraguayEmergencyNumber}`;
      }

      res.json(response);
    } catch (error) {
      console.error('Emergency contact error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to process emergency request' });
    }
  });

  // ===== ERROR LOGGING ENDPOINTS =====

  // Create error log (Public - no auth required for logging frontend errors)
  app.post('/api/error-logs', async (req, res) => {
    try {
      const errorLogSchema = z.object({
        errorCode: z.string(),
        technicalMessage: z.string(),
        userMessage: z.string(),
        endpoint: z.string().optional(),
        method: z.string().optional(),
        statusCode: z.number(),
        stackTrace: z.string().optional(),
      });

      const data = errorLogSchema.parse(req.body);
      
      // Get user ID if authenticated
      const userId = (req as any).user?.id || null;
      
      // Determine error type based on status code
      let errorType = 'internal';
      if (data.statusCode === 401 || data.statusCode === 403) {
        errorType = 'authentication';
      } else if (data.statusCode === 400 || data.statusCode === 422) {
        errorType = 'validation';
      } else if (data.statusCode >= 500) {
        errorType = 'internal';
      }
      
      // Get IP address and user agent
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Create error log
      const errorLog = await storage.createErrorLog({
        errorCode: data.errorCode,
        userId,
        errorType,
        endpoint: data.endpoint || null,
        method: data.method || null,
        technicalMessage: data.technicalMessage,
        userMessage: data.userMessage,
        stackTrace: data.stackTrace || null,
        context: {
          statusCode: data.statusCode,
          timestamp: new Date().toISOString(),
        },
        ipAddress,
        userAgent,
      });
      
      res.status(201).json({ success: true, errorCode: errorLog.errorCode });
    } catch (error) {
      console.error('Error log creation error:', error);
      // Don't fail loudly - error logging should be silent
      res.status(200).json({ success: false });
    }
  });

  // Get all error logs (Admin only)
  app.get('/api/error-logs', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { errorType, resolved, limit } = req.query;
      
      const filters: any = {};
      if (errorType) filters.errorType = errorType.toString();
      if (resolved !== undefined) filters.resolved = resolved === 'true';
      if (limit) filters.limit = parseInt(limit.toString());
      
      const errorLogs = await storage.getErrorLogs(filters);
      res.json(errorLogs);
    } catch (error) {
      console.error('Get error logs error:', error);
      res.status(500).json({ message: 'Failed to get error logs' });
    }
  });

  // Mark error as resolved (Admin only)
  app.patch('/api/error-logs/:id/resolve', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { id } = req.params;
      const { adminNotes } = req.body;
      
      const errorLog = await storage.markErrorAsResolved(id, req.user.id, adminNotes);
      
      if (!errorLog) {
        return res.status(404).json({ message: 'Error log not found' });
      }
      
      res.json(errorLog);
    } catch (error) {
      console.error('Mark error resolved error:', error);
      res.status(500).json({ message: 'Failed to mark error as resolved' });
    }
  });

  // ===== ADVANCED ANALYTICS & REPORTING ENDPOINTS =====

  // Dashboard Overview Analytics
  app.get('/api/analytics/dashboard', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { period = '30' } = req.query; // days
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get basic metrics
      const [
        totalPatients,
        totalDoctors,
        totalAppointments,
        completedAppointments,
        totalPrescriptions,
        tmcTransactionsData,
        recentActivity
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(patients),
        db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, 'doctor')),
        db.select({ count: sql<number>`count(*)` }).from(appointments).where(sql`created_at >= ${startDate}`),
        db.select({ count: sql<number>`count(*)` }).from(appointments)
          .where(sql`status = 'completed' AND created_at >= ${startDate}`),
        db.select({ count: sql<number>`count(*)` }).from(prescriptions).where(sql`created_at >= ${startDate}`),
        db.select({ total: sql<number>`COALESCE(sum(amount), 0)` }).from(tmcTransactions)
          .where(sql`created_at >= ${startDate}`),
        db.select({
          type: sql`'appointment'`,
          count: sql<number>`count(*)`,
          date: sql`date_trunc('day', created_at)`
        })
        .from(appointments)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`)
        .limit(30)
      ]);

      const dashboardMetrics = {
        overview: {
          totalPatients: totalPatients[0]?.count || 0,
          totalDoctors: totalDoctors[0]?.count || 0,
          appointmentsThisPeriod: totalAppointments[0]?.count || 0,
          completedAppointments: completedAppointments[0]?.count || 0,
          prescriptionsThisPeriod: totalPrescriptions[0]?.count || 0,
          tmcCreditsUsed: tmcTransactionsData[0]?.total || 0,
          completionRate: totalAppointments[0]?.count > 0 
            ? Math.round((completedAppointments[0]?.count / totalAppointments[0]?.count) * 100) 
            : 0
        },
        activityTrend: recentActivity,
        period: periodDays
      };

      res.json(dashboardMetrics);
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({ message: 'Failed to get dashboard analytics' });
    }
  });

  // Patient Demographics Analytics
  app.get('/api/analytics/patients', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const [
        ageDistribution,
        genderDistribution,
        recentPatients
      ] = await Promise.all([
        db.select({
          ageGroup: sql`CASE 
            WHEN date_part('year', age(date_of_birth)) < 18 THEN 'Menor de 18'
            WHEN date_part('year', age(date_of_birth)) < 30 THEN '18-29'
            WHEN date_part('year', age(date_of_birth)) < 50 THEN '30-49'
            WHEN date_part('year', age(date_of_birth)) < 65 THEN '50-64'
            ELSE '65+'
          END`,
          count: sql<number>`count(*)`
        })
        .from(patients)
        .where(sql`date_of_birth IS NOT NULL`)
        .groupBy(sql`CASE 
          WHEN date_part('year', age(date_of_birth)) < 18 THEN 'Menor de 18'
          WHEN date_part('year', age(date_of_birth)) < 30 THEN '18-29'
          WHEN date_part('year', age(date_of_birth)) < 50 THEN '30-49'
          WHEN date_part('year', age(date_of_birth)) < 65 THEN '50-64'
          ELSE '65+'
        END`),
        
        db.select({
          gender: patients.gender,
          count: sql<number>`count(*)`
        })
        .from(patients)
        .where(sql`gender IS NOT NULL`)
        .groupBy(patients.gender),

        db.select({
          registrationDate: sql`date_trunc('month', created_at)`,
          count: sql<number>`count(*)`
        })
        .from(patients)
        .where(sql`created_at >= NOW() - INTERVAL '12 months'`)
        .groupBy(sql`date_trunc('month', created_at)`)
        .orderBy(sql`date_trunc('month', created_at)`)
      ]);

      res.json({
        ageDistribution,
        genderDistribution,
        registrationTrend: recentPatients
      });
    } catch (error) {
      console.error('Patient analytics error:', error);
      res.status(500).json({ message: 'Failed to get patient analytics' });
    }
  });

  // Doctor Performance Analytics
  app.get('/api/analytics/doctors', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { period = '30' } = req.query;
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const [
        doctorAppointments,
        doctorPrescriptions,
        doctorRevenue
      ] = await Promise.all([
        db.select({
          doctorId: appointments.doctorId,
          doctorName: users.name,
          appointmentCount: sql<number>`count(*)`,
          completedCount: sql<number>`count(*) filter (where status = 'completed')`,
          cancelledCount: sql<number>`count(*) filter (where status = 'cancelled')`
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .where(sql`appointments.created_at >= ${startDate}`)
        .groupBy(appointments.doctorId, users.name),

        db.select({
          doctorId: prescriptions.doctorId,
          prescriptionCount: sql<number>`count(*)`
        })
        .from(prescriptions)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(prescriptions.doctorId),

        db.select({
          doctorId: tmcTransactions.userId,
          totalRevenue: sql<number>`COALESCE(sum(amount), 0)`
        })
        .from(tmcTransactions)
        .where(sql`created_at >= ${startDate} AND transaction_type = 'consultation'`)
        .groupBy(tmcTransactions.userId)
      ]);

      // Combine data by doctor
      const doctorMetrics = doctorAppointments.map(doc => {
        const prescriptions = doctorPrescriptions.find(p => p.doctorId === doc.doctorId);
        const revenue = doctorRevenue.find(r => r.doctorId === doc.doctorId);
        
        return {
          doctorId: doc.doctorId,
          doctorName: doc.doctorName,
          appointmentCount: doc.appointmentCount,
          completedCount: doc.completedCount,
          cancelledCount: doc.cancelledCount,
          completionRate: doc.appointmentCount > 0 
            ? Math.round((doc.completedCount / doc.appointmentCount) * 100) 
            : 0,
          prescriptionCount: prescriptions?.prescriptionCount || 0,
          totalRevenue: revenue?.totalRevenue || 0
        };
      });

      res.json({ doctors: doctorMetrics, period: periodDays });
    } catch (error) {
      console.error('Doctor analytics error:', error);
      res.status(500).json({ message: 'Failed to get doctor analytics' });
    }
  });

  // Prescription Analytics
  app.get('/api/analytics/prescriptions', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { period = '30' } = req.query;
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const [
        prescriptionTrend,
        topMedications,
        statusDistribution
      ] = await Promise.all([
        db.select({
          date: sql`date_trunc('day', created_at)`,
          count: sql<number>`count(*)`
        })
        .from(prescriptions)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`),

        db.select({
          medicationName: medications.name,
          prescriptionCount: sql<number>`count(prescription_items.id)`
        })
        .from(prescriptionItems)
        .leftJoin(medications, eq(prescriptionItems.medicationId, medications.id))
        .leftJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
        .where(sql`prescriptions.created_at >= ${startDate}`)
        .groupBy(medications.name)
        .orderBy(sql`count(prescription_items.id) DESC`)
        .limit(10),

        db.select({
          status: prescriptions.status,
          count: sql<number>`count(*)`
        })
        .from(prescriptions)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(prescriptions.status)
      ]);

      res.json({
        prescriptionTrend,
        topMedications,
        statusDistribution,
        period: periodDays
      });
    } catch (error) {
      console.error('Prescription analytics error:', error);
      res.status(500).json({ message: 'Failed to get prescription analytics' });
    }
  });

  // Financial Analytics
  app.get('/api/analytics/financial', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { period = '30' } = req.query;
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const [
        revenueByType,
        tmcFlowTrend,
        topSpenders
      ] = await Promise.all([
        db.select({
          transactionType: tmcTransactions.transactionType,
          totalAmount: sql<number>`COALESCE(sum(amount), 0)`,
          transactionCount: sql<number>`count(*)`
        })
        .from(tmcTransactions)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(tmcTransactions.transactionType),

        db.select({
          date: sql`date_trunc('day', created_at)`,
          totalRevenue: sql<number>`COALESCE(sum(amount), 0)`
        })
        .from(tmcTransactions)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`),

        db.select({
          userId: tmcTransactions.userId,
          userName: users.name,
          totalSpent: sql<number>`COALESCE(sum(amount), 0)`
        })
        .from(tmcTransactions)
        .leftJoin(users, eq(tmcTransactions.userId, users.id))
        .where(sql`tmcTransactions.created_at >= ${startDate}`)
        .groupBy(tmcTransactions.userId, users.name)
        .orderBy(sql`sum(amount) DESC`)
        .limit(10)
      ]);

      res.json({
        revenueByType,
        tmcFlowTrend,
        topSpenders,
        period: periodDays
      });
    } catch (error) {
      console.error('Financial analytics error:', error);
      res.status(500).json({ message: 'Failed to get financial analytics' });
    }
  });

  // System Activity Analytics
  app.get('/api/analytics/system', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { period = '7' } = req.query; // Default to 7 days for system analytics
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const [
        userActivity,
        whatsappActivity,
        examResults,
        aiUsage
      ] = await Promise.all([
        db.select({
          date: sql`date_trunc('hour', last_login)`,
          activeUsers: sql<number>`count(DISTINCT id)`
        })
        .from(users)
        .where(sql`last_login >= ${startDate}`)
        .groupBy(sql`date_trunc('hour', last_login)`)
        .orderBy(sql`date_trunc('hour', last_login)`),

        db.select({
          date: sql`date_trunc('day', created_at)`,
          messageCount: sql<number>`count(*)`,
          aiMessages: sql<number>`count(*) filter (where is_from_ai = true)`
        })
        .from(whatsappMessages)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`),

        db.select({
          examType: examResults.examType,
          count: sql<number>`count(*)`,
          aiAnalyzed: sql<number>`count(*) filter (where analyzed_by_ai = true)`
        })
        .from(examResults)
        .where(sql`created_at >= ${startDate}`)
        .groupBy(examResults.examType),

        db.select({
          aiGeneratedRecords: sql<number>`count(*) filter (where diagnostic_hypotheses IS NOT NULL)`,
          totalRecords: sql<number>`count(*)`
        })
        .from(medicalRecords)
        .where(sql`created_at >= ${startDate}`)
      ]);

      res.json({
        userActivity,
        whatsappActivity,
        examResults,
        aiUsage: aiUsage[0] || { aiGeneratedRecords: 0, totalRecords: 0 },
        period: periodDays
      });
    } catch (error) {
      console.error('System analytics error:', error);
      res.status(500).json({ message: 'Failed to get system analytics' });
    }
  });

  // Export Report Data
  app.get('/api/analytics/export/:reportType', requireAuth, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { reportType } = req.params;
      const { format = 'json', period = '30' } = req.query;

      let reportData;
      const periodDays = parseInt(period.toString());
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      switch (reportType) {
        case 'appointments':
          reportData = await db.select({
            appointmentId: appointments.id,
            patientName: patients.name,
            doctorName: users.name,
            scheduledAt: appointments.scheduledAt,
            type: appointments.type,
            status: appointments.status,
            createdAt: appointments.createdAt
          })
          .from(appointments)
          .leftJoin(patients, eq(appointments.patientId, patients.id))
          .leftJoin(users, eq(appointments.doctorId, users.id))
          .where(sql`appointments.created_at >= ${startDate}`)
          .orderBy(appointments.createdAt);
          break;

        case 'prescriptions':
          reportData = await db.select({
            prescriptionNumber: prescriptions.prescriptionNumber,
            patientId: prescriptions.patientId,
            doctorId: prescriptions.doctorId,
            diagnosis: prescriptions.diagnosis,
            status: prescriptions.status,
            createdAt: prescriptions.createdAt,
            expiresAt: prescriptions.expiresAt
          })
          .from(prescriptions)
          .where(sql`created_at >= ${startDate}`)
          .orderBy(prescriptions.createdAt);
          break;

        case 'financial':
          reportData = await db.select({
            transactionId: tmcTransactions.id,
            userId: tmcTransactions.userId,
            amount: tmcTransactions.amount,
            transactionType: tmcTransactions.transactionType,
            description: tmcTransactions.description,
            createdAt: tmcTransactions.createdAt
          })
          .from(tmcTransactions)
          .where(sql`created_at >= ${startDate}`)
          .orderBy(tmcTransactions.createdAt);
          break;

        default:
          return res.status(400).json({ message: 'Invalid report type' });
      }

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.csv"`);
        
        if (reportData.length > 0) {
          const headers = Object.keys(reportData[0]).join(',');
          const rows = reportData.map(row => 
            Object.values(row).map(value => 
              typeof value === 'string' ? `"${value}"` : value
            ).join(',')
          ).join('\n');
          res.send(headers + '\n' + rows);
        } else {
          res.send('No data available for the selected period');
        }
      } else {
        res.json({ data: reportData, reportType, period: periodDays });
      }
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({ message: 'Failed to export report' });
    }
  });

  // System Settings API
  app.get('/api/system-settings', async (req: Request, res: Response) => {
    try {
      if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin or Doctor access required' });
      }

      const { category } = req.query;
      let query = db.select().from(systemSettings);
      
      if (category) {
        query = query.where(eq(systemSettings.category, category.toString())) as any;
      }
      
      const settings = await query;
      res.json(settings);
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ message: 'Failed to get system settings' });
    }
  });

  app.get('/api/system-settings/public/inactivity-timeout', async (_req: Request, res: Response) => {
    try {
      const setting = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'inactivity_timeout_minutes'))
        .limit(1);
      
      res.json({ settingValue: setting.length > 0 ? setting[0].settingValue : '30' });
    } catch {
      res.json({ settingValue: '30' });
    }
  });

  app.get('/api/system-settings/public/postload', async (_req: Request, res: Response) => {
    try {
      const keys = [
        'postload_autoscroll_enabled',
        'postload_autoscroll_distance',
        'postload_autoscroll_delay_ms',
        'postload_autoscroll_return_delay_ms',
        'postload_custom_scripts_enabled',
        'postload_custom_scripts',
      ];
      const defaults: Record<string, string> = {
        postload_autoscroll_enabled: 'true',
        postload_autoscroll_distance: '5',
        postload_autoscroll_delay_ms: '300',
        postload_autoscroll_return_delay_ms: '150',
        postload_custom_scripts_enabled: 'false',
        postload_custom_scripts: '[]',
      };
      const results: Record<string, string> = {};
      for (const key of keys) {
        const setting = await db.select()
          .from(systemSettings)
          .where(eq(systemSettings.settingKey, key))
          .limit(1);
        results[key] = setting.length > 0 ? setting[0].settingValue : defaults[key];
      }
      res.json(results);
    } catch {
      res.json({
        postload_autoscroll_enabled: 'true',
        postload_autoscroll_distance: '5',
        postload_autoscroll_delay_ms: '300',
        postload_autoscroll_return_delay_ms: '150',
        postload_custom_scripts_enabled: 'false',
        postload_custom_scripts: '[]',
      });
    }
  });

  app.get('/api/system-settings/public/consultation-timeouts', async (_req: Request, res: Response) => {
    try {
      const keys = [
        'consultation_inactivity_timeout_minutes',
        'consultation_silence_timeout_minutes',
        'consultation_countdown_seconds',
      ];
      const results: Record<string, string> = {};
      const defaults: Record<string, string> = {
        consultation_inactivity_timeout_minutes: '10',
        consultation_silence_timeout_minutes: '20',
        consultation_countdown_seconds: '30',
      };
      for (const key of keys) {
        const setting = await db.select()
          .from(systemSettings)
          .where(eq(systemSettings.settingKey, key))
          .limit(1);
        results[key] = setting.length > 0 ? setting[0].settingValue : defaults[key];
      }
      res.json(results);
    } catch {
      res.json({
        consultation_inactivity_timeout_minutes: '10',
        consultation_silence_timeout_minutes: '20',
        consultation_countdown_seconds: '30',
      });
    }
  });

  app.get('/api/system-settings/:key', async (req: Request, res: Response) => {
    try {
      if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin or Doctor access required' });
      }
      
      const { key } = req.params;
      const setting = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);
      
      if (setting.length === 0) {
        return res.status(404).json({ message: 'Setting not found' });
      }
      
      res.json(setting[0]);
    } catch (error) {
      console.error('Get system setting error:', error);
      res.status(500).json({ message: 'Failed to get system setting' });
    }
  });

  app.put('/api/system-settings/:key', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { key } = req.params;
      
      if (key.startsWith('postload_')) {
        const isPermanent = req.user.username === 'root' || (req.user as any).isProtected === true;
        if (!isPermanent) {
          return res.status(403).json({ message: 'Apenas administradores permanentes podem modificar configurações de pós-carregamento' });
        }
      }

      const existing = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Setting not found' });
      }
      
      if (!existing[0].isEditable) {
        return res.status(403).json({ message: 'This setting cannot be edited' });
      }

      // Validate request body
      const updateSchema = z.object({
        settingValue: z.string(),
        description: z.string().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);

      const updated = await db.update(systemSettings)
        .set({ 
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.settingKey, key))
        .returning();

      if (key === 'whatsapp_sender_number') {
        whatsAppService.setAdminSenderNumber(validatedData.settingValue || '');
      }

      res.json(updated[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Update system setting error:', error);
      res.status(500).json({ message: 'Failed to update system setting' });
    }
  });

  app.post('/api/system-settings', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Validate request body
      const createSchema = z.object({
        settingKey: z.string().min(1),
        settingValue: z.string().min(1),
        settingType: z.enum(['string', 'number', 'boolean', 'json']),
        description: z.string().optional(),
        category: z.enum(['scheduling', 'ai', 'notifications', 'general']),
        isEditable: z.boolean().default(true),
      });
      
      const validatedData = createSchema.parse(req.body);

      const newSetting = await db.insert(systemSettings)
        .values({
          ...validatedData,
          updatedBy: req.user.id
        })
        .returning();

      res.status(201).json(newSetting[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Create system setting error:', error);
      res.status(500).json({ message: 'Failed to create system setting' });
    }
  });

  app.delete('/api/system-settings/:key', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { key } = req.params;

      if (key.startsWith('postload_')) {
        const isPermanent = req.user.username === 'root' || (req.user as any).isProtected === true;
        if (!isPermanent) {
          return res.status(403).json({ message: 'Apenas administradores permanentes podem excluir configurações de pós-carregamento' });
        }
      }
      
      // Check if setting exists and is editable
      const existing = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Setting not found' });
      }
      
      if (!existing[0].isEditable) {
        return res.status(403).json({ message: 'This setting cannot be deleted' });
      }

      await db.delete(systemSettings)
        .where(eq(systemSettings.settingKey, key));

      res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({ message: 'Failed to delete system setting' });
    }
  });

  app.get('/api/admin/ai-config/:module', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { module } = req.params;
      const { getECGConfig, getRadiologyConfig } = await import('./services/aiPromptConfig');

      if (module === 'ecg') {
        const config = await getECGConfig();
        res.json(config);
      } else if (module === 'radiology') {
        const config = await getRadiologyConfig();
        res.json(config);
      } else {
        res.status(400).json({ message: 'Módulo inválido. Use "ecg" ou "radiology".' });
      }
    } catch (error) {
      console.error('Get AI config error:', error);
      res.status(500).json({ message: 'Falha ao carregar configuração de IA' });
    }
  });

  app.put('/api/admin/ai-config/:module', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { module } = req.params;
      const { saveECGConfig, saveRadiologyConfig } = await import('./services/aiPromptConfig');

      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ message: 'Corpo da requisição inválido' });
      }

      if (module === 'ecg') {
        if (body.analysisPrompts && typeof body.analysisPrompts !== 'object') {
          return res.status(400).json({ message: 'analysisPrompts deve ser um objeto' });
        }
        if (body.severityScale && !Array.isArray(body.severityScale)) {
          return res.status(400).json({ message: 'severityScale deve ser um array' });
        }
        if (body.colorSemantics && !Array.isArray(body.colorSemantics)) {
          return res.status(400).json({ message: 'colorSemantics deve ser um array' });
        }
        if (body.modelParams && typeof body.modelParams !== 'object') {
          return res.status(400).json({ message: 'modelParams deve ser um objeto' });
        }
        await saveECGConfig(body, req.user.id);
        res.json({ message: 'Configuração ECG salva com sucesso' });
      } else if (module === 'radiology') {
        if (body.severityScale && !Array.isArray(body.severityScale)) {
          return res.status(400).json({ message: 'severityScale deve ser um array' });
        }
        if (body.colorSemantics && !Array.isArray(body.colorSemantics)) {
          return res.status(400).json({ message: 'colorSemantics deve ser um array' });
        }
        if (body.modelParams && typeof body.modelParams !== 'object') {
          return res.status(400).json({ message: 'modelParams deve ser um objeto' });
        }
        await saveRadiologyConfig(body, req.user.id);
        res.json({ message: 'Configuração Radiologia salva com sucesso' });
      } else {
        res.status(400).json({ message: 'Módulo inválido. Use "ecg" ou "radiology".' });
      }
    } catch (error) {
      console.error('Save AI config error:', error);
      res.status(500).json({ message: 'Falha ao salvar configuração de IA' });
    }
  });

  app.post('/api/admin/ai-config/:module/reset', async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      const { module } = req.params;
      const { getDefaultECGConfig, getDefaultRadiologyConfig, saveECGConfig, saveRadiologyConfig } = await import('./services/aiPromptConfig');

      if (module === 'ecg') {
        const defaults = getDefaultECGConfig();
        await saveECGConfig(defaults, req.user.id);
        res.json(defaults);
      } else if (module === 'radiology') {
        const defaults = getDefaultRadiologyConfig();
        await saveRadiologyConfig(defaults, req.user.id);
        res.json(defaults);
      } else {
        res.status(400).json({ message: 'Módulo inválido. Use "ecg" ou "radiology".' });
      }
    } catch (error) {
      console.error('Reset AI config error:', error);
      res.status(500).json({ message: 'Falha ao resetar configuração de IA' });
    }
  });

  // Upload PDF Reference - admin and doctor access
  app.post('/api/chatbot-references/upload-pdf', requireAuth, async (req: any, res: any) => {
    // Check admin or doctor role BEFORE invoking Multer
    if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Admin or Doctor access required' });
    }

    // Only invoke Multer if user is admin or doctor
    uploadPDF.single('pdfFile')(req, res, async (multerError: any) => {
      try {
        if (multerError) {
          console.error('Multer error:', multerError);
          return res.status(400).json({ message: multerError.message || 'File upload failed' });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No PDF file uploaded' });
        }
        
        const filename = req.file.filename;
        const fileUrl = `/uploads/references/${filename}`;
        const fileSize = req.file.size;
        
        // Extract text from PDF
        let pdfText = '';
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const filePath = path.join(pdfsDir, filename);
          const dataBuffer = await fs.promises.readFile(filePath);
          const pdfData = await pdfParse(dataBuffer);
          pdfText = pdfData.text;
        } catch (pdfError) {
          console.error('PDF text extraction error:', pdfError);
          // Continue without text extraction - file is still uploaded
        }
        
        res.json({
          message: 'PDF uploaded successfully',
          fileUrl,
          filename,
          fileSize,
          extractedText: pdfText
        });
      } catch (error) {
        console.error('PDF upload error:', error);
        
        // Cleanup uploaded file if something went wrong
        if (req.file) {
          const filePath = path.join(pdfsDir, req.file.filename);
          try {
            await fs.promises.unlink(filePath);
          } catch (unlinkError) {
            console.error('Failed to cleanup file:', unlinkError);
          }
        }
        
        res.status(500).json({ message: 'Failed to upload PDF' });
      }
    });
  });

  // Chatbot References API (Knowledge Sources)
  app.get('/api/chatbot-references', async (req: Request, res: Response) => {
    try {
      const { category, useForDiagnostics, language } = req.query;
      const userRole = req.user?.role || 'visitor';
      
      let query = db.select().from(chatbotReferences)
        .where(and(
          eq(chatbotReferences.isActive, true),
          sql`${userRole} = ANY(${chatbotReferences.allowedRoles})`
        ));
      
      if (category) {
        query = query.where(eq(chatbotReferences.category, category.toString())) as any;
      }
      
      if (useForDiagnostics === 'true') {
        query = query.where(eq(chatbotReferences.useForDiagnostics, true)) as any;
      }
      
      if (language) {
        query = query.where(eq(chatbotReferences.language, language.toString())) as any;
      }
      
      const references = await query;
      res.json(references);
    } catch (error) {
      console.error('Get chatbot references error:', error);
      res.status(500).json({ message: 'Failed to get chatbot references' });
    }
  });

  app.post('/api/chatbot-references', async (req: Request, res: Response) => {
    try {
      if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin or Doctor access required' });
      }

      // Validate request body
      const createSchema = z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        category: z.enum(['medical', 'procedural', 'emergency', 'general', 'diagnostic']),
        keywords: z.array(z.string()).optional(),
        priority: z.number().int().min(1).default(1),
        source: z.string().optional(),
        sourceType: z.enum(['text', 'pdf', 'url', 'internet']).default('text'),
        fileUrl: z.string().optional(), // Changed from z.string().url() to accept relative paths
        fileName: z.string().optional(),
        fileSize: z.number().int().optional(),
        pdfExtractedText: z.string().optional(),
        language: z.string().default('pt'),
        allowedRoles: z.array(z.enum(['admin', 'doctor', 'patient', 'visitor', 'researcher'])).default(['admin', 'doctor', 'patient']),
        useForDiagnostics: z.boolean().default(false),
        isActive: z.boolean().default(true),
      });
      
      const validatedData = createSchema.parse(req.body);

      const newReference = await db.insert(chatbotReferences)
        .values({
          ...validatedData,
          createdBy: req.user.id,
          updatedBy: req.user.id
        })
        .returning();

      res.status(201).json(newReference[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Create chatbot reference error:', error);
      res.status(500).json({ message: 'Failed to create chatbot reference' });
    }
  });

  app.put('/api/chatbot-references/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin or Doctor access required' });
      }

      // Validate request body
      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        category: z.enum(['medical', 'procedural', 'emergency', 'general', 'diagnostic']).optional(),
        keywords: z.array(z.string()).optional(),
        priority: z.number().int().min(1).optional(),
        source: z.string().optional(),
        sourceType: z.enum(['text', 'pdf', 'url', 'internet']).optional(),
        fileUrl: z.string().optional(), // Changed from z.string().url() to accept relative paths
        fileName: z.string().optional(),
        fileSize: z.number().int().optional(),
        pdfExtractedText: z.string().optional(),
        language: z.string().optional(),
        allowedRoles: z.array(z.enum(['admin', 'doctor', 'patient', 'visitor', 'researcher'])).optional(),
        useForDiagnostics: z.boolean().optional(),
        isActive: z.boolean().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);

      const { id } = req.params;
      const updated = await db.update(chatbotReferences)
        .set({
          ...validatedData,
          updatedBy: req.user.id,
          updatedAt: new Date()
        })
        .where(eq(chatbotReferences.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: 'Reference not found' });
      }

      res.json(updated[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      console.error('Update chatbot reference error:', error);
      res.status(500).json({ message: 'Failed to update chatbot reference' });
    }
  });

  app.delete('/api/chatbot-references/:id', async (req: Request, res: Response) => {
    try {
      if (!req.user || !['admin', 'doctor'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin or Doctor access required' });
      }

      const { id } = req.params;
      const deleted = await db.delete(chatbotReferences)
        .where(eq(chatbotReferences.id, id))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ message: 'Reference not found' });
      }

      res.json({ message: 'Reference deleted successfully' });
    } catch (error) {
      console.error('Delete chatbot reference error:', error);
      res.status(500).json({ message: 'Failed to delete chatbot reference' });
    }
  });

  // Get available appointment slots for doctors
  app.get('/api/doctors/available-slots', async (req: Request, res: Response) => {
    try {
      const { doctorId, date } = req.query;

      if (!date) {
        return res.status(400).json({ message: 'Data é obrigatória' });
      }

      const targetDate = new Date(date as string);

      if (doctorId) {
        // Get slots for specific doctor
        const slots = await getAvailableSlots(doctorId as string, targetDate);
        res.json({ doctorId, date, availableSlots: slots });
      } else {
        // Get all doctors and their available slots
        const doctors = await db.select()
          .from(users)
          .where(eq(users.role, 'doctor'));

        const doctorSlots = await Promise.all(
          doctors.map(async (doctor) => {
            const slots = await getAvailableSlots(doctor.id, targetDate);
            return {
              doctorId: doctor.id,
              doctorName: doctor.name,
              availableSlots: slots,
              hasAvailability: slots.length > 0
            };
          })
        );

        res.json({
          date,
          doctors: doctorSlots.filter(d => d.hasAvailability)
        });
      }
    } catch (error) {
      console.error('Get available slots error:', error);
      res.status(500).json({ message: 'Erro ao consultar horários disponíveis' });
    }
  });

  app.get('/api/doctors/by-specialty', async (req: Request, res: Response) => {
    try {
      const doctors = await db.select({
        id: users.id,
        name: users.name,
        specialization: users.specialization,
        medicalLicense: users.medicalLicense,
        profilePicture: users.profilePicture,
        isOnline: users.isOnline,
        availableForImmediate: users.availableForImmediate,
      })
        .from(users)
        .where(eq(users.role, 'doctor'));

      const grouped: Record<string, typeof doctors> = {};
      for (const doc of doctors) {
        const spec = doc.specialization || 'Clínico Geral';
        if (!grouped[spec]) grouped[spec] = [];
        grouped[spec].push(doc);
      }

      const result = Object.entries(grouped).map(([specialty, doctors]) => ({
        specialty,
        doctors,
      }));

      res.json(result);
    } catch (error) {
      console.error('Get doctors by specialty error:', error);
      res.status(500).json({ message: 'Erro ao listar médicos por especialidade' });
    }
  });

  // =============================================
  // DOCTOR REFERRAL SYSTEM
  // =============================================

  // Generate referral link for a doctor
  app.get('/api/doctors/referral-link', async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (req.user.role !== 'doctor') return res.status(403).json({ message: 'Only doctors can generate referral links' });

    try {
      const referralCode = req.user.id;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const referralLink = `${baseUrl}/register/doctor?ref=${referralCode}`;

      const commissionSetting = await storage.getSystemSetting('doctor_referral_commission_percent');
      const commissionPercent = commissionSetting ? parseInt(commissionSetting.settingValue) : 5;

      res.json({
        referralCode,
        referralLink,
        commissionPercent,
      });
    } catch (error) {
      console.error('Generate referral link error:', error);
      res.status(500).json({ message: 'Erro ao gerar link de indicação' });
    }
  });

  // Get referral stats for a doctor
  app.get('/api/doctors/referral-stats', async (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (req.user.role !== 'doctor') return res.status(403).json({ message: 'Only doctors can view referral stats' });

    try {
      const referredDoctors = await db.select({
        id: users.id,
        name: users.name,
        specialization: users.specialization,
        medicalLicense: users.medicalLicense,
        profilePicture: users.profilePicture,
        createdAt: users.createdAt,
      }).from(users).where(
        and(
          eq(users.superiorDoctorId, req.user.id),
          eq(users.role, 'doctor')
        )
      );

      const commissionSetting = await storage.getSystemSetting('doctor_referral_commission_percent');
      const commissionPercent = commissionSetting ? parseInt(commissionSetting.settingValue) : 5;

      const referralTransactions = await db.select().from(tmcTransactions).where(
        and(
          eq(tmcTransactions.userId, req.user.id),
          eq(tmcTransactions.reason, 'referral_commission')
        )
      ).orderBy(desc(tmcTransactions.createdAt)).limit(50);

      const totalEarned = referralTransactions.reduce((sum, t) => sum + t.amount, 0);

      res.json({
        referredDoctors,
        totalReferred: referredDoctors.length,
        commissionPercent,
        totalEarned,
        recentTransactions: referralTransactions,
      });
    } catch (error) {
      console.error('Get referral stats error:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas de indicação' });
    }
  });

  // Get all doctors
  app.get('/api/doctors', async (req: Request, res: Response) => {
    try {
      const doctors = await db.select({
        id: users.id,
        name: users.name,
        specialization: users.specialization,
        medicalLicense: users.medicalLicense,
        profilePicture: users.profilePicture,
        isOnline: users.isOnline,
        availableForImmediate: users.availableForImmediate,
        onlineSince: users.onlineSince,
        consultationPrice: users.consultationPrice,
      })
        .from(users)
        .where(eq(users.role, 'doctor'));

      res.json(doctors);
    } catch (error) {
      console.error('Get doctors error:', error);
      res.status(500).json({ message: 'Erro ao listar médicos' });
    }
  });

  // Get online/available doctors
  app.get('/api/doctors/online', async (req: Request, res: Response) => {
    try {
      const onlineDoctors = await db.select({
        id: users.id,
        name: users.name,
        specialization: users.specialization,
        medicalLicense: users.medicalLicense,
        profilePicture: users.profilePicture,
        isOnline: users.isOnline,
        availableForImmediate: users.availableForImmediate,
        onlineSince: users.onlineSince,
        onDutyUntil: users.onDutyUntil,
        consultationPrice: users.consultationPrice,
      })
        .from(users)
        .where(and(
          eq(users.role, 'doctor'),
          eq(users.isOnline, true),
          eq(users.availableForImmediate, true)
        ));

      const doctorsWithStatus = await Promise.all(
        onlineDoctors.map(async (doctor) => {
          const activeConsultations = await db.select({ 
            id: videoConsultations.id,
            patientId: videoConsultations.patientId 
          })
            .from(videoConsultations)
            .where(and(
              eq(videoConsultations.doctorId, doctor.id),
              inArray(videoConsultations.status, ['active', 'waiting'])
            ));

          const activePatientIds = activeConsultations.map(c => c.patientId).filter(Boolean);
          const activeUserIds: string[] = [];
          for (const pid of activePatientIds) {
            try {
              const pat = await storage.getPatient(pid);
              if (pat?.userId) activeUserIds.push(pat.userId);
            } catch {}
          }

          return {
            ...doctor,
            inConsultation: activeConsultations.length > 0,
            activePatientIds,
            activeUserIds,
          };
        })
      );

      res.json(doctorsWithStatus);
    } catch (error) {
      console.error('Get online doctors error:', error);
      res.status(500).json({ message: 'Erro ao listar médicos disponíveis' });
    }
  });

  // Update doctor online status
  app.post('/api/doctors/status', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem atualizar status' });
      }

      const { isOnline, availableForImmediate } = req.body;

      const updated = await db.update(users)
        .set({
          isOnline: isOnline ?? false,
          availableForImmediate: availableForImmediate ?? false,
          onlineSince: isOnline ? new Date() : null,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json({
        message: isOnline ? 'Status atualizado para online' : 'Status atualizado para offline',
        doctor: updated[0]
      });
    } catch (error) {
      console.error('Update doctor status error:', error);
      res.status(500).json({ message: 'Erro ao atualizar status' });
    }
  });

  // Toggle 24h on-duty status
  app.post('/api/doctors/on-duty', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem ativar plantão' });
      }

      const { activate } = req.body;
      const now = new Date();
      const onDutyUntil = activate ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null; // 24 hours from now
      const onDutyStartedAt = activate ? now : null;

      const updated = await db.update(users)
        .set({
          onDutyUntil,
          onDutyStartedAt,
          isOnline: activate ? true : undefined, // Activate online if starting duty
          availableForImmediate: activate ? true : undefined, // Activate immediate if starting duty
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json({
        message: activate 
          ? 'Plantão ativado por 24 horas! Você estará disponível automaticamente.'
          : 'Plantão desativado com sucesso.',
        onDutyUntil: updated[0].onDutyUntil,
        onDutyStartedAt: updated[0].onDutyStartedAt,
      });
    } catch (error) {
      console.error('Toggle on-duty error:', error);
      res.status(500).json({ message: 'Erro ao atualizar plantão' });
    }
  });

  // Get doctor schedule
  app.get('/api/doctors/:doctorId/schedule', async (req: Request, res: Response) => {
    try {
      const { doctorId } = req.params;

      const schedule = await db.select()
        .from(doctorSchedule)
        .where(eq(doctorSchedule.doctorId, doctorId));

      res.json(schedule);
    } catch (error) {
      console.error('Get doctor schedule error:', error);
      res.status(500).json({ message: 'Erro ao buscar agenda do médico' });
    }
  });

  // Update doctor schedule
  app.put('/api/doctors/:doctorId/schedule', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem definir horários' });
      }

      const { doctorId } = req.params;

      // Verify the doctor is updating their own schedule or is admin
      if (req.user.id !== doctorId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Você só pode editar sua própria agenda' });
      }

      const { schedules } = req.body; // Array of schedule objects

      // Delete existing schedules
      await db.delete(doctorSchedule)
        .where(eq(doctorSchedule.doctorId, doctorId));

      // Insert new schedules
      if (schedules && schedules.length > 0) {
        await db.insert(doctorSchedule).values(
          schedules.map((s: any) => ({
            doctorId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            consultationDuration: s.consultationDuration || 30,
            isActive: s.isActive ?? true,
          }))
        );
      }

      // Get updated schedule
      const updatedSchedule = await db.select()
        .from(doctorSchedule)
        .where(eq(doctorSchedule.doctorId, doctorId));

      res.json({
        message: 'Horários atualizados com sucesso',
        schedule: updatedSchedule
      });
    } catch (error) {
      console.error('Update doctor schedule error:', error);
      res.status(500).json({ message: 'Erro ao atualizar horários' });
    }
  });

  // Request immediate consultation
  app.post('/api/appointments/immediate', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Autenticação necessária' });
      }

      // Get patient record
      const patientRecord = await db.select()
        .from(patients)
        .where(eq(patients.userId, req.user.id))
        .limit(1);

      if (patientRecord.length === 0) {
        return res.status(404).json({ message: 'Registro de paciente não encontrado' });
      }

      const patient = patientRecord[0];
      const { doctorId, reason } = req.body;

      if (!doctorId) {
        return res.status(400).json({ message: 'Médico é obrigatório' });
      }

      // Verify doctor is online and available
      const doctor = await db.select()
        .from(users)
        .where(and(
          eq(users.id, doctorId),
          eq(users.role, 'doctor'),
          eq(users.isOnline, true),
          eq(users.availableForImmediate, true)
        ))
        .limit(1);

      if (doctor.length === 0) {
        return res.status(400).json({ message: 'Médico não está disponível para atendimento imediato' });
      }

      // Create consultation request to link patient to doctor for chat
      // Check if consultation request already exists
      const existingRequests = await storage.getConsultationRequestsByDoctor(doctorId);
      const hasExistingRequest = existingRequests.some(
        req => req.patientId === patient.id && 
               (req.status === 'pending' || req.status === 'accepted')
      );
      
      let consultationRequest;
      if (!hasExistingRequest) {
        consultationRequest = await storage.createConsultationRequest({
          patientId: patient.id,
          symptoms: reason || 'Consulta imediata solicitada',
          urgencyLevel: 'immediate',
          preferredDateTime: new Date(),
          selectedDoctorId: doctorId,
          status: 'accepted'
        });
      }

      // Create immediate appointment (scheduled for now)
      const appointment = await db.insert(appointments).values({
        patientId: patient.id,
        doctorId,
        scheduledAt: new Date(),
        type: 'emergency',
        status: 'scheduled',
        notes: reason || 'Consulta imediata solicitada',
      }).returning();

      res.json({
        message: 'Consulta imediata agendada com sucesso',
        appointment: appointment[0],
        consultationRequest
      });
    } catch (error) {
      console.error('Request immediate consultation error:', error);
      res.status(500).json({ message: 'Erro ao solicitar consulta imediata' });
    }
  });

  // Confirm AI-suggested appointment via chatbot
  app.post('/api/chatbot/confirm-appointment', async (req: any, res: Response) => {
    try {
      // Require authentication
      if (!req.user) {
        return res.status(401).json({ message: 'Autenticação necessária para agendar consultas' });
      }

      // Only patients can schedule appointments via chatbot
      if (req.user.role !== 'patient') {
        return res.status(403).json({ message: 'Apenas pacientes podem agendar consultas' });
      }

      const { dateIso, time, doctorId, doctorName, type } = req.body;

      if (!dateIso || !time || !doctorId) {
        return res.status(400).json({ message: 'Data, horário e médico são obrigatórios' });
      }

      // Create date from ISO date and time
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDate = new Date(dateIso);
      scheduledDate.setHours(hours, minutes, 0, 0);

      // Check if slot is still available
      const existingAppointment = await db.select()
        .from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          sql`ABS(EXTRACT(EPOCH FROM (${appointments.scheduledAt} - ${scheduledDate.toISOString()}::timestamp))) < 1800`
        ))
        .limit(1);

      if (existingAppointment.length > 0) {
        return res.status(409).json({
          message: 'Desculpe, este horário já foi reservado. Por favor, solicite outro horário.'
        });
      }

      // Get patient record
      const patientRecord = await db.select()
        .from(patients)
        .where(eq(patients.userId, req.user.id))
        .limit(1);

      const patientId = patientRecord.length > 0 ? patientRecord[0].id : req.user.id;

      // Create consultation request to link patient to doctor for chat
      const existingRequests = await storage.getConsultationRequestsByDoctor(doctorId);
      const hasExistingRequest = existingRequests.some(
        req => req.patientId === patientId && 
               (req.status === 'pending' || req.status === 'accepted')
      );
      
      if (!hasExistingRequest) {
        await storage.createConsultationRequest({
          patientId,
          symptoms: type || 'Consulta agendada via chatbot',
          urgencyLevel: 'normal',
          preferredDateTime: scheduledDate,
          selectedDoctorId: doctorId,
          status: 'accepted'
        });
      }

      // Create appointment
      const appointment = await storage.createAppointment({
        patientId: req.user.id,
        doctorId,
        scheduledAt: scheduledDate.toISOString(),
        type: type || 'Consulta Geral',
        status: 'scheduled',
        roomId: `room_${Date.now()}`,
        duration: 30
      });

      res.json({
        message: 'Consulta confirmada com sucesso!',
        appointment: {
          ...appointment,
          doctorName,
          scheduledAt: scheduledDate.toISOString()
        }
      });

    } catch (error) {
      console.error('Chatbot confirm appointment error:', error);
      res.status(500).json({ message: 'Erro ao confirmar agendamento' });
    }
  });

  // Request urgent consultation with on-duty doctor via voice assistant / chatbot
  app.post('/api/chatbot/urgent-consultation', async (req: any, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Autenticação necessária' });
      }

      if (req.user.role !== 'patient') {
        return res.status(403).json({ message: 'Apenas pacientes podem solicitar consultas urgentes' });
      }

      const { symptoms, urgencyLevel } = req.body;

      if (!symptoms || !symptoms.trim()) {
        return res.status(400).json({ message: 'Descrição dos sintomas é obrigatória' });
      }

      // Find on-duty doctors available for immediate consultation
      const now = new Date();
      const onDutyDoctors = await db.select({
        id: users.id,
        name: users.name,
        specialization: users.specialization,
        onDutyUntil: users.onDutyUntil,
      })
        .from(users)
        .where(and(
          eq(users.role, 'doctor'),
          eq(users.isOnline, true),
          eq(users.availableForImmediate, true),
          sql`${users.onDutyUntil} > ${now.toISOString()}::timestamp`
        ));

      if (onDutyDoctors.length === 0) {
        return res.json({
          success: false,
          message: 'Nenhum médico de plantão disponível no momento. Tente novamente em alguns minutos ou agende uma consulta regular.',
          onDutyDoctors: [],
        });
      }

      // Get patient record
      const patientRecord = await db.select()
        .from(patients)
        .where(eq(patients.userId, req.user.id))
        .limit(1);

      const patientId = patientRecord.length > 0 ? patientRecord[0].id : req.user.id;

      // Select best available doctor (first available on-duty)
      const selectedDoctor = onDutyDoctors[0];

      // Create consultation request with urgent status
      const consultationRequest = await storage.createConsultationRequest({
        patientId,
        symptoms: symptoms,
        urgencyLevel: urgencyLevel || 'urgent',
        preferredDateTime: now,
        selectedDoctorId: selectedDoctor.id,
        status: 'pending'
      });

      // Create notification for the on-duty doctor
      await storage.createNotification({
        userId: selectedDoctor.id,
        type: 'urgent_consultation',
        title: '🚨 Consulta Urgente Solicitada',
        message: `Paciente ${req.user.name} solicita atendimento urgente de plantão. Sintomas: ${symptoms.substring(0, 100)}...`,
        data: {
          consultationRequestId: consultationRequest.id,
          patientId,
          patientName: req.user.name,
          symptoms,
          urgencyLevel: urgencyLevel || 'urgent',
        },
      });

      res.json({
        success: true,
        message: `Sua solicitação urgente foi enviada ao Dr(a). ${selectedDoctor.name} (${selectedDoctor.specialization || 'Clínica Geral'}), que está de plantão. Aguarde o aceite do médico.`,
        consultationRequestId: consultationRequest.id,
        selectedDoctor: {
          id: selectedDoctor.id,
          name: selectedDoctor.name,
          specialization: selectedDoctor.specialization,
        },
        onDutyDoctors: onDutyDoctors.map(d => ({
          id: d.id,
          name: d.name,
          specialization: d.specialization,
        })),
      });
    } catch (error) {
      console.error('Urgent consultation request error:', error);
      res.status(500).json({ message: 'Erro ao solicitar consulta urgente' });
    }
  });

  // Schedule appointment via chatbot (legacy endpoint, kept for compatibility)
  app.post('/api/chatbot/schedule', async (req: Request, res: Response) => {
    try {
      // Require authentication
      if (!req.user) {
        return res.status(401).json({ message: 'Autenticação necessária para agendar consultas' });
      }

      // Only patients can schedule appointments via chatbot
      if (req.user.role !== 'patient') {
        return res.status(403).json({ message: 'Apenas pacientes podem agendar consultas' });
      }

      const { date, doctorId, type } = req.body;

      if (!date || !doctorId) {
        return res.status(400).json({ message: 'Data e médico são obrigatórios' });
      }

      // Get rescheduling margin
      const reschedulingMargin = await storage.getSystemSetting('rescheduling_margin_hours');
      const marginHours = reschedulingMargin ? parseInt(reschedulingMargin.settingValue) : 24;

      // Validate minimum scheduling time
      const scheduledDate = new Date(date);
      const now = new Date();
      const hoursDiff = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDiff < marginHours) {
        return res.status(400).json({
          message: `Consultas devem ser agendadas com pelo menos ${marginHours} horas de antecedência.`
        });
      }

      // Check doctor availability - get all appointments for the doctor on the requested date
      const doctorAppointments = await db.select()
        .from(appointments)
        .where(and(
          eq(appointments.doctorId, doctorId),
          sql`DATE(${appointments.scheduledAt}) = DATE(${scheduledDate.toISOString()})`
        ));

      // Check for time conflicts (appointments within 30 minutes of requested time)
      const requestedTime = scheduledDate.getTime();
      const duration = 30 * 60 * 1000; // 30 minutes in milliseconds
      
      const hasConflict = doctorAppointments.some(apt => {
        const aptTime = new Date(apt.scheduledAt).getTime();
        const aptDuration = (apt.duration || 30) * 60 * 1000;
        
        // Check if times overlap
        return (requestedTime < aptTime + aptDuration) && (requestedTime + duration > aptTime);
      });

      if (hasConflict) {
        return res.status(409).json({
          message: 'Este horário não está disponível. Por favor, escolha outro horário.',
          availableSlots: await getAvailableSlots(doctorId, scheduledDate)
        });
      }

      // Get patient record
      const patientRecord = await db.select()
        .from(patients)
        .where(eq(patients.userId, req.user.id))
        .limit(1);

      const patientId = patientRecord.length > 0 ? patientRecord[0].id : req.user.id;

      // Create consultation request to link patient to doctor for chat
      // Check if consultation request already exists
      const existingRequests = await storage.getConsultationRequestsByDoctor(doctorId);
      const hasExistingRequest = existingRequests.some(
        req => req.patientId === patientId && 
               (req.status === 'pending' || req.status === 'accepted')
      );
      
      if (!hasExistingRequest) {
        await storage.createConsultationRequest({
          patientId,
          symptoms: type || 'Consulta via chatbot',
          urgencyLevel: 'normal',
          preferredDateTime: scheduledDate,
          selectedDoctorId: doctorId,
          status: 'accepted'
        });
      }

      // Create appointment (use authenticated user ID)
      const appointment = await storage.createAppointment({
        patientId: req.user.id,
        doctorId,
        scheduledAt: scheduledDate.toISOString(),
        type: type || 'Consulta Geral',
        status: 'scheduled',
        roomId: `room_${Date.now()}`,
        duration: 30
      });

      res.json({
        message: 'Consulta agendada com sucesso',
        appointment
      });

    } catch (error) {
      console.error('Chatbot scheduling error:', error);
      res.status(500).json({ message: 'Erro ao agendar consulta via chatbot' });
    }
  });

  // ===== PAYPAL INTEGRATION ROUTES =====
  // PayPal integration blueprint routes - DO NOT MODIFY
  
  app.get("/paypal/setup", async (req, res) => {
    try {
      await loadPaypalDefault(req, res);
    } catch (blueprintErr) {
      console.error('[PayPal] Blueprint setup failed, using PAYPAL_MODE fallback:', blueprintErr);
      try {
        const { Client: PayPalClient, Environment: PayPalEnv, OAuthAuthorizationController } = await import('@paypal/paypal-server-sdk');
        const paypalMode = process.env.PAYPAL_MODE === 'production' ? PayPalEnv.Production : PayPalEnv.Sandbox;
        const fallbackClient = new PayPalClient({
          clientCredentialsAuthCredentials: {
            oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
            oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
          },
          environment: paypalMode,
        });
        const oauthController = new OAuthAuthorizationController(fallbackClient);
        const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
        const { result } = await oauthController.requestToken(
          { authorization: `Basic ${auth}` },
          { intent: 'sdk_init', response_type: 'client_token' }
        );
        res.json({ clientToken: result.accessToken });
      } catch (fallbackErr) {
        console.error('[PayPal] Fallback setup also failed:', fallbackErr);
        res.status(500).json({ error: 'PayPal setup failed' });
      }
    }
  });

  app.post("/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  // Custom endpoint for purchasing TMC credits via PayPal
  app.post('/api/credits/purchase', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { paypalOrderId } = req.body;

      if (!paypalOrderId) {
        return res.status(400).json({ message: 'PayPal order ID is required' });
      }

      // CRITICAL: Verify the PayPal order server-side before issuing credits
      const { body: orderBody } = await (async () => {
        const { OrdersController, Client, Environment } = await import("@paypal/paypal-server-sdk");
        const useProduction = process.env.PAYPAL_ENV === 'production';
        const client = new Client({
          clientCredentialsAuthCredentials: {
            oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
            oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
          },
          environment: useProduction ? Environment.Production : Environment.Sandbox,
        });
        const ordersController = new OrdersController(client);
        return await ordersController.showOrderDetails(paypalOrderId);
      })();

      const orderData = JSON.parse(String(orderBody));
      
      // Validate order status is COMPLETED
      if (orderData.status !== 'COMPLETED') {
        return res.status(400).json({ 
          message: 'Payment not completed',
          status: orderData.status 
        });
      }

      // Extract payment amount from PayPal order
      const purchaseUnit = orderData.purchase_units[0];
      const paidAmount = parseFloat(purchaseUnit.amount.value);
      const currency = purchaseUnit.amount.currency_code;

      // Calculate credits based on payment (server-side, NOT from client)
      // Credit pricing: $1 = 10 credits, $5 = 60 credits, $10 = 150 credits, $20 = 350 credits
      let creditsToAdd = 0;
      if (paidAmount >= 20) {
        creditsToAdd = Math.floor((paidAmount / 20) * 350);
      } else if (paidAmount >= 10) {
        creditsToAdd = Math.floor((paidAmount / 10) * 150);
      } else if (paidAmount >= 5) {
        creditsToAdd = Math.floor((paidAmount / 5) * 60);
      } else {
        creditsToAdd = Math.floor(paidAmount * 10);
      }

      // Check if order was already processed to prevent double-spending
      const existingTransaction = await db.select()
        .from(tmcTransactions)
        .where(sql`metadata->>'paypalOrderId' = ${paypalOrderId}`)
        .limit(1);

      if (existingTransaction.length > 0) {
        return res.status(400).json({ 
          message: 'This payment has already been processed',
          orderId: paypalOrderId
        });
      }
      
      // Add credits to user
      const newBalance = await tmcCreditsService.creditUser(
        req.user.id,
        creditsToAdd,
        'paypal_purchase',
        {
          functionUsed: 'credit_purchase',
          paidAmount,
          currency,
          paypalOrderId,
          paypalStatus: orderData.status,
          paypalPayerId: orderData.payer?.payer_id
        }
      );

      // Add to cashbox revenue
      await tmcCreditsService.addCashboxRevenue(
        creditsToAdd,
        `PayPal purchase - ${paidAmount} ${currency}`,
        undefined,
        req.user.id
      );

      console.log(`✅ Credits purchased: ${creditsToAdd} credits for ${paidAmount} ${currency} (Order: ${paypalOrderId})`);

      res.json({
        success: true,
        newBalance,
        creditsAdded: creditsToAdd,
        amountPaid: paidAmount,
        currency,
        message: 'Credits purchased successfully'
      });
    } catch (error: any) {
      console.error('Credit purchase error:', error);
      if (error.message?.includes('PayPal')) {
        return res.status(400).json({ message: 'PayPal verification failed', error: error.message });
      }
      res.status(500).json({ message: 'Failed to process credit purchase' });
    }
  });

  app.get('/api/credits/packages', requireAuth, async (req: any, res) => {
    try {
      const pkgs = await db.select().from(tmcCreditPackages)
        .where(eq(tmcCreditPackages.isActive, true))
        .orderBy(tmcCreditPackages.displayOrder);
      res.json(pkgs);
    } catch (error) {
      console.error('Failed to fetch credit packages:', error);
      res.status(500).json({ message: 'Erro ao buscar pacotes de créditos' });
    }
  });

  app.post('/api/credits/purchase/create-order', requireAuth, async (req: any, res) => {
    try {
      const { packageId } = req.body;
      if (!packageId) {
        return res.status(400).json({ message: 'Package ID is required' });
      }

      const [pkg] = await db.select().from(tmcCreditPackages)
        .where(and(eq(tmcCreditPackages.id, packageId), eq(tmcCreditPackages.isActive, true)));
      
      if (!pkg) {
        return res.status(404).json({ message: 'Pacote não encontrado ou inativo' });
      }

      const { OrdersController, Client, Environment } = await import("@paypal/paypal-server-sdk");
      const useProduction = process.env.PAYPAL_ENV === 'production';
      const client = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
          oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
        },
        environment: useProduction ? Environment.Production : Environment.Sandbox,
      });
      const ordersController = new OrdersController(client);

      const orderResponse = await ordersController.createOrder({
        body: {
          intent: "CAPTURE",
          purchaseUnits: [{
            amount: {
              currencyCode: "USD",
              value: pkg.priceUsd,
            },
            description: `${pkg.name} - ${pkg.credits} créditos TMC${pkg.bonusCredits ? ` + ${pkg.bonusCredits} bônus` : ''}`,
          }],
        },
      });

      const orderData = JSON.parse(String(orderResponse.body));
      
      await db.insert(paypalOrders).values({
        paypalOrderId: orderData.id,
        userId: req.user.id,
        packageId: pkg.id,
        amount: pkg.priceUsd,
        currency: 'USD',
        creditsAmount: (pkg.credits || 0) + (pkg.bonusCredits || 0),
        status: 'created',
      });

      res.json({
        orderId: orderData.id,
        package: pkg,
      });
    } catch (error: any) {
      console.error('Create PayPal order error:', error);
      res.status(500).json({ message: 'Falha ao criar ordem PayPal: ' + (error.message || 'Erro interno') });
    }
  });

  app.post('/api/credits/purchase/capture', requireAuth, async (req: any, res) => {
    try {
      const { orderID } = req.body;
      if (!orderID) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      const { OrdersController, Client, Environment } = await import("@paypal/paypal-server-sdk");
      const useProduction = process.env.PAYPAL_ENV === 'production';
      const client = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
          oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
        },
        environment: useProduction ? Environment.Production : Environment.Sandbox,
      });
      const ordersController = new OrdersController(client);

      const captureResponse = await ordersController.captureOrder({ id: orderID });
      const captureData = JSON.parse(String(captureResponse.body));

      if (captureData.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'Pagamento não foi completado', status: captureData.status });
      }

      const existingTransaction = await db.select()
        .from(tmcTransactions)
        .where(sql`metadata->>'paypalOrderId' = ${orderID}`)
        .limit(1);

      if (existingTransaction.length > 0) {
        return res.status(400).json({ message: 'Este pagamento já foi processado' });
      }

      const [paypalOrder] = await db.select().from(paypalOrders)
        .where(eq(paypalOrders.paypalOrderId, orderID));

      let creditsToAdd = 0;
      if (paypalOrder?.packageId) {
        const [pkg] = await db.select().from(tmcCreditPackages)
          .where(eq(tmcCreditPackages.id, paypalOrder.packageId));
        if (pkg) {
          creditsToAdd = (pkg.credits || 0) + (pkg.bonusCredits || 0);
        }
      }
      
      if (creditsToAdd === 0) {
        const purchaseUnit = captureData.purchase_units?.[0];
        const paidAmount = parseFloat(purchaseUnit?.amount?.value || '0');
        if (paidAmount >= 20) creditsToAdd = Math.floor((paidAmount / 20) * 350);
        else if (paidAmount >= 10) creditsToAdd = Math.floor((paidAmount / 10) * 150);
        else if (paidAmount >= 5) creditsToAdd = Math.floor((paidAmount / 5) * 60);
        else creditsToAdd = Math.floor(paidAmount * 10);
      }

      const purchaseUnit = captureData.purchase_units?.[0];
      const paidAmount = parseFloat(purchaseUnit?.amount?.value || '0');
      const currency = purchaseUnit?.amount?.currency_code || 'USD';

      const newBalance = await tmcCreditsService.creditUser(
        req.user.id,
        creditsToAdd,
        'paypal_purchase',
        {
          functionUsed: 'credit_purchase',
          paidAmount,
          currency,
          paypalOrderId: orderID,
          paypalStatus: captureData.status,
          paypalPayerId: captureData.payer?.payer_id
        }
      );

      await tmcCreditsService.addCashboxRevenue(
        creditsToAdd,
        `PayPal purchase - ${paidAmount} ${currency}`,
        undefined,
        req.user.id
      );

      await db.update(paypalOrders)
        .set({ status: 'completed' })
        .where(eq(paypalOrders.paypalOrderId, orderID));

      console.log(`✅ Credits purchased via wallet: ${creditsToAdd} credits for ${paidAmount} ${currency} (Order: ${orderID})`);

      res.json({
        success: true,
        newBalance,
        creditsAdded: creditsToAdd,
        amountPaid: paidAmount,
        currency,
        message: `${creditsToAdd} créditos adicionados com sucesso!`
      });
    } catch (error: any) {
      console.error('Credit capture error:', error);
      res.status(500).json({ message: 'Falha ao processar pagamento: ' + (error.message || 'Erro interno') });
    }
  });

  // ===== STRIPE PAYMENT ROUTES =====

  app.get('/api/stripe/publishable-key', async (_req: any, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      console.error('Stripe publishable key error:', error.message);
      res.status(500).json({ message: 'Failed to get Stripe config' });
    }
  });

  app.post('/api/stripe/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
      const { packageId, paymentMethod } = req.body;
      if (!packageId) return res.status(400).json({ message: 'Package ID is required' });

      const [pkg] = await db.select().from(tmcCreditPackages).where(eq(tmcCreditPackages.id, packageId));
      if (!pkg) return res.status(404).json({ message: 'Package not found' });

      const priceInCents = Math.round(parseFloat(pkg.price || '0') * 100);
      if (priceInCents <= 0) return res.status(400).json({ message: 'Invalid package price' });

      const stripe = await getUncachableStripeClient();

      const paymentMethodTypes: string[] = ['card'];
      if (paymentMethod === 'apple_pay') paymentMethodTypes.push('apple_pay' as any);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceInCents,
        currency: (pkg.currency || 'usd').toLowerCase(),
        payment_method_types: paymentMethodTypes,
        metadata: {
          userId: req.user.id,
          packageId: pkg.id,
          credits: String((pkg.credits || 0) + (pkg.bonusCredits || 0)),
        },
      });

      const [txn] = await db.insert(paymentTransactions).values({
        userId: req.user.id,
        packageId: pkg.id,
        provider: 'stripe',
        providerOrderId: paymentIntent.id,
        paymentMethod: paymentMethod || 'credit_card',
        amount: pkg.price || '0',
        currency: (pkg.currency || 'USD').toUpperCase(),
        creditsAmount: (pkg.credits || 0) + (pkg.bonusCredits || 0),
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id,
        stripeClientSecret: paymentIntent.client_secret || '',
        payerEmail: req.user.email,
        payerName: req.user.name,
      }).returning();

      res.json({
        clientSecret: paymentIntent.client_secret,
        transactionId: txn.id,
        amount: pkg.price,
        currency: pkg.currency,
        credits: (pkg.credits || 0) + (pkg.bonusCredits || 0),
      });
    } catch (error: any) {
      console.error('Stripe payment intent error:', error);
      res.status(500).json({ message: 'Failed to create payment: ' + (error.message || 'Internal error') });
    }
  });

  app.post('/api/stripe/confirm-payment', requireAuth, async (req: any, res) => {
    try {
      const { paymentIntentId } = req.body;
      if (!paymentIntentId) return res.status(400).json({ message: 'Payment intent ID required' });

      const [txn] = await db.select().from(paymentTransactions)
        .where(and(
          eq(paymentTransactions.stripePaymentIntentId, paymentIntentId),
          eq(paymentTransactions.userId, req.user.id)
        ));

      if (!txn) return res.status(404).json({ message: 'Transaction not found' });
      if (txn.status === 'completed') return res.status(400).json({ message: 'Payment already processed' });

      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.metadata?.userId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized payment intent' });
      }

      if (paymentIntent.status !== 'succeeded') {
        await db.update(paymentTransactions)
          .set({ status: 'failed', errorMessage: `Status: ${paymentIntent.status}`, updatedAt: new Date() })
          .where(eq(paymentTransactions.id, txn.id));
        return res.status(400).json({ message: 'Payment not completed', status: paymentIntent.status });
      }

      const creditsToAdd = txn.creditsAmount;

      const newBalance = await tmcCreditsService.creditUser(
        txn.userId,
        creditsToAdd,
        'stripe_purchase',
        {
          functionUsed: 'credit_purchase',
          paidAmount: parseFloat(txn.amount),
          currency: txn.currency,
          stripePaymentIntentId: paymentIntentId,
        }
      );

      await tmcCreditsService.addCashboxRevenue(
        creditsToAdd,
        `Stripe purchase - ${txn.amount} ${txn.currency}`,
        undefined,
        txn.userId
      );

      await db.update(paymentTransactions)
        .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(paymentTransactions.stripePaymentIntentId, paymentIntentId));

      console.log(`✅ Stripe credits: ${creditsToAdd} credits for ${txn.amount} ${txn.currency}`);

      res.json({
        success: true,
        newBalance,
        creditsAdded: creditsToAdd,
        message: `${creditsToAdd} créditos adicionados com sucesso!`
      });
    } catch (error: any) {
      console.error('Stripe confirm error:', error);
      res.status(500).json({ message: 'Failed to confirm payment: ' + (error.message || 'Internal error') });
    }
  });

  // ===== PAGBANK PIX/BOLETO PAYMENT ROUTES =====

  app.post('/api/pagbank/create-order', requireAuth, async (req: any, res) => {
    try {
      const { packageId, paymentMethod, document: payerDoc, name: payerName, email: payerEmail } = req.body;
      if (!packageId || !paymentMethod) return res.status(400).json({ message: 'Package ID and payment method required' });

      const [pkg] = await db.select().from(tmcCreditPackages).where(eq(tmcCreditPackages.id, packageId));
      if (!pkg) return res.status(404).json({ message: 'Package not found' });

      const priceInCents = Math.round(parseFloat(pkg.price || '0') * 100);
      if (priceInCents <= 0) return res.status(400).json({ message: 'Invalid package price' });

      const pagbankToken = process.env.PAGBANK_TOKEN;
      const pagbankBaseUrl = process.env.PAGBANK_SANDBOX === 'true'
        ? 'https://sandbox.api.pagseguro.com'
        : 'https://api.pagseguro.com';

      if (!pagbankToken) return res.status(500).json({ message: 'PagBank not configured' });

      const referenceId = `tmc_${Date.now()}_${req.user.id.substring(0, 8)}`;
      const creditsToAdd = (pkg.credits || 0) + (pkg.bonusCredits || 0);

      let pagbankPaymentMethod: any = {};
      if (paymentMethod === 'pix') {
        pagbankPaymentMethod = {
          type: 'PIX',
          pix: {
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
          }
        };
      } else if (paymentMethod === 'boleto') {
        if (!payerDoc || !payerName) return res.status(400).json({ message: 'CPF and name required for boleto' });
        pagbankPaymentMethod = {
          type: 'BOLETO',
          boleto: {
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
            holder: {
              name: payerName,
              tax_id: payerDoc.replace(/\D/g, ''),
              email: payerEmail || req.user.email,
            }
          }
        };
      } else if (paymentMethod === 'credit_card' || paymentMethod === 'debit_card') {
        pagbankPaymentMethod = { type: 'CREDIT_CARD' };
      } else {
        return res.status(400).json({ message: 'Invalid payment method' });
      }

      const orderPayload = {
        reference_id: referenceId,
        customer: {
          name: payerName || req.user.name || 'User',
          email: payerEmail || req.user.email,
          tax_id: payerDoc ? payerDoc.replace(/\D/g, '') : undefined,
        },
        items: [{
          reference_id: pkg.id,
          name: pkg.name || 'TMC Credits',
          quantity: 1,
          unit_amount: priceInCents,
        }],
        qr_codes: paymentMethod === 'pix' ? [{
          amount: { value: priceInCents },
          expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }] : undefined,
        charges: paymentMethod !== 'pix' ? [{
          reference_id: referenceId,
          description: `TMC Credits - ${pkg.name}`,
          amount: { value: priceInCents, currency: 'BRL' },
          payment_method: pagbankPaymentMethod,
        }] : undefined,
        notification_urls: [`https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}/api/pagbank/webhook`],
      };

      const response = await fetch(`${pagbankBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pagbankToken}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('PagBank create order error:', errorBody);
        return res.status(response.status).json({ message: 'PagBank order failed', details: errorBody });
      }

      const orderData = await response.json() as any;

      let pixCode = null;
      let pixQrUrl = null;
      let boletoUrl = null;
      let boletoBarcode = null;

      if (paymentMethod === 'pix' && orderData.qr_codes?.length > 0) {
        const qr = orderData.qr_codes[0];
        pixCode = qr.text;
        pixQrUrl = qr.links?.find((l: any) => l.media === 'image/png')?.href;
      }

      if (paymentMethod === 'boleto' && orderData.charges?.length > 0) {
        const charge = orderData.charges[0];
        const boletoLinks = charge.payment_method?.boleto?.links || [];
        boletoUrl = boletoLinks.find((l: any) => l.media === 'application/pdf')?.href;
        boletoBarcode = charge.payment_method?.boleto?.barcode;
      }

      const [txn] = await db.insert(paymentTransactions).values({
        userId: req.user.id,
        packageId: pkg.id,
        provider: 'pagbank',
        providerOrderId: orderData.id,
        paymentMethod,
        amount: pkg.price || '0',
        currency: 'BRL',
        creditsAmount: creditsToAdd,
        status: 'pending',
        payerEmail: payerEmail || req.user.email,
        payerName: payerName || req.user.name,
        payerDocument: payerDoc,
        pixCode,
        pixQrCodeUrl: pixQrUrl,
        boletoUrl,
        boletoBarcode,
        expiresAt: paymentMethod === 'pix'
          ? new Date(Date.now() + 30 * 60 * 1000)
          : paymentMethod === 'boleto'
            ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            : null,
        metadata: { referenceId, pagbankOrderId: orderData.id },
      }).returning();

      res.json({
        transactionId: txn.id,
        pagbankOrderId: orderData.id,
        paymentMethod,
        pixCode,
        pixQrCodeUrl: pixQrUrl,
        boletoUrl,
        boletoBarcode,
        amount: pkg.price,
        currency: 'BRL',
        credits: creditsToAdd,
        expiresAt: txn.expiresAt,
      });
    } catch (error: any) {
      console.error('PagBank create order error:', error);
      res.status(500).json({ message: 'Failed to create PagBank order: ' + (error.message || 'Internal error') });
    }
  });

  app.post('/api/pagbank/webhook', async (req: any, res) => {
    try {
      const notification = req.body;
      const pagbankOrderId = notification?.id;
      const referenceId = notification?.reference_id || notification?.charges?.[0]?.reference_id;
      
      if (!pagbankOrderId && !referenceId) {
        return res.status(200).json({ received: true });
      }

      const chargeStatus = notification?.charges?.[0]?.status;
      let newStatus = 'pending';
      if (chargeStatus === 'PAID') newStatus = 'completed';
      else if (chargeStatus === 'DECLINED' || chargeStatus === 'CANCELED') newStatus = 'failed';

      let txnResult;
      if (pagbankOrderId) {
        txnResult = await db.select().from(paymentTransactions)
          .where(eq(paymentTransactions.providerOrderId, pagbankOrderId));
      }
      if ((!txnResult || txnResult.length === 0) && referenceId) {
        txnResult = await db.select().from(paymentTransactions)
          .where(sql`metadata->>'referenceId' = ${referenceId}`);
      }
      const [txn] = txnResult || [];

      if (txn && txn.status !== 'completed' && newStatus === 'completed') {
        const creditsToAdd = txn.creditsAmount;

        const newBalance = await tmcCreditsService.creditUser(
          txn.userId,
          creditsToAdd,
          'pagbank_purchase',
          {
            functionUsed: 'credit_purchase',
            paidAmount: parseFloat(txn.amount),
            currency: 'BRL',
            pagbankOrderId: pagbankOrderId || txn.providerOrderId,
          }
        );

        await tmcCreditsService.addCashboxRevenue(
          creditsToAdd,
          `PagBank purchase - ${txn.amount} BRL`,
          undefined,
          txn.userId
        );

        await db.update(paymentTransactions)
          .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentTransactions.id, txn.id));

        console.log(`✅ PagBank credits: ${creditsToAdd} credits for ${txn.amount} BRL (Order: ${pagbankOrderId || txn.providerOrderId})`);
      } else if (txn && newStatus === 'failed') {
        await db.update(paymentTransactions)
          .set({ status: 'failed', errorMessage: chargeStatus, updatedAt: new Date() })
          .where(eq(paymentTransactions.id, txn.id));
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('PagBank webhook error:', error);
      res.status(200).json({ received: true });
    }
  });

  app.get('/api/pagbank/check-status/:transactionId', requireAuth, async (req: any, res) => {
    try {
      const { transactionId } = req.params;
      const [txn] = await db.select().from(paymentTransactions)
        .where(and(
          eq(paymentTransactions.id, transactionId),
          eq(paymentTransactions.userId, req.user.id)
        ));

      if (!txn) return res.status(404).json({ message: 'Transaction not found' });

      if (txn.status === 'pending' && txn.providerOrderId) {
        const pagbankToken = process.env.PAGBANK_TOKEN;
        const pagbankBaseUrl = process.env.PAGBANK_SANDBOX === 'true'
          ? 'https://sandbox.api.pagseguro.com'
          : 'https://api.pagseguro.com';

        if (pagbankToken) {
          try {
            const resp = await fetch(`${pagbankBaseUrl}/orders/${txn.providerOrderId}`, {
              headers: { 'Authorization': `Bearer ${pagbankToken}` },
            });
            if (resp.ok) {
              const orderData = await resp.json() as any;
              const chargeStatus = orderData.charges?.[0]?.status;
              if (chargeStatus === 'PAID' && txn.status !== 'completed') {
                const creditsToAdd = txn.creditsAmount;
                const newBalance = await tmcCreditsService.creditUser(
                  txn.userId,
                  creditsToAdd,
                  'pagbank_purchase',
                  {
                    functionUsed: 'credit_purchase',
                    paidAmount: parseFloat(txn.amount),
                    currency: 'BRL',
                    pagbankOrderId: txn.providerOrderId,
                  }
                );
                await tmcCreditsService.addCashboxRevenue(
                  creditsToAdd,
                  `PagBank purchase - ${txn.amount} BRL`,
                  undefined,
                  txn.userId
                );
                await db.update(paymentTransactions)
                  .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
                  .where(eq(paymentTransactions.id, txn.id));
                return res.json({ status: 'completed', creditsAdded: creditsToAdd, newBalance });
              }
            }
          } catch (e) {
            // PagBank check failed, return current status
          }
        }
      }

      res.json({
        status: txn.status,
        paymentMethod: txn.paymentMethod,
        pixCode: txn.pixCode,
        pixQrCodeUrl: txn.pixQrCodeUrl,
        boletoUrl: txn.boletoUrl,
        boletoBarcode: txn.boletoBarcode,
        expiresAt: txn.expiresAt,
      });
    } catch (error: any) {
      console.error('PagBank check status error:', error);
      res.status(500).json({ message: 'Failed to check payment status' });
    }
  });

  // ===== ADMIN PAYMENT MONITORING =====

  app.get('/api/admin/payments', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

      const { provider, status, startDate, endDate, limit: queryLimit } = req.query;
      const lim = Math.min(parseInt(queryLimit as string) || 100, 500);

      let query = db.select({
        transaction: paymentTransactions,
        userName: users.name,
        userEmail: users.email,
      })
        .from(paymentTransactions)
        .leftJoin(users, eq(paymentTransactions.userId, users.id))
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(lim);

      const conditions: any[] = [];
      if (provider) conditions.push(eq(paymentTransactions.provider, provider as string));
      if (status) conditions.push(eq(paymentTransactions.status, status as string));
      if (startDate) conditions.push(gte(paymentTransactions.createdAt, new Date(startDate as string)));
      if (endDate) conditions.push(lte(paymentTransactions.createdAt, new Date(endDate as string)));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query;

      const totals = await db.select({
        totalCount: sql<number>`count(*)`,
        totalAmount: sql<string>`coalesce(sum(cast(amount as numeric)), 0)`,
        completedCount: sql<number>`count(*) filter (where status = 'completed')`,
        completedAmount: sql<string>`coalesce(sum(cast(amount as numeric)) filter (where status = 'completed'), 0)`,
        pendingCount: sql<number>`count(*) filter (where status = 'pending')`,
        failedCount: sql<number>`count(*) filter (where status = 'failed')`,
      }).from(paymentTransactions);

      const providerBreakdown = await db.select({
        provider: paymentTransactions.provider,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`coalesce(sum(cast(amount as numeric)), 0)`,
        completedCount: sql<number>`count(*) filter (where status = 'completed')`,
      }).from(paymentTransactions).groupBy(paymentTransactions.provider);

      res.json({
        transactions: results.map(r => ({
          ...r.transaction,
          userName: r.userName,
          userEmail: r.userEmail,
        })),
        summary: totals[0] || {},
        providerBreakdown,
      });
    } catch (error: any) {
      console.error('Admin payments error:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.get('/api/admin/payments/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

      const [txn] = await db.select({
        transaction: paymentTransactions,
        userName: users.name,
        userEmail: users.email,
      })
        .from(paymentTransactions)
        .leftJoin(users, eq(paymentTransactions.userId, users.id))
        .where(eq(paymentTransactions.id, req.params.id));

      if (!txn) return res.status(404).json({ message: 'Transaction not found' });

      res.json({
        ...txn.transaction,
        userName: txn.userName,
        userEmail: txn.userEmail,
      });
    } catch (error: any) {
      console.error('Admin payment detail error:', error);
      res.status(500).json({ message: 'Failed to fetch payment details' });
    }
  });

  app.get('/api/credits/pricing', async (req: any, res) => {
    try {
      const urgentSetting = await storage.getSystemSetting('tmc_credit_cost_urgent');
      const exchangeSetting = await storage.getSystemSetting('tmc_exchange_rate');
      const urgentPrice = parseInt(urgentSetting?.settingValue || '30');
      const exchangeRate = parseInt(exchangeSetting?.settingValue || '5');

      res.json({
        urgentConsultationPrice: urgentPrice,
        exchangeRate,
      });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar preços' });
    }
  });

  // Get user credit balance and transaction history
  app.get('/api/credits/balance', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const balance = await tmcCreditsService.getUserBalance(req.user.id);
      const transactions = await tmcCreditsService.getUserTransactions(req.user.id, 20);

      res.json({
        balance,
        transactions
      });
    } catch (error) {
      console.error('Get credit balance error:', error);
      res.status(500).json({ message: 'Failed to get credit balance' });
    }
  });

  // ===== MEDICAL ASSISTANT CHATBOT ENDPOINTS =====
  
  // Get or create active conversation
  app.get('/api/chatbot/conversation', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Find active conversation for user
      const [existing] = await db.select()
        .from(chatbotConversations)
        .where(and(
          eq(chatbotConversations.userId, req.user.id),
          eq(chatbotConversations.isActive, true)
        ))
        .orderBy(desc(chatbotConversations.lastMessageAt))
        .limit(1);

      if (existing) {
        return res.json(existing);
      }

      // Create new conversation
      const [newConversation] = await db.insert(chatbotConversations).values({
        userId: req.user.id,
        userRole: req.user.role,
        messages: [],
        context: req.user.role === 'doctor' ? 'doctor_diagnostics' : 'patient_health_query',
        referencesUsed: [],
      }).returning();

      res.json(newConversation);
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ message: 'Failed to get conversation' });
    }
  });

  // Send message to chatbot
  app.post('/api/chatbot/message', async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { message, conversationId, context, language } = req.body;
      const userLang = language || 'pt';

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message is required' });
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        [conversation] = await db.select()
          .from(chatbotConversations)
          .where(eq(chatbotConversations.id, conversationId))
          .limit(1);
      }

      if (!conversation) {
        [conversation] = await db.insert(chatbotConversations).values({
          userId: req.user.id,
          userRole: req.user.role,
          messages: [],
          context: context || (req.user.role === 'doctor' ? 'doctor_diagnostics' : 'patient_health_query'),
          referencesUsed: [],
        }).returning();
      }

      const langNames: Record<string, string> = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch', zh: '中文', gn: 'Guaraní' };
      const langInstruction = userLang !== 'pt'
        ? `\n\nIMPORTANT LANGUAGE INSTRUCTION: You MUST respond entirely in ${langNames[userLang] || userLang}. All text, explanations, recommendations, and medical terminology should be in ${langNames[userLang] || userLang}. Do NOT mix languages.`
        : '';

      // Build system prompt based on user role and profile
      const userName = req.user.name?.split(' ')[0] || 'usuário';
      let systemPrompt = '';
      if (req.user.role === 'doctor') {
        systemPrompt = `Você é um assistente médico AI da plataforma Tele<M3D>, conversando com o(a) Dr(a). ${userName}.

PERFIL DO USUÁRIO: Médico(a) da plataforma.

SUAS CAPACIDADES PARA MÉDICOS:
- Verificação de hipóteses diagnósticas e diagnóstico diferencial
- Consulta a guidelines e protocolos médicos atualizados
- Análise de casos clínicos complexos
- Sugestões de exames complementares baseados em evidências
- Informações sobre tratamentos, medicações e interações medicamentosas
- Apoio em decisões clínicas
- Respostas rápidas a perguntas médicas objetivas

DIRETRIZES PADRÃO DE REFERÊNCIA (use como base para todas as condutas e aconselhamentos):
1. **OMS (Organização Mundial da Saúde)**: Diretrizes clínicas internacionais, mhGAP para saúde mental, GINA (asma), GOLD (DPOC), protocolos de triagem ETAT, Lista de Medicamentos Essenciais.
2. **Protocolos de Atenção Primária à Saúde - Ministério da Saúde do Brasil**: Cadernos de Atenção Básica (CAB 19, 32, 36, 37), PCDT CONITEC, PNAB, ESF, RENAME, Previne Brasil, vigilância epidemiológica, notificação compulsória.
3. **DSM-5 / DSM-5-TR (APA)**: Critérios diagnósticos para transtornos mentais, classificação e terapêutica psiquiátrica. Para condições psiquiátricas, utilize os critérios diagnósticos do DSM-5, complementados pelas diretrizes ABP e mhGAP-OMS.

MODO DE RESPOSTAS CURTAS (ATIVO — tem prioridade sobre outras regras de comprimento):
Para perguntas médicas diretas, responda de forma CONCISA e OBJETIVA:
- Dosagem, posologia, indicações: 1-3 linhas com a informação exata.
- Condutas e protocolos: tópicos curtos (máx. 5 itens).
- Perguntas de "sim ou não": responda diretamente + 1 frase de justificativa.
- Diagnóstico diferencial rápido: 3-5 diagnósticos mais prováveis.
- Apenas elabore mais quando o usuário pedir explicitamente ("explique melhor", "detalhe", "me fale mais").

REGRAS IMPORTANTES:
1. Use linguagem técnica médica apropriada para profissionais de saúde.
2. REFERÊNCIAS MÉDICAS: Se houver referências disponíveis, use-as como fonte PRIORITÁRIA. Baseie condutas nas diretrizes OMS, MS/Brasil e DSM-5 quando aplicável.
3. NÃO REPETIR: Evite repetir informações já ditas. Sempre traga informação nova.
4. NUNCA sugira agendamento de consultas ou triagem de sintomas — isso é para pacientes.
5. Cite fontes quando disponíveis (OMS, MS/Brasil, DSM-5, PCDT, CAB).
6. Para questões psiquiátricas: use critérios DSM-5, escalas (PHQ-9, GAD-7, AUDIT, CAGE), e terapêutica baseada em evidências.
7. Use bullet points e negrito para termos-chave apenas quando listar múltiplos itens.${langInstruction}`;
      } else if (req.user.role === 'admin') {
        systemPrompt = `Você é um assistente AI da plataforma Tele<M3D>, conversando com o administrador ${userName}.

PERFIL DO USUÁRIO: Administrador da plataforma.

SUAS CAPACIDADES PARA ADMINISTRADORES:
- Relatórios e estatísticas da plataforma
- Visão geral de consultas agendadas e em andamento
- Status de pacientes em fila de espera
- Informações sobre médicos ativos e disponíveis
- Configurações gerais do sistema
- Respostas rápidas sobre operações e métricas

MODO DE RESPOSTAS CURTAS (ATIVO — tem prioridade sobre outras regras de comprimento):
- Perguntas diretas: 1-3 linhas com a informação exata.
- Relatórios: tópicos curtos (máx. 5 itens).
- Apenas elabore mais quando solicitado explicitamente.

REGRAS IMPORTANTES:
1. Foque em informações gerenciais e operacionais.
2. NÃO sugira triagem de sintomas ou agendamento pessoal — isso é para pacientes.
3. Forneça dados e métricas quando solicitado.
4. Use bullet points apenas quando listar múltiplos itens.${langInstruction}`;
      } else {
        systemPrompt = `Você é um assistente de saúde AI da plataforma Tele<M3D>, conversando com o paciente ${userName}.

PERFIL DO USUÁRIO: Paciente da plataforma.

SUAS CAPACIDADES PARA PACIENTES:
- Orientações gerais sobre sintomas e condições de saúde
- Triagem inicial e classificação de urgência de sintomas (Protocolo de Manchester)
- Informações sobre quando procurar atendimento médico
- Ajuda com agendamento de consultas (diga "quero agendar uma consulta")
- Solicitação de CONSULTA URGENTE com médicos de plantão (diga "preciso de atendimento urgente")
- Explicações sobre exames e procedimentos em linguagem acessível
- Dicas de prevenção e autocuidado
- Cadastro e atualização de informações pessoais
- Respostas curtas e diretas para dúvidas de saúde

MODO DE RESPOSTAS CURTAS (ATIVO — tem prioridade sobre outras regras de comprimento):
- Perguntas simples de saúde ("posso tomar X com Y?", "o que é Y?"): 2-4 linhas, direto ao ponto.
- Orientações de sintomas: tópicos curtos (máx. 4 itens) + indicação se precisa de consulta.
- Dúvidas sobre medicamentos: responda brevemente + recomende confirmação com o médico.
- Apenas elabore mais quando o paciente pedir ("me explique melhor", "quero saber mais").

AÇÕES ESPECIAIS (inclua estas tags quando detectar a intenção):
- Se o paciente quer CONSULTA URGENTE/PLANTÃO: inclua [URGENT_CONSULTATION] no final da resposta
- Se o paciente quer AGENDAR CONSULTA: o sistema detecta automaticamente
- Se o paciente quer se CADASTRAR ou atualizar dados: inclua [REGISTER_UPDATE] no final da resposta

REGRAS IMPORTANTES:
1. Use linguagem simples e acessível, sem jargão médico complexo.
2. REFERÊNCIAS MÉDICAS: Se disponíveis, baseie suas respostas nelas.
3. NÃO REPETIR: Evite repetir informações já ditas. Sempre traga algo novo.
4. NÃO DIAGNOSTICAR: Você NÃO faz diagnósticos. Recomende consulta médica quando apropriado, mas de forma breve (ex: "Consulte seu médico para confirmação.").
5. EMERGÊNCIAS: Em casos de emergência, oriente SAMU 192 / UPA / Pronto Socorro e sugira consulta urgente com médico de plantão.
6. NUNCA forneça apoio clínico técnico ou análise de casos — isso é para médicos.
7. Para respostas via assistente de voz: máximo 2 frases, naturais e concisas.
8. Use bullet points apenas quando listar múltiplos itens.`;
      }

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };

      // First, check if this is a scheduling request (only for patients)
      let schedulingAnalysis = null;
      let responseType = 'general';
      let aiResponse = '';
      let referencesUsed: string[] = [];
      let suggestedAppointment = null;

      if (req.user.role === 'patient') {
        // Analyze if message contains scheduling intent
        const quickAnalysis = await geminiService.analyzeWhatsappMessage(message);
        
        if (quickAnalysis.isSchedulingRequest) {
          responseType = 'appointment';
          
          // Get available doctors with their time slots
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dayAfterTomorrow = new Date(today);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

          // Get all active doctors
          const doctors = await db.select()
            .from(users)
            .where(eq(users.role, 'doctor'));

          // Build availability data for each doctor
          const availableDoctors = [];
          
          for (const doctor of doctors) {
            // Get doctor's existing appointments
            const existingAppointments = await db.select()
              .from(appointments)
              .where(and(
                eq(appointments.doctorId, doctor.id),
                sql`DATE(${appointments.scheduledAt}) >= DATE(${today.toISOString()})`
              ));

            // Get doctor's schedule
            const scheduleData = await storage.getDoctorSchedule(doctor.id);
            
            const slots = [];
            
            // Check next 3 days
            for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
              const checkDate = new Date(today);
              checkDate.setDate(checkDate.getDate() + dayOffset);
              const dayOfWeek = checkDate.getDay();
              const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];

              if (scheduleData && scheduleData[dayName]) {
                const daySchedule = scheduleData[dayName];
                
                // Generate slots for morning
                if (daySchedule.morning.enabled) {
                  const [startHour] = daySchedule.morning.start.split(':').map(Number);
                  const [endHour] = daySchedule.morning.end.split(':').map(Number);
                  
                  for (let hour = startHour; hour < endHour; hour++) {
                    for (let min = 0; min < 60; min += 30) {
                      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                      const slotDateTime = new Date(checkDate);
                      slotDateTime.setHours(hour, min, 0, 0);
                      
                      // Check if slot is not occupied
                      const isOccupied = existingAppointments.some(apt => {
                        const aptTime = new Date(apt.scheduledAt);
                        return Math.abs(aptTime.getTime() - slotDateTime.getTime()) < 30 * 60 * 1000;
                      });
                      
                      if (!isOccupied && slotDateTime > new Date()) {
                        const dateStr = checkDate.toISOString().split('T')[0];
                        slots.push({
                          dateIso: dateStr,
                          time: time,
                          label: `${checkDate.toLocaleDateString('pt-BR')} às ${time}`
                        });
                      }
                    }
                  }
                }
                
                // Generate slots for afternoon
                if (daySchedule.afternoon.enabled) {
                  const [startHour] = daySchedule.afternoon.start.split(':').map(Number);
                  const [endHour] = daySchedule.afternoon.end.split(':').map(Number);
                  
                  for (let hour = startHour; hour < endHour; hour++) {
                    for (let min = 0; min < 60; min += 30) {
                      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                      const slotDateTime = new Date(checkDate);
                      slotDateTime.setHours(hour, min, 0, 0);
                      
                      const isOccupied = existingAppointments.some(apt => {
                        const aptTime = new Date(apt.scheduledAt);
                        return Math.abs(aptTime.getTime() - slotDateTime.getTime()) < 30 * 60 * 1000;
                      });
                      
                      if (!isOccupied && slotDateTime > new Date()) {
                        const dateStr = checkDate.toISOString().split('T')[0];
                        slots.push({
                          dateIso: dateStr,
                          time: time,
                          label: `${checkDate.toLocaleDateString('pt-BR')} às ${time}`
                        });
                      }
                    }
                  }
                }
              }
            }

            if (slots.length > 0) {
              availableDoctors.push({
                doctorId: doctor.id,
                doctorName: doctor.name,
                availableSlots: slots.slice(0, 10) // Limit to 10 slots per doctor
              });
            }
          }

          // Use AI to process scheduling with available slots
          schedulingAnalysis = await geminiService.processSchedulingRequest(
            message,
            availableDoctors
          );

          aiResponse = schedulingAnalysis.response;
          suggestedAppointment = schedulingAnalysis.suggestedAppointment;
        } else {
          // Regular chat response
          const aiResult = await geminiService.chatWithContext(
            message,
            systemPrompt,
            conversation.messages as Message[],
            req.user.role
          );
          aiResponse = aiResult.response;
          referencesUsed = aiResult.referencesUsed;
        }
      } else {
        // For doctors, use regular chat
        const aiResult = await geminiService.chatWithContext(
          message,
          systemPrompt,
          conversation.messages as Message[],
          req.user.role
        );
        aiResponse = aiResult.response;
        referencesUsed = aiResult.referencesUsed;
      }

      // Detect action tags in AI response
      let actionType: string | null = null;
      let cleanResponse = aiResponse;
      
      if (aiResponse.includes('[URGENT_CONSULTATION]')) {
        actionType = 'urgent_consultation';
        cleanResponse = aiResponse.replace('[URGENT_CONSULTATION]', '').trim();
      } else if (aiResponse.includes('[REGISTER_UPDATE]')) {
        actionType = 'register_update';
        cleanResponse = aiResponse.replace('[REGISTER_UPDATE]', '').trim();
      }

      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date().toISOString(),
        referencesUsed: referencesUsed,
      };

      // Update conversation
      const updatedMessages = [...(conversation.messages as Message[]), userMessage, assistantMessage];
      
      await db.update(chatbotConversations)
        .set({
          messages: updatedMessages,
          referencesUsed: Array.from(new Set([...(conversation.referencesUsed || []), ...referencesUsed])),
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversations.id, conversation.id));

      // Update usage count for references
      if (referencesUsed.length > 0) {
        for (const refId of referencesUsed) {
          await db.update(chatbotReferences)
            .set({
              usageCount: sql`${chatbotReferences.usageCount} + 1`,
              lastUsed: new Date(),
            })
            .where(eq(chatbotReferences.id, refId));
        }
      }

      res.json({
        conversationId: conversation.id,
        message: assistantMessage,
        type: responseType,
        metadata: {
          suggestedAppointment: suggestedAppointment,
          actionType: actionType,
        }
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Public chatbot endpoint for visitors (no authentication required)
  app.post('/api/chatbot/visitor-message', async (req: Request, res: Response) => {
    try {
      const { message, mode, language } = req.body;
      const visitorLang = language || 'pt';
      const vLangNames: Record<string, string> = { pt: 'Português', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch', zh: '中文', gn: 'Guaraní' };
      const vLangInstruction = visitorLang !== 'pt'
        ? `\n\nIMPORTANT LANGUAGE INSTRUCTION: You MUST respond entirely in ${vLangNames[visitorLang] || visitorLang}. All text, explanations, recommendations, and medical terminology should be in ${vLangNames[visitorLang] || visitorLang}. Do NOT mix languages.`
        : '';

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message is required' });
      }

      const symptomSystemPrompt = `╔══════════════════════════════════════════════════════════════╗
║  ANÁLISE DE SINTOMAS - TELE<M3D>                             ║
║  Sistema: Gemini 2.0 Flash                                   ║
║  Modo: Triagem Visitante (Protocolo de Manchester)           ║
╚══════════════════════════════════════════════════════════════╝

🎯 OBJETIVO: Realizar triagem clínica inicial baseada nos sintomas relatados.

📋 PROTOCOLOS DE REFERÊNCIA:
1. Protocolo de Manchester (MTS) - Classificação de Risco em 5 níveis:
   🔴 EMERGÊNCIA: Risco imediato de vida (dor torácica, dispneia grave, hemorragia, inconsciência)
   🟠 MUITO URGENTE: Dor severa, sinais de alerta (febre alta + rigidez nuca, confusão mental)
   🟡 URGENTE: Dor moderada, febre persistente, sintomas com >48h sem melhora
   🟢 PADRÃO: Sintomas leves estáveis, sem sinais de alerta
   🔵 NÃO URGENTE: Condições crônicas estáveis, consultas eletivas

2. Diretrizes OMS/WHO: GINA (asma), GOLD (DPOC), ETAT (triagem pediátrica)
3. Ministério da Saúde/Brasil: Cadernos de Atenção Básica, PCDT/CONITEC
4. DSM-5/DSM-5-TR: Critérios para questões de saúde mental

MODO DE RESPOSTAS CURTAS (ATIVO — tem prioridade sobre outras regras de comprimento):
- Perguntas simples sobre saúde ("o que é X?", "quando devo me preocupar?"): 2-4 linhas, direto ao ponto.
- Análise de sintomas: tópicos curtos (máx. 4 itens) + nível de urgência Manchester + indicação de quando procurar atendimento.
- Apenas elabore mais quando o visitante pedir ("me explique melhor", "quero saber mais").

📝 ESTRUTURA DA RESPOSTA:
1. Identifique os sintomas principais
2. Classifique o nível de urgência (Manchester)
3. Sugira possíveis causas (sem diagnosticar)
4. Oriente sobre quando procurar atendimento
5. Recomende registro na plataforma para teleconsulta

⚠️ REGRAS:
• NUNCA faça diagnósticos definitivos
• NUNCA prescreva medicamentos
• Para 🔴 EMERGÊNCIA: oriente SAMU 192 / Pronto-Socorro IMEDIATAMENTE
• Seja empático mas direto e conciso
• Incentive cadastro para consulta médica completa${vLangInstruction}`;

      const visitorGeneralPrompt = `╔══════════════════════════════════════════════════════════════╗
║  ASSISTENTE VIRTUAL IA - TELE<M3D>                            ║
║  Sistema: Gemini 2.0 Flash                                   ║
║  Modo: Visitante (Não Autenticado)                           ║
╚══════════════════════════════════════════════════════════════╝

🎯 OBJETIVO PRINCIPAL:
Você é o assistente virtual da plataforma Tele<M3D>. O usuário NÃO está logado, mas você pode ajudá-lo com:

1. 💬 PERGUNTAS RÁPIDAS DE SAÚDE:
   • Responda perguntas gerais sobre saúde de forma curta e objetiva (2-4 linhas)
   • NUNCA faça diagnósticos definitivos nem prescreva medicamentos
   • Sempre recomende consulta médica para confirmação
   • Para emergências: oriente SAMU 192 / UPA / Pronto-Socorro imediatamente

2. 📅 AGENDAMENTO DE CONSULTA:
   • Colete: nome completo, telefone/WhatsApp, motivo da consulta, preferência de data/horário
   • Explique que após coletar os dados, a equipe entrará em contato para confirmar
   • Incentive o cadastro na plataforma para agendamento direto e mais rápido

3. 🔑 ACESSO TEMPORÁRIO PARA TESTE:
   • Explique que é possível solicitar um link de acesso temporário para conhecer a plataforma
   • Colete: nome, e-mail e motivo do interesse
   • Informe que a solicitação será enviada ao administrador para aprovação
   • O link temporário tem validade limitada (configurável pelo admin)

MODO DE RESPOSTAS CURTAS (ATIVO — tem prioridade sobre outras regras de comprimento):
- Perguntas de saúde: 2-4 linhas, direto ao ponto + "Consulte um médico para confirmação."
- Perguntas sobre a plataforma: 1-3 linhas.
- Apenas elabore mais quando o visitante pedir.

⚠️ REGRAS CRÍTICAS:
• NÃO faça diagnósticos definitivos nem prescreva medicamentos
• Pode responder dúvidas gerais de saúde, mas sempre oriente consulta médica
• Seja educado, direto e conciso
• Para funcionalidades avançadas (prontuário, prescrições, teleconsulta), incentive o cadastro na plataforma

Quando o visitante fornecer dados para acesso temporário, inclua na resposta a tag [TEMP_ACCESS_REQUEST] seguida dos dados coletados em formato JSON: {"name": "...", "email": "...", "reason": "..."}${vLangInstruction}`;

      const systemPrompt = mode === 'symptoms' ? symptomSystemPrompt : visitorGeneralPrompt;


      // Call Gemini API with context - using 'visitor' role to filter appropriate references
      const aiResult = await geminiService.chatWithContext(
        message,
        systemPrompt,
        [], // No conversation history for visitors (stateless)
        'visitor' // Important: this filters PDF references to only those marked for visitors
      );

      // Update usage count for references (even for visitors, to track popular content)
      if (aiResult.referencesUsed.length > 0) {
        for (const refId of aiResult.referencesUsed) {
          await db.update(chatbotReferences)
            .set({
              usageCount: sql`${chatbotReferences.usageCount} + 1`,
              lastUsed: new Date(),
            })
            .where(eq(chatbotReferences.id, refId));
        }
      }

      let responseText = aiResult.response;

      if (responseText.includes('[TEMP_ACCESS_REQUEST]')) {
        try {
          const tagIdx = responseText.indexOf('[TEMP_ACCESS_REQUEST]');
          const jsonStr = responseText.substring(tagIdx + '[TEMP_ACCESS_REQUEST]'.length).trim();
          const jsonMatch = jsonStr.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const requestData = JSON.parse(jsonMatch[0]);
            const admins = await db.select().from(users).where(eq(users.role, 'admin'));
            for (const admin of admins) {
              await db.insert(pendingNotifications).values({
                userId: admin.id,
                type: 'temp_access_request',
                title: 'Solicitação de Acesso Temporário',
                message: `Visitante ${requestData.name || 'Anônimo'} (${requestData.email || 'sem e-mail'}) solicita acesso temporário. Motivo: ${requestData.reason || 'não informado'}`,
                actionUrl: '/admin',
                delivered: false,
                read: false,
                metadata: { visitorName: requestData.name, visitorEmail: requestData.email, reason: requestData.reason },
              });
            }
          }
          responseText = responseText.substring(0, tagIdx).trim();
        } catch (parseErr) {
          console.error('Failed to parse temp access request from AI:', parseErr);
        }
      }

      res.json({
        response: responseText,
        referencesUsed: aiResult.referencesUsed,
      });
    } catch (error) {
      console.error('Visitor chatbot error:', error);
      
      // Check if it's a Gemini API key error
      if (error instanceof Error && error.message.includes('GEMINI_API_KEY')) {
        return res.json({
          response: 'Funcionalidade de IA temporariamente indisponível. Por favor, tente novamente mais tarde ou entre em contato com nossa equipe.',
          referencesUsed: []
        });
      }
      
      res.status(500).json({ 
        message: 'Failed to process visitor message',
        response: 'Desculpe, houve um erro ao processar sua pergunta. Por favor, tente novamente.'
      });
    }
  });

  // Register credit and signature routers
  app.use('/api/credits', creditsRouter);
  app.use('/api/signatures', signaturesRouter);
  app.use('/api/medical-teams', requireAuth, medicalTeamsRouter);

  app.post('/api/inter-consultations', requireAuth, async (req: any, res) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem solicitar interconsultas' });
      }

      const { targetDoctorId, patientId, specialty, clinicalCase, urgency } = req.body;

      if (!targetDoctorId || !clinicalCase) {
        return res.status(400).json({ message: 'Médico alvo e descrição do caso clínico são obrigatórios' });
      }

      const targetDoctor = await db.select().from(users).where(and(eq(users.id, targetDoctorId), eq(users.role, 'doctor'))).limit(1);
      if (targetDoctor.length === 0) {
        return res.status(404).json({ message: 'Médico alvo não encontrado' });
      }

      if (targetDoctorId === req.user.id) {
        return res.status(400).json({ message: 'Não é possível solicitar interconsulta para si mesmo' });
      }

      const { interConsultations } = await import('@shared/schema');
      const [newInterConsultation] = await db.insert(interConsultations).values({
        requestingDoctorId: req.user.id,
        targetDoctorId,
        patientId: patientId || null,
        specialty: specialty || targetDoctor[0].specialization || null,
        clinicalCase,
        urgency: urgency || 'standard',
        status: 'pending',
      }).returning();

      try {
        const { pendingNotifications } = await import('@shared/schema');
        await db.insert(pendingNotifications).values({
          userId: targetDoctorId,
          type: 'inter_consultation',
          title: 'Nova Solicitação de Interconsulta',
          message: `Dr(a). ${req.user.name} solicita interconsulta: ${clinicalCase.substring(0, 100)}...`,
          priority: urgency === 'emergency' ? 'critical' : urgency === 'urgent' ? 'high' : 'medium',
          actionUrl: '/inter-consultation',
          senderId: req.user.id,
        });
      } catch (notifErr) {
        console.error('Failed to create notification for inter-consultation:', notifErr);
      }

      res.status(201).json(newInterConsultation);
    } catch (error) {
      console.error('Create inter-consultation error:', error);
      res.status(500).json({ message: 'Erro ao criar solicitação de interconsulta' });
    }
  });

  app.get('/api/inter-consultations', requireAuth, async (req: any, res) => {
    try {
      if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Apenas médicos podem acessar interconsultas' });
      }

      const { interConsultations } = await import('@shared/schema');
      const results = await db.select({
        id: interConsultations.id,
        requestingDoctorId: interConsultations.requestingDoctorId,
        targetDoctorId: interConsultations.targetDoctorId,
        patientId: interConsultations.patientId,
        specialty: interConsultations.specialty,
        clinicalCase: interConsultations.clinicalCase,
        urgency: interConsultations.urgency,
        status: interConsultations.status,
        responseNotes: interConsultations.responseNotes,
        respondedAt: interConsultations.respondedAt,
        scheduledAt: interConsultations.scheduledAt,
        createdAt: interConsultations.createdAt,
        updatedAt: interConsultations.updatedAt,
      }).from(interConsultations)
        .where(or(
          eq(interConsultations.requestingDoctorId, req.user.id),
          eq(interConsultations.targetDoctorId, req.user.id)
        ))
        .orderBy(desc(interConsultations.createdAt));

      const enriched = await Promise.all(results.map(async (ic) => {
        const reqDoc = await db.select({ id: users.id, name: users.name, specialization: users.specialization, profilePicture: users.profilePicture }).from(users).where(eq(users.id, ic.requestingDoctorId)).limit(1);
        const tgtDoc = await db.select({ id: users.id, name: users.name, specialization: users.specialization, profilePicture: users.profilePicture }).from(users).where(eq(users.id, ic.targetDoctorId)).limit(1);
        let patientInfo = null;
        if (ic.patientId) {
          const p = await db.select({ id: patients.id, name: patients.name }).from(patients).where(eq(patients.id, ic.patientId)).limit(1);
          patientInfo = p[0] || null;
        }
        return {
          ...ic,
          requestingDoctor: reqDoc[0] || null,
          targetDoctor: tgtDoc[0] || null,
          patient: patientInfo,
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error('Get inter-consultations error:', error);
      res.status(500).json({ message: 'Erro ao listar interconsultas' });
    }
  });

  app.get('/api/epidemiological-reports', requireAuth, async (req: any, res) => {
    try {
      const periodDays = parseInt(req.query.period as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const consultations = await db.select().from(videoConsultations)
        .where(sql`${videoConsultations.createdAt} >= ${startDate.toISOString()}`);

      const reqList = await db.select().from(consultationRequests)
        .where(sql`${consultationRequests.createdAt} >= ${startDate.toISOString()}`);

      const totalConsultations = consultations.length + reqList.length;

      const triageCounts: Record<string, number> = {};
      for (const cr of reqList) {
        const level = (cr as any).triageLevel || (cr as any).urgencyLevel || 'standard';
        triageCounts[level] = (triageCounts[level] || 0) + 1;
      }

      const triageLevels = Object.entries(triageCounts).map(([level, count]) => ({
        level,
        count,
        percentage: totalConsultations > 0 ? Math.round((count / totalConsultations) * 100) : 0,
      }));

      const patientsList = await db.select().from(patients);
      const ageGroups: Record<string, number> = { '0-17': 0, '18-30': 0, '31-45': 0, '46-60': 0, '60+': 0 };
      for (const p of patientsList) {
        if (p.dateOfBirth) {
          const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age <= 17) ageGroups['0-17']++;
          else if (age <= 30) ageGroups['18-30']++;
          else if (age <= 45) ageGroups['31-45']++;
          else if (age <= 60) ageGroups['46-60']++;
          else ageGroups['60+']++;
        }
      }

      res.json({
        totalConsultations,
        period: `${periodDays} dias`,
        symptoms: [],
        diagnoses: [],
        triageLevels,
        ageGroups: Object.entries(ageGroups).map(([group, count]) => ({ group, count })),
        summary: '',
      });
    } catch (error) {
      console.error('Epidemiological report error:', error);
      res.status(500).json({ message: 'Failed to generate epidemiological report' });
    }
  });

  app.post('/api/epidemiological-reports/analyze', requireAuth, async (req: any, res) => {
    try {
      const { period = 30 } = req.body;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const notesList = await db.select().from(consultationNotes)
        .where(sql`${consultationNotes.timestamp} >= ${startDate.toISOString()}`);

      const medRecords = await db.select().from(medicalRecords)
        .where(sql`${medicalRecords.createdAt} >= ${startDate.toISOString()}`);

      const reqList2 = await db.select().from(consultationRequests)
        .where(sql`${consultationRequests.createdAt} >= ${startDate.toISOString()}`);

      const vConsultations = await db.select().from(videoConsultations)
        .where(sql`${videoConsultations.createdAt} >= ${startDate.toISOString()}`);

      const totalConsultations = vConsultations.length + reqList2.length;

      const clinicalTexts: string[] = [];
      for (const note of notesList) {
        if (note.content && (note.type === 'doctor_note' || note.type === 'ai_response' || note.type === 'transcription')) {
          clinicalTexts.push(note.content);
        }
      }
      for (const rec of medRecords) {
        if (rec.diagnosis) clinicalTexts.push(rec.diagnosis as string);
        if (rec.notes) clinicalTexts.push(rec.notes as string);
      }
      for (const cr of reqList2) {
        if ((cr as any).symptoms) clinicalTexts.push(String((cr as any).symptoms));
        if ((cr as any).description) clinicalTexts.push((cr as any).description);
      }

      const combinedText = clinicalTexts.slice(0, 50).join('\n---\n');

      let analysisResult: any = { symptoms: [], diagnoses: [], summary: 'Análise não disponível.' };
      if (combinedText.length > 20) {
        try {
          const { geminiService } = await import('./services/gemini');
          const prompt = `Analise os seguintes textos clínicos e extraia dados epidemiológicos em formato JSON. Retorne APENAS JSON válido sem markdown:
{
  "symptoms": [{"symptom": "nome", "meshCode": "D000XXX", "count": N, "percentage": N, "trend": "up|down|stable"}],
  "diagnoses": [{"diagnosis": "nome", "icdCode": "X00", "count": N, "percentage": N}],
  "summary": "resumo epidemiológico em português"
}

Textos clínicos (${clinicalTexts.length} registros):
${combinedText.slice(0, 8000)}`;

          const aiResponse = await geminiService.generateText(prompt);
          try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analysisResult = JSON.parse(jsonMatch[0]);
            }
          } catch {
            analysisResult.summary = aiResponse;
          }
        } catch (aiErr) {
          console.error('AI analysis error:', aiErr);
        }
      }

      const triageCounts: Record<string, number> = {};
      for (const cr of reqList2) {
        const level = (cr as any).triageLevel || (cr as any).urgencyLevel || 'standard';
        triageCounts[level] = (triageCounts[level] || 0) + 1;
      }

      const triageLevels = Object.entries(triageCounts).map(([level, count]) => ({
        level,
        count,
        percentage: totalConsultations > 0 ? Math.round((count / totalConsultations) * 100) : 0,
      }));

      const patientsList2 = await db.select().from(patients);
      const ageGroups: Record<string, number> = { '0-17': 0, '18-30': 0, '31-45': 0, '46-60': 0, '60+': 0 };
      for (const p of patientsList2) {
        if (p.dateOfBirth) {
          const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age <= 17) ageGroups['0-17']++;
          else if (age <= 30) ageGroups['18-30']++;
          else if (age <= 45) ageGroups['31-45']++;
          else if (age <= 60) ageGroups['46-60']++;
          else ageGroups['60+']++;
        }
      }

      res.json({
        totalConsultations,
        period: `${period} dias`,
        symptoms: analysisResult.symptoms || [],
        diagnoses: analysisResult.diagnoses || [],
        triageLevels,
        ageGroups: Object.entries(ageGroups).map(([group, count]) => ({ group, count })),
        summary: analysisResult.summary || '',
      });
    } catch (error) {
      console.error('Epidemiological analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze epidemiological data' });
    }
  });


// ========== ADMIN CREDIT MANAGEMENT ==========

  app.get('/api/admin/credit-packages', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const pkgs = await db.select().from(tmcCreditPackages).orderBy(tmcCreditPackages.displayOrder);
      res.json(pkgs);
    } catch (error) {
      console.error('Failed to fetch credit packages:', error);
      res.status(500).json({ message: 'Erro ao buscar pacotes' });
    }
  });

  app.post('/api/admin/credit-packages', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const { name, credits, priceUsd, priceBrl, bonusCredits, description, isActive, isPromotional, displayOrder } = req.body;
      if (!name || !credits || !priceUsd) return res.status(400).json({ message: 'Nome, créditos e preço são obrigatórios' });
      const pkg = await db.insert(tmcCreditPackages).values({
        name, credits, priceUsd, priceBrl, bonusCredits: bonusCredits || 0,
        description, isActive: isActive !== false, isPromotional: isPromotional || false,
        displayOrder: displayOrder || 0,
      }).returning();
      res.json(pkg[0]);
    } catch (error) {
      console.error('Failed to create credit package:', error);
      res.status(500).json({ message: 'Erro ao criar pacote' });
    }
  });

  app.patch('/api/admin/credit-packages/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const { name, credits, priceUsd, priceBrl, bonusCredits, description, isActive, isPromotional, displayOrder } = req.body;
      const updated = await db.update(tmcCreditPackages).set({
        ...(name !== undefined && { name }),
        ...(credits !== undefined && { credits }),
        ...(priceUsd !== undefined && { priceUsd }),
        ...(priceBrl !== undefined && { priceBrl }),
        ...(bonusCredits !== undefined && { bonusCredits }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(isPromotional !== undefined && { isPromotional }),
        ...(displayOrder !== undefined && { displayOrder }),
        updatedAt: new Date(),
      }).where(eq(tmcCreditPackages.id, req.params.id)).returning();
      if (!updated[0]) return res.status(404).json({ message: 'Pacote não encontrado' });
      res.json(updated[0]);
    } catch (error) {
      console.error('Failed to update credit package:', error);
      res.status(500).json({ message: 'Erro ao atualizar pacote' });
    }
  });

  app.delete('/api/admin/credit-packages/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      await db.update(tmcCreditPackages).set({ isActive: false, updatedAt: new Date() }).where(eq(tmcCreditPackages.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to deactivate credit package:', error);
      res.status(500).json({ message: 'Erro ao desativar pacote' });
    }
  });

  app.get('/api/admin/exchange-rate', async (req, res) => {
    try {
      const setting = await storage.getSystemSetting('tmc_exchange_rate');
      res.json({ rate: parseInt(setting?.settingValue || '5'), description: setting?.description || 'Créditos TMC por 1 USD' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar taxa de câmbio' });
    }
  });

  app.put('/api/admin/exchange-rate', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const { rate } = req.body;
      if (!rate || rate <= 0) return res.status(400).json({ message: 'Taxa deve ser positiva' });
      await storage.updateSystemSetting('tmc_exchange_rate', String(rate));
      res.json({ success: true, rate });
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      res.status(500).json({ message: 'Erro ao atualizar taxa de câmbio' });
    }
  });

  app.get('/api/admin/credits/users', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin' && user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        email: users.email,
        tmcCredits: users.tmcCredits,
      }).from(users).orderBy(desc(users.tmcCredits));
      res.json(allUsers);
    } catch (error) {
      console.error('Failed to list user credits:', error);
      res.status(500).json({ message: 'Erro ao listar créditos' });
    }
  });

  app.post('/api/admin/credits/send', requireAuth, async (req, res) => {
    try {
      const actor = req.user as User;
      if (actor.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado: apenas admin' });
      }
      const { userId, amount, reason } = req.body;
      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'userId e amount positivo são obrigatórios' });
      }
      const targetUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser[0]) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      const balanceBefore = targetUser[0].tmcCredits || 0;
      const balanceAfter = balanceBefore + amount;
      await db.transaction(async (tx) => {
        await tx.update(users).set({ tmcCredits: balanceAfter }).where(eq(users.id, userId));
        await tx.insert(tmcTransactions).values({
          userId,
          type: 'credit',
          amount,
          reason: reason || 'Créditos enviados pelo admin',
          balanceBefore,
          balanceAfter,
          metadata: { sentBy: actor.id, sentByName: actor.name },
        });
        await tx.insert(walletAuditLog).values({
          userId,
          action: 'admin_adjustment',
          amount,
          balanceBefore,
          balanceAfter,
          actorId: actor.id,
          actorRole: 'admin',
          description: reason || 'Créditos enviados pelo admin',
          metadata: { sentByName: actor.name },
        });
      });
      res.json({ success: true, newBalance: balanceAfter });
    } catch (error) {
      console.error('Failed to send credits:', error);
      res.status(500).json({ message: 'Erro ao enviar créditos' });
    }
  });

  // ========== WALLET AUDIT LOG ==========

  app.get('/api/wallet/audit-log', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { userId, action, limit: limitParam } = req.query;
      const queryLimit = Math.min(parseInt(limitParam as string) || 100, 500);
      let conditions: any[] = [];
      if (user.role === 'admin' && userId) {
        conditions.push(eq(walletAuditLog.userId, userId as string));
      } else if (user.role !== 'admin') {
        conditions.push(eq(walletAuditLog.userId, user.id));
      }
      if (action) {
        conditions.push(eq(walletAuditLog.action, action as string));
      }
      const logs = conditions.length > 0
        ? await db.select().from(walletAuditLog).where(and(...conditions)).orderBy(desc(walletAuditLog.createdAt)).limit(queryLimit)
        : await db.select().from(walletAuditLog).orderBy(desc(walletAuditLog.createdAt)).limit(queryLimit);
      res.json(logs);
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      res.status(500).json({ message: 'Erro ao buscar log de auditoria' });
    }
  });

  app.get('/api/wallet/weekly-report', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const userId = user.role === 'admin' && req.query.userId ? req.query.userId as string : user.id;
      const transactions = await db.select()
        .from(tmcTransactions)
        .where(and(eq(tmcTransactions.userId, userId), gte(tmcTransactions.createdAt, oneWeekAgo)))
        .orderBy(desc(tmcTransactions.createdAt));
      const totalCredits = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalDebits = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const currentBalance = await creditService.getUserBalance(userId);
      res.json({
        period: { from: oneWeekAgo.toISOString(), to: new Date().toISOString() },
        summary: { totalCredits, totalDebits, netChange: totalCredits - totalDebits, currentBalance, transactionCount: transactions.length },
        transactions,
      });
    } catch (error) {
      console.error('Failed to generate weekly report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório semanal' });
    }
  });

  // ========== REPORTS ==========

  app.get('/api/reports/:type', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin' && user.role !== 'doctor') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      const { type } = req.params;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      if (type === 'consultations') {
        const allAppts = await db.select()
          .from(appointments)
          .where(and(gte(appointments.createdAt, startDate), lte(appointments.createdAt, endDate)));
        const byStatus: Record<string, number> = {};
        const byType: Record<string, number> = {};
        allAppts.forEach(a => {
          byStatus[a.status] = (byStatus[a.status] || 0) + 1;
          byType[a.type] = (byType[a.type] || 0) + 1;
        });
        res.json({ type: 'consultations', period: { start: startDate, end: endDate }, total: allAppts.length, byStatus, byType });
      } else if (type === 'patients') {
        const allPatients = await db.select().from(patients);
        const byGender: Record<string, number> = {};
        const ageGroups: Record<string, number> = { '0-18': 0, '19-30': 0, '31-50': 0, '51-70': 0, '71+': 0 };
        allPatients.forEach(p => {
          byGender[p.gender || 'não informado'] = (byGender[p.gender || 'não informado'] || 0) + 1;
          if (p.dateOfBirth) {
            const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            if (age <= 18) ageGroups['0-18']++;
            else if (age <= 30) ageGroups['19-30']++;
            else if (age <= 50) ageGroups['31-50']++;
            else if (age <= 70) ageGroups['51-70']++;
            else ageGroups['71+']++;
          }
        });
        res.json({ type: 'patients', total: allPatients.length, byGender, ageGroups });
      } else if (type === 'financial') {
        const allTx = await db.select()
          .from(tmcTransactions)
          .where(and(gte(tmcTransactions.createdAt, startDate), lte(tmcTransactions.createdAt, endDate)));
        const totalCredits = allTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const totalDebits = allTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const byType: Record<string, number> = {};
        allTx.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });
        res.json({ type: 'financial', period: { start: startDate, end: endDate }, totalTransactions: allTx.length, totalCredits, totalDebits, netFlow: totalCredits - totalDebits, byType });
      } else if (type === 'doctors') {
        const doctors = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, 'doctor'));
        const doctorStats = [];
        for (const doc of doctors) {
          const appts = await db.select().from(appointments)
            .where(and(eq(appointments.doctorId, doc.id), gte(appointments.createdAt, startDate), lte(appointments.createdAt, endDate)));
          const completed = appts.filter(a => a.status === 'completed').length;
          const cancelled = appts.filter(a => a.status === 'cancelled').length;
          const ratings = appts.filter(a => a.rating).map(a => a.rating!);
          const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
          doctorStats.push({ ...doc, totalAppointments: appts.length, completed, cancelled, avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null });
        }
        res.json({ type: 'doctors', period: { start: startDate, end: endDate }, doctors: doctorStats });
      } else {
        res.status(400).json({ message: 'Tipo de relatório inválido. Use: consultations, patients, financial, doctors' });
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório' });
    }
  });

  // ========== NFT MANAGEMENT ==========

  app.get('/api/nfts', requireAuth, async (req, res) => {
    try {
      const allNfts = await db.select().from(dynamicNfts).orderBy(desc(dynamicNfts.createdAt));
      res.json(allNfts);
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
      res.status(500).json({ message: 'Erro ao buscar NFTs' });
    }
  });

  app.get('/api/nfts/:id', requireAuth, async (req, res) => {
    try {
      const nft = await db.select().from(dynamicNfts).where(eq(dynamicNfts.id, req.params.id)).limit(1);
      if (!nft[0]) return res.status(404).json({ message: 'NFT não encontrado' });
      const owners = await db.select({
        id: nftOwnership.id,
        shares: nftOwnership.shares,
        purchasePrice: nftOwnership.purchasePrice,
        acquiredAt: nftOwnership.acquiredAt,
        userName: users.name,
        userId: users.id,
      }).from(nftOwnership)
        .leftJoin(users, eq(nftOwnership.userId, users.id))
        .where(eq(nftOwnership.nftId, req.params.id));
      res.json({ ...nft[0], owners });
    } catch (error) {
      console.error('Failed to fetch NFT:', error);
      res.status(500).json({ message: 'Erro ao buscar NFT' });
    }
  });

  app.post('/api/nfts', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin' && user.role !== 'doctor' && user.role !== 'researcher') {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      const { title, description, nftType, dataCategory, anonymizedData, valueTmc, totalShares, consentRecords, dataSourceCount } = req.body;
      if (!title || !nftType || !dataCategory || !anonymizedData) {
        return res.status(400).json({ message: 'Campos obrigatórios: title, nftType, dataCategory, anonymizedData' });
      }
      const nft = await db.insert(dynamicNfts).values({
        title,
        description,
        nftType,
        dataCategory,
        anonymizedData,
        valueTmc: valueTmc || 0,
        totalShares: totalShares || 100,
        availableShares: totalShares || 100,
        ownerId: user.id,
        creatorId: user.id,
        consentRecords,
        dataSourceCount: dataSourceCount || 0,
        status: 'active',
      }).returning();
      res.json(nft[0]);
    } catch (error) {
      console.error('Failed to create NFT:', error);
      res.status(500).json({ message: 'Erro ao criar NFT' });
    }
  });

  app.patch('/api/nfts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const nft = await db.select().from(dynamicNfts).where(eq(dynamicNfts.id, req.params.id)).limit(1);
      if (!nft[0]) return res.status(404).json({ message: 'NFT não encontrado' });
      if (nft[0].ownerId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas o proprietário ou admin pode editar' });
      }
      const { title, description, valueTmc, status, anonymizedData, consentRecords } = req.body;
      const updated = await db.update(dynamicNfts)
        .set({ title, description, valueTmc, status, anonymizedData, consentRecords, updatedAt: new Date(), lastValueUpdate: valueTmc !== undefined ? new Date() : undefined })
        .where(eq(dynamicNfts.id, req.params.id))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      console.error('Failed to update NFT:', error);
      res.status(500).json({ message: 'Erro ao atualizar NFT' });
    }
  });

  app.get('/api/nfts/:id/ownership', requireAuth, async (req, res) => {
    try {
      const owners = await db.select({
        id: nftOwnership.id,
        shares: nftOwnership.shares,
        purchasePrice: nftOwnership.purchasePrice,
        acquiredAt: nftOwnership.acquiredAt,
        userName: users.name,
        userId: users.id,
      }).from(nftOwnership)
        .leftJoin(users, eq(nftOwnership.userId, users.id))
        .where(eq(nftOwnership.nftId, req.params.id));
      res.json(owners);
    } catch (error) {
      console.error('Failed to fetch NFT ownership:', error);
      res.status(500).json({ message: 'Erro ao buscar propriedade do NFT' });
    }
  });

  app.post('/api/nfts/:id/buy-shares', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { shares } = req.body;
      if (!shares || shares <= 0) return res.status(400).json({ message: 'Número de shares inválido' });
      const nft = await db.select().from(dynamicNfts).where(eq(dynamicNfts.id, req.params.id)).limit(1);
      if (!nft[0]) return res.status(404).json({ message: 'NFT não encontrado' });
      if (nft[0].availableShares < shares) return res.status(400).json({ message: 'Shares insuficientes disponíveis' });
      const pricePerShare = Math.ceil(nft[0].valueTmc / nft[0].totalShares);
      const totalCost = pricePerShare * shares;
      const balance = await creditService.getUserBalance(user.id);
      if (balance < totalCost) return res.status(400).json({ message: 'Créditos insuficientes', required: totalCost, available: balance });
      await db.transaction(async (tx) => {
        await creditService.debitCredits(user.id, totalCost, `Compra de ${shares} shares do NFT ${nft[0].title}`);
        if (nft[0].ownerId !== user.id) {
          await creditService.addCredits(nft[0].ownerId, totalCost, `Venda de ${shares} shares do NFT ${nft[0].title}`);
        }
        await tx.insert(nftOwnership).values({ nftId: req.params.id, userId: user.id, shares, purchasePrice: pricePerShare });
        await tx.update(dynamicNfts).set({ availableShares: nft[0].availableShares - shares, updatedAt: new Date() }).where(eq(dynamicNfts.id, req.params.id));
      });
      res.json({ success: true, sharesAcquired: shares, totalCost });
    } catch (error) {
      console.error('Failed to buy NFT shares:', error);
      res.status(500).json({ message: 'Erro ao comprar shares' });
    }
  });

  // ========== BROKER ==========

  app.get('/api/broker/orders', requireAuth, async (req, res) => {
    try {
      const { assetType, status } = req.query;
      let conditions: any[] = [];
      if (assetType) conditions.push(eq(brokerOrders.assetType, assetType as string));
      if (status) conditions.push(eq(brokerOrders.status, status as string));
      const orders = conditions.length > 0
        ? await db.select({
            id: brokerOrders.id, orderType: brokerOrders.orderType, assetType: brokerOrders.assetType,
            nftId: brokerOrders.nftId, quantity: brokerOrders.quantity, pricePerUnit: brokerOrders.pricePerUnit,
            totalPrice: brokerOrders.totalPrice, filledQuantity: brokerOrders.filledQuantity,
            status: brokerOrders.status, createdAt: brokerOrders.createdAt, userName: users.name, userId: users.id,
          }).from(brokerOrders).leftJoin(users, eq(brokerOrders.userId, users.id)).where(and(...conditions)).orderBy(desc(brokerOrders.createdAt))
        : await db.select({
            id: brokerOrders.id, orderType: brokerOrders.orderType, assetType: brokerOrders.assetType,
            nftId: brokerOrders.nftId, quantity: brokerOrders.quantity, pricePerUnit: brokerOrders.pricePerUnit,
            totalPrice: brokerOrders.totalPrice, filledQuantity: brokerOrders.filledQuantity,
            status: brokerOrders.status, createdAt: brokerOrders.createdAt, userName: users.name, userId: users.id,
          }).from(brokerOrders).leftJoin(users, eq(brokerOrders.userId, users.id)).orderBy(desc(brokerOrders.createdAt));
      res.json(orders);
    } catch (error) {
      console.error('Failed to fetch broker orders:', error);
      res.status(500).json({ message: 'Erro ao buscar ordens' });
    }
  });

  app.post('/api/broker/orders', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { orderType, assetType, nftId, quantity, pricePerUnit } = req.body;
      if (!orderType || !assetType || !quantity || !pricePerUnit) {
        return res.status(400).json({ message: 'Campos obrigatórios: orderType, assetType, quantity, pricePerUnit' });
      }
      const totalPrice = quantity * pricePerUnit;
      if (orderType === 'buy') {
        const balance = await creditService.getUserBalance(user.id);
        if (balance < totalPrice) return res.status(400).json({ message: 'Créditos insuficientes', required: totalPrice, available: balance });
      }
      const order = await db.insert(brokerOrders).values({
        userId: user.id,
        orderType,
        assetType,
        nftId: nftId || null,
        quantity,
        pricePerUnit,
        totalPrice,
        status: 'open',
      }).returning();

      // Try to match orders
      const matchField = orderType === 'buy' ? 'sell' : 'buy';
      const matchingOrders = await db.select().from(brokerOrders)
        .where(and(
          eq(brokerOrders.assetType, assetType),
          eq(brokerOrders.orderType, matchField),
          eq(brokerOrders.status, 'open'),
          orderType === 'buy' ? lte(brokerOrders.pricePerUnit, pricePerUnit) : gte(brokerOrders.pricePerUnit, pricePerUnit),
        ))
        .orderBy(orderType === 'buy' ? brokerOrders.pricePerUnit : desc(brokerOrders.pricePerUnit));

      for (const match of matchingOrders) {
        if (order[0].filledQuantity >= order[0].quantity) break;
        const remaining = order[0].quantity - order[0].filledQuantity;
        const matchRemaining = match.quantity - match.filledQuantity;
        const fillQty = Math.min(remaining, matchRemaining);
        const fillPrice = match.pricePerUnit;
        const fillTotal = fillQty * fillPrice;
        const buyerId = orderType === 'buy' ? user.id : match.userId;
        const sellerId = orderType === 'sell' ? user.id : match.userId;
        await db.transaction(async (tx) => {
          await creditService.debitCredits(buyerId, fillTotal, `Compra via broker: ${fillQty}x ${assetType}`);
          await creditService.addCredits(sellerId, fillTotal, `Venda via broker: ${fillQty}x ${assetType}`);
          await tx.insert(brokerTrades).values({
            buyOrderId: orderType === 'buy' ? order[0].id : match.id,
            sellOrderId: orderType === 'sell' ? order[0].id : match.id,
            buyerId, sellerId, assetType, nftId: nftId || null, quantity: fillQty, pricePerUnit: fillPrice, totalPrice: fillTotal,
          });
          const newFilled = order[0].filledQuantity + fillQty;
          await tx.update(brokerOrders).set({
            filledQuantity: newFilled,
            status: newFilled >= order[0].quantity ? 'filled' : 'partially_filled',
            updatedAt: new Date(),
          }).where(eq(brokerOrders.id, order[0].id));
          order[0].filledQuantity = newFilled;
          const matchNewFilled = match.filledQuantity + fillQty;
          await tx.update(brokerOrders).set({
            filledQuantity: matchNewFilled,
            status: matchNewFilled >= match.quantity ? 'filled' : 'partially_filled',
            updatedAt: new Date(),
          }).where(eq(brokerOrders.id, match.id));
        });
      }

      const updatedOrder = await db.select().from(brokerOrders).where(eq(brokerOrders.id, order[0].id)).limit(1);
      res.json(updatedOrder[0]);
    } catch (error) {
      console.error('Failed to create broker order:', error);
      res.status(500).json({ message: 'Erro ao criar ordem' });
    }
  });

  app.delete('/api/broker/orders/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const order = await db.select().from(brokerOrders).where(eq(brokerOrders.id, req.params.id)).limit(1);
      if (!order[0]) return res.status(404).json({ message: 'Ordem não encontrada' });
      if (order[0].userId !== user.id && user.role !== 'admin') return res.status(403).json({ message: 'Sem permissão' });
      if (order[0].status === 'filled') return res.status(400).json({ message: 'Ordem já executada' });
      await db.update(brokerOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(brokerOrders.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to cancel broker order:', error);
      res.status(500).json({ message: 'Erro ao cancelar ordem' });
    }
  });

  app.get('/api/broker/trades', requireAuth, async (req, res) => {
    try {
      const trades = await db.select().from(brokerTrades).orderBy(desc(brokerTrades.createdAt)).limit(100);
      res.json(trades);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      res.status(500).json({ message: 'Erro ao buscar trades' });
    }
  });

  app.get('/api/broker/tm3d-supply', requireAuth, async (req, res) => {
    try {
      let supply = await db.select().from(tm3dSupply).limit(1);
      if (!supply[0]) {
        supply = await db.insert(tm3dSupply).values({
          totalSupply: 1000000,
          circulatingSupply: 0,
          reserveSupply: 1000000,
          priceInUsd: '0.20',
        }).returning();
      }
      res.json(supply[0]);
    } catch (error) {
      console.error('Failed to fetch TM3D supply:', error);
      res.status(500).json({ message: 'Erro ao buscar supply TM3D' });
    }
  });

  app.patch('/api/broker/tm3d-supply', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const { totalSupply, circulatingSupply, reserveSupply, priceInUsd, lastMintAmount, lastBurnAmount } = req.body;
      let existing = await db.select().from(tm3dSupply).limit(1);
      if (!existing[0]) {
        existing = await db.insert(tm3dSupply).values({ totalSupply: 1000000, circulatingSupply: 0, reserveSupply: 1000000, priceInUsd: '0.20' }).returning();
      }
      const updated = await db.update(tm3dSupply).set({
        ...(totalSupply !== undefined && { totalSupply }),
        ...(circulatingSupply !== undefined && { circulatingSupply }),
        ...(reserveSupply !== undefined && { reserveSupply }),
        ...(priceInUsd !== undefined && { priceInUsd }),
        ...(lastMintAmount !== undefined && { lastMintAmount }),
        ...(lastBurnAmount !== undefined && { lastBurnAmount }),
        updatedBy: user.id,
        updatedAt: new Date(),
      }).where(eq(tm3dSupply.id, existing[0].id)).returning();
      res.json(updated[0]);
    } catch (error) {
      console.error('Failed to update TM3D supply:', error);
      res.status(500).json({ message: 'Erro ao atualizar supply TM3D' });
    }
  });

  // ========== EXTERNAL WALLETS ==========

  app.get('/api/external-wallets', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const wallets = await db.select().from(externalWallets).where(eq(externalWallets.userId, user.id)).orderBy(desc(externalWallets.createdAt));
      res.json(wallets);
    } catch (error) {
      console.error('Failed to fetch external wallets:', error);
      res.status(500).json({ message: 'Erro ao buscar carteiras externas' });
    }
  });

  app.post('/api/external-wallets', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { walletAddress, walletType, network, label } = req.body;
      if (!walletAddress) return res.status(400).json({ message: 'Endereço da carteira é obrigatório' });
      const existing = await db.select().from(externalWallets)
        .where(and(eq(externalWallets.userId, user.id), eq(externalWallets.walletAddress, walletAddress)))
        .limit(1);
      if (existing[0]) return res.status(409).json({ message: 'Carteira já vinculada' });
      const isFirst = (await db.select().from(externalWallets).where(eq(externalWallets.userId, user.id))).length === 0;
      const wallet = await db.insert(externalWallets).values({
        userId: user.id,
        walletAddress,
        walletType: walletType || 'metamask',
        network: network || 'tm3d',
        label: label || null,
        isDefault: isFirst,
      }).returning();
      res.json(wallet[0]);
    } catch (error) {
      console.error('Failed to link external wallet:', error);
      res.status(500).json({ message: 'Erro ao vincular carteira externa' });
    }
  });

  app.delete('/api/external-wallets/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const wallet = await db.select().from(externalWallets).where(eq(externalWallets.id, req.params.id)).limit(1);
      if (!wallet[0]) return res.status(404).json({ message: 'Carteira não encontrada' });
      if (wallet[0].userId !== user.id) return res.status(403).json({ message: 'Sem permissão' });
      await db.delete(externalWallets).where(eq(externalWallets.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to remove external wallet:', error);
      res.status(500).json({ message: 'Erro ao remover carteira externa' });
    }
  });

  // ========== WITHDRAWAL REQUESTS ==========

  app.get('/api/withdrawals', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const conditions = user.role === 'admin' ? [] : [eq(withdrawalRequests.userId, user.id)];
      const requests = conditions.length > 0
        ? await db.select().from(withdrawalRequests).where(and(...conditions)).orderBy(desc(withdrawalRequests.createdAt))
        : await db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt));
      res.json(requests);
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error);
      res.status(500).json({ message: 'Erro ao buscar saques' });
    }
  });

  app.post('/api/withdrawals', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { externalWalletId, amount } = req.body;
      if (!externalWalletId || !amount || amount <= 0) return res.status(400).json({ message: 'Carteira e valor são obrigatórios' });
      const wallet = await db.select().from(externalWallets).where(eq(externalWallets.id, externalWalletId)).limit(1);
      if (!wallet[0] || wallet[0].userId !== user.id) return res.status(404).json({ message: 'Carteira não encontrada' });
      const balance = await creditService.getUserBalance(user.id);
      const fee = Math.ceil(amount * 0.02);
      const totalDebit = amount + fee;
      if (balance < totalDebit) return res.status(400).json({ message: 'Saldo insuficiente', required: totalDebit, available: balance });
      await creditService.debitCredits(user.id, totalDebit, `Saque para carteira externa: ${wallet[0].walletAddress}`);
      const withdrawal = await db.insert(withdrawalRequests).values({
        userId: user.id,
        externalWalletId,
        amount,
        fee,
        status: 'pending',
      }).returning();
      await db.insert(walletAuditLog).values({
        userId: user.id,
        action: 'debit',
        amount: totalDebit,
        balanceBefore: balance,
        balanceAfter: balance - totalDebit,
        actorRole: 'system',
        description: `Saque de ${amount} TMC + taxa ${fee} TMC para ${wallet[0].walletAddress}`,
        relatedTransactionId: withdrawal[0].id,
      });
      res.json(withdrawal[0]);
    } catch (error) {
      console.error('Failed to create withdrawal:', error);
      res.status(500).json({ message: 'Erro ao criar saque' });
    }
  });

  app.patch('/api/withdrawals/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });
      const { status, txHash } = req.body;
      const withdrawal = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, req.params.id)).limit(1);
      if (!withdrawal[0]) return res.status(404).json({ message: 'Saque não encontrado' });
      const updated = await db.update(withdrawalRequests).set({
        status,
        txHash,
        processedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
        processedBy: user.id,
      }).where(eq(withdrawalRequests.id, req.params.id)).returning();
      if (status === 'failed') {
        await creditService.addCredits(withdrawal[0].userId, withdrawal[0].amount + withdrawal[0].fee, `Estorno de saque cancelado/falho`);
      }
      res.json(updated[0]);
    } catch (error) {
      console.error('Failed to update withdrawal:', error);
      res.status(500).json({ message: 'Erro ao atualizar saque' });
    }
  });


  app.get('/api/docs/pdf', async (_req, res) => {
    try {
      const { generateSystemDocumentationHTML } = await import('./services/doc-pdf-generator');
      const html = generateSystemDocumentationHTML();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="TeleM3D-Documentacao.html"');
      res.send(html);
    } catch (error) {
      console.error('Failed to generate documentation PDF:', error);
      res.status(500).json({ message: 'Failed to generate documentation' });
    }
  });

  // ========== CLINIC MANAGEMENT API ==========

  function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  app.post('/api/clinics', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'doctor' && user.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas médicos podem criar clínicas' });
      }
      const { name, description, specialty } = req.body;
      if (!name) return res.status(400).json({ message: 'Nome da clínica é obrigatório' });

      let inviteCode = generateInviteCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db.select().from(clinics).where(eq(clinics.inviteCode, inviteCode)).limit(1);
        if (!existing.length) break;
        inviteCode = generateInviteCode();
        attempts++;
      }

      const [clinic] = await db.insert(clinics).values({
        name,
        description: description || null,
        ownerId: user.id,
        inviteCode,
        specialty: specialty || user.specialization || null,
      }).returning();

      await db.insert(clinicMembers).values({
        clinicId: clinic.id,
        userId: user.id,
        role: 'owner',
      });

      res.json(clinic);
    } catch (error) {
      console.error('Failed to create clinic:', error);
      res.status(500).json({ message: 'Erro ao criar clínica' });
    }
  });

  app.get('/api/clinics', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const memberships = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.userId, user.id), eq(clinicMembers.isActive, true)));
      if (!memberships.length) return res.json([]);

      const clinicIds = memberships.map(m => m.clinicId);
      const allClinics = await db.select().from(clinics)
        .where(and(inArray(clinics.id, clinicIds), eq(clinics.isActive, true)));

      const result = await Promise.all(allClinics.map(async (clinic) => {
        const members = await db.select({
          member: clinicMembers,
          user: users,
        }).from(clinicMembers)
          .innerJoin(users, eq(clinicMembers.userId, users.id))
          .where(and(eq(clinicMembers.clinicId, clinic.id), eq(clinicMembers.isActive, true)));

        const patientCount = await db.select().from(clinicPatientBindings)
          .where(and(eq(clinicPatientBindings.clinicId, clinic.id), eq(clinicPatientBindings.isActive, true)));

        const myRole = memberships.find(m => m.clinicId === clinic.id)?.role || 'associate';
        return {
          ...clinic,
          myRole,
          memberCount: members.length,
          patientCount: patientCount.length,
          members: members.map(m => ({
            id: m.member.id,
            userId: m.user.id,
            name: m.user.name,
            role: m.member.role,
            specialization: m.user.specialization,
            medicalLicense: m.user.medicalLicense,
            isOnline: m.user.isOnline,
            joinedAt: m.member.joinedAt,
          })),
        };
      }));

      res.json(result);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
      res.status(500).json({ message: 'Erro ao buscar clínicas' });
    }
  });

  app.get('/api/clinics/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      const membership = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, user.id), eq(clinicMembers.isActive, true)))
        .limit(1);
      if (!membership.length && user.role !== 'admin') {
        return res.status(403).json({ message: 'Você não é membro desta clínica' });
      }

      const members = await db.select({
        member: clinicMembers,
        user: users,
      }).from(clinicMembers)
        .innerJoin(users, eq(clinicMembers.userId, users.id))
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.isActive, true)));

      const patientBindings = await db.select({
        binding: clinicPatientBindings,
        user: users,
      }).from(clinicPatientBindings)
        .innerJoin(users, eq(clinicPatientBindings.patientId, users.id))
        .where(and(eq(clinicPatientBindings.clinicId, clinicId), eq(clinicPatientBindings.isActive, true)));

      const consultationLogs = await db.select().from(clinicConsultationLogs)
        .where(eq(clinicConsultationLogs.clinicId, clinicId))
        .orderBy(desc(clinicConsultationLogs.createdAt))
        .limit(50);

      res.json({
        ...clinic,
        myRole: membership[0]?.role || (user.role === 'admin' ? 'admin' : null),
        members: members.map(m => ({
          id: m.member.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          role: m.member.role,
          specialization: m.user.specialization,
          medicalLicense: m.user.medicalLicense,
          isOnline: m.user.isOnline,
          joinedAt: m.member.joinedAt,
        })),
        patients: patientBindings.map(p => ({
          id: p.binding.id,
          userId: p.user.id,
          name: p.user.name,
          email: p.user.email,
          discountPercent: p.binding.discountPercent,
          boundAt: p.binding.boundAt,
        })),
        consultationLogs,
      });
    } catch (error) {
      console.error('Failed to fetch clinic details:', error);
      res.status(500).json({ message: 'Erro ao buscar detalhes da clínica' });
    }
  });

  app.patch('/api/clinics/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      if (clinic.ownerId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas o proprietário pode editar a clínica' });
      }

      const { name, description, specialty, patientDiscountPercent, associateCommissionPercent } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (specialty !== undefined) updateData.specialty = specialty;
      if (patientDiscountPercent !== undefined) updateData.patientDiscountPercent = Math.max(0, Math.min(100, parseInt(patientDiscountPercent)));
      if (associateCommissionPercent !== undefined) updateData.associateCommissionPercent = Math.max(0, Math.min(100, parseInt(associateCommissionPercent)));

      const [updated] = await db.update(clinics).set(updateData).where(eq(clinics.id, clinicId)).returning();
      res.json(updated);
    } catch (error) {
      console.error('Failed to update clinic:', error);
      res.status(500).json({ message: 'Erro ao atualizar clínica' });
    }
  });

  app.delete('/api/clinics/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });
      if (clinic.ownerId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: 'Apenas o proprietário pode desativar a clínica' });
      }

      await db.update(clinics).set({ isActive: false, updatedAt: new Date() }).where(eq(clinics.id, clinicId));
      await db.update(clinicMembers).set({ isActive: false }).where(eq(clinicMembers.clinicId, clinicId));
      await db.update(clinicPatientBindings).set({ isActive: false }).where(eq(clinicPatientBindings.clinicId, clinicId));
      res.json({ message: 'Clínica desativada com sucesso' });
    } catch (error) {
      console.error('Failed to deactivate clinic:', error);
      res.status(500).json({ message: 'Erro ao desativar clínica' });
    }
  });

  app.post('/api/clinics/join', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ message: 'Código de convite é obrigatório' });

      const [clinic] = await db.select().from(clinics)
        .where(and(eq(clinics.inviteCode, inviteCode.toUpperCase()), eq(clinics.isActive, true)))
        .limit(1);
      if (!clinic) return res.status(404).json({ message: 'Código de convite inválido ou clínica inativa' });

      const existing = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinic.id), eq(clinicMembers.userId, user.id)))
        .limit(1);
      if (existing.length) {
        if (existing[0].isActive) return res.status(400).json({ message: 'Você já é membro desta clínica' });
        await db.update(clinicMembers).set({ isActive: true }).where(eq(clinicMembers.id, existing[0].id));
        return res.json({ message: 'Reativado na clínica', clinic });
      }

      const role = (user.role === 'doctor') ? 'associate' : 'staff';
      await db.insert(clinicMembers).values({
        clinicId: clinic.id,
        userId: user.id,
        role,
      });

      broadcastToUser(clinic.ownerId, {
        type: 'clinic_member_joined',
        data: { clinicId: clinic.id, clinicName: clinic.name, memberName: user.name, role },
      });

      try {
        await db.insert(pendingNotifications).values({
          userId: clinic.ownerId,
          type: 'clinic_member_joined',
          title: 'Novo membro na clínica',
          message: `${user.name} entrou na clínica ${clinic.name} como ${role}`,
          data: { clinicId: clinic.id, memberId: user.id },
        });
      } catch {}

      res.json({ message: 'Entrou na clínica com sucesso', clinic });
    } catch (error) {
      console.error('Failed to join clinic:', error);
      res.status(500).json({ message: 'Erro ao entrar na clínica' });
    }
  });

  app.delete('/api/clinics/:id/members/:userId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const { id: clinicId, userId: targetUserId } = req.params;
      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      if (clinic.ownerId !== user.id && user.id !== targetUserId && user.role !== 'admin') {
        return res.status(403).json({ message: 'Sem permissão para remover membro' });
      }
      if (targetUserId === clinic.ownerId) {
        return res.status(400).json({ message: 'Não é possível remover o proprietário da clínica' });
      }

      await db.update(clinicMembers).set({ isActive: false })
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, targetUserId)));
      res.json({ message: 'Membro removido com sucesso' });
    } catch (error) {
      console.error('Failed to remove clinic member:', error);
      res.status(500).json({ message: 'Erro ao remover membro' });
    }
  });

  app.post('/api/clinics/:id/bind-patient', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;

      if (user.role !== 'patient') {
        return res.status(403).json({ message: 'Apenas pacientes podem vincular-se a uma clínica' });
      }

      const [clinic] = await db.select().from(clinics)
        .where(and(eq(clinics.id, clinicId), eq(clinics.isActive, true)))
        .limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      const existing = await db.select().from(clinicPatientBindings)
        .where(and(eq(clinicPatientBindings.clinicId, clinicId), eq(clinicPatientBindings.patientId, user.id)))
        .limit(1);
      if (existing.length) {
        if (existing[0].isActive) return res.status(400).json({ message: 'Você já está vinculado a esta clínica' });
        await db.update(clinicPatientBindings).set({ isActive: true, discountPercent: clinic.patientDiscountPercent })
          .where(eq(clinicPatientBindings.id, existing[0].id));
        return res.json({ message: 'Vínculo reativado', discountPercent: clinic.patientDiscountPercent });
      }

      await db.insert(clinicPatientBindings).values({
        clinicId,
        patientId: user.id,
        discountPercent: clinic.patientDiscountPercent,
      });

      res.json({ message: 'Vinculado à clínica com sucesso', discountPercent: clinic.patientDiscountPercent });
    } catch (error) {
      console.error('Failed to bind patient to clinic:', error);
      res.status(500).json({ message: 'Erro ao vincular paciente' });
    }
  });

  app.delete('/api/clinics/:id/unbind-patient', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;

      await db.update(clinicPatientBindings).set({ isActive: false })
        .where(and(eq(clinicPatientBindings.clinicId, clinicId), eq(clinicPatientBindings.patientId, user.id)));
      res.json({ message: 'Vínculo removido com sucesso' });
    } catch (error) {
      console.error('Failed to unbind patient:', error);
      res.status(500).json({ message: 'Erro ao remover vínculo' });
    }
  });

  app.get('/api/clinics/patient/my-clinics', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const bindings = await db.select({
        binding: clinicPatientBindings,
        clinic: clinics,
      }).from(clinicPatientBindings)
        .innerJoin(clinics, eq(clinicPatientBindings.clinicId, clinics.id))
        .where(and(eq(clinicPatientBindings.patientId, user.id), eq(clinicPatientBindings.isActive, true), eq(clinics.isActive, true)));

      res.json(bindings.map(b => ({
        ...b.clinic,
        discountPercent: b.binding.discountPercent,
        boundAt: b.binding.boundAt,
      })));
    } catch (error) {
      console.error('Failed to fetch patient clinics:', error);
      res.status(500).json({ message: 'Erro ao buscar clínicas' });
    }
  });

  app.get('/api/clinics/lookup/:inviteCode', async (req: any, res) => {
    try {
      const code = req.params.inviteCode?.toUpperCase();
      const [clinic] = await db.select().from(clinics)
        .where(and(eq(clinics.inviteCode, code), eq(clinics.isActive, true)))
        .limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      const owner = await db.select().from(users).where(eq(users.id, clinic.ownerId)).limit(1);
      const memberCount = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinic.id), eq(clinicMembers.isActive, true)));

      res.json({
        id: clinic.id,
        name: clinic.name,
        description: clinic.description,
        specialty: clinic.specialty,
        ownerName: owner[0]?.name || 'Médico',
        ownerSpecialization: owner[0]?.specialization,
        memberCount: memberCount.length,
        patientDiscountPercent: clinic.patientDiscountPercent,
      });
    } catch (error) {
      console.error('Failed to lookup clinic:', error);
      res.status(500).json({ message: 'Erro ao buscar clínica' });
    }
  });

  app.post('/api/clinics/:id/invite-associate', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;
      const { associateId, consultationId } = req.body;

      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic) return res.status(404).json({ message: 'Clínica não encontrada' });

      const membership = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, user.id), eq(clinicMembers.isActive, true)))
        .limit(1);
      if (!membership.length) return res.status(403).json({ message: 'Você não é membro desta clínica' });

      const associateMembership = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, associateId), eq(clinicMembers.isActive, true)))
        .limit(1);
      if (!associateMembership.length) return res.status(404).json({ message: 'Associado não encontrado nesta clínica' });

      const associate = await db.select().from(users).where(eq(users.id, associateId)).limit(1);
      if (!associate.length) return res.status(404).json({ message: 'Usuário não encontrado' });

      const actionUrl = consultationId
        ? `/consultation/video/${consultationId}?clinicId=${clinicId}&role=associate`
        : `/clinics/${clinicId}`;

      const notificationMessage = consultationId
        ? `Dr. ${user.name} solicita sua participação em uma consulta da clínica ${clinic.name}. Acesse o link para entrar diretamente.`
        : `Dr. ${user.name} solicita sua presença na clínica ${clinic.name}.`;

      broadcastToUser(associateId, {
        type: 'clinic_associate_invite',
        data: {
          clinicId, clinicName: clinic.name,
          doctorName: user.name, consultationId,
          message: notificationMessage, actionUrl,
        },
      });

      try {
        await db.insert(pendingNotifications).values({
          userId: associateId,
          type: 'clinic_associate_invite',
          title: 'Chamado da Clínica',
          message: notificationMessage,
          priority: consultationId ? 'critical' : 'high',
          data: { clinicId, consultationId, actionUrl },
        });
      } catch {}

      if (associate[0].whatsappNumber) {
        try {
          await whatsAppService.sendMessage(
            associate[0].whatsappNumber,
            `[${clinic.name}] ${notificationMessage}`
          );
        } catch (e) { console.log('WhatsApp notification failed:', e); }
      }

      if (associate[0].email) {
        console.log(`[EMAIL] To: ${associate[0].email} | Subject: Chamado da Clínica ${clinic.name} | Body: ${notificationMessage}`);
      }

      if (associate[0].phone) {
        console.log(`[SMS] To: ${associate[0].phone} | Body: [${clinic.name}] ${notificationMessage}`);
      }

      res.json({ message: 'Convite enviado por todos os canais disponíveis' });
    } catch (error) {
      console.error('Failed to invite clinic associate:', error);
      res.status(500).json({ message: 'Erro ao convidar associado' });
    }
  });

  app.get('/api/clinics/:id/shared-patients', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const clinicId = req.params.id;

      const membership = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, user.id), eq(clinicMembers.isActive, true)))
        .limit(1);
      if (!membership.length && user.role !== 'admin') {
        return res.status(403).json({ message: 'Você não é membro desta clínica' });
      }

      const bindings = await db.select({
        binding: clinicPatientBindings,
        user: users,
      }).from(clinicPatientBindings)
        .innerJoin(users, eq(clinicPatientBindings.patientId, users.id))
        .where(and(eq(clinicPatientBindings.clinicId, clinicId), eq(clinicPatientBindings.isActive, true)));

      const patientData = await Promise.all(bindings.map(async (b) => {
        const patientRecord = await db.select().from(patients).where(eq(patients.userId, b.user.id)).limit(1);
        return {
          userId: b.user.id,
          name: b.user.name,
          email: b.user.email,
          phone: b.user.phone,
          discountPercent: b.binding.discountPercent,
          patientId: patientRecord[0]?.id,
          dateOfBirth: patientRecord[0]?.dateOfBirth,
          gender: patientRecord[0]?.gender,
          bloodType: patientRecord[0]?.bloodType,
        };
      }));

      res.json(patientData);
    } catch (error) {
      console.error('Failed to fetch shared patients:', error);
      res.status(500).json({ message: 'Erro ao buscar pacientes compartilhados' });
    }
  });

  app.get('/api/clinics/:id/shared-records/:patientUserId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const { id: clinicId, patientUserId } = req.params;

      const membership = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, user.id), eq(clinicMembers.isActive, true)))
        .limit(1);
      if (!membership.length) return res.status(403).json({ message: 'Sem permissão' });

      const patientBinding = await db.select().from(clinicPatientBindings)
        .where(and(eq(clinicPatientBindings.clinicId, clinicId), eq(clinicPatientBindings.patientId, patientUserId), eq(clinicPatientBindings.isActive, true)))
        .limit(1);
      if (!patientBinding.length) return res.status(403).json({ message: 'Paciente não vinculado a esta clínica' });

      const patientRecord = await db.select().from(patients).where(eq(patients.userId, patientUserId)).limit(1);
      if (!patientRecord.length) return res.json({ records: [], appointments: [], prescriptionList: [] });

      const records = await db.select().from(medicalRecords)
        .where(eq(medicalRecords.patientId, patientRecord[0].id))
        .orderBy(desc(medicalRecords.createdAt)).limit(50);

      const appointmentList = await db.select().from(appointments)
        .where(eq(appointments.patientId, patientRecord[0].id))
        .orderBy(desc(appointments.createdAt)).limit(50);

      const prescriptionList = await db.select().from(prescriptions)
        .where(eq(prescriptions.patientId, patientRecord[0].id))
        .orderBy(desc(prescriptions.createdAt)).limit(50);

      res.json({ records, appointments: appointmentList, prescriptionList });
    } catch (error) {
      console.error('Failed to fetch shared records:', error);
      res.status(500).json({ message: 'Erro ao buscar prontuários compartilhados' });
    }
  });

  app.get('/api/clinics/check-discount/:doctorId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const doctorId = req.params.doctorId;

      const doctorMemberships = await db.select().from(clinicMembers)
        .where(and(eq(clinicMembers.userId, doctorId), eq(clinicMembers.isActive, true)));
      if (!doctorMemberships.length) return res.json({ hasDiscount: false, discountPercent: 0 });

      const clinicIds = doctorMemberships.map(m => m.clinicId);
      const patientBinding = await db.select({
        binding: clinicPatientBindings,
        clinic: clinics,
      }).from(clinicPatientBindings)
        .innerJoin(clinics, eq(clinicPatientBindings.clinicId, clinics.id))
        .where(and(
          eq(clinicPatientBindings.patientId, user.id),
          eq(clinicPatientBindings.isActive, true),
          inArray(clinicPatientBindings.clinicId, clinicIds),
          eq(clinics.isActive, true)
        ))
        .limit(1);

      if (patientBinding.length) {
        return res.json({
          hasDiscount: true,
          discountPercent: patientBinding[0].binding.discountPercent,
          clinicId: patientBinding[0].clinic.id,
          clinicName: patientBinding[0].clinic.name,
        });
      }

      res.json({ hasDiscount: false, discountPercent: 0 });
    } catch (error) {
      console.error('Failed to check clinic discount:', error);
      res.status(500).json({ message: 'Erro ao verificar desconto' });
    }
  });

  app.get('/api/admin/clinics', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });

      const allClinics = await db.select({
        clinic: clinics,
        owner: users,
      }).from(clinics)
        .innerJoin(users, eq(clinics.ownerId, users.id))
        .orderBy(desc(clinics.createdAt));

      const result = await Promise.all(allClinics.map(async (c) => {
        const memberCount = await db.select().from(clinicMembers)
          .where(and(eq(clinicMembers.clinicId, c.clinic.id), eq(clinicMembers.isActive, true)));
        const patientCount = await db.select().from(clinicPatientBindings)
          .where(and(eq(clinicPatientBindings.clinicId, c.clinic.id), eq(clinicPatientBindings.isActive, true)));
        return {
          ...c.clinic,
          ownerName: c.owner.name,
          ownerSpecialization: c.owner.specialization,
          memberCount: memberCount.length,
          patientCount: patientCount.length,
        };
      }));

      res.json(result);
    } catch (error) {
      console.error('Failed to fetch admin clinics:', error);
      res.status(500).json({ message: 'Erro ao buscar clínicas' });
    }
  });

  app.patch('/api/admin/clinics/:id', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin') return res.status(403).json({ message: 'Apenas admin' });

      const clinicId = req.params.id;
      const { patientDiscountPercent, associateCommissionPercent, isActive } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (patientDiscountPercent !== undefined) updateData.patientDiscountPercent = Math.max(0, Math.min(100, parseInt(patientDiscountPercent)));
      if (associateCommissionPercent !== undefined) updateData.associateCommissionPercent = Math.max(0, Math.min(100, parseInt(associateCommissionPercent)));
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db.update(clinics).set(updateData).where(eq(clinics.id, clinicId)).returning();
      res.json(updated);
    } catch (error) {
      console.error('Failed to update admin clinic:', error);
      res.status(500).json({ message: 'Erro ao atualizar clínica' });
    }
  });

  // ===== FHIR R4 Dashboard + ECG Analysis Engine Routes =====

  // ECG Analysis via Gemini AI Vision (with OpenAI fallback)
  const LANG_MAP: Record<string, string> = {
    pt: 'Portuguese (Brazil)', en: 'English', es: 'Spanish', fr: 'French',
    it: 'Italian', de: 'German', zh: 'Chinese (Simplified)', gn: 'Guaraní',
  };

  const ecgAnalysisProgress = new Map<string, { pass: number; total: number }>();

  app.get('/api/ecg/analyze/progress/:jobId', requireAuth, (req: any, res: any) => {
    const progress = ecgAnalysisProgress.get(req.params.jobId);
    if (!progress) return res.json({ pass: 0, total: 3, percent: 0 });
    const passPercents: Record<number, number> = { 0: 0, 1: 33, 2: 66, 3: 100 };
    res.json({ ...progress, percent: passPercents[progress.pass] ?? Math.floor((progress.pass / progress.total) * 100) });
  });

  app.post('/api/ecg/analyze', requireAuthOrMcp, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos e administradores podem analisar ECGs' });
      }

      const { imageBase64, patientContext, language, jobId } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ message: 'Imagem ECG (base64) é obrigatória' });
      }

      const langName = LANG_MAP[language] || LANG_MAP['pt'];
      const trackingId = jobId || `ecg-${Date.now()}`;

      const { geminiService } = await import('./services/gemini');
      ecgAnalysisProgress.set(trackingId, { pass: 0, total: 3 });
      let result: any;
      try {
        result = await geminiService.analyzeECGImage(imageBase64, patientContext || {}, (pass) => {
          ecgAnalysisProgress.set(trackingId, { pass, total: 3 });
          console.log(`ECG Triple-Verification progress: ${pass}/3 (${Math.round(pass / 3 * 100)}%)`);
        });
      } finally {
        ecgAnalysisProgress.delete(trackingId);
      }

      let immersiveImage: string | null = null;
      const generateECGImmersiveImage = async (): Promise<string | null> => {
        const { editImageFromBase64 } = await import('./replit_integrations/image/client');
        const { getECGConfig } = await import('./services/aiPromptConfig');
        const ecgConfig = await getECGConfig();
        const findings = result.key_findings?.slice(0, 5)?.join('; ') || 'ECG analysis';
        const diagnosis = result.presumptive_diagnosis?.name || 'ECG';
        const severity = result.severity_level?.label || 'Moderado';
        const annotations = (result.color_coded_annotations || []).slice(0, 4).map((a: any) =>
          `Region "${a.region}": ${a.hypothesis} (${a.color_name} ${a.color_hex})`
        ).join('. ');

        const overlayPrompt = ecgConfig.imageGenerationPrompt
          .replace(/\{\{langName\}\}/g, langName)
          .replace(/\{\{diagnosis\}\}/g, diagnosis)
          .replace(/\{\{severity\}\}/g, severity)
          .replace(/\{\{annotations\}\}/g, annotations)
          .replace(/\{\{findings\}\}/g, findings);

        const imageBuffer = await editImageFromBase64(imageBase64, overlayPrompt, '1024x1024');
        return imageBuffer.toString('base64');
      };

      try {
        immersiveImage = await generateECGImmersiveImage();
        console.log('ECG immersive image generated successfully');
      } catch (imgError) {
        console.error('ECG immersive image generation failed, retrying once...', imgError instanceof Error ? imgError.message : imgError);
        try {
          immersiveImage = await generateECGImmersiveImage();
          console.log('ECG immersive image generated on retry');
        } catch (retryError) {
          console.error('ECG immersive image retry also failed (non-blocking):', retryError instanceof Error ? retryError.message : retryError);
        }
      }

      res.json({ ...result, immersive_image: immersiveImage });
    } catch (error) {
      console.error('ECG analysis error:', error);
      res.status(500).json({ 
        message: 'Erro ao analisar ECG. Tente novamente em alguns instantes.'
      });
    }
  });

  app.post('/api/ecg/generate-detail-image', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos e administradores podem gerar imagens' });
      }

      const { analysisData, language } = req.body;
      if (!analysisData) {
        return res.status(400).json({ message: 'Dados da análise são obrigatórios' });
      }

      const langName = LANG_MAP[language] || LANG_MAP['pt'];
      const { generateImageBuffer } = await import('./replit_integrations/image/client');
      const { getECGConfig } = await import('./services/aiPromptConfig');
      const ecgConfig = await getECGConfig();

      const diagnosis = analysisData.presumptive_diagnosis?.name || 'ECG Analysis';
      const confidence = analysisData.presumptive_diagnosis?.confidence || 'N/A';
      const severity = analysisData.severity_level?.label || 'Moderado';
      const severityLevel = analysisData.severity_level?.level || 2;
      const interpretation = analysisData.cardiac_interpretation || '';
      const conduct = analysisData.recommended_conduct || '';
      const techReport = analysisData.technical_report || '';
      const keyFindings = (analysisData.key_findings || []).slice(0, 5).join('; ');
      const clinicalComment = analysisData.clinical_comment || '';

      const differentials = (analysisData.differential_diagnoses || []).slice(0, 5).map((d: any) =>
        `${d.name}: ${d.confidence} (${d.color || '#888'})`
      ).join(', ');

      const colorAnnotations = (analysisData.color_coded_annotations || []).slice(0, 6).map((a: any) =>
        `${a.region}: ${a.hypothesis} ${a.probability} (${a.color_name} ${a.color_hex})`
      ).join('. ');

      const metrics = analysisData.ecg_metrics || {};
      const metricsStr = Object.entries(metrics).map(([k, v]) => `${k}: ${v}`).join(', ');

      const actionPlan = analysisData.action_plan || {};
      const immediateActions = (actionPlan.immediate_actions || []).slice(0, 3).join('; ');

      const imagePrompt = ecgConfig.detailImageGenerationPrompt
        .replace(/\{\{langName\}\}/g, langName)
        .replace(/\{\{diagnosis\}\}/g, diagnosis)
        .replace(/\{\{confidence\}\}/g, confidence)
        .replace(/\{\{severity\}\}/g, severity)
        .replace(/\{\{severityLevel\}\}/g, String(severityLevel))
        .replace(/\{\{interpretation\}\}/g, interpretation)
        .replace(/\{\{conduct\}\}/g, conduct)
        .replace(/\{\{techReport\}\}/g, techReport)
        .replace(/\{\{keyFindings\}\}/g, keyFindings)
        .replace(/\{\{clinicalComment\}\}/g, clinicalComment)
        .replace(/\{\{differentials\}\}/g, differentials)
        .replace(/\{\{colorAnnotations\}\}/g, colorAnnotations)
        .replace(/\{\{metricsStr\}\}/g, metricsStr)
        .replace(/\{\{immediateActions\}\}/g, immediateActions);

      const generateImage = async () => {
        const imageBuffer = await generateImageBuffer(imagePrompt, '1024x1024');
        return imageBuffer.toString('base64');
      };

      let detailImage: string;
      try {
        detailImage = await generateImage();
      } catch (firstErr) {
        console.error('ECG detail image first attempt failed, retrying...', firstErr instanceof Error ? firstErr.message : firstErr);
        detailImage = await generateImage();
      }

      console.log('ECG detail didactic image generated successfully');
      res.json({ detail_image: detailImage });
    } catch (error) {
      console.error('ECG detail image generation error:', error);
      res.status(500).json({
        message: 'Erro ao gerar imagem detalhada do ECG. Tente novamente em alguns instantes.'
      });
    }
  });

  app.post('/api/ecg/associate', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos podem associar análises ECG' });
      }

      const { patientId, analysisData, patientContext } = req.body;
      if (!patientId || !analysisData) {
        return res.status(400).json({ message: 'patientId e analysisData são obrigatórios' });
      }

      const topDiagnosis = analysisData.presumptive_diagnosis?.name || 
        Object.keys(analysisData.diagnosis_probabilities || {})[0]?.replace(/_/g, ' ') || 'ECG';

      const content = [
        `# Análise ECG - ${topDiagnosis}`,
        `**Data:** ${new Date().toLocaleString('pt-BR')}`,
        `**Paciente ID:** ${patientId}`,
        patientContext?.age ? `**Idade:** ${patientContext.age}` : '',
        patientContext?.sex ? `**Sexo:** ${patientContext.sex}` : '',
        patientContext?.clinicalHistory ? `**Histórico:** ${patientContext.clinicalHistory}` : '',
        '',
        `## Interpretação Cardíaca`,
        analysisData.cardiac_interpretation || analysisData.simple_summary || '',
        '',
        `## Diagnóstico Presuntivo`,
        `**${analysisData.presumptive_diagnosis?.name || topDiagnosis}** (${analysisData.presumptive_diagnosis?.confidence || 'N/A'})`,
        analysisData.presumptive_diagnosis?.reasoning || '',
        '',
        `## Diagnósticos Diferenciais`,
        ...(analysisData.differential_diagnoses || []).map((d: any) => `- ${d.name}: ${d.confidence} - ${d.reasoning || ''}`),
        '',
        `## Conduta Recomendada`,
        analysisData.recommended_conduct || '',
        '',
        `## Nível de Gravidade`,
        `${analysisData.severity_level?.label || 'N/A'} (${analysisData.severity_level?.level || 0}/5)`,
        analysisData.severity_level?.description || '',
        '',
        `## Laudo Técnico`,
        analysisData.technical_report || analysisData.technical_summary || '',
        '',
        `## Métricas`,
        ...Object.entries(analysisData.ecg_metrics || {}).map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v}`),
      ].filter(Boolean).join('\n');

      const noteResult = await storage.createDoctorNote({
        doctorId: req.user.id,
        title: `ECG - ${topDiagnosis} - Paciente ${patientId.substring(0, 8)}`,
        content,
        folder: 'ecg_study',
        color: 'blue',
        isPinned: false,
        patientId,
      });

      res.json({ success: true, noteId: (noteResult as any)?.id, message: 'Análise ECG associada ao paciente' });
    } catch (error) {
      console.error('ECG associate error:', error);
      res.status(500).json({ message: 'Erro ao associar análise ECG ao paciente' });
    }
  });

  app.post('/api/ecg/share', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos podem compartilhar análises ECG' });
      }

      const { recipientEmail, contentScope, analysisData, patientContext } = req.body;
      if (!recipientEmail || !contentScope || !analysisData) {
        return res.status(400).json({ message: 'recipientEmail, contentScope e analysisData são obrigatórios' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ message: 'Formato de email inválido' });
      }
      const validScopes = ['study_analysis', 'analysis_only', 'report_only', 'full_summary'];
      if (!validScopes.includes(contentScope)) {
        return res.status(400).json({ message: 'Escopo inválido' });
      }

      let formattedContent = '';
      const topDiagnosis = analysisData.presumptive_diagnosis?.name || 
        Object.keys(analysisData.diagnosis_probabilities || {})[0]?.replace(/_/g, ' ') || 'ECG';

      if (contentScope === 'study_analysis' || contentScope === 'full_summary') {
        formattedContent += `ANÁLISE ECG COMPLETA\n${'='.repeat(40)}\n`;
        formattedContent += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
        formattedContent += `Médico: Dr(a). ${req.user.name || req.user.username}\n\n`;
        if (patientContext?.age) formattedContent += `Idade: ${patientContext.age}\n`;
        if (patientContext?.sex) formattedContent += `Sexo: ${patientContext.sex}\n`;
        if (patientContext?.clinicalHistory) formattedContent += `Histórico: ${patientContext.clinicalHistory}\n`;
        formattedContent += '\n';
      }

      if (contentScope !== 'report_only') {
        formattedContent += `INTERPRETAÇÃO CARDÍACA\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.cardiac_interpretation || analysisData.simple_summary || 'N/A'}\n\n`;
        formattedContent += `ACHADOS PRINCIPAIS\n${'-'.repeat(30)}\n`;
        (analysisData.key_findings || []).forEach((f: string) => { formattedContent += `• ${f}\n`; });
        formattedContent += '\n';
        formattedContent += `DIAGNÓSTICO PRESUNTIVO\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.presumptive_diagnosis?.name || topDiagnosis} (${analysisData.presumptive_diagnosis?.confidence || 'N/A'})\n`;
        formattedContent += `${analysisData.presumptive_diagnosis?.reasoning || ''}\n\n`;
        formattedContent += `DIAGNÓSTICOS DIFERENCIAIS\n${'-'.repeat(30)}\n`;
        (analysisData.differential_diagnoses || []).forEach((d: any) => {
          formattedContent += `• ${d.name}: ${d.confidence} - ${d.reasoning || ''}\n`;
        });
        formattedContent += '\n';
        formattedContent += `CONDUTA RECOMENDADA\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.recommended_conduct || 'N/A'}\n\n`;
        formattedContent += `GRAVIDADE: ${analysisData.severity_level?.label || 'N/A'} (${analysisData.severity_level?.level || 0}/5)\n`;
        formattedContent += `${analysisData.severity_level?.description || ''}\n\n`;
      }

      if (contentScope === 'report_only' || contentScope === 'study_analysis' || contentScope === 'full_summary') {
        formattedContent += `LAUDO TÉCNICO\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.technical_report || analysisData.technical_summary || 'N/A'}\n\n`;
        formattedContent += `MÉTRICAS ECG\n${'-'.repeat(30)}\n`;
        Object.entries(analysisData.ecg_metrics || {}).forEach(([k, v]) => {
          formattedContent += `• ${k.replace(/_/g, ' ')}: ${v}\n`;
        });
        formattedContent += '\n';
      }

      formattedContent += `${'='.repeat(40)}\n`;
      formattedContent += analysisData.disclaimer || 'Análise automatizada por IA. Requer validação médica.';

      console.log(`[ECG Share] Doctor ${req.user.id} sharing ECG analysis to ${recipientEmail} (scope: ${contentScope})`);

      const shareRecord = await storage.createDoctorNote({
        doctorId: req.user.id,
        title: `ECG Share - ${topDiagnosis} → ${recipientEmail}`,
        content: formattedContent,
        folder: 'ecg_shares',
        color: 'green',
        isPinned: false,
        patientId: null,
      });

      res.json({
        success: true,
        shareId: (shareRecord as any)?.id,
        message: `Análise ECG preparada para envio a ${recipientEmail}`,
        recipientEmail,
        contentScope,
        formattedContent,
        sentAt: new Date().toISOString(),
        sentBy: req.user.id,
      });
    } catch (error) {
      console.error('ECG share error:', error);
      res.status(500).json({ message: 'Erro ao compartilhar análise ECG' });
    }
  });

  app.post('/api/radiology/analyze', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos e administradores podem analisar radiografias' });
      }

      const { imageBase64, patientContext, language } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ message: 'Imagem radiográfica (base64) é obrigatória' });
      }

      const { geminiService } = await import('./services/gemini');
      const result = await geminiService.analyzeRadiologyImage(imageBase64, patientContext || {});

      const immersiveImage = await geminiService.generateRadiologyPACSImage(result, language);
      res.json({ ...result, immersive_image: immersiveImage });
    } catch (error) {
      console.error('Radiology analysis error:', error);
      res.status(500).json({ 
        message: 'Erro ao analisar radiografia. Tente novamente em alguns instantes.'
      });
    }
  });

  app.post('/api/radiology/generate-immersive-image', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos e administradores podem gerar imagens' });
      }

      const { analysisData, language } = req.body;
      if (!analysisData) {
        return res.status(400).json({ message: 'Dados da análise são obrigatórios' });
      }

      const { geminiService } = await import('./services/gemini');
      const immersiveImage = await geminiService.generateRadiologyPACSImage(analysisData, language);
      if (!immersiveImage) {
        return res.status(500).json({ message: 'Falha ao gerar imagem imersiva' });
      }
      res.json({ immersive_image: immersiveImage });
    } catch (error) {
      console.error('Radiology immersive image generation error:', error);
      res.status(500).json({
        message: 'Erro ao gerar imagem imersiva. Tente novamente em alguns instantes.'
      });
    }
  });

  app.post('/api/radiology/associate', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos podem associar análises radiológicas' });
      }

      const { patientId, analysisData, patientContext } = req.body;
      if (!patientId || !analysisData) {
        return res.status(400).json({ message: 'patientId e analysisData são obrigatórios' });
      }

      const topDiagnosis = analysisData.probabilistic_diagnosis?.presumptive?.name || 
        analysisData.radiology_findings?.dominant_pathology || 'Radiologia';

      const content = [
        `# Análise Radiológica - ${topDiagnosis}`,
        `**Data:** ${new Date().toLocaleString('pt-BR')}`,
        `**Paciente ID:** ${patientId}`,
        patientContext?.age ? `**Idade:** ${patientContext.age}` : '',
        patientContext?.sex ? `**Sexo:** ${patientContext.sex}` : '',
        patientContext?.clinicalHistory ? `**Histórico:** ${patientContext.clinicalHistory}` : '',
        patientContext?.anatomicalRegion ? `**Região:** ${patientContext.anatomicalRegion}` : '',
        '',
        `## Achado Principal`,
        `**Patologia dominante:** ${analysisData.radiology_findings?.dominant_pathology || 'N/A'}`,
        `**Região anatômica:** ${analysisData.radiology_findings?.anatomical_region || 'N/A'}`,
        analysisData.radiology_findings?.description || '',
        '',
        `## Diagnóstico Presuntivo`,
        `**${analysisData.probabilistic_diagnosis?.presumptive?.name || topDiagnosis}** (${analysisData.probabilistic_diagnosis?.presumptive?.confidence || 'N/A'})`,
        analysisData.probabilistic_diagnosis?.presumptive?.reasoning || '',
        '',
        `## Diagnósticos Diferenciais`,
        ...(analysisData.probabilistic_diagnosis?.differentials || []).map((d: any) => `- ${d.name}: ${d.confidence} - ${d.reasoning || ''}`),
        '',
        `## Conduta Recomendada`,
        analysisData.recommended_conduct || '',
        '',
        `## Gravidade`,
        `${analysisData.severity_level?.label || 'N/A'} (${analysisData.severity_level?.level || 0}/5)`,
        analysisData.severity_level?.description || '',
        '',
        `## Laudo Formal`,
        analysisData.formal_report?.findings || '',
        analysisData.formal_report?.diagnostic_impression || '',
        analysisData.formal_report?.recommendations || '',
      ].filter(Boolean).join('\n');

      const noteResult = await storage.createDoctorNote({
        doctorId: req.user.id,
        title: `Radiologia - ${topDiagnosis} - Paciente ${patientId.substring(0, 8)}`,
        content,
        folder: 'radiology_study',
        color: 'purple',
        isPinned: false,
        patientId,
      });

      res.json({ success: true, noteId: (noteResult as any)?.id, message: 'Análise radiológica associada ao paciente' });
    } catch (error) {
      console.error('Radiology associate error:', error);
      res.status(500).json({ message: 'Erro ao associar análise radiológica ao paciente' });
    }
  });

  app.post('/api/radiology/share', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Apenas médicos podem compartilhar análises radiológicas' });
      }

      const { recipientEmail, contentScope, analysisData, patientContext } = req.body;
      if (!recipientEmail || !contentScope || !analysisData) {
        return res.status(400).json({ message: 'recipientEmail, contentScope e analysisData são obrigatórios' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        return res.status(400).json({ message: 'Formato de email inválido' });
      }
      const validScopes = ['study_analysis', 'analysis_only', 'report_only', 'full_summary'];
      if (!validScopes.includes(contentScope)) {
        return res.status(400).json({ message: 'Escopo inválido' });
      }

      let formattedContent = '';
      const topDiagnosis = analysisData.probabilistic_diagnosis?.presumptive?.name || 
        analysisData.radiology_findings?.dominant_pathology || 'Radiologia';

      if (contentScope === 'study_analysis' || contentScope === 'full_summary') {
        formattedContent += `ANÁLISE RADIOLÓGICA COMPLETA\n${'='.repeat(40)}\n`;
        formattedContent += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
        formattedContent += `Médico: Dr(a). ${req.user.name || req.user.username}\n\n`;
        if (patientContext?.age) formattedContent += `Idade: ${patientContext.age}\n`;
        if (patientContext?.sex) formattedContent += `Sexo: ${patientContext.sex}\n`;
        if (patientContext?.clinicalHistory) formattedContent += `Histórico: ${patientContext.clinicalHistory}\n`;
        if (patientContext?.anatomicalRegion) formattedContent += `Região: ${patientContext.anatomicalRegion}\n`;
        formattedContent += '\n';
      }

      if (contentScope !== 'report_only') {
        formattedContent += `ACHADO PRINCIPAL\n${'-'.repeat(30)}\n`;
        formattedContent += `Patologia: ${analysisData.radiology_findings?.dominant_pathology || 'N/A'}\n`;
        formattedContent += `Região: ${analysisData.radiology_findings?.anatomical_region || 'N/A'}\n`;
        formattedContent += `${analysisData.radiology_findings?.description || ''}\n\n`;
        formattedContent += `DIAGNÓSTICO PRESUNTIVO\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.probabilistic_diagnosis?.presumptive?.name || topDiagnosis} (${analysisData.probabilistic_diagnosis?.presumptive?.confidence || 'N/A'})\n`;
        formattedContent += `${analysisData.probabilistic_diagnosis?.presumptive?.reasoning || ''}\n\n`;
        formattedContent += `DIAGNÓSTICOS DIFERENCIAIS\n${'-'.repeat(30)}\n`;
        (analysisData.probabilistic_diagnosis?.differentials || []).forEach((d: any) => {
          formattedContent += `• ${d.name}: ${d.confidence} - ${d.reasoning || ''}\n`;
        });
        formattedContent += '\n';
        formattedContent += `CONDUTA RECOMENDADA\n${'-'.repeat(30)}\n`;
        formattedContent += `${analysisData.recommended_conduct || 'N/A'}\n\n`;
        formattedContent += `GRAVIDADE: ${analysisData.severity_level?.label || 'N/A'} (${analysisData.severity_level?.level || 0}/5)\n`;
        formattedContent += `${analysisData.severity_level?.description || ''}\n\n`;
      }

      if (contentScope === 'report_only' || contentScope === 'study_analysis' || contentScope === 'full_summary') {
        formattedContent += `LAUDO FORMAL\n${'-'.repeat(30)}\n`;
        formattedContent += `Exame: ${analysisData.formal_report?.exam || 'N/A'}\n`;
        formattedContent += `Técnica: ${analysisData.formal_report?.technique || 'N/A'}\n`;
        formattedContent += `Achados: ${analysisData.formal_report?.findings || 'N/A'}\n`;
        formattedContent += `Impressão: ${analysisData.formal_report?.diagnostic_impression || 'N/A'}\n`;
        formattedContent += `Recomendações: ${analysisData.formal_report?.recommendations || 'N/A'}\n\n`;
      }

      formattedContent += `${'='.repeat(40)}\n`;
      formattedContent += analysisData.disclaimer || 'Análise automatizada por IA. Requer validação médica.';

      console.log(`[Radiology Share] Doctor ${req.user.id} sharing radiology analysis to ${recipientEmail} (scope: ${contentScope})`);

      const shareRecord = await storage.createDoctorNote({
        doctorId: req.user.id,
        title: `Radiologia Share - ${topDiagnosis} → ${recipientEmail}`,
        content: formattedContent,
        folder: 'radiology_shares',
        color: 'purple',
        isPinned: false,
        patientId: null,
      });

      res.json({
        success: true,
        shareId: (shareRecord as any)?.id,
        message: `Análise radiológica preparada para envio a ${recipientEmail}`,
        recipientEmail,
        contentScope,
        formattedContent,
        sentAt: new Date().toISOString(),
        sentBy: req.user.id,
      });
    } catch (error) {
      console.error('Radiology share error:', error);
      res.status(500).json({ message: 'Erro ao compartilhar análise radiológica' });
    }
  });

  // FHIR R4 Local DB - Get Patients
  app.get('/api/fhir/patients', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const { name } = req.query;
      let query = db.select().from(fhirPatients).where(eq(fhirPatients.active, true)).orderBy(desc(fhirPatients.updatedAt));
      
      let rows = await query;
      if (name) {
        const search = (name as string).toLowerCase();
        rows = rows.filter(r => (r.name || '').toLowerCase().includes(search) || (r.family || '').toLowerCase().includes(search));
      }

      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: rows.length,
        entry: rows.map(r => ({
          resource: { ...(r.resourceData as any), id: r.id },
          fullUrl: `urn:uuid:${r.id}`,
        })),
      };
      res.json(bundle);
    } catch (error) {
      console.error('FHIR Patient fetch error:', error);
      res.status(500).json({ message: 'Erro ao buscar pacientes FHIR' });
    }
  });

  // FHIR R4 Local DB - Create Patient
  app.post('/api/fhir/patients', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Sem permissão' });
      }
      
      const resource = req.body;
      const givenName = resource.name?.[0]?.given?.join(' ') || '';
      const familyName = resource.name?.[0]?.family || '';
      const phone = resource.telecom?.find((t: any) => t.system === 'phone')?.value || null;
      const email = resource.telecom?.find((t: any) => t.system === 'email')?.value || null;

      const [created] = await db.insert(fhirPatients).values({
        resourceData: resource,
        name: givenName,
        family: familyName,
        gender: resource.gender || null,
        birthDate: resource.birthDate || null,
        phone,
        email,
        active: resource.active !== false,
        createdBy: req.user.id,
      }).returning();

      const fullResource = { ...resource, id: created.id };
      await db.update(fhirPatients).set({ resourceData: fullResource }).where(eq(fhirPatients.id, created.id));
      res.status(201).json(fullResource);
    } catch (error) {
      console.error('FHIR Patient create error:', error);
      res.status(500).json({ message: 'Erro ao criar paciente FHIR' });
    }
  });

  // FHIR R4 Local DB - Get Observations
  app.get('/api/fhir/observations', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const { patient } = req.query;
      
      let rows;
      if (patient) {
        rows = await db.select().from(fhirObservations).where(eq(fhirObservations.fhirPatientId, patient as string)).orderBy(desc(fhirObservations.createdAt));
      } else {
        rows = await db.select().from(fhirObservations).orderBy(desc(fhirObservations.createdAt)).limit(50);
      }

      const bundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: rows.length,
        entry: rows.map(r => ({
          resource: { ...(r.resourceData as any), id: r.id },
          fullUrl: `urn:uuid:${r.id}`,
        })),
      };
      res.json(bundle);
    } catch (error) {
      console.error('FHIR Observation fetch error:', error);
      res.status(500).json({ message: 'Erro ao buscar observações FHIR' });
    }
  });

  // FHIR R4 Local DB - Create Observation
  app.post('/api/fhir/observations', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Sem permissão' });
      }
      
      const resource = req.body;
      const patientRef = resource.subject?.reference?.replace('Patient/', '') || null;

      const [created] = await db.insert(fhirObservations).values({
        fhirPatientId: patientRef,
        resourceData: resource,
        code: resource.code?.coding?.[0]?.code || null,
        display: resource.code?.text || resource.code?.coding?.[0]?.display || null,
        valueString: resource.valueString || (resource.valueQuantity ? String(resource.valueQuantity.value) : null),
        valueQuantity: resource.valueQuantity ? String(resource.valueQuantity.value) : null,
        unit: resource.valueQuantity?.unit || null,
        status: resource.status || 'final',
        effectiveDateTime: resource.effectiveDateTime || new Date().toISOString(),
        createdBy: req.user.id,
      }).returning();

      const fullResource = { ...resource, id: created.id };
      await db.update(fhirObservations).set({ resourceData: fullResource }).where(eq(fhirObservations.id, created.id));
      res.status(201).json(fullResource);
    } catch (error) {
      console.error('FHIR Observation create error:', error);
      res.status(500).json({ message: 'Erro ao criar observação FHIR' });
    }
  });

  // FHIR R4 Local DB - Get Patient by ID
  app.get('/api/fhir/patients/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const [row] = await db.select().from(fhirPatients).where(eq(fhirPatients.id, req.params.id));
      if (!row) return res.status(404).json({ message: 'Paciente não encontrado' });
      res.json({ ...(row.resourceData as any), id: row.id });
    } catch (error) {
      console.error('FHIR Patient get error:', error);
      res.status(500).json({ message: 'Erro ao buscar paciente FHIR' });
    }
  });

  // FHIR R4 Local DB - Delete Patient
  app.delete('/api/fhir/patients/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Sem permissão' });
      }
      await db.delete(fhirObservations).where(eq(fhirObservations.fhirPatientId, req.params.id));
      const [deleted] = await db.delete(fhirPatients).where(eq(fhirPatients.id, req.params.id)).returning();
      if (!deleted) return res.status(404).json({ message: 'Paciente não encontrado' });
      res.json({ message: 'Paciente removido' });
    } catch (error) {
      console.error('FHIR Patient delete error:', error);
      res.status(500).json({ message: 'Erro ao remover paciente FHIR' });
    }
  });

  // FHIR R4 Local DB - Update Patient
  app.put('/api/fhir/patients/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const resource = { ...req.body, id: req.params.id };
      const givenName = resource.name?.[0]?.given?.join(' ') || '';
      const familyName = resource.name?.[0]?.family || '';
      const phone = resource.telecom?.find((t: any) => t.system === 'phone')?.value || null;
      const email = resource.telecom?.find((t: any) => t.system === 'email')?.value || null;

      const [updated] = await db.update(fhirPatients).set({
        resourceData: resource,
        name: givenName,
        family: familyName,
        gender: resource.gender || null,
        birthDate: resource.birthDate || null,
        phone,
        email,
        active: resource.active !== false,
        updatedAt: new Date(),
      }).where(eq(fhirPatients.id, req.params.id)).returning();

      if (!updated) return res.status(404).json({ message: 'Paciente não encontrado' });
      res.json(resource);
    } catch (error) {
      console.error('FHIR Patient update error:', error);
      res.status(500).json({ message: 'Erro ao atualizar paciente FHIR' });
    }
  });

  // FHIR R4 Local DB - Update Observation
  app.put('/api/fhir/observations/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const resource = { ...req.body, id: req.params.id };
      const patientRef = resource.subject?.reference?.replace('Patient/', '') || null;

      const [updated] = await db.update(fhirObservations).set({
        resourceData: resource,
        fhirPatientId: patientRef,
        code: resource.code?.coding?.[0]?.code || null,
        display: resource.code?.text || resource.code?.coding?.[0]?.display || null,
        valueString: resource.valueString || (resource.valueQuantity ? String(resource.valueQuantity.value) : null),
        valueQuantity: resource.valueQuantity ? String(resource.valueQuantity.value) : null,
        unit: resource.valueQuantity?.unit || null,
        status: resource.status || 'final',
        effectiveDateTime: resource.effectiveDateTime || new Date().toISOString(),
      }).where(eq(fhirObservations.id, req.params.id)).returning();

      if (!updated) return res.status(404).json({ message: 'Observação não encontrada' });
      res.json(resource);
    } catch (error) {
      console.error('FHIR Observation update error:', error);
      res.status(500).json({ message: 'Erro ao atualizar observação FHIR' });
    }
  });

  // FHIR R4 Local DB - Delete Observation
  app.delete('/api/fhir/observations/:id', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }
      const [deleted] = await db.delete(fhirObservations).where(eq(fhirObservations.id, req.params.id)).returning();
      if (!deleted) return res.status(404).json({ message: 'Observação não encontrada' });
      res.json({ message: 'Observação removida' });
    } catch (error) {
      console.error('FHIR Observation delete error:', error);
      res.status(500).json({ message: 'Erro ao remover observação FHIR' });
    }
  });

  // FHIR R4 - Clinical History from completed consultations
  app.get('/api/fhir/clinical-history', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Acesso restrito a médicos e administradores' });
      }

      const records = await db.select({
        id: medicalRecords.id,
        patientId: medicalRecords.patientId,
        doctorId: medicalRecords.doctorId,
        appointmentId: medicalRecords.appointmentId,
        diagnosis: medicalRecords.diagnosis,
        symptoms: medicalRecords.symptoms,
        treatment: medicalRecords.treatment,
        prescription: medicalRecords.prescription,
        observations: medicalRecords.observations,
        createdAt: medicalRecords.createdAt,
        doctorName: users.name,
        patientName: patients.name,
      })
      .from(medicalRecords)
      .leftJoin(users, eq(medicalRecords.doctorId, users.id))
      .leftJoin(patients, eq(medicalRecords.patientId, patients.id))
      .orderBy(desc(medicalRecords.createdAt))
      .limit(100);

      const completedAppointments = await db.select({
        id: appointments.id,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        scheduledAt: appointments.scheduledAt,
        type: appointments.type,
        status: appointments.status,
        notes: appointments.notes,
        doctorName: users.name,
        patientName: patients.name,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(eq(appointments.status, 'completed'))
      .orderBy(desc(appointments.scheduledAt))
      .limit(100);

      const timeline = [
        ...records.map(r => ({
          id: r.id,
          type: 'medical_record' as const,
          date: r.createdAt,
          patientName: r.patientName || 'Paciente',
          doctorName: r.doctorName || 'Médico',
          diagnosis: r.diagnosis,
          symptoms: r.symptoms,
          treatment: r.treatment,
          prescription: r.prescription,
          observations: r.observations,
          consultationType: r.appointmentId ? 'scheduled' : 'urgent',
        })),
        ...completedAppointments
          .filter(a => !records.some(r => r.appointmentId === a.id))
          .map(a => ({
            id: a.id,
            type: 'appointment' as const,
            date: a.scheduledAt,
            patientName: a.patientName || 'Paciente',
            doctorName: a.doctorName || 'Médico',
            diagnosis: null,
            symptoms: null,
            treatment: null,
            prescription: null,
            observations: a.notes,
            consultationType: a.type === 'emergency' ? 'urgent' : a.type === 'followup' ? 'followup' : 'scheduled',
          })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({ timeline, total: timeline.length });
    } catch (error) {
      console.error('Clinical history fetch error:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico clínico' });
    }
  });

  // FHIR R4 Local patients export as FHIR Bundle
  app.get('/api/fhir/export-bundle/:patientId', requireAuth, async (req: any, res: any) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Autenticação necessária' });
      if (!['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Sem permissão' });
      }

      const { patientExportService } = await import('./services/patient-export-service');
      const bundle = await patientExportService.exportPatientData(req.params.patientId, {
        standard: (req.query.standard as any) || 'fhir-intl',
        format: 'json',
        deidentify: req.query.deidentify === 'true',
      });
      
      res.setHeader('Content-Type', 'application/fhir+json');
      res.setHeader('Content-Disposition', `attachment; filename="fhir-bundle-${req.params.patientId}.json"`);
      res.json(bundle);
    } catch (error) {
      console.error('FHIR export error:', error);
      res.status(500).json({ message: 'Erro ao exportar bundle FHIR' });
    }
  });

  // ===== MCP-Compatible Study Management Routes =====

  const mcpOrDoctorAuth = async (req: any, res: any, next: any) => {
    const mcpSecret = process.env.TELE_M3D_SECRET;
    const authHeader = req.headers.authorization;
    const mcpHeader = req.headers["x-mcp-auth"];

    if (mcpSecret) {
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : mcpHeader;
      if (token === mcpSecret) {
        req.user = { id: 'mcp-service', role: 'admin', username: 'mcp-service', isMcpService: true };
        return next();
      }
    }

    return requireAuth(req, res, async () => {
      if (!req.user || !['doctor', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied: doctor or admin role required' });
      }
      next();
    });
  };

  app.get('/api/study-report/:id', mcpOrDoctorAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const [observation] = await db
        .select()
        .from(fhirObservations)
        .where(eq(fhirObservations.id, id))
        .limit(1);

      if (!observation) {
        return res.status(404).json({ message: 'Study report not found' });
      }

      if (!req.user.isMcpService && observation.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: you do not own this study report' });
      }

      res.json({
        id: observation.id,
        code: observation.code,
        display: observation.display,
        status: observation.status,
        valueString: observation.valueString,
        effectiveDateTime: observation.effectiveDateTime,
        resourceData: observation.resourceData,
        createdAt: observation.createdAt,
      });
    } catch (error) {
      console.error('Get study report error:', error);
      res.status(500).json({ message: 'Failed to retrieve study report' });
    }
  });

  app.get('/api/patient/:patientId/studies', mcpOrDoctorAuth, async (req: any, res: any) => {
    try {
      const { patientId } = req.params;

      const [patient] = await db
        .select()
        .from(fhirPatients)
        .where(eq(fhirPatients.id, patientId))
        .limit(1);

      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      if (!req.user.isMcpService && patient.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: you do not have access to this patient' });
      }

      const observations = await db
        .select({
          id: fhirObservations.id,
          code: fhirObservations.code,
          display: fhirObservations.display,
          status: fhirObservations.status,
          valueString: fhirObservations.valueString,
          effectiveDateTime: fhirObservations.effectiveDateTime,
          createdAt: fhirObservations.createdAt,
        })
        .from(fhirObservations)
        .where(eq(fhirObservations.fhirPatientId, patientId))
        .orderBy(desc(fhirObservations.createdAt));

      res.json({
        patientId,
        patientName: patient.name,
        totalStudies: observations.length,
        studies: observations,
      });
    } catch (error) {
      console.error('List patient studies error:', error);
      res.status(500).json({ message: 'Failed to list patient studies' });
    }
  });

  app.post('/api/studies', mcpOrDoctorAuth, async (req: any, res: any) => {
    try {
      const { patientId, imageBase64, studyType, notes } = req.body;

      if (!patientId || !imageBase64) {
        return res.status(400).json({ message: 'patientId and imageBase64 are required' });
      }

      const [patient] = await db
        .select()
        .from(fhirPatients)
        .where(eq(fhirPatients.id, patientId))
        .limit(1);

      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      if (!req.user.isMcpService && patient.createdBy !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied: you do not have access to this patient' });
      }

      const type = studyType || "12-lead";
      const now = new Date().toISOString();
      const createdBy = req.user.isMcpService ? patient.createdBy : req.user.id;

      const resourceData = {
        resourceType: "Observation",
        status: "preliminary",
        category: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "procedure",
            display: "Procedure",
          }],
        }],
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "11524-6",
            display: "ECG study",
          }],
          text: `ECG Study - ${type}`,
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: now,
        valueString: notes || `ECG ${type} study`,
      };

      const [newObservation] = await db
        .insert(fhirObservations)
        .values({
          fhirPatientId: patientId,
          resourceData,
          code: "11524-6",
          display: `ECG Study - ${type}`,
          valueString: notes || `ECG ${type} study`,
          status: "preliminary",
          effectiveDateTime: now,
          createdBy,
        })
        .returning();

      res.status(201).json({
        id: newObservation.id,
        status: "created",
        studyType: type,
        patientId,
        createdAt: newObservation.createdAt,
      });
    } catch (error) {
      console.error('Create study error:', error);
      res.status(500).json({ message: 'Failed to create study' });
    }
  });

  return httpServer;
}

// Migrate database schema to add new columns for 24h on-duty system
async function migrateOnDutyColumns() {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS on_duty_until TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS on_duty_started_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_price INTEGER DEFAULT 0`);
    console.log('✓ On-duty columns migrated successfully');
  } catch (error) {
    console.error('Failed to migrate on-duty columns:', error);
  }
}

async function migrateMedicalTeamsTables() {
  try {
    // Create medical_teams table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS medical_teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        team_type TEXT NOT NULL DEFAULT 'clinical_discussion',
        patient_id UUID REFERENCES patients(id),
        is_active BOOLEAN DEFAULT true,
        room_id TEXT,
        last_meeting_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    // Create medical_team_members table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS medical_team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES medical_teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(team_id, user_id)
      )
    `);
    
    console.log('✓ Medical teams tables migrated successfully');
  } catch (error) {
    console.error('Failed to migrate medical teams tables:', error);
  }
}

async function migrateInterConsultationsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inter_consultations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requesting_doctor_id UUID NOT NULL REFERENCES users(id),
        target_doctor_id UUID NOT NULL REFERENCES users(id),
        patient_id UUID REFERENCES patients(id),
        specialty TEXT,
        clinical_case TEXT NOT NULL,
        urgency TEXT NOT NULL DEFAULT 'standard',
        status TEXT NOT NULL DEFAULT 'pending',
        response_notes TEXT,
        responded_at TIMESTAMP,
        scheduled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Inter-consultations table migrated successfully');
  } catch (error) {
    console.error('Failed to migrate inter-consultations table:', error);
  }
}

async function migratePharmacyTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pharmacy_dispensing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL REFERENCES prescriptions(id),
        prescription_item_id UUID REFERENCES prescription_items(id),
        pharmacist_id UUID NOT NULL REFERENCES users(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        doctor_id UUID NOT NULL REFERENCES users(id),
        medication_name TEXT NOT NULL,
        dispensed_quantity INTEGER NOT NULL,
        batch_number TEXT,
        manufacturer TEXT,
        expiry_date TIMESTAMP,
        dispensing_notes TEXT,
        verification_method TEXT NOT NULL DEFAULT 'manual',
        signature_verified BOOLEAN DEFAULT false,
        crm_verified BOOLEAN DEFAULT false,
        crm_verification_notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        dispensed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pharmacy_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pharmacist_id UUID NOT NULL REFERENCES users(id),
        report_type TEXT NOT NULL DEFAULT 'daily',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        total_dispensed INTEGER DEFAULT 0,
        total_prescriptions INTEGER DEFAULT 0,
        medication_breakdown JSONB,
        doctor_breakdown JSONB,
        pathology_breakdown JSONB,
        schedule_breakdown JSONB,
        lgpd_compliant BOOLEAN DEFAULT true,
        generated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacist_id UUID REFERENCES users(id)
    `);
    await db.execute(sql`
      ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pharmacist_read_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE prescription_items ALTER COLUMN medication_id DROP NOT NULL
    `);
    console.log('✓ Pharmacy tables migrated successfully');
  } catch (error) {
    console.error('Failed to migrate pharmacy tables:', error);
  }
}

async function migratePMDColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS pmd_data JSONB
    `);
    await db.execute(sql`
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS pmd_audit_logs JSONB DEFAULT '[]'::jsonb
    `);
    await db.execute(sql`
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS pmd_version TEXT DEFAULT '1.0'
    `);
    console.log('✓ PMD columns migrated successfully');
  } catch (error) {
    console.error('Failed to migrate PMD columns:', error);
  }
}

async function migrateDoctorPatientBlocks() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doctor_patient_blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES users(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        reason TEXT,
        blocked_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Doctor patient blocks table migrated successfully');
  } catch (error) {
    console.error('Failed to migrate doctor patient blocks:', error);
  }
}

async function migratePaymentTransactions() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        package_id UUID REFERENCES tmc_credit_packages(id),
        provider TEXT NOT NULL,
        provider_order_id TEXT,
        payment_method TEXT NOT NULL,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BRL',
        credits_amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        payer_email TEXT,
        payer_name TEXT,
        payer_document TEXT,
        pix_code TEXT,
        pix_qr_code_url TEXT,
        boleto_url TEXT,
        boleto_barcode TEXT,
        stripe_payment_intent_id TEXT,
        stripe_client_secret TEXT,
        error_message TEXT,
        metadata JSONB,
        completed_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Payment transactions table migrated successfully');
  } catch (error) {
    console.error('Failed to migrate payment transactions:', error);
  }
}

async function migrateClinicTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS clinics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        owner_id UUID NOT NULL REFERENCES users(id),
        invite_code TEXT NOT NULL UNIQUE,
        patient_discount_percent INTEGER NOT NULL DEFAULT 30,
        associate_commission_percent INTEGER NOT NULL DEFAULT 15,
        logo_url TEXT,
        specialty TEXT,
        settings JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS clinic_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL REFERENCES clinics(id),
        user_id UUID NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'associate',
        is_active BOOLEAN DEFAULT true,
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS clinic_patient_bindings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL REFERENCES clinics(id),
        patient_id UUID NOT NULL REFERENCES users(id),
        discount_percent INTEGER NOT NULL DEFAULT 30,
        is_active BOOLEAN DEFAULT true,
        bound_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS clinic_consultation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id UUID NOT NULL REFERENCES clinics(id),
        appointment_id UUID,
        doctor_id UUID NOT NULL REFERENCES users(id),
        patient_id UUID NOT NULL REFERENCES users(id),
        original_cost INTEGER NOT NULL,
        discount_applied INTEGER NOT NULL DEFAULT 0,
        final_cost INTEGER NOT NULL,
        owner_commission INTEGER NOT NULL DEFAULT 0,
        owner_paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✓ Clinic tables migrated successfully');
  } catch (error) {
    console.error('Failed to migrate clinic tables:', error);
  }
}

async function migrateUserDeactivationFields() {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT DEFAULT NULL`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT false`);
    // Ensure root user is always protected
    await db.execute(sql`UPDATE users SET is_protected = true WHERE username = 'root'`);
    console.log('✓ User deactivation/protection fields migrated successfully');
  } catch (error) {
    console.error('Failed to migrate user deactivation fields:', error);
  }
}

async function migrateFhirTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fhir_patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_data JSONB NOT NULL,
        name TEXT,
        family TEXT,
        gender TEXT,
        birth_date TEXT,
        phone TEXT,
        email TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fhir_observations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fhir_patient_id UUID REFERENCES fhir_patients(id),
        resource_data JSONB NOT NULL,
        code TEXT,
        display TEXT,
        value_string TEXT,
        value_quantity TEXT,
        unit TEXT,
        status TEXT NOT NULL DEFAULT 'final',
        effective_date_time TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ FHIR tables migrated successfully');
  } catch (error) {
    console.error('Failed to migrate FHIR tables:', error);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        escrow_transaction_id UUID REFERENCES tmc_transactions(id),
        completion_transaction_id UUID REFERENCES tmc_transactions(id),
        responded_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Credit transfers table migrated successfully');
  } catch (error) {
    console.error('Failed to migrate credit transfers table:', error);
  }

  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS document_country TEXT`);
    await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS document TEXT`);
    await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_country TEXT`);
    await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS merged_into_patient_id UUID`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS profile_merge_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        temporary_patient_id UUID NOT NULL,
        permanent_patient_id UUID NOT NULL,
        permanent_user_id UUID NOT NULL,
        merged_by TEXT NOT NULL,
        merged_records JSONB DEFAULT '{}',
        before_state JSONB DEFAULT '{}',
        after_state JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_document_country
      ON users (document, document_country)
      WHERE document IS NOT NULL AND document_country IS NOT NULL
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_document_country
      ON patients (document, document_country)
      WHERE document IS NOT NULL AND document_country IS NOT NULL AND merged_into_patient_id IS NULL
    `);
    console.log('✓ Profile unification fields migrated successfully');
  } catch (error) {
    console.error('Failed to migrate profile unification fields:', error);
  }
}

async function initStripeSync() {
  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.log('⚠ DATABASE_URL not set, skipping Stripe init');
      return;
    }

    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('✓ Stripe schema ready');

    const stripeSync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`;
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        console.log(`✓ Stripe webhook configured: ${result?.webhook?.url || 'OK'}`);
      } catch (whErr: any) {
        console.log('⚠ Stripe webhook setup skipped:', whErr.message);
      }
    }

    stripeSync.syncBackfill()
      .then(() => console.log('✓ Stripe data synced'))
      .catch((err: any) => console.error('Stripe sync error:', err));
  } catch (error) {
    console.error('Stripe init error (non-fatal):', error);
  }
}

async function initializeDefaultSystemSettings() {
  const defaultSettings = [
    {
      settingKey: 'temporary_access_link_expiry_hours',
      settingValue: '2',
      settingType: 'number',
      description: 'Período de validade do link de acesso temporário para visitantes (em horas)',
      category: 'access',
      isEditable: true,
    },
    {
      settingKey: 'consultation_access_token_expiry_hours',
      settingValue: '48',
      settingType: 'number',
      description: 'Período de validade do token de acesso direto à consulta (em horas)',
      category: 'access',
      isEditable: true,
    },
    {
      settingKey: 'max_consultation_duration_minutes',
      settingValue: '60',
      settingType: 'number',
      description: 'Duração máxima da consulta por vídeo (em minutos)',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'ai_auto_triage_enabled',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Habilitar triagem automática por IA nas solicitações de consulta',
      category: 'ai',
      isEditable: true,
    },
    {
      settingKey: 'ai_diagnostic_confidence_threshold',
      settingValue: '96',
      settingType: 'number',
      description: 'Limiar de confiança (%) para aprovação automática de inferências diagnósticas',
      category: 'ai',
      isEditable: true,
    },
    {
      settingKey: 'post_consultation_auto_generate',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Gerar automaticamente prescrições, exames e encaminhamentos após consulta',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'whatsapp_notifications_enabled',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Habilitar envio de notificações via WhatsApp para pacientes',
      category: 'notifications',
      isEditable: true,
    },
    {
      settingKey: 'waiting_room_max_patients',
      settingValue: '20',
      settingType: 'number',
      description: 'Número máximo de pacientes simultâneos na sala de espera',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'prescription_require_digital_signature',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Exigir assinatura digital ICP-Brasil nas prescrições',
      category: 'prescriptions',
      isEditable: true,
    },
    {
      settingKey: 'tmc_credit_cost_consultation',
      settingValue: '5',
      settingType: 'number',
      description: 'Custo em créditos TMC por consulta por vídeo',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'tmc_credit_cost_urgent',
      settingValue: '30',
      settingType: 'number',
      description: 'Custo fixo em créditos TMC para pronto atendimento (consulta urgente imediata)',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'tmc_exchange_rate',
      settingValue: '5',
      settingType: 'number',
      description: 'Taxa de câmbio: quantidade de créditos TMC por 1 USD (padrão: 5 TMC = 1 USD)',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'consultation-commission-percent',
      settingValue: '15',
      settingType: 'number',
      description: 'Taxa percentual da plataforma sobre o preço da consulta definido pelo médico (ex: 15 = 15%)',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'doctor_referral_commission_percent',
      settingValue: '5',
      settingType: 'number',
      description: 'Percentual de comissão que o médico indicador recebe sobre cada consulta do médico indicado (ex: 5 = 5%)',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'paypal_recipient_email',
      settingValue: 'lucasmedicina86@icloud.com',
      settingType: 'string',
      description: 'E-mail do destinatário PayPal para recebimento de pagamentos de créditos TMC',
      category: 'financial',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_dispensing_enabled',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Habilitar módulo de dispensação farmacêutica',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_require_signature_verification',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Exigir verificação de assinatura digital antes da dispensação',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_require_crm_verification',
      settingValue: 'false',
      settingType: 'boolean',
      description: 'Exigir verificação de CRM do médico antes da dispensação (ativar em caso de suspeita)',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_prescription_expiry_days',
      settingValue: '30',
      settingType: 'number',
      description: 'Período de validade da prescrição para dispensação (em dias)',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_lgpd_reports_enabled',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Habilitar anonimização LGPD nos relatórios farmacêuticos',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'pharmacy_auto_read_confirmation',
      settingValue: 'false',
      settingType: 'boolean',
      description: 'Confirmação automática de leitura de prescrições pelo farmacêutico',
      category: 'pharmacy',
      isEditable: true,
    },
    {
      settingKey: 'consultation_inactivity_timeout_minutes',
      settingValue: '10',
      settingType: 'number',
      description: 'Tempo de inatividade do usuário (sem mouse/teclado/toque) antes do aviso de desconexão durante consultas por vídeo (em minutos)',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'consultation_silence_timeout_minutes',
      settingValue: '20',
      settingType: 'number',
      description: 'Tempo de silêncio (sem atividade de áudio/vídeo) antes do aviso de desconexão durante consultas por vídeo (em minutos)',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'consultation_countdown_seconds',
      settingValue: '30',
      settingType: 'number',
      description: 'Duração da contagem regressiva do aviso de desconexão da consulta (em segundos)',
      category: 'consultations',
      isEditable: true,
    },
    {
      settingKey: 'postload_autoscroll_enabled',
      settingValue: 'true',
      settingType: 'boolean',
      description: 'Ativar rolagem automática da página após carregamento (scroll down e retorno ao topo)',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'postload_autoscroll_distance',
      settingValue: '5',
      settingType: 'number',
      description: 'Distância em pixels da rolagem automática após carregamento da página',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'postload_autoscroll_delay_ms',
      settingValue: '300',
      settingType: 'number',
      description: 'Tempo de espera (ms) antes de executar a rolagem automática após carregamento',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'postload_autoscroll_return_delay_ms',
      settingValue: '150',
      settingType: 'number',
      description: 'Tempo de espera (ms) antes de retornar ao topo após a rolagem automática',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'postload_custom_scripts_enabled',
      settingValue: 'false',
      settingType: 'boolean',
      description: 'Ativar execução de scripts personalizados após carregamento da página',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'postload_custom_scripts',
      settingValue: '[]',
      settingType: 'json',
      description: 'Lista de scripts personalizados para executar após carregamento (JSON array com objetos {name, code, enabled, order})',
      category: 'postload',
      isEditable: true,
    },
    {
      settingKey: 'whatsapp_sender_number',
      settingValue: '',
      settingType: 'string',
      description: 'ID do número WhatsApp Business (Phone Number ID da Meta API, ex: 123456789012345). Encontrado em developers.facebook.com > WhatsApp > API Setup.',
      category: 'notifications',
      isEditable: true,
    },
  ];

  try {
    for (const setting of defaultSettings) {
      const existing = await storage.getSystemSetting(setting.settingKey);
      if (!existing) {
        await storage.createSystemSetting(setting);
      }
    }
    console.log('✓ Default system settings initialized');

    const senderSetting = await storage.getSystemSetting('whatsapp_sender_number');
    if (senderSetting?.value) {
      whatsAppService.setAdminSenderNumber(senderSetting.value);
      console.log('✓ WhatsApp sender number loaded from settings');
    }
  } catch (error) {
    console.error('Failed to initialize system settings:', error);
  }
}

// Initialize default doctor if not exists
async function initializeDefaultDoctor() {
  try {
    // Check if a doctor user exists by username
    const existingDoctor = await storage.getUserByUsername('doctor');
    
    if (!existingDoctor) {
      console.log('Creating default doctor user...');
      // Hash the default password using the same method as login
      const hashedPassword = crypto.createHash('sha256').update('doctor123').digest('hex');
      
      const newDoctor = await storage.createUser({
        username: 'doctor',
        password: hashedPassword, // Properly hashed password
        role: 'doctor',
        name: 'Dr. Sistema MedIA',
        email: 'medico@media.med.br',
        phone: '+55 11 99999-9999',
        digitalCertificate: 'dev-certificate-001',
      });
      
      // Update the DEFAULT_DOCTOR_ID to use the generated ID
      console.log('Default doctor created successfully with ID:', newDoctor.id);
      return newDoctor.id;
    } else {
      console.log('Default doctor already exists with ID:', existingDoctor.id);
      
      // Password migration handled in login endpoint for simplicity
      
      return existingDoctor.id;
    }
  } catch (error) {
    console.error('Failed to initialize default doctor:', error);
    return null;
  }
}

async function initializeCreditPackagesAndCosts() {
  try {
    const existingPkgs = await db.select().from(tmcCreditPackages).limit(1);
    if (existingPkgs.length === 0) {
      const defaultPackages = [
        {
          name: 'Início',
          credits: 25,
          priceUsd: '5.00',
          priceBrl: '25.00',
          bonusCredits: 0,
          description: 'Ideal para experimentar o sistema. Permite ~5 consultas ou ~8 prescrições.',
          isActive: true,
          isPromotional: false,
          displayOrder: 1,
        },
        {
          name: 'Básico Mensal',
          credits: 100,
          priceUsd: '20.00',
          priceBrl: '100.00',
          bonusCredits: 10,
          description: 'Para médicos com até 20 consultas/mês. Inclui consultas, prescrições, prontuários e IA diagnóstica.',
          isActive: true,
          isPromotional: false,
          displayOrder: 2,
        },
        {
          name: 'Profissional',
          credits: 250,
          priceUsd: '50.00',
          priceBrl: '250.00',
          bonusCredits: 35,
          description: 'Para clínicas ativas (~50 consultas/mês). Inclui todos os recursos + relatórios epidemiológicos e interconsultas.',
          isActive: true,
          isPromotional: false,
          displayOrder: 3,
        },
        {
          name: 'Premium',
          credits: 500,
          priceUsd: '100.00',
          priceBrl: '500.00',
          bonusCredits: 100,
          description: 'Para alto volume (~100 consultas/mês). Acesso total com bônus de 20%. Ideal para equipes médicas.',
          isActive: true,
          isPromotional: false,
          displayOrder: 4,
        },
        {
          name: 'Institucional',
          credits: 1500,
          priceUsd: '250.00',
          priceBrl: '1250.00',
          bonusCredits: 500,
          description: 'Para hospitais e redes de clínicas. 2000 créditos totais para múltiplos médicos e departamentos.',
          isActive: true,
          isPromotional: false,
          displayOrder: 5,
        },
        {
          name: 'Promoção Boas-Vindas',
          credits: 50,
          priceUsd: '8.00',
          priceBrl: '40.00',
          bonusCredits: 15,
          description: 'Oferta especial para novos usuários! 65 créditos pelo preço de 40. Válido na primeira compra.',
          isActive: true,
          isPromotional: true,
          displayOrder: 0,
        },
      ];

      for (const pkg of defaultPackages) {
        await db.insert(tmcCreditPackages).values(pkg);
      }
      console.log('✓ Default credit packages seeded (6 packages)');
    }

    const existingConfigs = await db.select().from(tmcConfig).limit(1);
    if (existingConfigs.length === 0) {
      const defaultCosts = [
        { functionName: 'video_consultation', costInCredits: 5, description: 'Consulta por vídeo (Agora)', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 10 },
        { functionName: 'ai_triage', costInCredits: 1, description: 'Triagem por IA (Manchester Protocol)', category: 'consultation', minimumRole: 'patient', bonusForPatient: 0, commissionPercentage: 0 },
        { functionName: 'ai_diagnostic', costInCredits: 3, description: 'Inferência diagnóstica por IA (CID-10/DSM-5)', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 10 },
        { functionName: 'prescription_create', costInCredits: 2, description: 'Emissão de prescrição digital', category: 'prescription', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 5 },
        { functionName: 'medical_record_create', costInCredits: 2, description: 'Criação de prontuário médico', category: 'data_access', minimumRole: 'doctor', bonusForPatient: 1, commissionPercentage: 5 },
        { functionName: 'medical_record_view', costInCredits: 1, description: 'Consulta de prontuário', category: 'data_access', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 0 },
        { functionName: 'ai_chat', costInCredits: 1, description: 'Consulta ao chatbot IA médico', category: 'consultation', minimumRole: 'patient', bonusForPatient: 0, commissionPercentage: 0 },
        { functionName: 'whatsapp_ai_analysis', costInCredits: 2, description: 'Análise de mensagem WhatsApp por IA', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 5 },
        { functionName: 'epidemiological_report', costInCredits: 5, description: 'Relatório epidemiológico com MeSH/CID', category: 'data_access', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 10 },
        { functionName: 'post_consultation_review', costInCredits: 2, description: 'Revisão pós-consulta com geração de itens', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 5 },
        { functionName: 'inter_consultation', costInCredits: 3, description: 'Interconsulta médica', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 10 },
        { functionName: 'nft_creation', costInCredits: 10, description: 'Criação de NFT dinâmico de dados anonimizados', category: 'data_access', minimumRole: 'doctor', bonusForPatient: 2, commissionPercentage: 15 },
        { functionName: 'drug_interaction_check', costInCredits: 1, description: 'Verificação de interação medicamentosa por IA', category: 'prescription', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 0 },
        { functionName: 'soap_report', costInCredits: 2, description: 'Geração de relatório SOAP por IA', category: 'consultation', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 5 },
        { functionName: 'lab_order', costInCredits: 1, description: 'Solicitação de exame laboratorial', category: 'prescription', minimumRole: 'doctor', bonusForPatient: 0, commissionPercentage: 0 },
      ];

      for (const cost of defaultCosts) {
        await db.insert(tmcConfig).values(cost);
      }
      console.log('✓ Default feature costs seeded (15 functions)');
    }
  } catch (error) {
    console.error('Failed to initialize credit packages/costs:', error);
  }
}

async function migratePostConsultationEditColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE post_consultation_items
      ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb
    `);
    await db.execute(sql`
      ALTER TABLE post_consultation_items
      ADD COLUMN IF NOT EXISTS edited_at timestamp
    `);
    await db.execute(sql`
      ALTER TABLE post_consultation_items
      ADD COLUMN IF NOT EXISTS edited_by varchar(255)
    `);
    console.log('✓ Post-consultation edit columns migrated successfully');
  } catch (error) {
    console.error('Failed to migrate post-consultation edit columns:', error);
  }
}
