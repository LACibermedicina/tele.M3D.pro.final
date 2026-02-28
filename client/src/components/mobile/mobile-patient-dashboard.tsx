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
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"

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
  const { user } = useAuth();

  const { data: consultations } = useQuery<ConsultationsData>({
    queryKey: ['/api/my-consultations'],
  });

  const { data: wallet } = useQuery<WalletData>({
    queryKey: ['/api/wallet/balance'],
  });

  const upcomingCount = consultations?.upcoming?.length ?? 0;
  const videoHistoryCount = consultations?.videoHistory?.length ?? 0;
  const upcomingList = consultations?.upcoming ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary/5 to-medical-secondary/5 px-4 py-6 space-y-6">

      <Card className="border-0 shadow-lg bg-gradient-to-r from-medical-secondary to-medical-accent text-white">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <Avatar className="w-16 h-16 border-2 border-white/20">
              <AvatarImage src={user?.profilePicture || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-lg">
                {user?.name?.charAt(0) || 'P'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{user?.name || "Paciente"}</h1>
              <p className="text-white/90 text-sm capitalize">{user?.role || "paciente"}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className="bg-white/20 text-white">Verificado</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{upcomingCount}</div>
              <div className="text-white/80 text-xs">Próximas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{videoHistoryCount}</div>
              <div className="text-white/80 text-xs">Histórico</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{wallet?.balance ?? 0}</div>
              <div className="text-white/80 text-xs">TM3D</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/consultation-request">
          <Button
            size="lg"
            className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg"
            data-testid="button-consultation-request"
          >
            <Stethoscope className="w-6 h-6" />
            <span className="text-sm font-medium">Solicitar Consulta</span>
          </Button>
        </Link>

        <Link href="/immediate-consultation">
          <Button
            size="lg"
            className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg"
            data-testid="button-waiting-room"
          >
            <Video className="w-6 h-6" />
            <span className="text-sm font-medium">Sala de Espera</span>
          </Button>
        </Link>

        <Link href="/my-consultations">
          <Button
            size="lg"
            className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg"
            data-testid="button-my-consultations"
          >
            <Calendar className="w-6 h-6" />
            <span className="text-sm font-medium">Minhas Consultas</span>
          </Button>
        </Link>

        <Link href="/records">
          <Button
            size="lg"
            className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg"
            data-testid="button-records"
          >
            <FileText className="w-6 h-6" />
            <span className="text-sm font-medium">Prontuários</span>
          </Button>
        </Link>

        <Link href="/prescriptions">
          <Button
            size="lg"
            className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg"
            data-testid="button-prescriptions"
          >
            <Pill className="w-6 h-6" />
            <span className="text-sm font-medium">Prescrições</span>
          </Button>
        </Link>

        <Button
          size="lg"
          className="w-full h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg"
          data-testid="button-iam3d-assistant"
          onClick={onOpenIAM3D}
        >
          <Brain className="w-6 h-6" />
          <span className="text-sm font-medium">Assistente IAM3D</span>
        </Button>
      </div>

      {upcomingList.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-medical-primary" />
                Próximas Consultas
              </h2>
              <Badge variant="secondary">{upcomingCount} agendadas</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingList.map((appointment: any) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex-1">
                  <h3 className="font-medium text-sm">
                    {appointment.doctorName || `Consulta #${appointment.id}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {appointment.specialty || appointment.type || "Consulta"}
                  </p>
                  <p className="text-xs text-medical-primary mt-1">
                    {appointment.scheduledDate
                      ? new Date(appointment.scheduledDate).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })
                      : appointment.date || ""}
                  </p>
                </div>
                {appointment.status === 'in_progress' && (
                  <Link href={`/consultation-session/${appointment.id}`}>
                    <Button size="sm" data-testid={`button-join-${appointment.id}`}>
                      Entrar
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 border-red-200">
        <CardContent className="p-4">
          <a href="tel:192" className="block">
            <Button
              size="lg"
              className="w-full h-16 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:from-red-600 hover:to-red-700"
              data-testid="button-emergency"
            >
              <Phone className="w-6 h-6 mr-2" />
              <div className="text-left">
                <div className="font-bold">192 SAMU</div>
                <div className="text-sm opacity-90">Emergência 24h</div>
              </div>
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
