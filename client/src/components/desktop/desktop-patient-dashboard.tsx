import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, FileText, MessageCircle, Stethoscope, ClipboardList, Video, CalendarCheck, Pill } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import TodaySchedule from "@/components/dashboard/today-schedule";
import { type DashboardStats } from "@shared/schema";

interface Prescription {
  id: string;
  status: string;
  expiresAt: string;
}

export function DesktopPatientDashboard() {
  const { user } = useAuth();

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

  const hasActivePrescriptions = prescriptions?.some(p => {
    const isActive = p.status === 'active';
    const isNotExpired = new Date(p.expiresAt) >= new Date();
    return isActive && isNotExpired;
  }) || false;

  const hasRecords = (medicalRecords && medicalRecords.length > 0) || (stats && (stats.secureRecords || 0) > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Stats Cards */}
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

        {/* Quick Actions */}
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

        {/* Today's Schedule */}
        <TodaySchedule />
      </div>
    </div>
  );
}
