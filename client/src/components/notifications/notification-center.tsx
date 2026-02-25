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
import { Bell, BellRing, Check, X, AlertTriangle, MessageCircle, Calendar, FileText, Activity, Video, Stethoscope, Send, Reply, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';

interface NotificationCenterProps {
  isScrolled?: boolean;
}

export default function NotificationCenter({ isScrolled = false }: NotificationCenterProps) {
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotification, clearAllNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
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
      case 'patient_joined_office':
        return <Calendar className={`h-4 w-4 ${iconClass}`} />;
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
      default:
        return <Bell className={`h-4 w-4 ${iconClass}`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-destructive bg-destructive/5';
      case 'high':
        return 'border-l-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50';
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative hover:bg-primary/10 transition-colors duration-300 ${
            isScrolled ? 'text-white' : 'text-gray-800 dark:text-gray-200'
          }`}
          data-testid="button-notification-center"
        >
          {unreadCount > 0 ? (
            <BellRing className={`h-5 w-5 transition-colors duration-300 ${
              isScrolled 
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]' 
                : 'text-gray-800 dark:text-gray-200'
            }`} />
          ) : (
            <Bell className={`h-5 w-5 transition-colors duration-300 ${
              isScrolled 
                ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]' 
                : 'text-gray-800 dark:text-gray-200'
            }`} />
          )}
          
          {/* Connection Status Indicator */}
          <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          
          {/* Unread Count Badge */}
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
        
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
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
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="border-t p-3 flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
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