import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Stethoscope, ClipboardList, Video, CalendarCheck, Pill, Zap, Loader2, CheckCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TodaySchedule from "@/components/dashboard/today-schedule";
import { type DashboardStats } from "@shared/schema";

interface Prescription {
  id: string;
  status: string;
  expiresAt: string;
}

interface OnlineDoctor {
  id: string;
  name: string;
  specialization: string;
  availableForImmediate: boolean;
  inConsultation?: boolean;
}

export function DesktopPatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSearchingDoctor, setIsSearchingDoctor] = useState(false);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: user?.id ? ['/api/dashboard/stats', user.id] : [],
    enabled: !!user?.id,
  });

  const { data: prescriptions } = useQuery<Prescription[]>({
    queryKey: ['/api/prescriptions/recent'],
    select: (data) => data || [],
  });

  const { data: medicalRecords } = useQuery<any[]>({
    queryKey: ['/api/medical-records/my'],
    select: (data) => data || [],
  });

  const { data: onlineDoctors } = useQuery<OnlineDoctor[]>({
    queryKey: ['/api/doctors/online'],
    refetchInterval: 15000,
  });

  const immediateJoinMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const res = await apiRequest('POST', `/api/doctor-office/join/${doctorId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setIsSearchingDoctor(false);
      if (!data?.consultationId) {
        toast({
          title: "Erro",
          description: "Resposta inválida do servidor. Redirecionando para sala de espera...",
          variant: "destructive",
        });
        setTimeout(() => setLocation('/immediate-consultation'), 500);
        return;
      }
      toast({
        title: "Médico encontrado!",
        description: "Conectando à sala de vídeo...",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setTimeout(() => {
        setLocation(`/patient/video/${data.consultationId}`);
      }, 1000);
    },
    onError: (error: any) => {
      setIsSearchingDoctor(false);
      toast({
        title: "Erro",
        description: error.message || "Nenhum médico disponível no momento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleImmediateConsultation = () => {
    const availableDoctors = (onlineDoctors || []).filter(
      d => d.availableForImmediate && !d.inConsultation
    );

    if (availableDoctors.length === 0) {
      setLocation('/immediate-consultation');
      return;
    }

    setIsSearchingDoctor(true);
    const selectedDoctor = availableDoctors[0];
    immediateJoinMutation.mutate(selectedDoctor.id);
  };

  const hasActivePrescriptions = prescriptions?.some(p => {
    const isActive = p.status === 'active';
    const isNotExpired = new Date(p.expiresAt) >= new Date();
    return isActive && isNotExpired;
  }) || false;

  const hasRecords = (medicalRecords && medicalRecords.length > 0) || (stats && (stats.secureRecords || 0) > 0);

  const availableCount = (onlineDoctors || []).filter(d => d.availableForImmediate && !d.inConsultation).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <button
          onClick={handleImmediateConsultation}
          disabled={isSearchingDoctor || immediateJoinMutation.isPending}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 p-6 group disabled:opacity-80 disabled:cursor-wait"
          data-testid="button-immediate-consultation"
        >
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              {isSearchingDoctor || immediateJoinMutation.isPending ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Zap className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-xl font-bold">
                {isSearchingDoctor ? "Buscando médico disponível..." : "Consultar Agora"}
              </h2>
              <p className="text-white/80 text-sm mt-1">
                {isSearchingDoctor
                  ? "Conectando ao primeiro médico disponível..."
                  : "Atendimento imediato com médico disponível online"
                }
              </p>
            </div>
            <div className="text-right shrink-0">
              {availableCount > 0 ? (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                  </span>
                  <span className="text-sm font-semibold">{availableCount} médico{availableCount > 1 ? 's' : ''}</span>
                </div>
              ) : (
                <Badge className="bg-white/20 text-white border-0 text-xs">Ver disponíveis</Badge>
              )}
            </div>
          </div>
        </button>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-my-appointments">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Minhas Consultas</p>
                    <p className="text-2xl font-bold" data-testid="text-my-appointments">
                      {stats.todayConsultations || 0}
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-my-records">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {hasRecords ? 'Meus Registros' : 'Minhas Solicitações'}
                    </p>
                    <p className="text-2xl font-bold" data-testid="text-my-records">
                      {hasRecords ? (stats.secureRecords || 0) : (stats.todayConsultations || 0)}
                    </p>
                  </div>
                  {hasRecords ? (
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <ClipboardList className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Acesso Rápido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/consultation-request">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2 bg-medical-primary hover:bg-medical-primary/90"
                data-testid="button-consultation-request"
              >
                <Stethoscope className="w-6 h-6" />
                <span className="font-medium">Solicitar Consulta</span>
              </Button>
            </Link>

            <Link href="/immediate-consultation">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-waiting-room"
              >
                <Video className="w-6 h-6" />
                <span className="font-medium">Sala de Espera</span>
              </Button>
            </Link>

            <Link href="/my-consultations">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-my-consultations"
              >
                <CalendarCheck className="w-6 h-6" />
                <span className="font-medium">Minhas Consultas</span>
              </Button>
            </Link>

            <Link href="/records">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-records"
              >
                {hasRecords ? (
                  <FileText className="w-6 h-6" />
                ) : (
                  <ClipboardList className="w-6 h-6" />
                )}
                <span className="font-medium">
                  {hasRecords ? 'Meu Prontuário' : 'Minhas Solicitações'}
                </span>
              </Button>
            </Link>

            <Link href="/patient-agenda">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-agenda"
              >
                <Calendar className="w-6 h-6" />
                <span className="font-medium">Minha Agenda</span>
              </Button>
            </Link>

            {hasActivePrescriptions && (
              <Link href="/prescriptions">
                <Button
                  className="w-full h-24 flex flex-col items-center justify-center gap-2"
                  variant="outline"
                  data-testid="button-prescriptions"
                >
                  <Pill className="w-6 h-6" />
                  <span className="font-medium">Minhas Prescrições</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        <TodaySchedule />
      </div>
    </div>
  );
}
