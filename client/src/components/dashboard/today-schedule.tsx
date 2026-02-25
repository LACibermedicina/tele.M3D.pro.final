import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Video, VideoOff, Plus, Search, Loader2, Calendar, User, Clock } from "lucide-react";

type Appointment = typeof appointments.$inferSelect & {
  patient?: { name: string; id: string };
};

export default function TodaySchedule() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
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

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: user?.id ? ['/api/appointments/today', user.id] : ['appointments-today-placeholder'],
    enabled: !!user?.id,
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/appointments/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate the today appointments query
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
      }
      // Also invalidate general appointments queries
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ id, scheduledAt, notes }: { id: string; scheduledAt: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/appointments/${id}/reschedule`, { scheduledAt, notes });
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate the today appointments query
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
      }
      // Also invalidate general appointments queries
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
  });

  const rateAppointmentMutation = useMutation({
    mutationFn: async ({ id, rating, feedback }: { id: string; rating: number; feedback?: string }) => {
      const response = await apiRequest('POST', `/api/appointments/${id}/rate`, { rating, feedback });
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate the today appointments query
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/appointments/today', user.id] });
      }
      // Also invalidate general appointments queries
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

  // Doctor office toggle mutations
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

  // Check initial office status
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
      {
        id: appointmentId,
        data: { status: 'in-progress' }
      },
      {
        onSuccess: () => {
          toast({
            title: "Consulta iniciada",
            description: "A consulta está agora em andamento.",
          });
        }
      }
    );
  };

  const handleCompleteConsultation = (appointmentId: string) => {
    updateAppointmentMutation.mutate(
      {
        id: appointmentId,
        data: { status: 'completed' }
      },
      {
        onSuccess: () => {
          toast({
            title: "Consulta finalizada",
            description: "A consulta foi concluída com sucesso.",
          });
        }
      }
    );
  };
  
  const handleEnterVideoCall = (appointment: any) => {
    // Navigate to video consultation page
    navigate(`/consultation/video/${appointment.patientId}`);
  };
  
  const handleOpenChat = (appointment: any) => {
    // Navigate to WhatsApp page (could be enhanced to pre-select patient)
    navigate('/whatsapp');
  };
  
  const handleOpenReschedule = (appointment: any) => {
    setSelectedAppointment(appointment);
    // Set default to 1 day ahead
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
          toast({
            title: "Avaliação enviada",
            description: "Obrigado pela sua avaliação!",
          });
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda de Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card data-testid="card-today-schedule">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle>Agenda de Hoje</CardTitle>
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
                    Fechar Consultório
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Abrir Consultório
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleOpenNewAppointment} data-testid="button-new-appointment">
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!(appointments || []).length ? (
          <div className="text-center py-8">
            <i className="fas fa-calendar-day text-4xl text-muted-foreground mb-3"></i>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              Nenhuma consulta hoje
            </h3>
            <p className="text-muted-foreground">
              Sua agenda está livre para hoje.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(appointments || []).map((appointment: any) => (
              <div
                key={appointment.id}
                className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                data-testid={`appointment-item-${appointment.id}`}
              >
                <div className="text-primary font-medium text-lg min-w-[60px]">
                  {format(new Date(appointment.scheduledAt), "HH:mm")}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="font-medium" data-testid={`appointment-patient-${appointment.id}`}>
                      {appointment.patient?.name || "Paciente não identificado"}
                    </p>
                    {appointment.aiScheduled && (
                      <Badge className="bg-purple-100 text-purple-800 text-xs">
                        <i className="fas fa-robot mr-1"></i>
                        IA
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`appointment-type-${appointment.id}`}>
                    {appointment.type === 'consultation' ? 'Consulta de Rotina' :
                     appointment.type === 'followup' ? 'Retorno' :
                     appointment.type === 'emergency' ? 'Emergência' : appointment.type}
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
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEnterVideoCall(appointment)}
                        data-testid={`button-enter-${appointment.id}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <i className="fas fa-video mr-1"></i>
                        Entrar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenChat(appointment)}
                        data-testid={`button-chat-${appointment.id}`}
                      >
                        <i className="fas fa-comments mr-1"></i>
                        Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenReschedule(appointment)}
                        data-testid={`button-reschedule-${appointment.id}`}
                      >
                        <i className="fas fa-calendar-alt mr-1"></i>
                        Reagendar
                      </Button>
                    </>
                  )}
                  
                  {appointment.status === 'in-progress' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenChat(appointment)}
                        data-testid={`button-chat-inprogress-${appointment.id}`}
                      >
                        <i className="fas fa-comments mr-1"></i>
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCompleteConsultation(appointment.id)}
                        data-testid={`button-complete-${appointment.id}`}
                      >
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
                            <i className="fas fa-check mr-1"></i>
                            Concluído
                          </Badge>
                          <div className="flex items-center text-yellow-500">
                            {[...Array(5)].map((_, i) => (
                              <i key={i} className={`fas fa-star ${i < appointment.rating ? '' : 'opacity-30'}`}></i>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-green-100 text-green-800">
                            <i className="fas fa-check mr-1"></i>
                            Concluído
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRating(appointment)}
                            data-testid={`button-rate-${appointment.id}`}
                          >
                            <i className="fas fa-star mr-1"></i>
                            Avaliar
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Reschedule Dialog */}
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
          <Button 
            variant="outline" 
            onClick={() => setRescheduleDialogOpen(false)}
            data-testid="button-cancel-reschedule"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleReschedule}
            disabled={rescheduleAppointmentMutation.isPending}
            data-testid="button-confirm-reschedule"
          >
            {rescheduleAppointmentMutation.isPending ? "Reagendando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* New Appointment Dialog */}
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
          <Button
            variant="outline"
            onClick={() => setNewAppointmentDialogOpen(false)}
            data-testid="button-cancel-new-appointment"
          >
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

    {/* Rating Dialog */}
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
                  <i 
                    className={`fas fa-star text-3xl ${star <= rating ? 'text-yellow-500' : 'text-gray-300'}`}
                  ></i>
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
          <Button 
            variant="outline" 
            onClick={() => setRatingDialogOpen(false)}
            data-testid="button-cancel-rating"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmitRating}
            disabled={rateAppointmentMutation.isPending || rating === 0}
            data-testid="button-submit-rating"
          >
            {rateAppointmentMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
