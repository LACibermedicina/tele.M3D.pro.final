import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Stethoscope, ClipboardList, Video, CalendarCheck, Pill, Zap, Loader2, CheckCircle, Ambulance, Coins, RotateCcw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TodaySchedule from "@/components/dashboard/today-schedule";
import { type DashboardStats } from "@shared/schema";
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";

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
  consultationPrice?: number;
}

interface PricingInfo {
  urgentConsultationPrice: number;
  exchangeRate: number;
}

export function DesktopPatientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { restoreAll } = useMinimizedPanels();
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

  const { data: pricing } = useQuery<PricingInfo>({
    queryKey: ['/api/credits/pricing'],
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
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { const keys = Object.keys(localStorage).filter(k => k.startsWith("draggable_dashboard_desktop-patient_")); keys.forEach(k => localStorage.removeItem(k)); restoreAll(); window.location.reload(); }} className="text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3 mr-1" /> Reset Layout
          </Button>
        </div>

        <DraggableDashboardPanel id="dp-consultation-actions" label="Ações de Consulta" icon="zap" dashboardKey="desktop-patient">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleImmediateConsultation}
            disabled={isSearchingDoctor || immediateJoinMutation.isPending}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 p-5 group disabled:opacity-80 disabled:cursor-wait text-left"
            data-testid="button-immediate-consultation"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                {isSearchingDoctor || immediateJoinMutation.isPending ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Zap className="w-7 h-7" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">
                  {isSearchingDoctor ? "Buscando..." : "Consultar Agora"}
                </h2>
                <p className="text-white/80 text-xs mt-0.5">
                  {isSearchingDoctor
                    ? "Conectando ao médico..."
                    : "Consulta com médico disponível"
                  }
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {availableCount > 0 ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                    </span>
                    <span className="text-xs font-medium">{availableCount} médico{availableCount > 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">Ver disponíveis</Badge>
                )}
              </div>
              {(() => {
                const firstDoc = (onlineDoctors || []).find(d => d.availableForImmediate && !d.inConsultation);
                const docPrice = firstDoc?.consultationPrice;
                return docPrice && docPrice > 0 ? (
                  <Badge className="bg-white/25 text-white border-0 text-xs font-semibold">
                    <Coins className="w-3 h-3 mr-1" />
                    {docPrice} TMC
                  </Badge>
                ) : null;
              })()}
            </div>
          </button>

          <Link href="/immediate-consultation">
            <button
              className="w-full h-full rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 hover:from-red-600 hover:via-rose-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 p-5 group text-left"
              data-testid="button-urgent-care"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Ambulance className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold">Pronto Atendimento</h2>
                  <p className="text-white/80 text-xs mt-0.5">
                    Sala de espera urgente — preço fixo
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/70">Preço definido pelo administrador</span>
                <Badge className="bg-white/25 text-white border-0 text-xs font-semibold">
                  <Coins className="w-3 h-3 mr-1" />
                  {pricing?.urgentConsultationPrice ?? 30} TMC
                </Badge>
              </div>
            </button>
          </Link>
        </div>
        </DraggableDashboardPanel>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DraggableDashboardPanel id="dp-appointments" label="Minhas Consultas" icon="calendar" dashboardKey="desktop-patient">
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
            </DraggableDashboardPanel>

            <DraggableDashboardPanel id="dp-records" label="Meus Registros" icon="filetext" dashboardKey="desktop-patient">
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
            </DraggableDashboardPanel>
          </div>
        )}

        <DraggableDashboardPanel id="dp-quick-actions" label="Acesso Rápido" icon="zap" dashboardKey="desktop-patient">
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
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="dp-schedule" label="Agenda" icon="calendar" dashboardKey="desktop-patient">
          <TodaySchedule />
        </DraggableDashboardPanel>
      </div>
    </div>
  );
}
