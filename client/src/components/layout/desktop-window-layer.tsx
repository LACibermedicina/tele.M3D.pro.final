import { useEffect, useRef, lazy, Suspense, type ComponentType } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useDesktopWindowManager } from "@/contexts/DesktopWindowManagerContext";
import DesktopWindowComponent from "./desktop-window";
import DesktopHome from "@/components/desktop-home";
import {
  LayoutDashboard, Users, CalendarClock, MessageCircle, FileText,
  ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield,
  Stethoscope, StickyNote, Video, Pill, Activity, AlertCircle,
  Microscope, Wallet, FileBarChart, Gem, TrendingUp, Coffee,
  HeartPulse, CreditCard, UserPlus, Home, User, Briefcase,
  Building2, type LucideIcon
} from "lucide-react";

interface WindowRoute {
  path: string;
  title: string;
  icon: LucideIcon;
  roles?: string[];
  isPublic?: boolean;
  paramRoute?: boolean;
  component: ComponentType;
}

const Dashboard = lazy(() => import("@/pages/dashboard"));
const ResponsiveDashboard = lazy(() => import("@/components/responsive-dashboard").then(m => ({ default: m.ResponsiveDashboard })));
const Patients = lazy(() => import("@/pages/patients"));
const PatientProfile = lazy(() => import("@/pages/patient-profile"));
const Profile = lazy(() => import("@/pages/profile"));
const Schedule = lazy(() => import("@/pages/schedule"));
const WhatsApp = lazy(() => import("@/pages/whatsapp"));
const MedicalRecords = lazy(() => import("@/pages/medical-records"));
const PatientRecords = lazy(() => import("@/pages/patient-records"));
const Prescriptions = lazy(() => import("@/pages/prescriptions"));
const Analytics = lazy(() => import("@/pages/analytics"));
const AdminPage = lazy(() => import("@/pages/admin"));
const AdminPaymentsPage = lazy(() => import("@/pages/admin-payments"));
const PatientAgenda = lazy(() => import("@/pages/patient-agenda"));
const MedicalAssistant = lazy(() => import("@/pages/medical-assistant"));
const MedicalReferences = lazy(() => import("@/pages/medical-references"));
const ConsultationRequest = lazy(() => import("@/pages/consultation-request"));
const MyConsultations = lazy(() => import("@/pages/my-consultations"));
const ConsultationSession = lazy(() => import("@/pages/consultation-session"));
const ClinicalDashboard = lazy(() => import("@/pages/clinical-dashboard"));
const DoctorAvailability = lazy(() => import("@/pages/doctor-availability"));
const DoctorReferrals = lazy(() => import("@/pages/doctor-referrals"));
const ImmediateConsultation = lazy(() => import("@/pages/immediate-consultation"));
const DoctorChat = lazy(() => import("@/pages/doctor-chat"));
const DoctorNotesPage = lazy(() => import("@/pages/doctor-notes"));
const MedicalTeams = lazy(() => import("@/pages/medical-teams"));
const TeamRoom = lazy(() => import("@/pages/team-room"));
const MedicalCafe = lazy(() => import("@/pages/medical-cafe"));
const DoctorOffice = lazy(() => import("@/pages/doctor-office"));
const CoffeeRoom = lazy(() => import("@/pages/coffee-room"));
const InterConsultationRequest = lazy(() => import("@/pages/inter-consultation-request"));
const EpidemiologicalReports = lazy(() => import("@/pages/epidemiological-reports"));
const IncompleteConsultations = lazy(() => import("@/pages/incomplete-consultations"));
const PostConsultationReview = lazy(() => import("@/pages/post-consultation-review"));
const DiagnosticReview = lazy(() => import("@/pages/diagnostic-review"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const Reports = lazy(() => import("@/pages/reports"));
const FHIRDashboard = lazy(() => import("@/pages/fhir-dashboard"));
const NftManagement = lazy(() => import("@/pages/nft-management"));
const Broker = lazy(() => import("@/pages/broker"));
const CreditsPage = lazy(() => import("@/pages/credits"));
const ClinicsPage = lazy(() => import("@/pages/clinics"));
const PharmacyDashboard = lazy(() => import("@/pages/pharmacy"));
const PharmacyReportsPage = lazy(() => import("@/pages/pharmacy-reports"));

function RecordsRouter() {
  const { user } = useAuth();
  return user?.role === "patient" ? (
    <Suspense fallback={<WindowLoader />}><PatientRecords /></Suspense>
  ) : (
    <Suspense fallback={<WindowLoader />}><MedicalRecords /></Suspense>
  );
}

function WindowLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );
}

const WINDOW_ROUTES: WindowRoute[] = [
  { path: "/dashboard", title: "Dashboard", icon: LayoutDashboard, roles: ["admin", "doctor", "patient"], component: ResponsiveDashboard },
  { path: "/", title: "Dashboard", icon: LayoutDashboard, isPublic: true, component: ResponsiveDashboard },
  { path: "/profile", title: "Perfil", icon: User, component: Profile },
  { path: "/patients", title: "Pacientes", icon: Users, roles: ["doctor", "admin"], component: Patients },
  { path: "/schedule", title: "Agenda", icon: CalendarClock, roles: ["doctor", "admin"], component: Schedule },
  { path: "/whatsapp", title: "WhatsApp IA", icon: MessageCircle, roles: ["doctor", "admin"], component: WhatsApp },
  { path: "/records", title: "Prontuários", icon: FileText, roles: ["doctor", "admin", "patient"], component: RecordsRouter },
  { path: "/prescriptions", title: "Prescrições", icon: ClipboardList, roles: ["doctor", "admin", "patient"], component: Prescriptions },
  { path: "/analytics", title: "Analytics", icon: BarChart3, roles: ["admin"], component: Analytics },
  { path: "/admin", title: "Administração", icon: Shield, roles: ["admin"], component: AdminPage },
  { path: "/admin/payments", title: "Pagamentos", icon: CreditCard, roles: ["admin"], component: AdminPaymentsPage },
  { path: "/reports", title: "Relatórios", icon: FileBarChart, roles: ["doctor", "admin"], component: Reports },
  { path: "/patient-agenda", title: "Minha Agenda", icon: CalendarClock, roles: ["patient", "admin"], component: PatientAgenda },
  { path: "/consultation-request", title: "Solicitar Consulta", icon: Stethoscope, roles: ["patient"], component: ConsultationRequest },
  { path: "/my-consultations", title: "Minhas Consultas", icon: CalendarClock, roles: ["patient"], component: MyConsultations },
  { path: "/clinical-dashboard", title: "Dashboard Clínico", icon: HeartPulse, roles: ["doctor", "patient", "admin"], component: ClinicalDashboard },
  { path: "/assistant", title: "Assistente IA", icon: BrainCircuit, roles: ["doctor", "patient", "admin"], component: MedicalAssistant },
  { path: "/medical-references", title: "Referências Médicas", icon: BookOpenCheck, roles: ["doctor", "admin"], component: MedicalReferences },
  { path: "/doctor-availability", title: "Disponibilidade", icon: CalendarClock, roles: ["doctor"], component: DoctorAvailability },
  { path: "/doctor-referrals", title: "Indicações", icon: UserPlus, roles: ["doctor"], component: DoctorReferrals },
  { path: "/immediate-consultation", title: "Sala de Espera", icon: Video, isPublic: true, component: ImmediateConsultation },
  { path: "/doctor-notes", title: "Anotações", icon: StickyNote, roles: ["doctor"], component: DoctorNotesPage },
  { path: "/doctor-chat", title: "Chat Médico", icon: MessageCircle, roles: ["doctor"], component: DoctorChat },
  { path: "/medical-teams", title: "Equipes Médicas", icon: Users, roles: ["doctor"], component: MedicalTeams },
  { path: "/medical-cafe", title: "Café Virtual", icon: Coffee, roles: ["doctor"], component: MedicalCafe },
  { path: "/doctor-office", title: "Consultório", icon: Briefcase, roles: ["doctor"], component: DoctorOffice },
  { path: "/coffee-room", title: "Cafeteria", icon: Coffee, roles: ["doctor"], component: CoffeeRoom },
  { path: "/inter-consultation", title: "Interconsulta", icon: Stethoscope, roles: ["doctor"], component: InterConsultationRequest },
  { path: "/epidemiological-reports", title: "Epidemiologia", icon: Activity, roles: ["doctor", "admin"], component: EpidemiologicalReports },
  { path: "/incomplete-consultations", title: "Pendências", icon: AlertCircle, roles: ["doctor", "admin"], component: IncompleteConsultations },
  { path: "/post-consultation-review", title: "Revisão Pós-Consulta", icon: ClipboardList, roles: ["doctor"], component: PostConsultationReview },
  { path: "/diagnostic-review", title: "Inferências Diagnósticas", icon: Microscope, roles: ["doctor"], component: DiagnosticReview },
  { path: "/wallet", title: "Carteira Digital", icon: Wallet, roles: ["doctor", "patient", "admin", "researcher"], component: WalletPage },
  { path: "/nft-management", title: "NFTs", icon: Gem, roles: ["admin", "doctor", "researcher"], component: NftManagement },
  { path: "/broker", title: "Broker", icon: TrendingUp, component: Broker },
  { path: "/credits", title: "Créditos", icon: CreditCard, component: CreditsPage },
  { path: "/clinics", title: "Clínicas", icon: Building2, component: ClinicsPage },
  { path: "/fhir-dashboard", title: "Análise de Estudos", icon: HeartPulse, roles: ["doctor", "admin"], component: FHIRDashboard },
  { path: "/pharmacy", title: "Farmácia", icon: Pill, roles: ["pharmacist", "admin"], component: PharmacyDashboard },
  { path: "/pharmacy/reports", title: "Relatórios Farmácia", icon: FileBarChart, roles: ["pharmacist", "admin"], component: PharmacyReportsPage },
];

const PARAM_ROUTES: { pattern: RegExp; routePattern: string; getTitle: (path: string) => string; icon: LucideIcon; roles?: string[]; component: ComponentType }[] = [
  { pattern: /^\/patients\/\d+/, routePattern: "/patients/:id", getTitle: () => "Perfil do Paciente", icon: Users, roles: ["doctor", "admin"], component: PatientProfile },
  { pattern: /^\/consultation-session\//, routePattern: "/consultation-session/:sessionId", getTitle: () => "Sessão de Consulta", icon: Stethoscope, roles: ["doctor", "patient", "admin"], component: ConsultationSession },
  { pattern: /^\/team-room\//, routePattern: "/team-room/:id", getTitle: () => "Sala de Equipe", icon: Users, roles: ["doctor"], component: TeamRoom },
];

const EXCLUDED_PATHS = [
  "/login", "/register", "/acesso", "/join", "/features", "/documentation",
  "/manual", "/faq", "/installation", "/consultation/video", "/patient/video",
];

function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATHS.some(ep => path === ep || path.startsWith(ep + "/"));
}

export function useDesktopNavigation() {
  const { toggleWindow, isDesktopMode } = useDesktopWindowManager();
  const { user } = useAuth();

  return {
    navigateToWindow: (path: string) => {
      if (!isDesktopMode || !user) return false;
      if (isExcludedPath(path)) return false;

      const staticRoute = WINDOW_ROUTES.find(r => r.path === path);
      if (staticRoute) {
        toggleWindow({
          id: `win-${path}`,
          title: staticRoute.title,
          icon: staticRoute.icon,
          route: path,
        });
        return true;
      }

      const paramRoute = PARAM_ROUTES.find(r => r.pattern.test(path));
      if (paramRoute) {
        toggleWindow({
          id: `win-${path}`,
          title: paramRoute.getTitle(path),
          icon: paramRoute.icon,
          route: path,
        });
        return true;
      }

      return false;
    },
    isDesktopMode: isDesktopMode && !!user,
  };
}

export default function DesktopWindowLayer() {
  const { windows, openWindow, seedClosedWindow, isDesktopMode } = useDesktopWindowManager();
  const { user } = useAuth();
  const [location] = useLocation();
  const lastLocationRef = useRef(location);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isDesktopMode || !user) return;

    if (!initializedRef.current) {
      initializedRef.current = true;

      seedClosedWindow({
        id: "win-/dashboard",
        title: "Dashboard",
        icon: LayoutDashboard,
        route: "/dashboard",
        size: { w: 900, h: 600 },
      });

      if (location !== "/" && !isExcludedPath(location)) {
        const route = WINDOW_ROUTES.find(r => r.path === location);
        const paramRoute = PARAM_ROUTES.find(r => r.pattern.test(location));
        if (route) {
          openWindow({ id: `win-${location}`, title: route.title, icon: route.icon, route: location });
        } else if (paramRoute) {
          openWindow({ id: `win-${location}`, title: paramRoute.getTitle(location), icon: paramRoute.icon, route: location });
        }
      }
      return;
    }

    if (location !== lastLocationRef.current) {
      lastLocationRef.current = location;
      if (isExcludedPath(location)) return;

      const route = WINDOW_ROUTES.find(r => r.path === location);
      const paramRoute = PARAM_ROUTES.find(r => r.pattern.test(location));
      if (route) {
        openWindow({ id: `win-${location}`, title: route.title, icon: route.icon, route: location });
      } else if (paramRoute) {
        openWindow({ id: `win-${location}`, title: paramRoute.getTitle(location), icon: paramRoute.icon, route: location });
      }
    }
  }, [location, isDesktopMode, user, openWindow]);

  if (!isDesktopMode || !user) return null;
  if (isExcludedPath(location)) return null;

  const openWindows = windows.filter(w => w.state === "open");

  return (
    <div className="fixed inset-0 z-[2] pointer-events-none" style={{ bottom: 56 }}>
      {openWindows.map(win => {
        const content = getWindowContent(win.route, user.role);
        if (!content) return null;
        return (
          <div key={win.id} className="pointer-events-auto">
            <DesktopWindowComponent windowData={win}>
              <Suspense fallback={<WindowLoader />}>
                {content}
              </Suspense>
            </DesktopWindowComponent>
          </div>
        );
      })}
    </div>
  );
}

function hasAccess(roles: string[] | undefined, userRole: string): boolean {
  if (!roles) return true;
  return roles.includes(userRole);
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <p className="text-sm text-white/50">Acesso não autorizado</p>
    </div>
  );
}

function getWindowContent(route: string, userRole: string) {
  if (route === "home") return <DesktopHome />;

  const staticRoute = WINDOW_ROUTES.find(r => r.path === route);
  if (staticRoute) {
    if (!hasAccess(staticRoute.roles, userRole)) return <AccessDenied />;
    const Comp = staticRoute.component;
    return <Comp />;
  }

  const paramRoute = PARAM_ROUTES.find(r => r.pattern.test(route));
  if (paramRoute) {
    if (!hasAccess(paramRoute.roles, userRole)) return <AccessDenied />;
    const Comp = paramRoute.component;
    return <Comp />;
  }

  return null;
}

function isWindowedRoute(path: string): boolean {
  if (path === "/" || path === "") return true;
  if (WINDOW_ROUTES.some(r => r.path === path)) return true;
  if (PARAM_ROUTES.some(r => r.pattern.test(path))) return true;
  return false;
}

export { WINDOW_ROUTES, PARAM_ROUTES, isExcludedPath, isWindowedRoute };
