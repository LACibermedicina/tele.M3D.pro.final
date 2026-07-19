import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell, Wallet, Users, FileText, Settings, ChevronRight,
  Loader2, QrCode, Stethoscope, Clock, Edit, Eye
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { QRTransfer } from "@/components/wallet/qr-transfer";
import { type DashboardStats } from "@shared/schema";

interface Appointment {
  id: string;
  patient?: { name: string; profilePicture?: string; id?: string };
  type?: string;
  appointmentTime?: string;
  status: string;
}

interface Notification {
  id: string;
  read: boolean;
  message?: string;
}

interface Patient {
  id: string;
  name?: string;
}

export function MobileModeDoctor() {
  const { user } = useAuth();
  const { clearViewMode } = useViewMode();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [qrOpen, setQrOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: user?.id ? ["/api/dashboard/stats", user.id] : [],
    enabled: !!user?.id,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ["/api/tmc/balance"],
  });

  const { data: todayAppointments } = useQuery<Appointment[]>({
    queryKey: user?.id ? ["/api/appointments/today", user.id] : [],
    enabled: !!user?.id,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    retry: false,
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    retry: false,
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => {
      const res = await apiRequest("POST", "/api/doctors/status", { isOnline: online, availableForImmediate: online });
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: variables ? "Consultório Aberto" : "Consultório Fechado" });
    },
    onError: (_err, variables) => {
      setIsOnline(!variables);
    },
  });

  const handleToggleOnline = (checked: boolean) => {
    setIsOnline(checked);
    toggleOnlineMutation.mutate(checked);
  };

  const unreadNotifications = notifications?.filter((n) => !n.read)?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800">
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-primary/20">
              <AvatarImage src={user?.profilePicture || undefined} />
              <AvatarFallback data-no-translate className="bg-primary/10 text-primary font-bold">
                {user?.name?.charAt(0) || "D"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 data-no-translate className="text-base font-bold">Dr(a). {user?.name || "Médico"}</h1>
              <p className="text-xs text-muted-foreground">
                {user?.specialization || "Medicina Geral"} - Modo Mobile
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              clearViewMode();
              setLocation("/mode-selection");
            }}
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            Trocar
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Notificações</span>
            {unreadNotifications > 0 && (
              <Badge className="bg-red-500 text-white text-xs h-5">{unreadNotifications}</Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isOnline ? "Online" : "Offline"}
              </span>
              <Switch
                checked={isOnline}
                onCheckedChange={handleToggleOnline}
              />
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-lg" onClick={() => setLocation("/wallet")}>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className="text-xl font-bold">
                    {balanceLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      `${balance?.balance || 0} TM3D`
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground self-center" />
            </div>
            <div className="flex gap-2 mt-3">
              <Link href="/wallet">
                <Button size="sm" variant="outline" className="text-xs">
                  <Wallet className="w-3.5 h-3.5 mr-1" />
                  Comprar
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setQrOpen(true);
                }}
              >
                <QrCode className="w-3.5 h-3.5 mr-1" />
                Enviar/Receber
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Pacientes do Dia
              </CardTitle>
              <Link href="/patients">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Ver Todos
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {todayAppointments && todayAppointments.length > 0 ? (
              <div className="space-y-2">
                {todayAppointments.slice(0, 5).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={apt.patient?.profilePicture || undefined} />
                        <AvatarFallback data-no-translate className="text-xs">
                          {apt.patient?.name?.charAt(0) || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p data-no-translate className="text-sm font-medium truncate">
                          {apt.patient?.name || "Paciente"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {apt.appointmentTime
                            ? new Date(apt.appointmentTime).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "--:--"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {apt.patient?.id && (
                        <Link href={`/patients/${apt.patient.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}
                      <Link href={`/consultation-session/${apt.id}`}>
                        <Button size="sm" className="h-7 text-xs">
                          <Stethoscope className="w-3 h-3 mr-1" />
                          Atender
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma consulta agendada
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/records">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <FileText className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Prontuários</span>
                <span className="text-xs text-muted-foreground">
                  {stats?.secureRecords || 0} registros
                </span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/prescriptions">
            <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <Edit className="w-6 h-6 text-orange-500" />
                <span className="text-sm font-medium">Prescrições</span>
                <span className="text-xs text-muted-foreground">Editar & Aprovar</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Link href="/patients">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Todos os Pacientes</span>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalPatients || 0} pacientes registrados
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <QRTransfer open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}
