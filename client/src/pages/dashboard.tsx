import TodaySchedule from "@/components/dashboard/today-schedule";
import WhatsAppIntegration from "@/components/dashboard/whatsapp-integration";
import PatientQuickInfo from "@/components/dashboard/patient-quick-info";
import AIClinicalAssistant from "@/components/dashboard/ai-clinical-assistant";
import DigitalSignature from "@/components/dashboard/digital-signature";
import MedicalCollaborators from "@/components/dashboard/medical-collaborators";
import ExamResults from "@/components/dashboard/exam-results";
import RealTimeStatus from "@/components/dashboard/real-time-status";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { type DashboardStats } from "@shared/schema";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { restoreAll } = useMinimizedPanels();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: user?.id ? ['/api/dashboard/stats', user.id] : ['dashboard-stats-placeholder'],
    enabled: !!user?.id,
  });

  if (statsLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>;
  }

  const resetLayout = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("draggable_dashboard_main_"));
    keys.forEach(k => localStorage.removeItem(k));
    restoreAll();
    window.location.reload();
  };

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={resetLayout} className="text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3 mr-1" /> Reset Layout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DraggableDashboardPanel id="stats-consultations" label="Consultas Hoje" icon="calendar" dashboardKey="main">
          <div className="medical-card p-6" data-testid="card-today-consultations">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.today_appointments")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-today-consultations">
                  {stats?.todayConsultations || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <i className="fas fa-calendar-day text-lg text-muted-foreground"></i>
              </div>
            </div>
          </div>
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="stats-whatsapp" label="WhatsApp" icon="message" dashboardKey="main">
          <div className="medical-card p-6" data-testid="card-whatsapp-messages">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.whatsapp_messages")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-whatsapp-messages">
                  {stats?.whatsappMessages || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <i className="fab fa-whatsapp text-lg text-muted-foreground"></i>
              </div>
            </div>
          </div>
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="stats-ai" label="IA Agendamento" icon="brain" dashboardKey="main">
          <div className="medical-card p-6" data-testid="card-ai-scheduling">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.ai_scheduling")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-ai-scheduling">
                  {stats?.aiScheduling || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <i className="fas fa-robot text-lg text-muted-foreground"></i>
              </div>
            </div>
          </div>
        </DraggableDashboardPanel>

        <DraggableDashboardPanel id="stats-records" label="Prontuários" icon="shield" dashboardKey="main">
          <div className="medical-card p-6" data-testid="card-secure-records">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("dashboard.secure_records")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="text-secure-records">
                  {stats?.secureRecords || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                <i className="fas fa-shield-alt text-lg text-muted-foreground"></i>
              </div>
            </div>
          </div>
        </DraggableDashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <DraggableDashboardPanel id="schedule" label="Agenda" icon="calendar" dashboardKey="main">
            <TodaySchedule />
          </DraggableDashboardPanel>
          <DraggableDashboardPanel id="whatsapp" label="WhatsApp" icon="message" dashboardKey="main">
            <WhatsAppIntegration />
          </DraggableDashboardPanel>
        </div>

        <div className="space-y-6">
          <DraggableDashboardPanel id="realtime" label="Status em Tempo Real" icon="activity" dashboardKey="main">
            <RealTimeStatus />
          </DraggableDashboardPanel>
          <DraggableDashboardPanel id="patient-info" label="Info Paciente" icon="users" dashboardKey="main">
            <PatientQuickInfo />
          </DraggableDashboardPanel>
          <DraggableDashboardPanel id="ai-assistant" label="Assistente IA" icon="brain" dashboardKey="main">
            <AIClinicalAssistant />
          </DraggableDashboardPanel>
          <DraggableDashboardPanel id="signature" label="Assinatura Digital" icon="shield" dashboardKey="main">
            <DigitalSignature />
          </DraggableDashboardPanel>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <DraggableDashboardPanel id="collaborators" label="Colaboradores" icon="users" dashboardKey="main">
          <MedicalCollaborators />
        </DraggableDashboardPanel>
        <DraggableDashboardPanel id="exams" label="Exames" icon="flask" dashboardKey="main">
          <ExamResults />
        </DraggableDashboardPanel>
      </div>
    </div>
    </PageWrapper>
  );
}
