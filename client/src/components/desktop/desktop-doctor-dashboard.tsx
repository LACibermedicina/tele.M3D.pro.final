import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar, Users, FileText, Link2, Copy, CheckCircle, Loader2, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TodaySchedule from "@/components/dashboard/today-schedule";
import { type DashboardStats } from "@shared/schema";
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";

export function DesktopDoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { restoreAll } = useMinimizedPanels();
  const [tempAccessOpen, setTempAccessOpen] = useState(false);
  const [generatedAccess, setGeneratedAccess] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: user?.id ? ['/api/dashboard/stats', user.id] : [],
    enabled: !!user?.id,
  });

  const generateTempAccessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/temporary-access/generate', {});
      return await res.json();
    },
    onSuccess: (data) => {
      setGeneratedAccess(data);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  async function copyAccessLink() {
    if (!generatedAccess) return;
    try {
      await navigator.clipboard.writeText(generatedAccess.accessLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { const keys = Object.keys(localStorage).filter(k => k.startsWith("draggable_dashboard_desktop-doctor_")); keys.forEach(k => localStorage.removeItem(k)); restoreAll(); window.location.reload(); }} className="text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3 mr-1" /> Reset Layout
          </Button>
        </div>
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DraggableDashboardPanel id="dd-consultations" label="Consultas Hoje" icon="calendar" dashboardKey="desktop-doctor">
              <Link href="/schedule">
                <Card data-testid="card-today-appointments" className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Consultas Hoje</p>
                        <p className="text-2xl font-bold" data-testid="text-today-appointments">
                          {stats.todayConsultations || 0}
                        </p>
                      </div>
                      <Calendar className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </DraggableDashboardPanel>

            <DraggableDashboardPanel id="dd-patients" label="Meus Pacientes" icon="users" dashboardKey="desktop-doctor">
              <Link href="/patients">
                <Card data-testid="card-my-patients" className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Meus Pacientes</p>
                        <p className="text-2xl font-bold" data-testid="text-my-patients">
                          {stats.totalPatients || 0}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </DraggableDashboardPanel>

            <DraggableDashboardPanel id="dd-records" label="Prontuários" icon="filetext" dashboardKey="desktop-doctor">
              <Link href="/records">
                <Card data-testid="card-records" className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Prontuários</p>
                        <p className="text-2xl font-bold" data-testid="text-records">
                          {stats.secureRecords || 0}
                        </p>
                      </div>
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </DraggableDashboardPanel>
          </div>
        )}

        <DraggableDashboardPanel id="dd-quick-actions" label="Acesso Rápido" icon="zap" dashboardKey="desktop-doctor">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Acesso Rápido</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link href="/schedule">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2 bg-medical-primary hover:bg-medical-primary/90"
                data-testid="button-schedule"
              >
                <Calendar className="w-6 h-6" />
                <span className="font-medium">Agenda</span>
              </Button>
            </Link>

            <Link href="/patients">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-patients"
              >
                <Users className="w-6 h-6" />
                <span className="font-medium">Pacientes</span>
              </Button>
            </Link>

            <Link href="/records">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-records"
              >
                <FileText className="w-6 h-6" />
                <span className="font-medium">Prontuários</span>
              </Button>
            </Link>

            <Link href="/prescriptions">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-prescriptions"
              >
                <i className="fas fa-prescription text-2xl"></i>
                <span className="font-medium">Prescrições</span>
              </Button>
            </Link>

            <Link href="/whatsapp">
              <Button
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                variant="outline"
                data-testid="button-whatsapp"
              >
                <i className="fab fa-whatsapp text-2xl"></i>
                <span className="font-medium">WhatsApp</span>
              </Button>
            </Link>

            <Button
              className="w-full h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
              variant="outline"
              onClick={() => { setTempAccessOpen(true); setGeneratedAccess(null); setCopied(false); }}
              data-testid="button-temp-access"
            >
              <Link2 className="w-6 h-6" />
              <span className="font-medium text-xs text-center leading-tight">Gerar Link de Acesso Temporário</span>
            </Button>
          </div>
        </div>
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="dd-schedule" label="Agenda" icon="calendar" dashboardKey="desktop-doctor">
          <TodaySchedule />
        </DraggableDashboardPanel>
      </div>

      <Dialog open={tempAccessOpen} onOpenChange={setTempAccessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-600" />
              Link de Acesso Temporário
            </DialogTitle>
            <DialogDescription>
              Gere um link para que visitantes acessem a Sala de Espera sem login. O link expira em 2 horas.
            </DialogDescription>
          </DialogHeader>

          {!generatedAccess ? (
            <div className="space-y-4 pt-2">
              <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium text-indigo-700 dark:text-indigo-300">Sobre o link temporário:</p>
                <ul className="text-indigo-600 dark:text-indigo-400 space-y-1 text-xs">
                  <li>• O visitante poderá ver os médicos disponíveis na Sala de Espera</li>
                  <li>• Para solicitar atendimento, precisará fazer login ou criar conta</li>
                  <li>• O link expira automaticamente em 2 horas após a geração</li>
                  <li>• É um acesso de visualização — não permite consulta sem autenticação</li>
                </ul>
              </div>
              <Button
                onClick={() => generateTempAccessMutation.mutate()}
                disabled={generateTempAccessMutation.isPending}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {generateTempAccessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Gerar Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Link de acesso</label>
                <div className="flex gap-2">
                  <Input value={generatedAccess.accessLink} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={copyAccessLink}>
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Válido por {generatedAccess.expiryHours}h — até {new Date(generatedAccess.expiresAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · Gerado por {generatedAccess.generatedBy}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
