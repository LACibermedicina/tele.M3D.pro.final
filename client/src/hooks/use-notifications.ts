import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

export interface Notification {
  id: string;
  type: 'appointment' | 'whatsapp' | 'exam_result' | 'emergency' | 'system' | 'consultation_invite' | 'doctor_message' | 'consultation_ready' | 'urgent_alert' | 'consultation_message' | 'patient_joined_office' | 'credit_transfer' | 'credit_transfer_response' | 'credit_transfer_cancelled' | 'incomplete_consultation' | 'room_presence' | 'urgency_request' | 'urgency_accepted';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  data?: any;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { messages: wsMessages, isConnected } = useWebSocket();
  const { toast } = useToast();
  const pendingFetched = useRef(false);

  const mapDbNotification = (n: any, markRead: boolean): Notification => {
    const resolvedType = n.metadata?.wsType || n.type;
    return {
      id: `stored-${n.id}`,
      type: resolvedType as Notification['type'],
      title: n.title,
      message: n.message,
      priority: n.priority as Notification['priority'],
      timestamp: new Date(n.createdAt),
      read: markRead,
      actionUrl: n.actionUrl,
      data: { ...n.metadata, senderId: n.senderId, dbId: n.id }
    };
  };

  useEffect(() => {
    if (isConnected && !pendingFetched.current) {
      pendingFetched.current = true;

      const fetchPending = fetch('/api/notifications/pending', { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .catch(() => []);

      const fetchHistory = fetch('/api/notifications/history', { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .catch(() => []);

      Promise.all([fetchPending, fetchHistory]).then(([pending, history]: [any[], any[]]) => {
        const mapped: Notification[] = [];

        if (pending && pending.length > 0) {
          mapped.push(...pending.map((n: any) => mapDbNotification(n, false)));
          const ids = pending.map((n: any) => n.id);
          apiRequest('POST', '/api/notifications/mark-read', { notificationIds: ids }).catch(() => {});
        }

        if (history && history.length > 0) {
          mapped.push(...history.map((n: any) => mapDbNotification(n, true)));
        }

        if (mapped.length > 0) {
          setNotifications(prev => [...mapped, ...prev]);
        }
      });
    }
  }, [isConnected]);

  // Process incoming WebSocket messages into notifications
  useEffect(() => {
    const latestMessage = wsMessages[wsMessages.length - 1];
    if (!latestMessage) return;

    const notification = processWebSocketMessage(latestMessage);
    if (notification) {
      setNotifications(prev => {
        let updated = [notification, ...prev.slice(0, 49)];

        if (notification.type === 'urgency_accepted' && notification.data?.requestId) {
          updated = updated.map(n =>
            n.type === 'urgency_request' && n.data?.requestId === notification.data.requestId
              ? { ...n, read: true }
              : n
          );
        }

        return updated;
      });
      
      if (notification.priority === 'high' || notification.priority === 'critical') {
        toast({
          title: notification.title,
          description: notification.message,
          variant: notification.priority === 'critical' ? 'destructive' : 'default',
        });
        
        if (notification.priority === 'critical') {
          playNotificationSound();
        }
      }

      invalidateRelatedQueries(notification.type);
    }
  }, [wsMessages, toast]);

  const processWebSocketMessage = (message: any): Notification | null => {
    const timestamp = new Date();
    
    switch (message.type) {
      case 'whatsapp_message':
        return {
          id: `whatsapp-${Date.now()}`,
          type: 'whatsapp',
          title: 'Nova Mensagem WhatsApp',
          message: `Mensagem de ${message.data.patientName || 'paciente'}`,
          priority: 'medium',
          timestamp,
          read: false,
          actionUrl: '/dashboard',
          data: message.data
        };

      case 'appointment_update':
        return {
          id: `appointment-${Date.now()}`,
          type: 'appointment',
          title: 'Consulta Atualizada',
          message: message.data.message || 'Uma consulta foi atualizada',
          priority: message.data.urgent ? 'high' : 'medium',
          timestamp,
          read: false,
          actionUrl: '/schedule',
          data: message.data
        };

      case 'exam_result':
        return {
          id: `exam-${Date.now()}`,
          type: 'exam_result',
          title: 'Novo Resultado de Exame',
          message: `Resultado disponível: ${message.data.examType}`,
          priority: message.data.abnormalValues?.length > 0 ? 'high' : 'medium',
          timestamp,
          read: false,
          actionUrl: '/dashboard',
          data: message.data
        };

      case 'emergency_alert':
        return {
          id: `emergency-${Date.now()}`,
          type: 'emergency',
          title: 'ALERTA DE EMERGÊNCIA',
          message: message.data.message || 'Situação de emergência detectada',
          priority: 'critical',
          timestamp,
          read: false,
          actionUrl: '/dashboard',
          data: message.data
        };

      case 'system_notification':
        return {
          id: `system-${Date.now()}`,
          type: 'system',
          title: message.data.title || 'Notificação do Sistema',
          message: message.data.message,
          priority: message.data.priority || 'low',
          timestamp,
          read: false,
          data: message.data
        };

      case 'consultation_invite':
        return {
          id: `invite-${Date.now()}`,
          type: 'consultation_invite',
          title: message.data?.title || 'Convite para Teleconsulta',
          message: message.data?.message || 'Você foi convidado para uma consulta por vídeo',
          priority: 'critical',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'consultation_ready':
        return {
          id: `ready-${Date.now()}`,
          type: 'consultation_ready',
          title: 'Consulta Pronta',
          message: message.data?.message || 'Sua consulta por vídeo está pronta',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'consultation_message':
        return {
          id: `consult-msg-${Date.now()}`,
          type: 'consultation_message',
          title: message.data?.title || 'Mensagem da Consulta',
          message: message.data?.message || '',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'doctor_message':
        return {
          id: `doc-msg-${Date.now()}`,
          type: 'doctor_message',
          title: message.data?.title || 'Mensagem do Médico',
          message: message.data?.message || '',
          priority: message.data?.priority || 'high',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'urgent_alert':
        return {
          id: `urgent-${Date.now()}`,
          type: 'urgent_alert',
          title: message.data?.title || 'ALERTA URGENTE',
          message: message.data?.message || 'Mensagem urgente recebida',
          priority: 'critical',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'patient_joined_office':
        return {
          id: `patient-join-${Date.now()}`,
          type: 'patient_joined_office',
          title: 'Paciente na Sala de Espera',
          message: `${message.patient?.name || 'Um paciente'} entrou no seu consultório virtual e aguarda atendimento.`,
          priority: 'critical',
          timestamp,
          read: false,
          actionUrl: `/video-consultation/${message.consultationId}`,
          data: message
        };

      case 'consultation_request':
        return {
          id: `req-${Date.now()}`,
          type: 'appointment',
          title: message.data?.title || 'Nova Solicitação de Consulta',
          message: message.data?.message || 'Um paciente solicitou uma consulta',
          priority: message.data?.priority || 'high',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl || '/doctor-chat',
          data: message.data
        };

      case 'credit_transfer':
        return {
          id: `transfer-${Date.now()}`,
          type: 'credit_transfer',
          title: message.data?.title || 'Transferência de Créditos',
          message: message.data?.message || 'Você recebeu uma transferência de créditos',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: '/wallet',
          data: message.data
        };

      case 'credit_transfer_response':
        return {
          id: `transfer-resp-${Date.now()}`,
          type: 'credit_transfer_response',
          title: message.data?.title || 'Resposta de Transferência',
          message: message.data?.message || 'Sua transferência foi respondida',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: '/wallet',
          data: message.data
        };

      case 'credit_transfer_cancelled':
        return {
          id: `transfer-cancel-${Date.now()}`,
          type: 'credit_transfer_cancelled',
          title: message.data?.title || 'Transferência Cancelada',
          message: message.data?.message || 'Uma transferência foi cancelada',
          priority: 'medium',
          timestamp,
          read: false,
          actionUrl: '/wallet',
          data: message.data
        };

      case 'room_presence':
        return {
          id: `room-presence-${Date.now()}`,
          type: 'room_presence',
          title: message.data?.title || 'Presença na Sala',
          message: message.data?.message || 'Alguém entrou na sala de consulta.',
          priority: message.data?.priority || 'high',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl,
          data: message.data
        };

      case 'urgency_request':
        return {
          id: `urgency-req-${Date.now()}`,
          type: 'urgency_request',
          title: message.data?.title || 'Solicitação Urgente',
          message: message.data?.message || 'Nova solicitação de consulta urgente',
          priority: message.data?.priority || 'critical',
          timestamp,
          read: false,
          actionUrl: message.data?.actionUrl || '/doctor-chat',
          data: message.data
        };

      case 'urgency_accepted':
        return {
          id: `urgency-accepted-${Date.now()}`,
          type: 'urgency_accepted',
          title: message.data?.title || 'Solicitação Atendida',
          message: message.data?.message || 'A solicitação foi aceita por outro médico.',
          priority: 'medium',
          timestamp,
          read: false,
          actionUrl: null,
          data: message.data
        };

      default:
        return null;
    }
  };

  const invalidateRelatedQueries = (type: string) => {
    switch (type) {
      case 'whatsapp':
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages/recent'] });
        break;
      case 'appointment':
        queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/chat/doctor/threads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
        break;
      case 'consultation_invite':
      case 'consultation_ready':
      case 'room_presence':
        queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
        break;
      case 'urgency_request':
      case 'urgency_accepted':
        queryClient.invalidateQueries({ queryKey: ['/api/consultation-requests'] });
        queryClient.invalidateQueries({ queryKey: ['/api/chat/doctor/threads'] });
        break;
      case 'exam_result':
        queryClient.invalidateQueries({ queryKey: ['/api/exam-results/recent'] });
        break;
      case 'credit_transfer':
      case 'credit_transfer_response':
      case 'credit_transfer_cancelled':
        queryClient.invalidateQueries({ queryKey: ['/api/tmc/balance'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tmc/transfers/pending'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tmc/transfers/history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/tmc/transactions'] });
        break;
      default:
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    }
  };

  const playNotificationSound = () => {
    // Create a simple notification beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const ACTIVE_THRESHOLD_MS = 20 * 60 * 1000;
  const URGENCY_ACCEPTED_THRESHOLD_MS = 5 * 60 * 1000;

  const getActiveThreshold = (type: string) =>
    type === 'urgency_accepted' ? URGENCY_ACCEPTED_THRESHOLD_MS : ACTIVE_THRESHOLD_MS;

  const activeNotifications = notifications.filter(n => {
    const age = Date.now() - new Date(n.timestamp).getTime();
    return !n.read && age < getActiveThreshold(n.type);
  });

  const historyNotifications = notifications.filter(n => {
    const age = Date.now() - new Date(n.timestamp).getTime();
    return n.read || age >= getActiveThreshold(n.type);
  });

  return {
    notifications,
    activeNotifications,
    historyNotifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications
  };
}