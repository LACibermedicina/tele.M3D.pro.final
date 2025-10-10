import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Stethoscope, Calendar, FileText, Shield, Users, Clock, DollarSign, Star } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { type DashboardStats } from "@shared/schema"

interface Patient {
  id: string;
  name: string;
  type: string;
  time: string;
  status: string;
  profilePicture?: string;
}

interface Appointment {
  id: string;
  patient?: {
    name: string;
    profilePicture?: string;
  };
  type?: string;
  appointmentTime?: string;
  status: string;
}

interface TMCStats {
  todayEarnings: number;
  totalCredits: number;
  consultationRate: number;
}

export function MobileDoctorDashboard() {
  const { user } = useAuth();
  
  // Fetch real dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: user?.id ? ['/api/dashboard/stats', user.id] : [],
    enabled: !!user?.id,
  });

  // Fetch today's appointments for next patients
  const { data: todayAppointments } = useQuery<Appointment[]>({
    queryKey: user?.id ? ['/api/appointments/today', user.id] : [],
    enabled: !!user?.id,
  });

  const tmcStats: TMCStats = {
    todayEarnings: 2450,
    totalCredits: user?.tmcCredits || 0,
    consultationRate: 150
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary/5 to-medical-secondary/5 px-4 py-6 space-y-6">
      
      {/* Doctor Profile Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-medical-primary to-medical-secondary text-white">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <Avatar className="w-16 h-16 border-2 border-white/20">
              <AvatarImage src={user?.profilePicture || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-lg">
                {user?.name?.charAt(0) || 'D'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{user?.name}</h1>
              <p className="text-white/90 text-sm">
                {user?.specialization || 'Medicina Geral'} {user?.medicalLicense ? `• CRM: ${user.medicalLicense}` : ''}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                <span className="text-sm">
                  {stats?.todayConsultations ? `${stats.todayConsultations} consultas hoje` : 'Nenhuma consulta hoje'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Today's Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats?.todayConsultations || 0}</div>
              <div className="text-white/80 text-xs">Hoje</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {todayAppointments ? todayAppointments.filter((apt) => apt.status === 'pending').length : 0}
              </div>
              <div className="text-white/80 text-xs">Pendentes</div>
            </div>
            <div className="text-center">
              <Badge className="bg-green-500 text-white">
                Online
              </Badge>
              <div className="text-white/80 text-xs mt-1">Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          size="lg" 
          className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-medical-primary to-blue-600 text-white shadow-lg"
          data-testid="button-start-consultation"
        >
          <Stethoscope className="w-6 h-6" />
          <span className="text-sm font-medium">Iniciar Consulta</span>
        </Button>
        
        <Button 
          size="lg" 
          variant="outline"
          className="h-20 flex flex-col items-center justify-center space-y-2 border-medical-primary text-medical-primary hover:bg-medical-primary/10 shadow-lg"
          data-testid="button-prescribe"
        >
          <FileText className="w-6 h-6" />
          <span className="text-sm font-medium">Prescrever</span>
        </Button>
        
        <Button 
          size="lg" 
          variant="outline"
          className="h-20 flex flex-col items-center justify-center space-y-2 border-medical-secondary text-medical-secondary hover:bg-medical-secondary/10 shadow-lg"
          data-testid="button-schedule"
        >
          <Calendar className="w-6 h-6" />
          <span className="text-sm font-medium">Agenda</span>
        </Button>
        
        <Button 
          size="lg" 
          variant="outline"
          className="h-20 flex flex-col items-center justify-center space-y-2 border-medical-accent text-medical-accent hover:bg-medical-accent/10 shadow-lg"
          data-testid="button-digital-sign"
        >
          <Shield className="w-6 h-6" />
          <span className="text-sm font-medium">Assinar</span>
        </Button>
      </div>

      {/* Next Patients */}
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
              <Users className="w-5 h-5 mr-2 text-medical-primary" />
              Próximos Pacientes
            </h2>
            <Badge variant="secondary">{todayAppointments?.length || 0} hoje</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayAppointments && todayAppointments.length > 0 ? (
            todayAppointments.slice(0, 3).map((appointment: any, index: number) => (
            <div key={appointment.id}>
              <div className="flex items-center space-x-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={appointment.patient?.profilePicture || undefined} />
                  <AvatarFallback>{appointment.patient?.name?.charAt(0) || 'P'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium">{appointment.patient?.name || 'Paciente'}</h3>
                  <p className="text-sm text-muted-foreground">{appointment.type || 'Consulta'}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="w-3 h-3 text-medical-primary" />
                    <span className="text-sm text-medical-primary font-medium">
                      {appointment.appointmentTime ? new Date(appointment.appointmentTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                    <Badge 
                      variant={appointment.status === "confirmed" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {appointment.status === 'confirmed' ? 'Confirmado' : appointment.status === 'pending' ? 'Pendente' : 'Concluído'}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" data-testid={`button-attend-${appointment.id}`}>
                  Atender
                </Button>
              </div>
              {index < todayAppointments.length - 1 && index < 2 && <Separator className="mt-4" />}
            </div>
          ))
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhuma consulta agendada para hoje</p>
          )}
        </CardContent>
      </Card>

      {/* TMC Earnings */}
      <Card className="shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold flex items-center text-green-800">
            <DollarSign className="w-5 h-5 mr-2" />
            Ganhos TMC
          </h2>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-green-700">{tmcStats.todayEarnings.toLocaleString()} TMC</div>
            <div className="text-green-600">≈ R$ {tmcStats.totalCredits.toFixed(2)} hoje</div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-700">Por consulta</span>
              <span className="font-medium">{tmcStats.consultationRate} TMC</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="sm" className="text-green-700 border-green-300">
                Sacar
              </Button>
              <Button variant="outline" size="sm" className="text-green-700 border-green-300">
                Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Status */}
      <Card className="shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold flex items-center text-blue-800">
            <Shield className="w-5 h-5 mr-2" />
            Segurança Médica
          </h2>
          <Badge className="w-fit bg-green-100 text-green-800">Ativa</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-blue-800">Certificado Digital</h3>
            <p className="text-sm text-blue-600">Válido até: 15/12/2025</p>
            <p className="text-xs text-muted-foreground">ICP-Brasil A3</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-medium text-blue-800">Autenticação Biométrica</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="text-xs">Digital</Badge>
                <Badge className="text-xs bg-green-100 text-green-800">Ativa</Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">Facial</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className="text-xs bg-green-100 text-green-800">Ativa</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}