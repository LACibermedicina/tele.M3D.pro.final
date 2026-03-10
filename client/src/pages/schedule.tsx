import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_DOCTOR_ID } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfDay, endOfDay, isToday, addMinutes, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Calendar as CalendarIcon, Users, AlertCircle, Bell, CheckCircle2, Video, Plus, MoreHorizontal, Download, Upload, History, PhoneCall, Wifi, XCircle, Trash2, RotateCcw, FileCheck, MessageSquare, QrCode, Ban, ShieldBan, UserX } from "lucide-react";
import ConsultationAccessGenerator from "@/components/consultation-access-generator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatErrorForToast } from "@/lib/error-handler";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [appointmentType, setAppointmentType] = useState<string>("consultation");
  const [editAppointmentType, setEditAppointmentType] = useState<string>("consultation");
  const [editNotes, setEditNotes] = useState<string>("");
  const [isJoinLinkModalOpen, setIsJoinLinkModalOpen] = useState(false);
  const [generatedJoinLink, setGeneratedJoinLink] = useState<string | null>(null);
  const [selectedAppointmentForLink, setSelectedAppointmentForLink] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [upcomingNotifications, setUpcomingNotifications] = useState<any[]>([]);
  const [quickBookMode, setQuickBookMode] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<'today' | 'future' | 'history'>('today');
  const [isInstantConsultOpen, setIsInstantConsultOpen] = useState(false);
  const [instantPatientId, setInstantPatientId] = useState<string>("");
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancelConfirmName, setCancelConfirmName] = useState<string>("");
  const [cancelAllScope, setCancelAllScope] = useState<'today' | 'future' | null>(null);
  const [cancelAllAppointmentType, setCancelAllAppointmentType] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  const [blockPatientId, setBlockPatientId] = useState<string | null>(null);
  const [blockPatientName, setBlockPatientName] = useState<string>("");
  const [blockReason, setBlockReason] = useState<string>("");
  const [showBlockedList, setShowBlockedList] = useState(false);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery<any[]>({
    queryKey: ['/api/appointments/doctor', DEFAULT_DOCTOR_ID, selectedDate.toISOString()],
  });

  const { data: futureAppointments, isLoading: futureLoading } = useQuery<any[]>({
    queryKey: ['/api/appointments/doctor', DEFAULT_DOCTOR_ID, 'future'],
    enabled: scheduleTab === 'future',
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<any>({
    queryKey: ['/api/appointments/doctor', DEFAULT_DOCTOR_ID, 'history'],
    enabled: scheduleTab === 'history',
  });

  const { data: consultationRequests, isLoading: requestsLoading } = useQuery<any[]>({
    queryKey: ['/api/consultation-requests'],
  });

  const { data: onlinePatients } = useQuery<any[]>({
    queryKey: ['/api/patients/online-status'],
    refetchInterval: 10000,
  });

  const { data: allPatientsForInstant } = useQuery<any[]>({
    queryKey: ['/api/patients'],
    enabled: isInstantConsultOpen,
  });

  const startInstantConsultMutation = useMutation({
    mutationFn: (patientId: string) => apiRequest('POST', `/api/video-consultations/start-with-patient/${patientId}`, {}),
    onSuccess: (_response: any, patientId: string) => {
      toast({
        title: "Consulta iniciada",
        description: "O paciente foi notificado. Redirecionando para a sala...",
      });
      setIsInstantConsultOpen(false);
      setInstantPatientId("");
      setLocation(`/consultation/video/${patientId}`);
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  // Real-time notification system with interval updates
  useEffect(() => {
    const updateNotifications = () => {
      const now = new Date();
      let upcoming: any[] = [];
      
      if (appointments && appointments.length > 0) {
        upcoming = appointments.filter((apt: any) => {
          const aptTime = new Date(apt.scheduledAt);
          const minutesUntil = differenceInMinutes(aptTime, now);
          return minutesUntil > 0 && minutesUntil <= 30; // Next 30 minutes
        });
      }
      
      // Always update notifications, even if empty
      setUpcomingNotifications(upcoming);
    };

    // Initial update
    updateNotifications();

    // Update every minute for real-time notifications
    const notificationInterval = setInterval(updateNotifications, 60000);

    return () => clearInterval(notificationInterval);
  }, [appointments]);

  // Fetch available slots for appointment creation
  const { data: availableSlots, isLoading: slotsLoading } = useQuery<any[]>({
    queryKey: ['/api/scheduling/available-slots', DEFAULT_DOCTOR_ID],
    enabled: isCreateModalOpen, // Only fetch when modal is open
  });

  // Fetch patients for selection
  const { data: patients } = useQuery<any[]>({
    queryKey: ['/api/patients'],
    enabled: isCreateModalOpen, // Only fetch when modal is open  
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: (appointmentData: any) => apiRequest('POST', '/api/appointments', appointmentData),
    onSuccess: (response, appointmentData) => {
      // Navigate to the appointment's date so user can see the created appointment
      const appointmentDate = new Date(appointmentData.scheduledAt);
      setSelectedDate(appointmentDate);
      
      toast({
        title: "Consulta agendada",
        description: "A consulta foi agendada com sucesso.",
      });
      setIsCreateModalOpen(false);
      setSelectedPatientId("");
      setSelectedSlot("");
      setAppointmentType("consultation");
      // Invalidate and refetch appointments
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });


  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest('PATCH', `/api/appointments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({
        title: "Consulta atualizada",
        description: "A consulta foi atualizada com sucesso.",
      });
      setIsEditModalOpen(false);
      setEditingAppointment(null);
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('PATCH', `/api/appointments/${id}`, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({
        title: "Consulta cancelada",
        description: "A consulta foi cancelada com sucesso.",
      });
      setCancelConfirmId(null);
      setCancelConfirmName("");
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const reactivateConsultationMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('POST', `/api/video-consultations/${id}/reactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({ title: "Consulta reativada", description: "O paciente foi notificado para retornar à videochamada." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const completeConsultationMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      apiRequest('POST', `/api/video-consultations/${id}/complete`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({ title: "Consulta concluída", description: "Prontuário gerado automaticamente." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const cancelAllMutation = useMutation({
    mutationFn: ({ scope, appointmentType }: { scope: 'today' | 'future'; appointmentType: string }) =>
      apiRequest('POST', '/api/appointments/cancel-all', { doctorId: DEFAULT_DOCTOR_ID, scope, appointmentType }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({
        title: "Consultas canceladas",
        description: `${data.cancelled} consulta(s) cancelada(s) com sucesso.`,
      });
      setCancelAllScope(null);
      setCancelAllAppointmentType('all');
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
      setCancelAllScope(null);
      setCancelAllAppointmentType('all');
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/appointments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({
        title: "Agendamento excluído",
        description: "O agendamento foi removido permanentemente.",
      });
      setDeleteConfirmId(null);
      setDeleteConfirmName("");
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/consultation-requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consultation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      toast({ title: "Solicitação aceita", description: "A solicitação de consulta foi aceita." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/consultation-requests/${id}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consultation-requests'] });
      toast({ title: "Solicitação recusada", description: "A solicitação de consulta foi recusada." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/consultation-requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consultation-requests'] });
      toast({ title: "Solicitação cancelada", description: "A solicitação de consulta foi cancelada." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const blockPatientMutation = useMutation({
    mutationFn: ({ patientId, reason }: { patientId: string; reason: string }) =>
      apiRequest('POST', '/api/doctor/block-patient', { patientId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor/blocked-patients'] });
      toast({
        title: "Paciente bloqueado",
        description: `${blockPatientName} foi bloqueado. Este paciente não poderá mais agendar consultas com você.`,
      });
      setBlockPatientId(null);
      setBlockPatientName("");
      setBlockReason("");
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const unblockPatientMutation = useMutation({
    mutationFn: (patientId: string) => apiRequest('DELETE', `/api/doctor/block-patient/${patientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/doctor/blocked-patients'] });
      toast({ title: "Paciente desbloqueado", description: "O paciente pode agendar consultas novamente." });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const { data: blockedPatients } = useQuery<any[]>({
    queryKey: ['/api/doctor/blocked-patients'],
    enabled: showBlockedList,
  });

  const handleCancelAppointment = (appointment: any) => {
    setCancelConfirmId(appointment.id);
    setCancelConfirmName(appointment.patientName || 'Paciente não identificado');
  };

  const handleDeleteAppointment = (appointment: any) => {
    setDeleteConfirmId(appointment.id);
    setDeleteConfirmName(appointment.patientName || 'Paciente não identificado');
  };

  const handleBlockPatient = (appointment: any) => {
    if (appointment.patientId) {
      setBlockPatientId(appointment.patientId);
      setBlockPatientName(appointment.patientName || 'Paciente não identificado');
      setBlockReason("");
    }
  };

  const handleStartConsultation = async (appointment: any) => {
    if (!appointment) return;
    setLocation(`/consultation/video/${appointment.patientId}`);
  };

  const handleGenerateJoinLink = async (appointment: any) => {
    if (!appointment) return;

    try {
      // First create or get existing video consultation
      let consultationId = null;
      
      // Check if consultation already exists for this appointment
      const existingConsultations = await fetch(`/api/video-consultations/appointment/${appointment.id}`);
      if (existingConsultations.ok) {
        const consultations = await existingConsultations.json();
        if (consultations.length > 0) {
          consultationId = consultations[0].id;
        }
      }
      
      // Create new consultation if none exists
      if (!consultationId) {
        const consultationResponse = await fetch('/api/video-consultations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patientId: appointment.patientId,
            doctorId: DEFAULT_DOCTOR_ID,
            appointmentId: appointment.id,
          }),
        });
        
        if (!consultationResponse.ok) {
          throw new Error('Falha ao criar sessão de consulta');
        }
        
        const consultation = await consultationResponse.json();
        consultationId = consultation.id;
      }

      // Generate patient join token
      const tokenResponse = await fetch('/api/auth/patient-join-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultationId,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.message || 'Falha ao gerar token de acesso');
      }

      const { token } = await tokenResponse.json();
      
      // Create join link with base64 encoded token
      const joinLink = `${window.location.origin}/join/${token}`;
      
      setGeneratedJoinLink(joinLink);
      setSelectedAppointmentForLink(appointment);
      setIsJoinLinkModalOpen(true);

      toast({
        title: "Link gerado com sucesso",
        description: "Link de acesso criado para o paciente.",
      });

    } catch (error) {
      console.error('Error generating join link:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível gerar o link de acesso.",
        variant: "destructive",
      });
    }
  };

  // Handle appointment creation
  const handleCreateAppointment = () => {
    if (!selectedPatientId || !selectedSlot) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um paciente e um horário.",
        variant: "destructive",
      });
      return;
    }

    // Find the selected slot to get proper date/time
    const slot = (availableSlots || []).find((s: any) => s.formatted === selectedSlot);
    if (!slot) {
      toast({
        title: "Horário inválido",
        description: "O horário selecionado não é válido.",
        variant: "destructive",
      });
      return;
    }

    const appointmentData = {
      patientId: selectedPatientId,
      doctorId: DEFAULT_DOCTOR_ID,
      scheduledAt: new Date(`${slot.date} ${slot.time}`),
      type: appointmentType,
      status: 'scheduled',
      aiScheduled: false,
    };

    createAppointmentMutation.mutate(appointmentData);
  };

  // Handle edit appointment
  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment(appointment);
    setEditAppointmentType(appointment.type || 'consultation');
    setEditNotes(appointment.notes || '');
    setIsEditModalOpen(true);
  };

  // Handle update appointment
  const handleUpdateAppointment = () => {
    if (!editingAppointment) return;

    const updateData = {
      type: editAppointmentType,
      notes: editNotes,
    };

    updateAppointmentMutation.mutate({
      id: editingAppointment.id,
      data: updateData,
    });
  };

  // Export calendar to iCal format
  const handleExportCalendar = async () => {
    try {
      const response = await fetch(`/api/appointments/export/${DEFAULT_DOCTOR_ID}?format=ical`);
      if (!response.ok) throw new Error('Failed to export calendar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agenda-telemed-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Agenda exportada",
        description: "Seu calendário foi exportado com sucesso em formato iCal.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar a agenda.",
        variant: "destructive",
      });
    }
  };

  // Import calendar from file
  const handleImportCalendar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doctorId', DEFAULT_DOCTOR_ID);

      const response = await fetch('/api/appointments/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import calendar');
      }

      const result = await response.json();
      
      toast({
        title: "Agenda importada",
        description: `${result.imported} eventos importados com sucesso.`,
      });

      // Refresh appointments
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      toast({
        title: "Erro ao importar",
        description: error instanceof Error ? error.message : "Não foi possível importar a agenda.",
        variant: "destructive",
      });
      event.target.value = '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 dark:from-blue-900/30 dark:to-cyan-900/30 dark:text-blue-300';
      case 'completed':
        return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-300';
      case 'cancelled':
        return 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 dark:from-red-900/30 dark:to-rose-900/30 dark:text-red-300';
      case 'in-progress':
        return 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 dark:from-orange-900/30 dark:to-amber-900/30 dark:text-orange-300';
      default:
        return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 dark:from-gray-900/30 dark:to-slate-900/30 dark:text-gray-300';
    }
  };

  const getTimeBasedStyling = (scheduledAt: string) => {
    const now = new Date();
    const aptTime = new Date(scheduledAt);
    const minutesUntil = differenceInMinutes(aptTime, now);
    
    if (minutesUntil <= 0) {
      return 'border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20';
    } else if (minutesUntil <= 30) {
      return 'border-l-4 border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 animate-pulse';
    } else if (isToday(aptTime)) {
      return 'border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20';
    }
    return 'border-l-4 border-gray-300 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20';
  };

  const getTypeIcon = (type: string, aiScheduled: boolean) => {
    if (aiScheduled) return "fas fa-robot text-purple-600";
    switch (type) {
      case 'consultation':
        return "fas fa-stethoscope text-blue-600";
      case 'followup':
        return "fas fa-redo text-green-600";
      case 'emergency':
        return "fas fa-exclamation text-red-600";
      default:
        return "fas fa-calendar text-gray-600";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-purple-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-32 w-32 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-lg font-medium text-muted-foreground">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="schedule-page-background">
        {/* Modern Header with Notifications */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <CalendarIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Agenda Tele{"<"}M3D{">"}
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
          
          {/* Notification Badge & Actions */}
          <div className="flex items-center gap-3">
            {upcomingNotifications.length > 0 && (
              <div className="relative" data-testid="notification-badge">
                <Button variant="outline" size="sm" className="relative backdrop-blur-lg bg-white/20 border-orange-200 hover:bg-orange-50 dark:bg-black/20 dark:border-orange-800 dark:hover:bg-orange-950/20">
                  <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                </Button>
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1 min-w-[1rem] h-5 flex items-center justify-center">
                  {upcomingNotifications.length}
                </Badge>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('day');
                  // Refresh appointments for current day
                  queryClient.invalidateQueries({ queryKey: ['/api/appointments/doctor'] });
                }}
                data-testid="button-view-day"
                className={`backdrop-blur-lg border-white/20 hover:bg-white/20 dark:border-white/10 dark:hover:bg-black/20 ${
                  viewMode === 'day' 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                    : 'bg-white/10 dark:bg-black/10'
                }`}
              >
                Dia
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('week');
                  // Future: implement week view logic
                  toast({ title: 'Visualização Semanal', description: 'Em breve - visualização semanal completa' });
                }}
                data-testid="button-view-week"
                className={`backdrop-blur-lg border-white/20 hover:bg-white/20 dark:border-white/10 dark:hover:bg-black/20 ${
                  viewMode === 'week' 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                    : 'bg-white/10 dark:bg-black/10'
                }`}
              >
                Semana
              </Button>
            </div>
            
            <Button 
              onClick={() => setIsInstantConsultOpen(true)}
              data-testid="button-new-appointment"
              className="btn-medical-primary"
            >
              <Video className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Enhanced Calendar Sidebar */}
          <div className="lg:col-span-1">
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 dark:border-white/10 shadow-xl">
              <CardHeader className="border-b border-white/10 dark:border-white/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      // Quick create appointment on double-click handled by day cell click
                    }
                  }}
                  onDayClick={(day) => {
                    // Double-click to quick create appointment
                    setSelectedDate(day);
                    setQuickBookMode(true);
                    setIsCreateModalOpen(true);
                  }}
                  locale={ptBR}
                  className="w-full backdrop-blur-sm bg-white/50 dark:bg-black/20 rounded-lg p-2"
                  data-testid="calendar-schedule"
                />
                
                {/* Enhanced Legend with Modern Styling */}
                <div className="mt-6 space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Status dos Agendamentos</div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full shadow-sm"></div>
                      <span className="text-muted-foreground">Consultas agendadas</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-sm animate-pulse"></div>
                      <span className="text-muted-foreground">Agendamentos IA</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-sm"></div>
                      <span className="text-muted-foreground">Retornos</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-sm"></div>
                      <span className="text-muted-foreground">Em andamento</span>
                    </div>
                  </div>
                </div>

                {/* Export/Import Actions */}
                <div className="mt-6 border-t border-white/10 dark:border-white/5 pt-4 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground mb-3">Gerenciar Agenda</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={handleExportCalendar}
                    data-testid="button-export-calendar"
                  >
                    <Download className="h-4 w-4" />
                    Exportar Agenda
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    data-testid="button-import-calendar"
                  >
                    <Upload className="h-4 w-4" />
                    Importar Agenda
                  </Button>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".ics,.json"
                    className="hidden"
                    onChange={handleImportCalendar}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Consultation Requests from Patients */}
          {(() => {
            const pendingRequests = (consultationRequests || []).filter(
              (r: any) => r.status === 'pending' || r.status === 'accepted'
            );
            if (pendingRequests.length === 0) return null;
            return (
              <div className="lg:col-span-3 mb-4">
                <Card className="backdrop-blur-xl bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Bell className="h-4 w-4" />
                        </div>
                        <span>Solicitações de Pacientes</span>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          {pendingRequests.length}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingRequests.map((req: any) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-white/60 dark:bg-black/20 border border-amber-100 dark:border-amber-900"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm truncate">{req.patientName || 'Paciente'}</h4>
                              <Badge className={
                                req.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }>
                                {req.status === 'pending' ? 'Pendente' : 'Aceita'}
                              </Badge>
                              {req.urgencyLevel && (
                                <Badge variant="outline" className={
                                  req.urgencyLevel === 'emergency' ? 'border-red-500 text-red-600' :
                                  req.urgencyLevel === 'urgent' ? 'border-orange-500 text-orange-600' :
                                  'border-blue-500 text-blue-600'
                                }>
                                  {req.urgencyLevel === 'emergency' ? 'Emergência' :
                                   req.urgencyLevel === 'urgent' ? 'Urgente' : 'Normal'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {req.specialty && <span>Especialidade: {req.specialty}</span>}
                              {req.symptoms && <p className="truncate">Sintomas: {req.symptoms}</p>}
                              {req.preferredDate && (
                                <span> | Data preferida: {new Date(req.preferredDate).toLocaleDateString('pt-BR')}</span>
                              )}
                              <span className="block">Criado em: {new Date(req.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            {req.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 border-green-200"
                                  onClick={() => acceptRequestMutation.mutate(req.id)}
                                  disabled={acceptRequestMutation.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Aceitar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200"
                                  onClick={() => declineRequestMutation.mutate(req.id)}
                                  disabled={declineRequestMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Recusar
                                </Button>
                              </>
                            )}
                            {req.status === 'accepted' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200"
                                onClick={() => cancelRequestMutation.mutate(req.id)}
                                disabled={cancelRequestMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Appointments Area with Tabs */}
          <div className="lg:col-span-3">
            <Tabs value={scheduleTab} onValueChange={(v) => setScheduleTab(v as 'today' | 'future' | 'history')}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid grid-cols-3 w-[480px]">
                  <TabsTrigger value="today" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Hoje
                    {(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-1">
                        {(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="future" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Futuras
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                    onClick={() => setShowBlockedList(true)}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Bloqueados
                  </Button>
                  <Button 
                    onClick={() => setIsInstantConsultOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    size="sm"
                  >
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Consulta Instantânea
                  </Button>
                </div>
              </div>

              <TabsContent value="today">
                <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 dark:border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 dark:border-white/5">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 text-white">
                          <Users className="h-4 w-4" />
                        </div>
                        <span>Consultas de Hoje</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {upcomingNotifications.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 text-orange-800 dark:text-orange-200">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {upcomingNotifications.length} próxima{upcomingNotifications.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <span data-testid="text-appointment-count">
                            {(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').length} consultas pendentes
                          </span>
                        </div>
                        {(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                            onClick={() => setCancelAllScope('today')}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancelar Todas
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').length ? (
                      <div className="text-center py-12">
                        <i className="fas fa-calendar-day text-6xl text-muted-foreground mb-4"></i>
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                          Nenhuma consulta pendente
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          Não há consultas ativas ou agendadas para este dia.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsCreateModalOpen(true)}
                            data-testid="button-add-first-appointment"
                          >
                            <i className="fas fa-plus mr-2"></i>
                            Agendar consulta
                          </Button>
                          <Button 
                            onClick={() => setIsInstantConsultOpen(true)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                          >
                            <PhoneCall className="h-4 w-4 mr-2" />
                            Consulta Instantânea
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(appointments || []).filter((a: any) => a.status === 'scheduled' || a.status === 'in-progress').map((appointment: any) => (
                          <div
                            key={appointment.id}
                            className={`flex items-center space-x-4 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg backdrop-blur-sm ${getTimeBasedStyling(appointment.scheduledAt)}`}
                            data-testid={`card-appointment-${appointment.id}`}
                          >
                            <div className="flex-shrink-0">
                              <div className="text-primary font-bold text-lg">
                                {format(new Date(appointment.scheduledAt), "HH:mm")}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-foreground truncate" data-testid={`text-appointment-patient-${appointment.id}`}>
                                  {appointment.patientName || "Paciente não identificado"}
                                </h3>
                                {appointment.aiScheduled && (
                                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                    <i className="fas fa-robot mr-1"></i>
                                    IA
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <i className={getTypeIcon(appointment.type, appointment.aiScheduled)}></i>
                                <span data-testid={`text-appointment-type-${appointment.id}`}>
                                  {appointment.type === 'consultation' ? 'Consulta' :
                                   appointment.type === 'followup' ? 'Retorno' :
                                   appointment.type === 'emergency' ? 'Emergência' : appointment.type}
                                </span>
                                {appointment.notes && (
                                  <>
                                    <span>•</span>
                                    <span data-testid={`text-appointment-notes-${appointment.id}`}>
                                      {appointment.notes}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Badge 
                                className={getStatusColor(appointment.status)}
                                data-testid={`badge-appointment-status-${appointment.id}`}
                              >
                                {appointment.status === 'scheduled' ? 'Agendado' :
                                 appointment.status === 'in-progress' ? 'Em andamento' :
                                 appointment.status === 'completed' ? 'Concluído' :
                                 appointment.status === 'cancelled' ? 'Cancelado' : appointment.status}
                              </Badge>
                            </div>

                            <div className="flex items-center space-x-2">
                              <div className="relative inline-flex items-center">
                                {(() => {
                                  const patientOnline = onlinePatients?.find((s: any) => s.patientId === appointment.patientId)?.isOnline;
                                  return patientOnline !== undefined ? (
                                    <span className={`absolute -top-1 -left-1 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 z-10 ${patientOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={patientOnline ? 'Paciente online' : 'Paciente offline'} />
                                  ) : null;
                                })()}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartConsultation(appointment)}
                                  disabled={false}
                                  data-testid={`button-start-consultation-${appointment.id}`}
                                >
                                  <i className="fas fa-video mr-1"></i>
                                  Iniciar
                                </Button>
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateJoinLink(appointment)}
                                data-testid={`button-generate-link-${appointment.id}`}
                              >
                                <i className="fas fa-link mr-1"></i>
                                Gerar Link
                              </Button>
                              
                              <ConsultationAccessGenerator
                                patientId={appointment.patientId}
                                patientName={appointment.patientName || "Paciente"}
                                appointmentId={appointment.id}
                                scheduledAt={appointment.scheduledAt}
                                trigger={
                                  <Button variant="outline" size="sm" className="gap-1">
                                    <QrCode className="h-3.5 w-3.5" />
                                    QR/WhatsApp
                                  </Button>
                                }
                              />
                              
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-edit-appointment-${appointment.id}`}
                                onClick={() => handleEditAppointment(appointment)}
                              >
                                <i className="fas fa-edit mr-1"></i>
                                Editar
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                                data-testid={`button-cancel-appointment-${appointment.id}`}
                                onClick={() => handleCancelAppointment(appointment)}
                                disabled={cancelAppointmentMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-700 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-950/30 border-red-300 dark:border-red-700"
                                onClick={() => handleDeleteAppointment(appointment)}
                                disabled={deleteAppointmentMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                              {appointment.patientId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                                  onClick={() => handleBlockPatient(appointment)}
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  Bloquear
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="future">
                <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 dark:border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 dark:border-white/5">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                          <Clock className="h-4 w-4" />
                        </div>
                        <span>Consultas Futuras</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <span>{(futureAppointments || []).length} agendamento(s)</span>
                        </div>
                        {(futureAppointments || []).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                            onClick={() => setCancelAllScope('future')}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Cancelar Todas
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {futureLoading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Carregando consultas futuras...</p>
                      </div>
                    ) : !(futureAppointments || []).length ? (
                      <div className="text-center py-12">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhuma consulta futura</h3>
                        <p className="text-muted-foreground mb-4">Não há consultas agendadas para os próximos dias.</p>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Agendar Nova Consulta
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[600px]">
                        <div className="space-y-4">
                          {(futureAppointments || []).map((appointment: any) => {
                            const aptDate = new Date(appointment.scheduledAt);
                            return (
                              <div
                                key={appointment.id}
                                className="flex items-center space-x-4 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg backdrop-blur-sm border-l-4 border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20"
                              >
                                <div className="flex-shrink-0 text-center">
                                  <div className="text-xs text-muted-foreground font-medium">{format(aptDate, "dd/MM", { locale: ptBR })}</div>
                                  <div className="text-primary font-bold text-lg">{format(aptDate, "HH:mm")}</div>
                                  <div className="text-[10px] text-muted-foreground">{format(aptDate, "EEEE", { locale: ptBR })}</div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h3 className="font-semibold text-foreground truncate">
                                      {appointment.patientName || "Paciente não identificado"}
                                    </h3>
                                    {appointment.aiScheduled && (
                                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">IA</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                    <span>
                                      {appointment.type === 'consultation' ? 'Consulta' :
                                       appointment.type === 'followup' ? 'Retorno' :
                                       appointment.type === 'emergency' ? 'Emergência' : appointment.type}
                                    </span>
                                    {appointment.notes && <><span>•</span><span>{appointment.notes}</span></>}
                                  </div>
                                </div>
                                <Badge className={getStatusColor(appointment.status)}>
                                  {appointment.status === 'scheduled' ? 'Agendado' : appointment.status === 'in-progress' ? 'Em andamento' : appointment.status}
                                </Badge>
                                <div className="flex items-center space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleGenerateJoinLink(appointment)}>
                                    <i className="fas fa-link mr-1"></i>Gerar Link
                                  </Button>
                                  <ConsultationAccessGenerator
                                    patientId={appointment.patientId}
                                    patientName={appointment.patientName || "Paciente"}
                                    appointmentId={appointment.id}
                                    scheduledAt={appointment.scheduledAt}
                                    trigger={
                                      <Button variant="outline" size="sm" className="gap-1">
                                        <QrCode className="h-3.5 w-3.5" />
                                        QR/WhatsApp
                                      </Button>
                                    }
                                  />
                                  <Button variant="outline" size="sm" onClick={() => handleEditAppointment(appointment)}>
                                    <i className="fas fa-edit mr-1"></i>Editar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                                    onClick={() => handleCancelAppointment(appointment)}
                                    disabled={cancelAppointmentMutation.isPending}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-700 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-950/30 border-red-300 dark:border-red-700"
                                    onClick={() => handleDeleteAppointment(appointment)}
                                    disabled={deleteAppointmentMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Excluir
                                  </Button>
                                  {appointment.patientId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                                      onClick={() => handleBlockPatient(appointment)}
                                    >
                                      <Ban className="h-4 w-4 mr-1" />
                                      Bloquear
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 dark:border-white/10 shadow-xl">
                  <CardHeader className="border-b border-white/10 dark:border-white/5">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                        <History className="h-4 w-4" />
                      </div>
                      <span>Histórico de Consultas</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Carregando histórico...</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[600px]">
                        {historyData?.videoConsultations?.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              Teleconsultas Realizadas ({historyData.videoConsultations.length})
                            </h3>
                            <div className="space-y-3">
                              {historyData.videoConsultations.map((vc: any) => {
                                const isIncomplete = vc.status === 'incomplete';
                                const endReasonText = vc.connectionLogs?.endReason;
                                return (
                                <div key={vc.id} className={`flex items-start space-x-4 p-4 rounded-xl border transition-colors ${isIncomplete ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20' : 'border-border/50 bg-muted/30 hover:bg-muted/50'}`}>
                                  <div className="flex-shrink-0">
                                    <div className={`p-2 rounded-lg text-white ${isIncomplete ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}>
                                      <Video className="h-4 w-4" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm">{vc.patientName}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                      <Clock className="h-3 w-3" />
                                      {vc.startedAt ? format(new Date(vc.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : format(new Date(vc.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                      {vc.duration && <span>• {Math.round(vc.duration / 60)} min</span>}
                                    </div>
                                    {endReasonText && isIncomplete && (
                                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Motivo: {endReasonText}</p>
                                    )}
                                    {vc.meetingNotes && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{vc.meetingNotes}</p>
                                    )}
                                    {isIncomplete && (
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => reactivateConsultationMutation.mutate(vc.id)}
                                          disabled={reactivateConsultationMutation.isPending}
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                          Reativar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => setLocation(`/consultation/video/${vc.patientId}`)}
                                        >
                                          <Video className="h-3 w-3" />
                                          Nova Chamada
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => completeConsultationMutation.mutate({ id: vc.id })}
                                          disabled={completeConsultationMutation.isPending}
                                        >
                                          <FileCheck className="h-3 w-3" />
                                          Concluir
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() => setLocation(`/whatsapp`)}
                                        >
                                          <MessageSquare className="h-3 w-3" />
                                          Mensagem
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  {isIncomplete ? (
                                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 flex-shrink-0">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Inconcluída
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex-shrink-0">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Concluída
                                    </Badge>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {historyData?.appointments?.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4" />
                              Agendamentos Anteriores ({historyData.appointments.length})
                            </h3>
                            <div className="space-y-3">
                              {historyData.appointments.map((apt: any) => (
                                <div key={apt.id} className="flex items-center space-x-4 p-4 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <div className="flex-shrink-0">
                                    <div className="text-muted-foreground font-bold text-sm">
                                      {format(new Date(apt.scheduledAt), "dd/MM")}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(apt.scheduledAt), "HH:mm")}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm">{apt.patientName || 'Paciente'}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                      <i className={getTypeIcon(apt.type, apt.aiScheduled)}></i>
                                      <span>
                                        {apt.type === 'consultation' ? 'Consulta' :
                                         apt.type === 'followup' ? 'Retorno' :
                                         apt.type === 'emergency' ? 'Emergência' : apt.type}
                                      </span>
                                      {apt.notes && <span>• {apt.notes}</span>}
                                    </div>
                                  </div>
                                  <Badge className={getStatusColor(apt.status)}>
                                    {apt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!historyData?.appointments?.length && !historyData?.videoConsultations?.length) && (
                          <div className="text-center py-12">
                            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhum histórico</h3>
                            <p className="text-muted-foreground">Você ainda não possui consultas anteriores.</p>
                          </div>
                        )}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setIsInstantConsultOpen(true)}>
                <CardContent className="p-6 text-center">
                  <PhoneCall className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Consulta Instantânea</h3>
                  <p className="text-sm text-muted-foreground">Iniciar videochamada com paciente online</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setScheduleTab('future')}>
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-indigo-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Consultas Futuras</h3>
                  <p className="text-sm text-muted-foreground">Visualize agendamentos dos próximos dias</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setScheduleTab('history')}>
                <CardContent className="p-6 text-center">
                  <History className="h-8 w-8 text-indigo-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Histórico</h3>
                  <p className="text-sm text-muted-foreground">Consultas realizadas, canceladas e expiradas</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

      {/* Appointment Creation Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-create-appointment">
          <DialogHeader>
            <DialogTitle>Nova Consulta</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Patient Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Paciente
              </label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger data-testid="select-patient">
                  <SelectValue placeholder="Selecione um paciente" />
                </SelectTrigger>
                <SelectContent>
                  {(patients || []).map((patient: any) => (
                    <SelectItem 
                      key={patient.id} 
                      value={patient.id}
                      data-testid={`option-patient-${patient.id}`}
                    >
                      {patient.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Available Slots */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Horário Disponível
              </label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger data-testid="select-available-slot">
                  <SelectValue placeholder="Selecione um horário" />
                </SelectTrigger>
                <SelectContent>
                  {slotsLoading ? (
                    <SelectItem value="loading" disabled>
                      Carregando horários...
                    </SelectItem>
                  ) : (
                    (availableSlots || []).map((slot: any, index: number) => (
                      <SelectItem 
                        key={index} 
                        value={slot.formatted}
                        data-testid={`option-slot-${index}`}
                      >
                        {slot.formatted}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Appointment Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Tipo de Consulta
              </label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger data-testid="select-appointment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation" data-testid="option-type-consultation">
                    Consulta
                  </SelectItem>
                  <SelectItem value="followup" data-testid="option-type-followup">
                    Retorno
                  </SelectItem>
                  <SelectItem value="emergency" data-testid="option-type-emergency">
                    Emergência
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                data-testid="button-cancel-appointment"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateAppointment}
                disabled={createAppointmentMutation.isPending || !selectedPatientId || !selectedSlot}
                data-testid="button-confirm-appointment"
              >
                {createAppointmentMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Agendando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Agendar Consulta
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-edit-appointment">
          <DialogHeader>
            <DialogTitle>Editar Consulta</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {editingAppointment && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Paciente: <span className="font-medium">{editingAppointment.patientName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Data/Hora: <span className="font-medium">
                    {format(new Date(editingAppointment.scheduledAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Consulta</label>
              <Select value={editAppointmentType} onValueChange={setEditAppointmentType}>
                <SelectTrigger data-testid="select-edit-appointment-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consulta</SelectItem>
                  <SelectItem value="followup">Retorno</SelectItem>
                  <SelectItem value="emergency">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea 
                placeholder="Observações sobre a consulta..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                data-testid="textarea-edit-notes"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1"
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateAppointment}
                disabled={updateAppointmentMutation.isPending}
                className="flex-1"
                data-testid="button-save-edit"
              >
                {updateAppointmentMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Join Link Modal */}
      <Dialog open={isJoinLinkModalOpen} onOpenChange={setIsJoinLinkModalOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-join-link">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <i className="fas fa-link text-blue-600"></i>
              Link de Acesso para Paciente
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedAppointmentForLink && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-gray-800">{selectedAppointmentForLink.patientName}</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedAppointmentForLink.date + ' ' + selectedAppointmentForLink.time).toLocaleString('pt-BR')}
                </p>
              </div>
            )}

            {generatedJoinLink && (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600 mb-2">Link de acesso:</p>
                  <p className="font-mono text-sm bg-white p-2 rounded border break-all">
                    {generatedJoinLink}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedJoinLink);
                      toast({
                        title: "Link copiado!",
                        description: "O link foi copiado para a área de transferência.",
                      });
                    }}
                    className="btn-medical-primary flex-1"
                    data-testid="button-copy-link"
                  >
                    <i className="fas fa-copy mr-2"></i>
                    Copiar Link
                  </Button>

                  <Button
                    onClick={() => {
                      const message = `Olá! Seu link para a consulta médica: ${generatedJoinLink}`;
                      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                      window.open(whatsappUrl, '_blank');
                    }}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-share-whatsapp"
                  >
                    <i className="fab fa-whatsapp mr-2 text-green-600"></i>
                    WhatsApp
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <i className="fas fa-info-circle text-amber-600 mr-2"></i>
                  <strong>Instruções para o paciente:</strong> Este link é válido por 4 horas. 
                  O paciente deve clicar no link na hora da consulta e permitir acesso à câmera e microfone.
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsJoinLinkModalOpen(false);
                  setGeneratedJoinLink(null);
                  setSelectedAppointmentForLink(null);
                }}
                data-testid="button-close-link-modal"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instant Consultation Dialog */}
      <Dialog open={isInstantConsultOpen} onOpenChange={setIsInstantConsultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              Consulta Instantânea
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Selecione um paciente para iniciar uma videoconsulta. O paciente receberá uma notificação em tempo real.
          </p>
          <div className="space-y-3">
            <Select value={instantPatientId} onValueChange={setInstantPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um paciente" />
              </SelectTrigger>
              <SelectContent>
                {(allPatientsForInstant || []).map((patient: any) => {
                  const isOnline = onlinePatients?.find((s: any) => s.patientId === patient.id)?.isOnline;
                  return (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {patient.name}
                        {isOnline && <span className="text-xs text-green-600 ml-1">Online</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {onlinePatients && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300 mb-2">
                  <Wifi className="h-4 w-4" />
                  <span className="font-medium">Pacientes Online</span>
                </div>
                {onlinePatients.filter((p: any) => p.isOnline).length > 0 ? (
                  <div className="space-y-1">
                    {onlinePatients.filter((p: any) => p.isOnline).map((p: any) => (
                      <button
                        key={p.patientId}
                        onClick={() => setInstantPatientId(p.patientId)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          instantPatientId === p.patientId 
                            ? 'bg-green-200 dark:bg-green-800 font-medium' 
                            : 'hover:bg-green-100 dark:hover:bg-green-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          {p.name}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum paciente online no momento</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => { setIsInstantConsultOpen(false); setInstantPatientId(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => instantPatientId && startInstantConsultMutation.mutate(instantPatientId)}
              disabled={!instantPatientId || startInstantConsultMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
            >
              {startInstantConsultMutation.isPending ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i>Chamando...</>
              ) : (
                <><PhoneCall className="h-4 w-4 mr-2" />Iniciar Chamada</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelConfirmId} onOpenChange={(open) => { if (!open) { setCancelConfirmId(null); setCancelConfirmName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Cancelar Consulta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar a consulta com <strong>{cancelConfirmName}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCancelConfirmId(null); setCancelConfirmName(""); }}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelConfirmId && cancelAppointmentMutation.mutate(cancelConfirmId)}
                disabled={cancelAppointmentMutation.isPending}
              >
                {cancelAppointmentMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel All Confirmation Dialog */}
      <Dialog open={!!cancelAllScope} onOpenChange={(open) => { if (!open) { setCancelAllScope(null); setCancelAllAppointmentType('all'); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Cancelar Todas as Consultas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Tipo de Consulta</label>
              <Select value={cancelAllAppointmentType} onValueChange={setCancelAllAppointmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="consultation">Consultas</SelectItem>
                  <SelectItem value="followup">Retornos</SelectItem>
                  <SelectItem value="emergency">Emergências</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                {cancelAllScope === 'today'
                  ? `Você está prestes a cancelar ${cancelAllAppointmentType === 'all' ? 'todas as' : ''} ${(appointments || []).filter((a: any) => (a.status === 'scheduled' || a.status === 'in-progress') && (cancelAllAppointmentType === 'all' || a.type === cancelAllAppointmentType)).length} consulta(s) pendente(s) de hoje${cancelAllAppointmentType !== 'all' ? ` do tipo "${cancelAllAppointmentType === 'consultation' ? 'Consulta' : cancelAllAppointmentType === 'followup' ? 'Retorno' : 'Emergência'}"` : ''}.`
                  : `Você está prestes a cancelar ${cancelAllAppointmentType === 'all' ? 'todas as' : ''} consulta(s) futura(s) agendada(s)${cancelAllAppointmentType !== 'all' ? ` do tipo "${cancelAllAppointmentType === 'consultation' ? 'Consulta' : cancelAllAppointmentType === 'followup' ? 'Retorno' : 'Emergência'}"` : ''}.`}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Todas as consultas serão marcadas como canceladas e movidas para o histórico. Os pacientes serão notificados. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCancelAllScope(null); setCancelAllAppointmentType('all'); }}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelAllScope && cancelAllMutation.mutate({ scope: cancelAllScope, appointmentType: cancelAllAppointmentType })}
                disabled={cancelAllMutation.isPending}
              >
                {cancelAllMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) { setDeleteConfirmId(null); setDeleteConfirmName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Excluir Agendamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                Tem certeza que deseja <strong>excluir permanentemente</strong> o agendamento com <strong>{deleteConfirmName}</strong>?
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              O agendamento será removido do sistema e o paciente será notificado. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setDeleteConfirmId(null); setDeleteConfirmName(""); }}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteAppointmentMutation.mutate(deleteConfirmId)}
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending ? 'Excluindo...' : 'Excluir Permanentemente'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Patient Dialog */}
      <Dialog open={!!blockPatientId} onOpenChange={(open) => { if (!open) { setBlockPatientId(null); setBlockPatientName(""); setBlockReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Ban className="h-5 w-5" />
              Bloquear Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                Ao bloquear <strong>{blockPatientName}</strong>, este paciente não poderá mais:
              </p>
              <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 space-y-1 list-disc list-inside">
                <li>Agendar consultas com você</li>
                <li>Solicitar consultas por triagem direcionadas a você</li>
                <li>Enviar solicitações de atendimento</li>
              </ul>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Motivo do bloqueio (opcional)
              </label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Comportamento inadequado, não comparecimentos repetidos..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setBlockPatientId(null); setBlockPatientName(""); setBlockReason(""); }}>
                Voltar
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => blockPatientId && blockPatientMutation.mutate({ patientId: blockPatientId, reason: blockReason })}
                disabled={blockPatientMutation.isPending}
              >
                {blockPatientMutation.isPending ? 'Bloqueando...' : 'Confirmar Bloqueio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blocked Patients List Dialog */}
      <Dialog open={showBlockedList} onOpenChange={setShowBlockedList}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-600" />
              Pacientes Bloqueados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!blockedPatients || blockedPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum paciente bloqueado.
              </p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {blockedPatients.map((block: any) => (
                    <div key={block.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{block.patientName}</p>
                        {block.reason && <p className="text-xs text-muted-foreground mt-1">Motivo: {block.reason}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          Bloqueado em {new Date(block.blockedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockPatientMutation.mutate(block.patientId)}
                        disabled={unblockPatientMutation.isPending}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                      >
                        Desbloquear
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </PageWrapper>
  );
}
