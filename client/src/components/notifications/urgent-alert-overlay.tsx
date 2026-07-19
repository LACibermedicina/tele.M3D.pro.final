import { useState, useEffect } from 'react';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Video, Stethoscope, X, Bell } from 'lucide-react';

export default function UrgentAlertOverlay() {
  const { notifications, markAsRead } = useNotifications();
  const [, setLocation] = useLocation();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const urgentNotifications = notifications.filter(
    n => !n.read && 
    !dismissedIds.has(n.id) &&
    (n.type === 'consultation_invite' || n.type === 'urgent_alert' || 
     (n.type === 'doctor_message' && n.priority === 'critical'))
  );

  const currentAlert = urgentNotifications[0];

  const handleDismiss = (id: string) => {
    markAsRead(id);
    setDismissedIds(prev => {
      const next = new Set(Array.from(prev));
      next.add(id);
      return next;
    });
  };

  const handleAction = (notification: Notification) => {
    markAsRead(notification.id);
    setDismissedIds(prev => {
      const next = new Set(Array.from(prev));
      next.add(notification.id);
      return next;
    });
    if (notification.actionUrl) {
      setLocation(notification.actionUrl);
    }
  };

  if (!currentAlert) return null;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'consultation_invite':
        return <Video className="h-12 w-12 text-white" />;
      case 'urgent_alert':
        return <AlertTriangle className="h-12 w-12 text-white" />;
      case 'doctor_message':
        return <Stethoscope className="h-12 w-12 text-white" />;
      default:
        return <Bell className="h-12 w-12 text-white" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'consultation_invite':
        return 'from-blue-600 to-blue-800';
      case 'urgent_alert':
        return 'from-red-600 to-red-800';
      case 'doctor_message':
        return 'from-orange-600 to-orange-800';
      default:
        return 'from-gray-600 to-gray-800';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'consultation_invite':
        return 'Entrar na Consulta';
      case 'urgent_alert':
        return 'Ver Detalhes';
      case 'doctor_message':
        return 'Responder';
      default:
        return 'Ver';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <div className={`bg-gradient-to-br ${getAlertColor(currentAlert.type)} p-6 text-center`}>
          <div className="flex justify-end">
            <button
              onClick={() => handleDismiss(currentAlert.id)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-3 -mt-2">
            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              {getAlertIcon(currentAlert.type)}
            </div>
            <h2 className="text-xl font-bold text-white">{currentAlert.title}</h2>
          </div>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-center text-foreground">{currentAlert.message}</p>
          
          {currentAlert.data?.senderName && (
            <p className="text-center text-sm text-muted-foreground">
              Enviado por: <strong>{currentAlert.data.senderName}</strong>
            </p>
          )}
          {currentAlert.data?.doctorName && (
            <p className="text-center text-sm text-muted-foreground">
              Médico: <strong data-no-translate>Dr(a). {currentAlert.data.doctorName}</strong>
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleDismiss(currentAlert.id)}
            >
              Fechar
            </Button>
            {currentAlert.actionUrl && (
              <Button
                className="flex-1"
                onClick={() => handleAction(currentAlert)}
              >
                {getActionLabel(currentAlert.type)}
              </Button>
            )}
          </div>

          {urgentNotifications.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">
              +{urgentNotifications.length - 1} alerta(s) pendente(s)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
