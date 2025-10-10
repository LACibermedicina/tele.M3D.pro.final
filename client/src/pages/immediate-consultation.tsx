import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, User, Stethoscope, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLocation } from "wouter";
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
}

export default function ImmediateConsultation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [reason, setReason] = useState("");

  // Fetch online doctors
  const { data: onlineDoctors, isLoading } = useQuery<Doctor[]>({
    queryKey: ['/api/doctors/online'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Request immediate consultation mutation - joins doctor's open office
  const requestMutation = useMutation({
    mutationFn: async (data: { doctorId: string; reason: string }) => {
      // Join doctor's office directly
      const res = await apiRequest('POST', `/api/doctor-office/join/${data.doctorId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Entrando no Consultório!",
        description: "Conectando à sala de vídeo do médico...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Redirect to video consultation with the consultation ID
      setTimeout(() => {
        setLocation(`/consultation/video/${data.consultationId}`);
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

  // Sort doctors: on-duty first, then by online time
  const sortedDoctors = onlineDoctors?.slice().sort((a, b) => {
    const aOnDuty = isOnDuty(a);
    const bOnDuty = isOnDuty(b);
    
    if (aOnDuty && !bOnDuty) return -1;
    if (!aOnDuty && bOnDuty) return 1;
    
    // If both on-duty or both not, sort by online time
    const aTime = a.onlineSince ? new Date(a.onlineSince).getTime() : 0;
    const bTime = b.onlineSince ? new Date(b.onlineSince).getTime() : 0;
    return aTime - bTime; // Earlier online time first
  });

  if (!user || user.role !== 'patient') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Acesso restrito a pacientes
              </p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Atendimento Imediato</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Solicite uma consulta com médicos disponíveis agora
        </p>
      </div>

      {/* Available Doctors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Médicos Disponíveis Agora
          </CardTitle>
          <CardDescription>
            Médicos online e disponíveis para atendimento imediato
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-2 animate-spin opacity-50" />
              <p className="text-muted-foreground">Procurando médicos disponíveis...</p>
            </div>
          ) : !sortedDoctors || sortedDoctors.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-yellow-600" />
              <p className="text-muted-foreground font-medium">Nenhum médico disponível no momento</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente novamente em alguns minutos ou agende uma consulta
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {sortedDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                    selectedDoctor?.id === doctor.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedDoctor(doctor)}
                  data-testid={`doctor-card-${doctor.id}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
                      <AvatarImage src={doctor.profilePicture || undefined} />
                      <AvatarFallback>
                        {doctor.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-semibold">{doctor.name}</h3>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                          Online {getOnlineTime(doctor.onlineSince)}
                        </Badge>
                        {isOnDuty(doctor) && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Plantão 24h
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{doctor.specialization || 'Clínico Geral'}</p>
                      <p className="text-xs text-muted-foreground">CRM: {doctor.medicalLicense}</p>
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

      {/* Request Form */}
      {selectedDoctor && (
        <Card>
          <CardHeader>
            <CardTitle>Descreva o Motivo da Consulta</CardTitle>
            <CardDescription>
              Explique brevemente o que você está sentindo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm sm:text-base">Motivo da Consulta</Label>
              <Textarea
                id="reason"
                placeholder="Descreva seus sintomas, há quanto tempo está sentindo, etc..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                data-testid="textarea-reason"
                className="text-sm"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Médico selecionado:</strong> {selectedDoctor.name}
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Você será atendido imediatamente após a confirmação.
              </p>
            </div>

            <Button
              onClick={handleRequest}
              disabled={requestMutation.isPending || !reason.trim()}
              className="w-full"
              size="lg"
              data-testid="button-request-consultation"
            >
              <Clock className="h-5 w-5 mr-2" />
              {requestMutation.isPending ? 'Agendando...' : 'Solicitar Atendimento Imediato'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </PageWrapper>
  );
}
