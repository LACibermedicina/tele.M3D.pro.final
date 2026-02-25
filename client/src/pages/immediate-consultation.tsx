import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, User, Stethoscope, CheckCircle, AlertCircle, Siren, ShieldAlert, Video, Activity, Phone, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation, useSearch } from "wouter";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  medicalLicense: string;
  profilePicture: string | null;
  isOnline: boolean;
  availableForImmediate: boolean;
  onlineSince: string | null;
  onDutyUntil: string | null;
  inConsultation?: boolean;
  activePatientIds?: string[];
  activeUserIds?: string[];
}

export default function ImmediateConsultation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [reason, setReason] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'urgent' | 'emergency'>('normal');
  const [hasTemporaryAccess, setHasTemporaryAccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const accessCode = params.get('access');
    if (accessCode && accessCode.length >= 10) {
      setHasTemporaryAccess(true);
      sessionStorage.setItem('temp_access_code', accessCode);
      sessionStorage.setItem('temp_access_time', Date.now().toString());
    } else {
      const stored = sessionStorage.getItem('temp_access_code');
      const storedTime = sessionStorage.getItem('temp_access_time');
      if (stored && storedTime) {
        const elapsed = Date.now() - parseInt(storedTime);
        if (elapsed < 2 * 60 * 60 * 1000) {
          setHasTemporaryAccess(true);
        } else {
          sessionStorage.removeItem('temp_access_code');
          sessionStorage.removeItem('temp_access_time');
        }
      }
    }
  }, [searchString]);

  const canAccess = !!user || hasTemporaryAccess;

  const { data: onlineDoctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ['/api/doctors/online'],
    refetchInterval: 10000,
    enabled: canAccess,
  });

  const requestMutation = useMutation({
    mutationFn: async (data: { doctorId: string; reason: string }) => {
      if (!user) {
        throw new Error('Faça login para solicitar uma consulta');
      }
      const res = await apiRequest('POST', `/api/doctor-office/join/${data.doctorId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Entrando no Consultório!",
        description: "Conectando à sala de vídeo do médico...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      setTimeout(() => {
        setLocation(`/patient/video/${data.consultationId}`);
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao entrar no consultório",
        variant: "destructive",
      });
    },
  });

  const handleRequest = () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    if (!selectedDoctor) {
      toast({
        title: "Erro",
        description: "Selecione um médico",
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: "Erro",
        description: "Descreva o motivo da consulta",
        variant: "destructive",
      });
      return;
    }

    requestMutation.mutate({
      doctorId: selectedDoctor.id,
      reason,
    });
  };

  const getOnlineTime = (onlineSince: string | null) => {
    if (!onlineSince) return '';
    const minutes = Math.floor((Date.now() - new Date(onlineSince).getTime()) / 60000);
    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `há ${hours}h`;
  };

  const isOnDuty = (doctor: Doctor) => {
    return doctor.onDutyUntil && new Date(doctor.onDutyUntil) > new Date();
  };

  const getDutyTimeRemaining = (doctor: Doctor) => {
    if (!doctor.onDutyUntil) return '';
    const remaining = new Date(doctor.onDutyUntil).getTime() - Date.now();
    if (remaining <= 0) return '';
    const hours = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    if (hours > 0) return `${hours}h${mins > 0 ? `${mins}min` : ''} restantes`;
    return `${mins}min restantes`;
  };

  const sortedDoctors = onlineDoctors?.slice().sort((a, b) => {
    const aOnDuty = isOnDuty(a);
    const bOnDuty = isOnDuty(b);
    if (aOnDuty && !bOnDuty) return -1;
    if (!aOnDuty && bOnDuty) return 1;
    const aTime = a.onlineSince ? new Date(a.onlineSince).getTime() : 0;
    const bTime = b.onlineSince ? new Date(b.onlineSince).getTime() : 0;
    return aTime - bTime;
  });

  const onDutyDoctors = sortedDoctors?.filter(d => isOnDuty(d)) || [];
  const regularDoctors = sortedDoctors?.filter(d => !isOnDuty(d)) || [];
  const totalOnline = sortedDoctors?.length || 0;

  const isLoggedIn = !!user;
  const inConsultationDoctors = sortedDoctors?.filter(d => d.inConsultation) || [];
  const availableDoctors = sortedDoctors?.filter(d => !d.inConsultation) || [];

  const isAttendingCurrentUser = (doctor: OnlineDoctor) => {
    if (!user?.id || !doctor.activeUserIds) return false;
    return doctor.activeUserIds.includes(user.id);
  };

  const urgencyConfig = {
    normal: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Normal', icon: Activity },
    urgent: { color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Urgente', icon: ShieldAlert },
    emergency: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Emergência', icon: Siren },
  };

  if (!canAccess) {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-6 sm:p-8 lg:p-12 max-w-lg mx-auto text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldOff className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">
            A Sala de Espera é acessível apenas para pacientes cadastrados ou visitantes com link de acesso temporário fornecido pelo médico ou administrador.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => setLocation('/login')} size="lg" className="w-full">
              Fazer Login
            </Button>
            <Button onClick={() => setLocation('/register/patient')} variant="outline" size="lg" className="w-full">
              Criar Conta de Paciente
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Já recebeu um link de acesso? Cole-o diretamente no navegador.
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Video className="h-7 w-7 text-primary" />
            {isLoggedIn ? 'Sala de Espera & Atendimento Imediato' : 'Sala de Espera'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {isLoggedIn 
              ? 'Veja médicos disponíveis agora e solicite atendimento imediato' 
              : 'Veja os médicos disponíveis. Faça login para solicitar uma consulta.'}
          </p>
          {hasTemporaryAccess && !isLoggedIn && (
            <Badge variant="outline" className="mt-2 bg-amber-50 text-amber-700 border-amber-300">
              Acesso temporário (expira em 2 horas)
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{totalOnline}</p>
                <p className="text-xs text-muted-foreground">Médicos Online</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{onDutyDoctors.length}</p>
                <p className="text-xs text-muted-foreground">Em Plantão</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Video className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{regularDoctors.length}</p>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {onDutyDoctors.length > 0 && (
          <Card className="border-red-200 bg-gradient-to-r from-red-50/80 to-orange-50/80 dark:from-red-950/30 dark:to-orange-950/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <Siren className="h-5 w-5 animate-pulse" />
                Sala de Urgência
              </CardTitle>
              <CardDescription>
                Médicos de plantão disponíveis para atendimento de urgência e emergência
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {onDutyDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                      selectedDoctor?.id === doctor.id
                        ? 'border-red-400 bg-red-50 dark:bg-red-950/40 ring-2 ring-red-300'
                        : 'border-red-200 hover:border-red-300 bg-white dark:bg-card'
                    }`}
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
                          <AvatarImage src={doctor.profilePicture || undefined} />
                          <AvatarFallback className="bg-red-100 text-red-700">
                            {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                      </div>
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-semibold">{doctor.name}</h3>
                          <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                            <Siren className="w-3 h-3 mr-1" />
                            Plantão
                          </Badge>
                          {doctor.inConsultation ? (
                            isAttendingCurrentUser(doctor) ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                                <Video className="w-3 h-3 mr-1" />
                                Em atendimento com você
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">
                                <Video className="w-3 h-3 mr-1" />
                                Em Atendimento
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                              Online {getOnlineTime(doctor.onlineSince)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{doctor.specialization || 'Clínico Geral'}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">CRM: {doctor.medicalLicense}</p>
                          {getDutyTimeRemaining(doctor) && (
                            <p className="text-xs text-orange-600">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {getDutyTimeRemaining(doctor)}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedDoctor?.id === doctor.id && (
                        <CheckCircle className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {onDutyDoctors.length > 0 ? 'Consulta Regular' : 'Médicos Disponíveis Agora'}
            </CardTitle>
            <CardDescription>
              {onDutyDoctors.length > 0 
                ? 'Médicos online disponíveis para consulta imediata'
                : 'Médicos online e disponíveis para atendimento imediato'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto mb-2 animate-spin opacity-50" />
                <p className="text-muted-foreground">Procurando médicos disponíveis...</p>
              </div>
            ) : regularDoctors.length === 0 && onDutyDoctors.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-yellow-600" />
                <p className="text-muted-foreground font-medium">Nenhum médico disponível no momento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tente novamente em alguns minutos ou agende uma consulta
                </p>
                {isLoggedIn && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setLocation('/consultation-request')}
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Agendar Consulta
                  </Button>
                )}
              </div>
            ) : regularDoctors.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Apenas médicos de plantão disponíveis no momento. Selecione um acima.
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {regularDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                      selectedDoctor?.id === doctor.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
                          <AvatarImage src={doctor.profilePicture || undefined} />
                          <AvatarFallback>
                            {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${doctor.inConsultation ? (isAttendingCurrentUser(doctor) ? 'bg-blue-500' : 'bg-yellow-500') : 'bg-green-500 animate-pulse'}`} />
                      </div>
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-semibold">{doctor.name}</h3>
                          {doctor.inConsultation ? (
                            isAttendingCurrentUser(doctor) ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                                <Video className="w-3 h-3 mr-1" />
                                Em atendimento com você
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs">
                                <Video className="w-3 h-3 mr-1" />
                                Em Atendimento
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                              Online {getOnlineTime(doctor.onlineSince)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{doctor.specialization || 'Clínico Geral'}</p>
                        <p className="text-xs text-muted-foreground">CRM: {doctor.medicalLicense}</p>
                        {doctor.inConsultation && !isAttendingCurrentUser(doctor) && (
                          <p className="text-xs text-yellow-600 mt-1">Médico em videochamada — aguarde ou escolha outro</p>
                        )}
                        {isAttendingCurrentUser(doctor) && (
                          <p className="text-xs text-blue-600 mt-1">Este médico está atendendo você agora</p>
                        )}
                      </div>
                      {selectedDoctor?.id === doctor.id && (
                        <CheckCircle className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedDoctor && (
          <Card>
            <CardHeader>
              <CardTitle>Solicitar Atendimento</CardTitle>
              <CardDescription>
                Descreva o motivo e selecione o nível de urgência
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isLoggedIn ? (
                <div className="text-center py-6 space-y-4">
                  <p className="text-muted-foreground">
                    Para solicitar atendimento, é necessário estar logado.
                  </p>
                  <Button onClick={() => setLocation('/login')} size="lg">
                    Fazer Login
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Não tem conta? <a href="/register/patient" className="text-primary underline">Cadastre-se</a>
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nível de Urgência</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['normal', 'urgent', 'emergency'] as const).map((level) => {
                        const config = urgencyConfig[level];
                        const Icon = config.icon;
                        return (
                          <button
                            key={level}
                            onClick={() => setUrgencyLevel(level)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                              urgencyLevel === level 
                                ? `${config.color} border-current font-semibold`
                                : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs">{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {urgencyLevel === 'emergency' && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-2">
                        <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <strong>Em caso de risco de vida, ligue para o SAMU: 192</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-sm sm:text-base">Motivo da Consulta</Label>
                    <Textarea
                      id="reason"
                      placeholder="Descreva seus sintomas, há quanto tempo está sentindo, etc..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      data-testid="textarea-reason"
                      className="text-sm"
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={selectedDoctor.profilePicture || undefined} />
                        <AvatarFallback>
                          {selectedDoctor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          {selectedDoctor.name}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          {selectedDoctor.specialization || 'Clínico Geral'} · CRM: {selectedDoctor.medicalLicense}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      Você será atendido imediatamente após a confirmação via teleconsulta.
                    </p>
                  </div>

                  <Button
                    onClick={handleRequest}
                    disabled={requestMutation.isPending || !reason.trim()}
                    className={`w-full ${urgencyLevel === 'emergency' ? 'bg-red-600 hover:bg-red-700' : urgencyLevel === 'urgent' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                    size="lg"
                    data-testid="button-request-consultation"
                  >
                    <Video className="h-5 w-5 mr-2" />
                    {requestMutation.isPending ? 'Conectando...' : 'Entrar no Consultório Virtual'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoggedIn && !selectedDoctor && totalOnline > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Para ser atendido por um dos médicos disponíveis, faça login ou cadastre-se.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setLocation('/login')} variant="default">
                  Fazer Login
                </Button>
                <Button onClick={() => setLocation('/register/patient')} variant="outline">
                  Criar Conta
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
