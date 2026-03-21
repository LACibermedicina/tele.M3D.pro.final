import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-admin";
import { LayoutDashboard, Users, CalendarClock, MessageCircle, FileText, ClipboardList, BrainCircuit, BookOpenCheck, Menu, Settings, User, Lock, Shield, Headphones, Ambulance, Plus, AlertTriangle, Pill, Clock3, Coffee, Monitor } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";
import telemedLogo from "@/assets/logo-fundo.png";

interface SidebarProps {
  className?: string;
}

// Navigation items will be generated inside the component using translations

// Quick actions will be generated inside the component using translations

function SwitchModeButton() {
  const { clearViewMode } = useViewMode();
  const [, setLocation] = useLocation();
  return (
    <div className="border-t border-border px-4 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          clearViewMode();
          setLocation("/mode-selection");
        }}
      >
        <Monitor className="w-3.5 h-3.5 mr-2" />
        Trocar modalidade
      </Button>
    </div>
  );
}

function SidebarContent() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const isPatient = user?.role === 'patient';
  const isDoctor = user?.role === 'doctor';

  const allNavItems = [
    {
      path: "/dashboard",
      label: t("navigation.dashboard"),
      icon: LayoutDashboard,
      description: t("dashboard.title"),
      roles: ['doctor', 'admin', 'patient', 'researcher'],
    },
    {
      path: "/patients",
      label: t("navigation.patients"),
      icon: Users,
      description: t("patients.title"),
      roles: ['doctor', 'admin'],
    },
    {
      path: isDoctor ? "/doctor-availability" : "/schedule",
      label: isDoctor ? "Disponibilidade" : t("navigation.schedule"),
      icon: isDoctor ? Clock3 : CalendarClock,
      description: isDoctor ? "Gerencie seus horários e plantões" : t("appointments.title"),
      roles: ['doctor', 'admin', 'patient'],
    },
    {
      path: "/my-consultations",
      label: "Minhas Consultas",
      icon: FileText,
      description: "Histórico e consultas agendadas",
      roles: ['patient'],
    },
    {
      path: "/immediate-consultation",
      label: "Sala de Espera",
      icon: Headphones,
      description: "Consulta imediata com médico online",
      roles: ['patient', 'visitor'],
    },
    {
      path: "/consultation-request",
      label: "Solicitar Consulta",
      icon: Ambulance,
      description: "Triagem e solicitação de consulta",
      roles: ['patient'],
    },
    {
      path: "/whatsapp",
      label: t("navigation.whatsapp"),
      icon: MessageCircle,
      description: t("telemedicine.secure_messaging"),
      roles: ['doctor', 'admin'],
    },
    {
      path: "/records",
      label: isPatient ? "Meus Registros" : t("navigation.records"),
      icon: FileText,
      description: t("medical.medical_record"),
      roles: ['doctor', 'admin', 'patient'],
    },
    {
      path: "/prescriptions",
      label: isPatient ? "Minhas Prescrições" : t("navigation.prescriptions"),
      icon: ClipboardList,
      description: t("medical.prescriptions"),
      roles: ['doctor', 'admin', 'patient'],
    },
    {
      path: "/ai-assistant",
      label: isAdmin ? t("navigation.ai_assistant") : t("navigation.assistant_neutral", "Assistente Clínico"),
      icon: BrainCircuit,
      description: isAdmin ? t("medical.ai_assistant_desc") : t("medical.assistant_desc_neutral", "Assistente Clínico"),
      roles: ['doctor', 'admin', 'researcher'],
    },
    {
      path: "/medical-references",
      label: t("navigation.medical_references"),
      icon: BookOpenCheck,
      description: t("medical.knowledge_base"),
      roles: ['doctor', 'admin', 'researcher'],
    },
    {
      path: "/inter-consultation",
      label: "Interconsulta",
      icon: Ambulance,
      description: "Solicitar parecer de outro especialista",
      roles: ['doctor'],
    },
    {
      path: "/medical-teams",
      label: "Equipes Médicas",
      icon: Users,
      description: "Salas de reunião e colaboração médica",
      roles: ['doctor', 'admin'],
    },
    {
      path: "/medical-cafe",
      label: "Cafeteria Médica",
      icon: Coffee,
      description: "Canal público para médicos - suporte e socialização",
      roles: ['doctor', 'admin'],
    },
    {
      path: "/pharmacy",
      label: "Painel Farmácia",
      icon: Pill,
      description: "Gestão de prescrições e dispensação",
      roles: ['pharmacist', 'admin'],
    },
  ];

  const navItems = allNavItems.filter(item => !user?.role || item.roles.includes(user.role));

  const quickActions = [
    {
      label: t("dashboard.new_appointment"),
      icon: Plus,
      action: "new-appointment",
      color: "bg-primary text-primary-foreground"
    },
    {
      label: t("medical.emergency"),
      icon: AlertTriangle,
      action: "emergency",
      color: "bg-destructive text-destructive-foreground"
    },
    {
      label: t("medical.prescription_digital"),
      icon: Pill,
      action: "prescription",
      color: "bg-secondary text-secondary-foreground"
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Modern Logo and Brand */}
      <div className="flex items-center space-x-4 p-6 border-b border-border">
        <div className="w-12 h-12 flex items-center justify-center">
          <img 
            src={telemedLogo} 
            alt={t("app.logo_alt")} 
            className="w-full h-full object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-medical-primary bg-clip-text text-transparent">
            {t("app.name")}
          </h2>
          <p className="text-xs text-muted-foreground font-medium">{t("app.subtitle")}</p>
        </div>
      </div>

      {/* Support and Emergency Access */}
      <div className="px-6 py-3 space-y-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30 transition-colors"
          data-testid="sidebar-support"
        >
          <Headphones className="mr-2 h-4 w-4" />
          {t("support.contact")}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs font-semibold text-destructive hover:bg-destructive/10 border-destructive/30 transition-colors"
          data-testid="sidebar-emergency"
        >
          <Ambulance className="mr-2 h-4 w-4" />
          {t("medical.emergency")}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("navigation.dashboard")}
          </h3>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`nav-item flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    location === item.path || (location === "/" && item.path === "/dashboard")
                      ? "active bg-gradient-to-r from-primary to-medical-primary text-white shadow-md"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                  data-testid={`sidebar-nav-${item.path.slice(1) || 'dashboard'}`}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1">
                    <div>{item.label}</div>
                    <div className="text-xs opacity-80">{item.description}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("dashboard.quick_actions")}
          </h3>
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={action.action}
                variant="outline"
                size="sm"
                className="w-full justify-start h-12 rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                data-testid={`sidebar-action-${action.action}`}
              >
                <ActionIcon className="mr-3 h-4 w-4 text-primary" />
                <span className="text-left font-medium">{action.label}</span>
              </Button>
            );
          })}
        </div>

        {/* AI Status */}
        <div className="space-y-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("dashboard.system_status")}
          </h3>
          <div className="px-3 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-medium">{t("dashboard.support_system")}</span>
              </div>
              <Badge className="success-badge text-xs px-3 py-1">{t("dashboard.status_active")}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-medium">{t("navigation.whatsapp")}</span>
              </div>
              <Badge className="success-badge text-xs px-3 py-1">{t("dashboard.status_online")}</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full shadow-sm"></div>
                <span className="text-sm font-medium">{t("dashboard.database")}</span>
              </div>
              <Badge className="success-badge text-xs px-3 py-1">{t("dashboard.status_connected")}</Badge>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Modern User Info */}
      <div className="border-t border-border p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}>
            <User className="text-white h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" data-testid="sidebar-user-name">{user?.name || t("user.guest")}</p>
            {user?.medicalLicense && (
              <p className="text-xs text-muted-foreground font-medium">{t("user.crm")}: {user.medicalLicense}</p>
            )}
            {!user?.medicalLicense && user?.role && (
              <p className="text-xs text-muted-foreground font-medium">{t(`user.role_${user.role}`)}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl hover:bg-primary/10" data-testid="sidebar-user-menu">
            <Settings className="text-primary h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Modern Security Footer */}
      <SwitchModeButton />
      <div className="border-t border-border p-4">
        <div className="space-y-3 text-xs">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-security-gradient/10 border border-accent/20">
            <Lock className="text-accent h-4 w-4" />
            <span className="font-medium text-muted-foreground">{t("security.encryption")}</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-security-gradient/10 border border-accent/20">
            <Shield className="text-accent h-4 w-4" />
            <span className="font-medium text-muted-foreground">{t("security.iso_cert")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ className }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 md:hidden"
            data-testid="sidebar-trigger-mobile"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className={`w-80 border-r border-border bg-card ${className}`} data-testid="sidebar-desktop">
      <SidebarContent />
    </div>
  );
}
