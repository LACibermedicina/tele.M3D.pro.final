import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Video,
  Calendar,
  FileText,
  Phone,
  Stethoscope,
  Pill,
  Brain,
  Zap,
  Clock,
  ChevronRight,
  Ambulance,
  Coins,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";

interface ConsultationsData {
  upcoming: any[];
  past: any[];
  videoHistory: any[];
  activeVideoConsultations: any[];
  total: number;
}

interface WalletData {
  balance: number;
  balanceInReais: number;
}

interface MobilePatientDashboardProps {
  onOpenIAM3D?: () => void;
}

export function MobilePatientDashboard({ onOpenIAM3D }: MobilePatientDashboardProps) {
  const { restoreAll } = useMinimizedPanels();
  const { user } = useAuth();

  const { data: consultations } = useQuery<ConsultationsData>({
    queryKey: ['/api/my-consultations'],
    retry: false,
  });

  const { data: wallet } = useQuery<WalletData>({
    queryKey: ['/api/credits/balance'],
  });

  const { data: pricing } = useQuery<{ urgentConsultationPrice: number }>({
    queryKey: ['/api/credits/pricing'],
  });

  const upcomingCount = consultations?.upcoming?.length ?? 0;
  const videoHistoryCount = consultations?.videoHistory?.length ?? 0;
  const upcomingList = consultations?.upcoming ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary/5 to-medical-secondary/5 flex flex-col">
      <div className="px-4 py-4 space-y-4 flex-1">

        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-medical-primary/20">
            <AvatarImage src={user?.profilePicture || undefined} />
            <AvatarFallback className="bg-medical-primary/10 text-medical-primary text-base font-bold">
              {user?.name?.charAt(0) || 'P'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{user?.name || "Paciente"}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] h-5">Verificado</Badge>
              <span>{wallet?.balance ?? 0} TM3D</span>
            </div>
          </div>
          <div className="flex gap-2 text-center">
            <div className="px-2">
              <div className="text-lg font-bold text-medical-primary">{upcomingCount}</div>
              <div className="text-[10px] text-muted-foreground">Próximas</div>
            </div>
            <div className="px-2">
              <div className="text-lg font-bold text-medical-secondary">{videoHistoryCount}</div>
              <div className="text-[10px] text-muted-foreground">Histórico</div>
            </div>
          </div>
        </div>

        <DraggableDashboardPanel id="patient-actions" label="Ações" icon="zap" dashboardKey="mobile-patient">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/consultation-request">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white cursor-pointer hover:shadow-xl transition-shadow h-full" data-testid="button-consult-now">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold leading-tight">Consultar Agora</h2>
                </div>
                <p className="text-white/80 text-[10px]">Médico disponível</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/immediate-consultation">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-red-500 to-rose-600 text-white cursor-pointer hover:shadow-xl transition-shadow h-full" data-testid="button-urgent-care">
              <CardContent className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Ambulance className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold leading-tight">Pronto Atendimento</h2>
                </div>
                <div className="flex items-center gap-1">
                  <Coins className="w-3 h-3 text-white/80" />
                  <span className="text-[10px] text-white/80">{pricing?.urgentConsultationPrice ?? 30} TMC</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="patient-nav" label="Navegação" icon="layout" dashboardKey="mobile-patient">
        <div className="space-y-1">
          <Link href="/consultation-request">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" data-testid="button-consultation-request">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Solicitar Consulta</span>
                <p className="text-xs text-muted-foreground">Agendar ou triagem por sintomas</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>

          <Link href="/my-consultations">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors" data-testid="button-my-consultations">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Minhas Consultas</span>
                <p className="text-xs text-muted-foreground">Agendadas e histórico</p>
              </div>
              {upcomingCount > 0 && <Badge className="bg-purple-500 text-white text-[10px] h-5">{upcomingCount}</Badge>}
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>

          <Link href="/records">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors" data-testid="button-records">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Prontuários</span>
                <p className="text-xs text-muted-foreground">Registros médicos</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>

          <Link href="/prescriptions">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors" data-testid="button-prescriptions">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
                <Pill className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Prescrições</span>
                <p className="text-xs text-muted-foreground">Medicamentos e receitas</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </Link>

          <div
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
            data-testid="button-iam3d-assistant"
            onClick={onOpenIAM3D}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">Assistente IAM3D</span>
              <p className="text-xs text-muted-foreground">Triagem e orientações por IA</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </div>
        </DraggableDashboardPanel>

        {upcomingList.length > 0 && (
          <Card className="shadow-md">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-medical-primary" />
                  Próximas Consultas
                </h2>
                <Badge variant="secondary" className="text-[10px] h-5">{upcomingCount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-3">
              {upcomingList.slice(0, 3).map((appointment: any) => (
                <div key={appointment.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {appointment.doctorName || `Consulta #${appointment.id}`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {appointment.scheduledDate
                        ? new Date(appointment.scheduledDate).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })
                        : appointment.date || ""}
                    </p>
                  </div>
                  {appointment.status === 'in_progress' && (
                    <Link href={`/consultation-session/${appointment.id}`}>
                      <Button size="sm" className="h-7 text-xs" data-testid={`button-join-${appointment.id}`}>
                        Entrar
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      </div>

      <div className="px-4 pb-4">
        <a href="tel:192" className="block">
          <Button
            size="sm"
            className="w-full h-11 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md"
            data-testid="button-emergency"
          >
            <Phone className="w-4 h-4 mr-2" />
            <span className="font-bold text-sm">192 SAMU</span>
            <span className="text-xs opacity-90 ml-1">- Emergência 24h</span>
          </Button>
        </a>
      </div>
    </div>
  );
}
