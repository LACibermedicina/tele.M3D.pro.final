import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointments } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Video, VideoOff, Plus, Search, Loader2, Calendar, User, Clock, CheckCircle, ChevronLeft, ChevronRight, FileText, UserCircle, Star } from "lucide-react";

type Appointment = typeof appointments.$inferSelect & {
  patient?: { name: string; id: string };
};

export default function TodaySchedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState("today");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [newAppointmentDialogOpen, setNewAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isOfficeOpen, setIsOfficeOpen] = useState(false);

  const [newApptPatientId, setNewApptPatientId] = useState("");
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptType, setNewApptType] = useState("consultation");
  const [newApptNotes, setNewApptNotes] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  const [completedDateFrom, setCompletedDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [completedDateTo, setCompletedDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { data: allTodayAppointments, isLoading } = useQuery<Appointment[]>({
    queryKey: user?.id ? ['/api/appointments/today', user.id] : ['appointments-today-placeholder'],
    enabled: !!user?.id,
  });

  const activeAppointments = useMemo(() => {
    return (allTodayAppointments || []).filter((a: any) => 
      a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'rescheduled'
    );
  }, [allTodayAppointments]);

  const todayCompletedAppointments = useMemo(() => {
    return (allTodayAppointments || []).filter((a: any) => a.status === 'completed');
  }, [allTodayAppointments]);

  const { data: completedAppointments, isLoading: completedLoading } = useQuery<Appointment[]>({
    queryKey: user?.id ? ['/api/appointments/completed', user.id, completedDateFrom, completedDateTo] : ['completed-placeholder'],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/completed/${user!.id}?from=${completedDateFrom}&to=${completedDateTo}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!user?.id && activeTab === 'completed',
  });

  const { data: upcomingAppointments, isLoading: upcomingLoading } = useQuery<Appointment[]>({
    queryKey: user?.id ? ['/api/appointments/upcoming', user.id] : ['upcoming-placeholder'],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/upcoming/${user!.id}?days=30`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!user?.id && activeTab === 'calendar',
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/completed', user.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming', user.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ id, scheduledAt, notes }: { id: string; scheduledAt: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/appointments/${id}/reschedule`, { scheduledAt, notes });
      return await response.json();
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming', user.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
  });

  const rateAppointmentMutation = useMutation({
    mutationFn: async ({ id, rating, feedback }: { id: string; rating: number; feedback?: string }) => {
      const response = await apiRequest('POST', `/api/appointments/${id}/rate`, { rating, feedback });
      return await response.json();
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/completed', user.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
  });

  const { data: patientsList = [] } = useQuery<any[]>({
    queryKey: ['/api/patients'],
    enabled: newAppointmentDialogOpen,
  });

  const filteredPatients = patientSearch.trim()
    ? patientsList.filter((p: any) =>
        p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : patientsList;

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: { patientId: string; doctorId: string; scheduledAt: string; type: string; notes?: string }) => {
      const response = await apiRequest('POST', '/api/appointments', data);
      return await response.json();
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/upcoming', user.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setNewAppointmentDialogOpen(false);
      resetNewAppointmentForm();
      toast({
        title: "Consulta agendada",
        description: "A consulta foi agendada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao agendar",
        description: error.message || "Não foi possível agendar a consulta.",
        variant: "destructive",
      });
    },
  });

  const resetNewAppointmentForm = () => {
    setNewApptPatientId("");
    setNewApptDate("");
    setNewApptType("consultation");
    setNewApptNotes("");
    setPatientSearch("");
  };

  const handleCreateAppointment = () => {
    if (!newApptPatientId) {
      toast({ title: "Selecione um paciente", variant: "destructive" });
      return;
    }
    if (!newApptDate) {
      toast({ title: "Selecione a data e horário", variant: "destructive" });
      return;
    }
    if (!user?.id) return;

    createAppointmentMutation.mutate({
      patientId: newApptPatientId,
      doctorId: user.id,
      scheduledAt: new Date(newApptDate).toISOString(),
      type: newApptType,
      notes: newApptNotes || undefined,
    });
  };

  const handleOpenNewAppointment = () => {
    resetNewAppointmentForm();
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setMinutes(0);
    setNewApptDate(format(now, "yyyy-MM-dd'T'HH:mm"));
    setNewAppointmentDialogOpen(true);
  };

  const toggleOfficeMutation = useMutation({
    mutationFn: async (open: boolean) => {
      const endpoint = open ? '/api/doctor-office/open' : '/api/doctor-office/close';
      const response = await apiRequest('POST', endpoint, {});
      return await response.json();
    },
    onSuccess: (data) => {
      setIsOfficeOpen(data.isOpen);
      toast({
        title: data.isOpen ? "Consultório Aberto" : "Consultório Fechado",
        description: data.isOpen 
          ? "Pacientes podem entrar agora em sua sala de vídeo" 
          : "Consultório fechado para novos pacientes",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors/online'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do consultório",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user?.id && user.role === 'doctor') {
      apiRequest('GET', `/api/doctor-office/status/${user.id}`, null)
        .then(res => res.json())
        .then(data => setIsOfficeOpen(data.isOpen))
        .catch(() => setIsOfficeOpen(false));
    }
  }, [user]);

  const handleStartConsultation = (appointmentId: string) => {
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status: 'in-progress' } },
      {
        onSuccess: () => {
          toast({ title: "Consulta iniciada", description: "A consulta está agora em andamento." });
        }
      }
    );
  };

  const handleCompleteConsultation = (appointmentId: string) => {
    updateAppointmentMutation.mutate(
      { id: appointmentId, data: { status: 'completed' } },
      {
        onSuccess: () => {
          toast({ title: "Consulta finalizada", description: "A consulta foi concluída com sucesso." });
        }
      }
    );
  };
  
  const handleEnterVideoCall = (appointment: any) => {
    navigate(`/consultation/video/${appointment.patientId}`);
  };
  
  const handleOpenChat = (appointment: any) => {
    navigate('/whatsapp');
  };
  
  const handleOpenReschedule = (appointment: any) => {
    setSelectedAppointment(appointment);
    const defaultDate = format(addDays(new Date(appointment.scheduledAt), 1), "yyyy-MM-dd'T'HH:mm");
    setNewScheduledDate(defaultDate);
    setRescheduleDialogOpen(true);
  };
  
  const handleReschedule = () => {
    if (!selectedAppointment || !newScheduledDate) return;
    
    rescheduleAppointmentMutation.mutate(
      {
        id: selectedAppointment.id,
        scheduledAt: new Date(newScheduledDate).toISOString(),
        notes: `Reagendada pelo usuário`
      },
      {
        onSuccess: (data) => {
          setRescheduleDialogOpen(false);
          setSelectedAppointment(null);
          toast({
            title: "Consulta reagendada",
            description: `A consulta foi reagendada para ${format(new Date(data.newAppointment.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao reagendar",
            description: error.message || "Não foi possível reagendar a consulta.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleOpenRating = (appointment: any) => {
    setSelectedAppointment(appointment);
    setRating(0);
    setFeedback("");
    setRatingDialogOpen(true);
  };

  const handleSubmitRating = () => {
    if (!selectedAppointment || rating === 0) {
      toast({
        title: "Avaliação incompleta",
        description: "Por favor, selecione uma nota de 1 a 5 estrelas.",
        variant: "destructive",
      });
      return;
    }
    
    rateAppointmentMutation.mutate(
      {
        id: selectedAppointment.id,
        rating,
        feedback: feedback || undefined,
      },
      {
        onSuccess: () => {
          setRatingDialogOpen(false);
          setSelectedAppointment(null);
          setRating(0);
          setFeedback("");
          toast({ title: "Avaliação enviada", description: "Obrigado pela sua avaliação!" });
        },
        onError: (error: any) => {
          toast({
            title: "Erro ao avaliar",
            description: error.message || "Não foi possível enviar a avaliação.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calendarMonth]);

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    (upcomingAppointments || []).forEach((a: any) => {
      const key = format(new Date(a.scheduledAt), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [upcomingAppointments]);

  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case 'consultation': return 'Consulta de Rotina';
      case 'followup': return 'Retorno';
      case 'emergency': return 'Emergência';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('patient_dashboard.today_schedule')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderAppointmentItem = (appointment: any, showDate = false) => (
    <div
      key={appointment.id}
      className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
      data-testid={`appointment-item-${appointment.id}`}
    >
      <div className="text-primary font-medium text-lg min-w-[60px]">
        {format(new Date(appointment.scheduledAt), "HH:mm")}
        {showDate && (
          <div className="text-xs text-muted-foreground font-normal">
            {format(new Date(appointment.scheduledAt), "dd/MM")}
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <button
            onClick={() => {
              if (appointment.patient?.id) navigate(`/patients/${appointment.patient.id}`);
            }}
            className="font-medium hover:text-primary hover:underline transition-colors cursor-pointer text-left"
            data-testid={`appointment-patient-${appointment.id}`}
          >
            {appointment.patient?.name || t('patient_dashboard.patient_unidentified')}
          </button>
          {appointment.aiScheduled && (
            <Badge className="bg-purple-100 text-purple-800 text-xs">
              <i className="fas fa-robot mr-1"></i>
              IA
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground" data-testid={`appointment-type-${appointment.id}`}>
          {getAppointmentTypeLabel(appointment.type)}
        </p>
        {appointment.notes && (
          <p className="text-xs text-muted-foreground mt-1" data-testid={`appointment-notes-${appointment.id}`}>
            {appointment.notes}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {appointment.status === 'scheduled' && (
          <>
            <Button variant="default" size="sm" onClick={() => handleEnterVideoCall(appointment)} data-testid={`button-enter-${appointment.id}`} className="bg-blue-600 hover:bg-blue-700 text-white">
              <i className="fas fa-video mr-1"></i>
              Entrar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenChat(appointment)} data-testid={`button-chat-${appointment.id}`}>
              <i className="fas fa-comments mr-1"></i>
              Chat
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenReschedule(appointment)} data-testid={`button-reschedule-${appointment.id}`}>
              <i className="fas fa-calendar-alt mr-1"></i>
              Reagendar
            </Button>
          </>
        )}
        
        {appointment.status === 'in-progress' && (
          <>
            <Button variant="outline" size="sm" onClick={() => handleOpenChat(appointment)} data-testid={`button-chat-inprogress-${appointment.id}`}>
              <i className="fas fa-comments mr-1"></i>
              Chat
            </Button>
            <Button size="sm" onClick={() => handleCompleteConsultation(appointment.id)} data-testid={`button-complete-${appointment.id}`}>
              <i className="fas fa-check mr-1"></i>
              Finalizar
            </Button>
          </>
        )}

        {appointment.status === 'completed' && (
          <>
            {appointment.rating ? (
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluído
                </Badge>
                <div className="flex items-center text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < appointment.rating ? 'fill-current' : 'opacity-30'}`} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Concluído
                </Badge>
                {user?.role === 'patient' && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenRating(appointment)} data-testid={`button-rate-${appointment.id}`}>
                    <Star className="h-3 w-3 mr-1" />
                    Avaliar
                  </Button>
                )}
              </div>
            )}
            {user?.role === 'doctor' && appointment.patient?.id && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${appointment.patient.id}`)} className="text-primary">
                <UserCircle className="h-4 w-4 mr-1" />
                Perfil
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
    <Card data-testid="card-today-schedule">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle>{t('patient_dashboard.today_schedule')}</CardTitle>
          <div className="flex gap-2">
            {user?.role === 'doctor' && (
              <Button 
                onClick={() => toggleOfficeMutation.mutate(!isOfficeOpen)}
                variant={isOfficeOpen ? "destructive" : "default"}
                size="sm"
                disabled={toggleOfficeMutation.isPending}
                data-testid="button-toggle-office"
              >
                {isOfficeOpen ? (
                  <>
                    <VideoOff className="h-4 w-4 mr-2" />
                    {t('patient_dashboard.close_office')}
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    {t('patient_dashboard.open_office')}
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => {
                if (user?.role === 'patient') {
                  navigate('/consultation-request');
                } else {
                  handleOpenNewAppointment();
                }
              }}
              data-testid="button-new-appointment"
            >
              <Plus className="h-4 w-4 mr-2" />
              {user?.role === 'patient' ? t('patient_dashboard.request_consultation') : t('patient_dashboard.new_consultation')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
            <TabsTrigger value="today" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <Clock className="h-4 w-4 mr-2" />
              Agenda de Hoje
              {activeAppointments.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1.5">
                  {activeAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
              <CheckCircle className="h-4 w-4 mr-2" />
              Consultas Realizadas
              {todayCompletedAppointments.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1.5 bg-green-100 text-green-800">
                  {todayCompletedAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
            {user?.role === 'doctor' && (
              <TabsTrigger value="calendar" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3">
                <Calendar className="h-4 w-4 mr-2" />
                Agenda de Consultas
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="today" className="p-6 mt-0">
            {activeAppointments.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  {t('patient_dashboard.no_consultations_today')}
                </h3>
                <p className="text-muted-foreground">
                  {t('patient_dashboard.schedule_free_today')}
                </p>
                {todayCompletedAppointments.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {todayCompletedAppointments.length} consulta(s) realizada(s) hoje — veja na aba "Consultas Realizadas"
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {activeAppointments.map((appointment: any) => renderAppointmentItem(appointment))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="p-6 mt-0">
            <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  value={completedDateFrom}
                  onChange={(e) => setCompletedDateFrom(e.target.value)}
                  className="w-[150px] h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  value={completedDateTo}
                  onChange={(e) => setCompletedDateTo(e.target.value)}
                  className="w-[150px] h-9"
                />
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-9" onClick={() => {
                  const today = format(new Date(), "yyyy-MM-dd");
                  setCompletedDateFrom(today);
                  setCompletedDateTo(today);
                }}>
                  Hoje
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  setCompletedDateFrom(format(d, "yyyy-MM-dd"));
                  setCompletedDateTo(format(new Date(), "yyyy-MM-dd"));
                }}>
                  7 dias
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 30);
                  setCompletedDateFrom(format(d, "yyyy-MM-dd"));
                  setCompletedDateTo(format(new Date(), "yyyy-MM-dd"));
                }}>
                  30 dias
                </Button>
              </div>
            </div>

            {completedLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (completedAppointments || []).length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  Nenhuma consulta realizada
                </h3>
                <p className="text-sm text-muted-foreground">
                  Não há consultas concluídas no período selecionado.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {(completedAppointments || []).length} consulta(s) realizada(s)
                </p>
                {(completedAppointments || []).map((appointment: any) => (
                  <div
                    key={appointment.id}
                    className="flex items-center space-x-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-100 dark:border-green-900/30"
                  >
                    <div className="text-center min-w-[60px]">
                      <div className="text-primary font-medium text-lg">
                        {format(new Date(appointment.scheduledAt), "HH:mm")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(appointment.scheduledAt), "dd/MM")}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <button
                        onClick={() => {
                          if (appointment.patient?.id) navigate(`/patients/${appointment.patient.id}`);
                        }}
                        className="font-medium hover:text-primary hover:underline transition-colors cursor-pointer text-left"
                      >
                        {appointment.patient?.name || 'Paciente não identificado'}
                      </button>
                      <p className="text-sm text-muted-foreground">
                        {getAppointmentTypeLabel(appointment.type)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {appointment.rating && (
                        <div className="flex items-center text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < appointment.rating ? 'fill-current' : 'opacity-30'}`} />
                          ))}
                        </div>
                      )}
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Concluído
                      </Badge>
                      {user?.role === 'doctor' && appointment.patient?.id && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${appointment.patient.id}`)} className="text-primary">
                          <UserCircle className="h-4 w-4 mr-1" />
                          Perfil
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {user?.role === 'doctor' && (
            <TabsContent value="calendar" className="p-6 mt-0">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => {
                  const prev = new Date(calendarMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setCalendarMonth(prev);
                }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-lg capitalize">
                  {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => {
                  const next = new Date(calendarMonth);
                  next.setMonth(next.getMonth() + 1);
                  setCalendarMonth(next);
                }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {upcomingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {calendarDays.map((day, idx) => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const dayAppts = appointmentsByDay[dayKey] || [];
                      const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                      return (
                        <div
                          key={idx}
                          className={`min-h-[80px] p-1 border rounded-md ${
                            isToday(day) ? 'bg-primary/5 border-primary/30' :
                            isCurrentMonth ? 'bg-background border-border' :
                            'bg-muted/30 border-transparent'
                          }`}
                        >
                          <div className={`text-xs font-medium mb-1 ${
                            isToday(day) ? 'text-primary' :
                            isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'
                          }`}>
                            {format(day, "d")}
                          </div>
                          {dayAppts.slice(0, 3).map((appt: any) => (
                            <button
                              key={appt.id}
                              onClick={() => {
                                if (appt.patient?.id) navigate(`/patients/${appt.patient.id}`);
                              }}
                              className="w-full text-left text-[10px] leading-tight mb-0.5 px-1 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary truncate transition-colors cursor-pointer"
                              title={`${format(new Date(appt.scheduledAt), "HH:mm")} - ${appt.patient?.name || 'Paciente'}`}
                            >
                              {format(new Date(appt.scheduledAt), "HH:mm")} {appt.patient?.name?.split(' ')[0] || ''}
                            </button>
                          ))}
                          {dayAppts.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">
                              +{dayAppts.length - 3} mais
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(upcomingAppointments || []).length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Próximas Consultas
                      </h4>
                      {(upcomingAppointments || []).slice(0, 10).map((appointment: any) => renderAppointmentItem(appointment, true))}
                      {(upcomingAppointments || []).length > 10 && (
                        <p className="text-sm text-muted-foreground text-center">
                          e mais {(upcomingAppointments || []).length - 10} consultas agendadas
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
    
    <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
      <DialogContent data-testid="dialog-reschedule">
        <DialogHeader>
          <DialogTitle>Reagendar Consulta</DialogTitle>
          <DialogDescription>
            Escolha uma nova data e horário para a consulta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newScheduledDate">Nova Data e Horário</Label>
            <Input
              id="newScheduledDate"
              type="datetime-local"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
              data-testid="input-reschedule-date"
            />
          </div>
          {selectedAppointment && (
            <div className="text-sm text-muted-foreground">
              <p>Paciente: {selectedAppointment.patient?.name}</p>
              <p>Data atual: {format(new Date(selectedAppointment.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)} data-testid="button-cancel-reschedule">
            Cancelar
          </Button>
          <Button onClick={handleReschedule} disabled={rescheduleAppointmentMutation.isPending} data-testid="button-confirm-reschedule">
            {rescheduleAppointmentMutation.isPending ? "Reagendando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={newAppointmentDialogOpen} onOpenChange={setNewAppointmentDialogOpen}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-new-appointment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Agendar Nova Consulta
          </DialogTitle>
          <DialogDescription>
            Selecione o paciente, data e tipo de consulta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Paciente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente por nome..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-patient"
              />
            </div>
            {newApptPatientId && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md text-sm">
                <User className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {patientsList.find((p: any) => p.id === newApptPatientId)?.name || 'Paciente selecionado'}
                </span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setNewApptPatientId("")}>
                  Alterar
                </Button>
              </div>
            )}
            {!newApptPatientId && (
              <ScrollArea className="max-h-[150px] border rounded-md">
                {filteredPatients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    {patientSearch ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredPatients.slice(0, 20).map((patient: any) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setNewApptPatientId(patient.id);
                          setPatientSearch("");
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left text-sm transition-colors"
                        data-testid={`patient-option-${patient.id}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{patient.name}</p>
                          {patient.email && (
                            <p className="text-xs text-muted-foreground truncate">{patient.email}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appt-date" className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Data e Horário
              </Label>
              <Input
                id="appt-date"
                type="datetime-local"
                value={newApptDate}
                onChange={(e) => setNewApptDate(e.target.value)}
                data-testid="input-appointment-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Consulta</Label>
              <Select value={newApptType} onValueChange={setNewApptType}>
                <SelectTrigger data-testid="select-appointment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta de Rotina</SelectItem>
                  <SelectItem value="followup">Retorno</SelectItem>
                  <SelectItem value="emergency">Emergência</SelectItem>
                  <SelectItem value="exam">Exame</SelectItem>
                  <SelectItem value="procedure">Procedimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appt-notes">Observações (opcional)</Label>
            <Textarea
              id="appt-notes"
              placeholder="Motivo da consulta, observações importantes..."
              value={newApptNotes}
              onChange={(e) => setNewApptNotes(e.target.value)}
              rows={3}
              className="resize-none"
              data-testid="textarea-appointment-notes"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setNewAppointmentDialogOpen(false)} data-testid="button-cancel-new-appointment">
            Cancelar
          </Button>
          <Button
            onClick={handleCreateAppointment}
            disabled={createAppointmentMutation.isPending || !newApptPatientId || !newApptDate}
            data-testid="button-confirm-new-appointment"
          >
            {createAppointmentMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Agendar Consulta
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
      <DialogContent data-testid="dialog-rating">
        <DialogHeader>
          <DialogTitle>Avaliar Consulta</DialogTitle>
          <DialogDescription>
            Como foi sua experiência com o médico?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nota (1 a 5 estrelas)</Label>
            <div className="flex space-x-2 justify-center py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star className={`h-8 w-8 ${star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback">Comentário (opcional)</Label>
            <textarea
              id="feedback"
              className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md bg-background"
              placeholder="Conte-nos sobre sua experiência..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              data-testid="textarea-feedback"
            />
          </div>
          {selectedAppointment && (
            <div className="text-sm text-muted-foreground">
              <p>Médico: Dr. {selectedAppointment.doctor?.name || 'Nome não disponível'}</p>
              <p>Data: {format(new Date(selectedAppointment.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setRatingDialogOpen(false)} data-testid="button-cancel-rating">
            Cancelar
          </Button>
          <Button onClick={handleSubmitRating} disabled={rateAppointmentMutation.isPending || rating === 0} data-testid="button-submit-rating">
            {rateAppointmentMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
