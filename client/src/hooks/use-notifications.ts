import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './use-websocket';
import { useToast } from './use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

export interface Notification {
  id: string;
  type: 'appointment' | 'whatsapp' | 'exam_result' | 'emergency' | 'system' | 'consultation_invite' | 'doctor_message' | 'consultation_ready' | 'urgent_alert' | 'consultation_message' | 'doctor_transfer_request' | 'doctor_transfer_response' | 'patient_transfer_request' | 'data_access_request' | 'data_access_response';
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

  // Fetch pending stored notifications on initial connection
  useEffect(() => {
    if (isConnected && !pendingFetched.current) {
      pendingFetched.current = true;
      fetch('/api/notifications/pending', { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then((pending: any[]) => {
          if (pending && pending.length > 0) {
            const storedNotifications: Notification[] = pending.map((n: any) => ({
              id: `stored-${n.id}`,
              type: n.type as Notification['type'],
              title: n.title,
              message: n.message,
              priority: n.priority as Notification['priority'],
              timestamp: new Date(n.createdAt),
              read: false,
              actionUrl: n.actionUrl,
              data: { ...n.metadata, senderId: n.senderId, dbId: n.id }
            }));
            setNotifications(prev => [...storedNotifications, ...prev]);

            // Mark as read in DB
            const ids = pending.map((n: any) => n.id);
            apiRequest('POST', '/api/notifications/mark-read', { notificationIds: ids }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [isConnected]);

  // Process incoming WebSocket messages into notifications
  useEffect(() => {
    const latestMessage = wsMessages[wsMessages.length - 1];
    if (!latestMessage) return;

    const notification = processWebSocketMessage(latestMessage);
    if (notification) {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep latest 50
      
      // Show toast for high/critical priority notifications
      if (notification.priority === 'high' || notification.priority === 'critical') {
        toast({
          title: notification.title,
          description: notification.message,
          variant: notification.priority === 'critical' ? 'destructive' : 'default',
        });
        
        // Play notification sound for critical alerts
        if (notification.priority === 'critical') {
          playNotificationSound();
        }
      }

      // Trigger cache invalidation for related data
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
          type: 'appointment',
          title: 'Paciente na Sala de Espera',
          message: `${message.patient?.name || 'Um paciente'} entrou no seu consultório virtual`,
          priority: 'critical',
          timestamp,
          read: false,
          actionUrl: `/consultation/video/${message.consultationId}`,
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

      case 'doctor_transfer_request':
        return {
          id: `transfer-req-${Date.now()}`,
          type: 'doctor_transfer_request',
          title: message.data?.title || 'Solicitação de Transferência',
          message: message.data?.message || 'Um médico solicitou a transferência de um paciente',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: '/waiting-room',
          data: message.data
        };

      case 'doctor_transfer_response':
        return {
          id: `transfer-res-${Date.now()}`,
          type: 'doctor_transfer_response',
          title: message.data?.title || 'Resposta de Transferência',
          message: message.data?.message || 'Resposta à solicitação de transferência',
          priority: 'high',
          timestamp,
          read: false,
          actionUrl: '/waiting-room',
          data: message.data
        };

      case 'patient_transfer_request':
        return {
          id: `patient-transfer-${Date.now()}`,
          type: 'patient_transfer_request',
          title: message.data?.title || 'Confirmação de Transferência',
          message: message.data?.message || 'Seu médico responsável aprovou uma transferência. Deseja confirmar?',
          priority: 'critical',
          timestamp,
          read: false,
          data: message.data
        };

      case 'data_access_request':
        return {
          id: `data-access-req-${Date.now()}`,
          type: 'data_access_request',
          title: message.data?.title || 'Solicitação de Acesso a Dados',
          message: message.data?.message || 'Um médico solicitou acesso aos seus dados',
          priority: 'high',
          timestamp,
          read: false,
          data: message.data
        };

      case 'data_access_response':
        return {
          id: `data-access-res-${Date.now()}`,
          type: 'data_access_response',
          title: message.data?.title || 'Resposta de Acesso a Dados',
          message: message.data?.message || 'Resposta à solicitação de acesso a dados',
          priority: 'medium',
          timestamp,
          read: false,
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
        queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
        break;
      case 'exam_result':
        queryClient.invalidateQueries({ queryKey: ['/api/exam-results/recent'] });
        break;
      case 'doctor_transfer_request':
      case 'doctor_transfer_response':
      case 'patient_transfer_request':
        queryClient.invalidateQueries({ queryKey: ['/api/waiting-room'] });
        queryClient.invalidateQueries({ queryKey: ['/api/doctor-transfer/pending'] });
        break;
      case 'data_access_request':
      case 'data_access_response':
        queryClient.invalidateQueries({ queryKey: ['/api/data-access/requests'] });
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

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications
  };
}