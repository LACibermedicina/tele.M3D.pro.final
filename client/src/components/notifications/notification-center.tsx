import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, BellRing, Check, X, AlertTriangle, MessageCircle, Calendar, FileText, Activity, Video, Stethoscope, Send, Reply, Trash2, Clock, History } from 'lucide-react';
import { useLocation } from 'wouter';

interface NotificationCenterProps {
  isScrolled?: boolean;
}

export default function NotificationCenter({ isScrolled = false }: NotificationCenterProps) {
  const { notifications, activeNotifications, historyNotifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotification, clearAllNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSendReply = async (notification: Notification) => {
    if (!replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      if (notification.type === 'consultation_message' && (user?.role === 'doctor' || user?.role === 'admin')) {
        const consultationId = notification.data?.consultationId || notification.metadata?.consultationId;
        if (consultationId) {
          await apiRequest('POST', `/api/video-consultations/${consultationId}/notes`, {
            type: 'chat',
            content: replyText.trim(),
            metadata: { senderName: user?.name || 'Médico(a)', senderRole: 'doctor' }
          });
          toast({ title: "Resposta enviada", description: `Sua resposta foi enviada para ${notification.data?.patientName || 'o paciente'}.` });
        }
      } else if (notification.type === 'urgency_accepted' && notification.data?.acceptedById) {
        await apiRequest('POST', '/api/notifications/patient-reply', {
          doctorId: notification.data.acceptedById,
          message: replyText.trim(),
          notificationId: notification.id,
        });
        toast({ title: "Mensagem enviada", description: `Sua mensagem foi enviada para Dr(a). ${notification.data.acceptedByName || 'o médico'}.` });
      } else {
        const doctorId = notification.data?.doctorId || notification.data?.senderId || notification.senderId;
        if (!doctorId) return;
        await apiRequest('POST', '/api/notifications/patient-reply', {
          doctorId,
          message: replyText.trim(),
          notificationId: notification.id,
        });
        toast({ title: "Resposta enviada", description: `Sua resposta foi enviada para ${notification.data?.doctorName || 'o médico'}.` });
      }
      setReplyText("");
      setReplyingTo(null);
      markAsRead(notification.id);
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar a resposta.", variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = priority === 'critical' ? 'text-destructive' : 
                     priority === 'high' ? 'text-orange-500' : 
                     priority === 'medium' ? 'text-blue-500' : 'text-muted-foreground';

    switch (type) {
      case 'whatsapp':
        return <MessageCircle className={`h-4 w-4 ${iconClass}`} />;
      case 'appointment':
        return <Calendar className={`h-4 w-4 ${iconClass}`} />;
      case 'patient_joined_office':
        return <Stethoscope className={`h-4 w-4 ${iconClass}`} />;
      case 'exam_result':
        return <FileText className={`h-4 w-4 ${iconClass}`} />;
      case 'emergency':
      case 'urgent_alert':
        return <AlertTriangle className={`h-4 w-4 ${iconClass}`} />;
      case 'system':
        return <Activity className={`h-4 w-4 ${iconClass}`} />;
      case 'consultation_invite':
      case 'consultation_ready':
        return <Video className={`h-4 w-4 ${iconClass}`} />;
      case 'consultation_message':
        return <MessageCircle className={`h-4 w-4 ${iconClass}`} />;
      case 'incomplete_consultation':
        return <AlertTriangle className={`h-4 w-4 ${iconClass} text-orange-500`} />;
      case 'doctor_message':
        return <Stethoscope className={`h-4 w-4 ${iconClass}`} />;
      case 'room_presence':
        return <Video className={`h-4 w-4 ${iconClass}`} />;
      case 'urgency_request':
        return <AlertTriangle className={`h-4 w-4 text-red-500`} />;
      case 'urgency_accepted':
        return <Check className={`h-4 w-4 text-green-500`} />;
      default:
        return <Bell className={`h-4 w-4 ${iconClass}`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-l-muted bg-muted/30';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
      setIsOpen(false);
    }
  };

  const displayedNotifications = activeTab === 'active' ? activeNotifications : historyNotifications;

  const renderNotification = (notification: Notification) => (
    <div
      key={notification.id}
      className={`p-3 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-muted/50 ${
        getPriorityColor(notification.priority)
      } ${!notification.read ? 'font-medium' : 'opacity-75'}`}
      onClick={() => handleNotificationClick(notification)}
      data-testid={`notification-${notification.id}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center space-x-2">
          {getNotificationIcon(notification.type, notification.priority)}
          <h4 className="text-sm font-medium truncate">
            {notification.title}
          </h4>
        </div>
        <div className="flex items-center space-x-1">
          {!notification.read && (
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          )}
          {activeTab === 'active' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                clearNotification(notification.id);
              }}
              data-testid={`button-clear-${notification.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2">
        {notification.message}
      </p>
      
      <div className="flex items-center justify-between flex-wrap gap-1">
        <p className="text-xs text-muted-foreground">
          {format(notification.timestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </p>
        <div className="flex items-center gap-1">
          {(notification.type === 'consultation_invite' || notification.type === 'consultation_ready' || notification.type === 'consultation_message') && (notification.data?.actionUrl || notification.actionUrl) && (
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
                setLocation(notification.data?.actionUrl || notification.actionUrl || '/my-consultations');
                setIsOpen(false);
              }}
            >
              <Video className="h-3 w-3 mr-1" />
              Entrar
            </Button>
          )}
          {notification.type === 'patient_joined_office' && notification.actionUrl && (
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
                setLocation(notification.actionUrl!);
                setIsOpen(false);
              }}
            >
              <Video className="h-3 w-3 mr-1" />
              Atender
            </Button>
          )}
          {notification.type === 'incomplete_consultation' && (
            <>
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                  setLocation(notification.data?.actionUrl || notification.actionUrl || '/schedule');
                  setIsOpen(false);
                }}
              >
                <Video className="h-3 w-3 mr-1" />
                Retomar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-green-600 hover:text-green-800"
                onClick={async (e) => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                  const cId = notification.data?.consultationId || notification.metadata?.consultationId;
                  if (cId) {
                    try {
                      await apiRequest('POST', `/api/video-consultations/${cId}/complete`, { notes: 'Concluída via notificação' });
                    } catch {}
                  }
                  setIsOpen(false);
                }}
              >
                Concluir
              </Button>
            </>
          )}
          {notification.type === 'credit_transfer' && (notification.data?.transferId || notification.metadata?.transferId) && (
            <>
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={async (e) => {
                  e.stopPropagation();
                  const tId = notification.data?.transferId || notification.metadata?.transferId;
                  try {
                    await apiRequest('POST', '/api/tmc/transfer-respond', { transferId: tId, action: 'accept' });
                    markAsRead(notification.id);
                    toast({ title: 'Transferência aceita!' });
                  } catch (err: any) {
                    toast({ title: 'Erro', description: err.message, variant: 'destructive' });
                  }
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                Aceitar
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={async (e) => {
                  e.stopPropagation();
                  const tId = notification.data?.transferId || notification.metadata?.transferId;
                  try {
                    await apiRequest('POST', '/api/tmc/transfer-respond', { transferId: tId, action: 'reject' });
                    markAsRead(notification.id);
                    toast({ title: 'Transferência recusada' });
                  } catch (err: any) {
                    toast({ title: 'Erro', description: err.message, variant: 'destructive' });
                  }
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Recusar
              </Button>
            </>
          )}
          {notification.type === 'appointment' && notification.data?.requestId && (
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
                setLocation('/doctor-chat');
                setIsOpen(false);
              }}
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Atender
            </Button>
          )}
          {notification.type === 'room_presence' && notification.actionUrl && (
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
                setLocation(notification.actionUrl!);
                setIsOpen(false);
              }}
            >
              <Video className="h-3 w-3 mr-1" />
              Entrar
            </Button>
          )}
          {notification.type === 'urgency_request' && notification.data?.requestId && (
            <>
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await apiRequest('PATCH', `/api/consultation-requests/${notification.data.requestId}/accept`, {});
                    const data = await result.json().catch(() => ({}));
                    markAsRead(notification.id);
                    const consultationId = data?.consultationId;
                    if (consultationId) {
                      setLocation(`/video-consultation/${consultationId}`);
                    } else {
                      setLocation('/doctor-chat');
                    }
                    setIsOpen(false);
                    toast({ title: 'Solicitação aceita!' });
                  } catch (err: any) {
                    toast({ title: 'Erro', description: err.message || 'Solicitação já aceita por outro médico.', variant: 'destructive' });
                    markAsRead(notification.id);
                  }
                }}
              >
                <Video className="h-3 w-3 mr-1" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                  setLocation('/doctor-chat');
                  setIsOpen(false);
                }}
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                Chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-green-600 hover:text-green-800"
                onClick={(e) => {
                  e.stopPropagation();
                  if (notification.data?.patientCode) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(`Sobre paciente #${notification.data.patientCode}`)}`, '_blank');
                  }
                  markAsRead(notification.id);
                }}
              >
                <Send className="h-3 w-3 mr-1" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  clearNotification(notification.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {notification.type === 'urgency_accepted' && notification.data?.acceptedByName && (
            <>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Check className="h-3 w-3" />
                {notification.data.acceptedByName}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyingTo(replyingTo === notification.id ? null : notification.id);
                  setReplyText("");
                }}
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                Mensagem
              </Button>
            </>
          )}
          {(notification.type === 'consultation_invite' || notification.type === 'doctor_message' || notification.type === 'consultation_message') && (notification.data?.allowReply !== false) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo(replyingTo === notification.id ? null : notification.id);
                setReplyText("");
              }}
            >
              <Reply className="h-3 w-3 mr-1" />
              Responder
            </Button>
          )}
        </div>
      </div>
      
      {replyingTo === notification.id && (
        <div className="mt-2 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder="Digite sua resposta..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendReply(notification)}
            className="h-7 text-xs flex-1"
            disabled={sendingReply}
            autoFocus
          />
          <Button
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleSendReply(notification)}
            disabled={!replyText.trim() || sendingReply}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative hover:bg-primary/10 transition-colors duration-300 ${
            isScrolled ? 'text-white' : 'text-indigo-950 dark:text-white'
          }`}
          data-testid="button-notification-center"
        >
          {unreadCount > 0 ? (
            <BellRing className={`h-5 w-5 transition-colors duration-300 ${
              isScrolled 
                ? 'text-white' 
                : 'text-indigo-950 dark:text-white'
            }`} />
          ) : (
            <Bell className={`h-5 w-5 transition-colors duration-300 ${
              isScrolled 
                ? 'text-white' 
                : 'text-indigo-950 dark:text-white'
            }`} />
          )}
          
          <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-96 p-0" 
        align="end"
        data-testid="popover-notifications"
      >
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações</h3>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Online' : 'Offline'}
              </span>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  data-testid="button-mark-all-read"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b">
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('active')}
          >
            <Clock className="h-3.5 w-3.5" />
            Ativas
            {activeNotifications.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-1">
                {activeNotifications.length}
              </Badge>
            )}
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('history')}
          >
            <History className="h-3.5 w-3.5" />
            Histórico
            {historyNotifications.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs ml-1">
                {historyNotifications.length}
              </Badge>
            )}
          </button>
        </div>
        
        <ScrollArea className="h-80">
          {displayedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              {activeTab === 'active' ? (
                <>
                  <Bell className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma notificação ativa
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Notificações recentes aparecerão aqui
                  </p>
                </>
              ) : (
                <>
                  <History className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma notificação no histórico
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Notificações lidas ou antigas aparecerão aqui
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {displayedNotifications.map(renderNotification)}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="border-t p-3 flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={() => {
                clearAllNotifications();
                toast({ title: "Notificações limpas", description: "Todas as notificações foram removidas." });
              }}
              data-testid="button-clear-all-notifications"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Todas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}