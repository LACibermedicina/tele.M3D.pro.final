import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import InactivityMonitor from "@/components/inactivity-monitor";
import PostLoadEffects from "@/components/post-load-effects";
import { MinimizedPanelsProvider } from "@/contexts/MinimizedPanelsContext";
import MinimizedPanelDock from "@/components/layout/minimized-panel-dock";
import UnifiedToolbox from "@/components/layout/unified-toolbox";
import { onForceDisconnect } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { disconnectAllMediaServices } from "@/components/inactivity-monitor";
import { NavigationProvider } from "@/contexts/NavigationContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Seo } from "@/components/seo";
// Route pages are lazy-loaded so they are code-split into their own chunks
// instead of bloating the main entry bundle (keeps initial JS under Google's
// 2 MB rendering cap). desktop-window-layer.tsx lazy-loads the same modules,
// so Rollup can now move them out of the main chunk.
const Dashboard = lazy(() => import("@/pages/dashboard"));
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
const Login = lazy(() => import("@/pages/login"));
const PatientJoin = lazy(() => import("@/pages/patient-join"));
const VideoConsultation = lazy(() => import("@/pages/video-consultation"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Features = lazy(() => import("@/pages/features"));
const Documentation = lazy(() => import("@/pages/documentation"));
const RegisterSelect = lazy(() => import("@/pages/register/index"));
const PatientRegister = lazy(() => import("@/pages/register/patient"));
const DoctorRegister = lazy(() => import("@/pages/register/doctor"));
const AdminRegister = lazy(() => import("@/pages/register/admin"));
const PharmacistRegister = lazy(() => import("@/pages/register/pharmacist"));
const PharmacyDashboard = lazy(() => import("@/pages/pharmacy"));
const PharmacyReportsPage = lazy(() => import("@/pages/pharmacy-reports"));
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
const PatientVideoConsultation = lazy(() => import("@/pages/patient-video-consultation"));
const EpidemiologicalReports = lazy(() => import("@/pages/epidemiological-reports"));
const IncompleteConsultations = lazy(() => import("@/pages/incomplete-consultations"));
const PostConsultationReview = lazy(() => import("@/pages/post-consultation-review"));
const DiagnosticReview = lazy(() => import("@/pages/diagnostic-review"));
const WalletPage = lazy(() => import("@/pages/wallet"));
const ConsultationAccess = lazy(() => import("@/pages/consultation-access"));
const Manual = lazy(() => import("@/pages/manual"));
const FAQ = lazy(() => import("@/pages/faq"));
const Installation = lazy(() => import("@/pages/installation"));
const Broker = lazy(() => import("@/pages/broker"));
const ClinicsPage = lazy(() => import("@/pages/clinics"));
const Reports = lazy(() => import("@/pages/reports"));
const FHIRDashboard = lazy(() => import("@/pages/fhir-dashboard"));
const NftManagement = lazy(() => import("@/pages/nft-management"));
const CreditsPage = lazy(() => import("@/pages/credits"));
import UrgentAlertOverlay from "@/components/notifications/urgent-alert-overlay";
import Header from "@/components/layout/header";
import FloatingChatbot from "@/components/ui/floating-chatbot";
import FloatingECGAnalyzer from "@/components/ui/floating-ecg-analyzer";
import FloatingRadiologyAnalyzer from "@/components/ui/floating-radiology-analyzer";
import FloatingStudyNotes from "@/components/ui/floating-study-notes";
import CommandPalette from "@/components/command-palette";
import DraggableWidgetButtons from "@/components/ui/draggable-widget-buttons";
import { VoiceAssistantProvider } from "@/contexts/VoiceAssistantContext";
import { LayoutSettingsProvider, useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { VoiceAssistantPrompt } from "@/components/voice-assistant-prompt";
import { VoiceAssistantOverlay } from "@/components/voice-assistant-overlay";
import DesktopBackground from "@/components/layout/desktop-background";
import { DesktopWindowManagerProvider } from "@/contexts/DesktopWindowManagerContext";
import DesktopWindowLayer, { isWindowedRoute } from "@/components/layout/desktop-window-layer";
import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import { AccessModalityProvider, useAccessModality } from "@/contexts/AccessModalityContext";
import { AssistedLayout } from "@/components/assisted/assisted-layout";
import { ImmersiveFloatingChat } from "@/components/immersive/immersive-floating-chat";

const ModeSelection = lazy(() => import("@/pages/mode-selection"));
const ResponsiveDashboard = lazy(() => import("@/components/responsive-dashboard").then(m => ({ default: m.ResponsiveDashboard })));

import { useGlobalShortcuts, useCommandEvents, useApplicationShortcuts } from "@/hooks/use-shortcuts";

function ForceDisconnectGuard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribe = onForceDisconnect((_reason, message) => {
      disconnectAllMediaServices();
      toast({
        title: 'Sessão encerrada pelo administrador',
        description: message,
        variant: 'destructive',
      });
      setLocation('/login');
    });
    return unsubscribe;
  }, [toast, setLocation]);

  return null;
}

function RecordsRouter() {
  const { user } = useAuth();
  if (user?.role === 'patient') {
    return <PatientRecords />;
  }
  return <MedicalRecords />;
}

function Router() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { viewMode } = useViewMode();
  const { isCommandPaletteOpen, setIsCommandPaletteOpen } = useGlobalShortcuts();
  const { mobileMenuStyle, sidebarCollapsed } = useLayoutSettings();
  const { isClassic, isProfessional, isAssisted } = useAccessModality();

  useCommandEvents();
  useApplicationShortcuts();

  const [location] = useLocation();
  const isInVideoConsultation = location.startsWith('/consultation/video') || location.startsWith('/patient/video');
  const isImmersiveMode = !!user && viewMode === 'immersive';
  const isAssistedMode = !!user && isAssisted && !isInVideoConsultation;

  if (isAssistedMode) {
    return (
      <div data-modality="assisted" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
        <AssistedLayout />
      </div>
    );
  }
  // Radiology features (Proposta #5) gated to professional/assisted modalities
  const showRadiologyFeatures = !isClassic;
  // #39 floating widgets only visible when professional/assisted
  const showProfessionalWidgets = !isClassic;

  const sidebarMargin = mobileMenuStyle === 'sidebar' && user
    ? (sidebarCollapsed ? 'md:ml-0 ml-[60px]' : 'md:ml-0 ml-64')
    : '';
  const bottomPadding = mobileMenuStyle === 'bottom' && user ? 'md:pb-0 pb-16' : '';

  const isDesktopWindowed = typeof window !== "undefined" && window.innerWidth >= 768 && !!user && !isInVideoConsultation && isWindowedRoute(location);

  return (
    <>
    <DesktopBackground />
    <DesktopWindowLayer />
    {isDesktopWindowed && <Header />}
    <div className={`min-h-screen transition-all duration-300 ${sidebarMargin} ${bottomPadding} relative z-[1] md:bg-transparent bg-background desktop-env-root`}>
      {user && <UrgentAlertOverlay />}
      
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)}
        userRole={user?.role}
      />

      {!isDesktopWindowed && <div data-page-content={!isInVideoConsultation ? "" : undefined}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" /></div>}>
      <Switch>
        {/* Public routes */}
        <Route path="/login">
          <Seo page="login" />
          <Header />
          <Login />
        </Route>
        <Route path="/acesso/:code">
          <Seo page="acesso" />
          <Header />
          <ConsultationAccess />
        </Route>
        <Route path="/acesso">
          <Seo page="acesso" />
          <Header />
          <ConsultationAccess />
        </Route>
        <Route path="/join/:token">
          <Seo page="join" />
          <Header />
          <PatientJoin />
        </Route>
        
        {/* Registration routes - public */}
        <Route path="/register">
          <Seo page="register" />
          <Header />
          <RegisterSelect />
        </Route>
        <Route path="/register/patient">
          <Seo page="registerPatient" />
          <Header />
          <PatientRegister />
        </Route>
        <Route path="/register/doctor">
          <Seo page="registerDoctor" />
          <Header />
          <DoctorRegister />
        </Route>
        <Route path="/register/admin">
          <Seo page="registerAdmin" />
          <Header />
          <AdminRegister />
        </Route>
        <Route path="/register/pharmacist">
          <Seo page="registerPharmacist" />
          <Header />
          <PharmacistRegister />
        </Route>
        
        {/* Features page - public */}
        <Route path="/features">
          <Seo page="features" />
          <Header />
          <Features />
        </Route>
        
        <Route path="/mode-selection">
          <ProtectedRoute skipModeCheck>
            <Header />
            <ModeSelection />
          </ProtectedRoute>
        </Route>

        {/* Documentation page - public */}
        <Route path="/documentation">
          <Seo page="documentation" />
          <Header />
          <Documentation />
        </Route>
        <Route path="/manual">
          <Seo page="manual" />
          <Header />
          <Manual />
        </Route>
        <Route path="/faq">
          <Seo page="faq" />
          <Header />
          <FAQ />
        </Route>
        <Route path="/installation">
          <ProtectedRoute requiredRoles={['admin']}>
            <Header />
            <Installation />
          </ProtectedRoute>
        </Route>
        
        {/* Public homepage - accessible to all including visitors */}
        <Route path="/">
          <Seo page="home" />
          <Header />
          <ResponsiveDashboard />
        </Route>
        
        <Route path="/dashboard">
          <ProtectedRoute>
            <Header />
            <ResponsiveDashboard />
          </ProtectedRoute>
        </Route>
        
        <Route path="/profile">
          <ProtectedRoute>
            <Header />
            <Profile />
          </ProtectedRoute>
        </Route>
        
        <Route path="/patients/:id">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <PatientProfile />
          </ProtectedRoute>
        </Route>
        
        <Route path="/patients">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <Patients />
          </ProtectedRoute>
        </Route>
        
        <Route path="/schedule">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <Schedule />
          </ProtectedRoute>
        </Route>
        
        <Route path="/whatsapp">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <WhatsApp />
          </ProtectedRoute>
        </Route>
        
        <Route path="/records">
          <ProtectedRoute requiredRoles={['doctor', 'admin', 'patient']}>
            <Header />
            <RecordsRouter />
          </ProtectedRoute>
        </Route>
        
        <Route path="/prescriptions">
          <ProtectedRoute requiredRoles={['doctor', 'admin', 'patient']}>
            <Header />
            <Prescriptions />
          </ProtectedRoute>
        </Route>
        
        <Route path="/analytics">
          <ProtectedRoute requiredRoles={['admin']}>
            <Header />
            <Analytics />
          </ProtectedRoute>
        </Route>
        
        <Route path="/admin">
          <ProtectedRoute requiredRoles={['admin']}>
            <Header />
            <AdminPage />
          </ProtectedRoute>
        </Route>

        <Route path="/admin/payments">
          <ProtectedRoute requiredRoles={['admin']}>
            <Header />
            <AdminPaymentsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/reports">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <Reports />
          </ProtectedRoute>
        </Route>
        
        <Route path="/consultation/video/:patientId">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <VideoConsultation />
          </ProtectedRoute>
        </Route>
        
        <Route path="/patient/video/:consultationId">
          <ProtectedRoute requiredRoles={['patient']}>
            <PatientVideoConsultation />
          </ProtectedRoute>
        </Route>
        
        <Route path="/patient-agenda">
          <ProtectedRoute requiredRoles={['patient', 'admin']}>
            <Header />
            <PatientAgenda />
          </ProtectedRoute>
        </Route>
        
        <Route path="/consultation-request">
          <ProtectedRoute requiredRoles={['patient']}>
            <Header />
            <ConsultationRequest />
          </ProtectedRoute>
        </Route>
        
        <Route path="/my-consultations">
          <ProtectedRoute requiredRoles={['patient']}>
            <Header />
            <MyConsultations />
          </ProtectedRoute>
        </Route>
        
        <Route path="/consultation-session/:sessionId">
          <ProtectedRoute requiredRoles={['doctor', 'patient', 'admin']}>
            <Header />
            <ConsultationSession />
          </ProtectedRoute>
        </Route>
        
        <Route path="/post-consultation-review">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <PostConsultationReview />
          </ProtectedRoute>
        </Route>
        
        <Route path="/diagnostic-review">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DiagnosticReview />
          </ProtectedRoute>
        </Route>
        
        <Route path="/wallet">
          <ProtectedRoute requiredRoles={['doctor', 'patient', 'admin', 'researcher']}>
            <Header />
            <WalletPage />
          </ProtectedRoute>
        </Route>
        
        <Route path="/clinical-dashboard">
          <ProtectedRoute requiredRoles={['doctor', 'patient', 'admin']}>
            <Header />
            <ClinicalDashboard />
          </ProtectedRoute>
        </Route>
        
        <Route path="/assistant">
          <ProtectedRoute requiredRoles={['doctor', 'patient', 'admin']}>
            <Header />
            <MedicalAssistant />
          </ProtectedRoute>
        </Route>
        
        <Route path="/medical-references">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <MedicalReferences />
          </ProtectedRoute>
        </Route>
        
        <Route path="/doctor-availability">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DoctorAvailability />
          </ProtectedRoute>
        </Route>

        <Route path="/doctor-referrals">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DoctorReferrals />
          </ProtectedRoute>
        </Route>
        
        <Route path="/immediate-consultation">
          <Header />
          <ImmediateConsultation />
        </Route>
        
        <Route path="/doctor-notes">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DoctorNotesPage />
          </ProtectedRoute>
        </Route>
        
        <Route path="/doctor-chat">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DoctorChat />
          </ProtectedRoute>
        </Route>
        
        <Route path="/medical-teams">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <MedicalTeams />
          </ProtectedRoute>
        </Route>
        
        <Route path="/team-room/:id">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <TeamRoom />
          </ProtectedRoute>
        </Route>
        
        <Route path="/medical-cafe">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <MedicalCafe />
          </ProtectedRoute>
        </Route>
        
        <Route path="/doctor-office">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <DoctorOffice />
          </ProtectedRoute>
        </Route>
        
        <Route path="/coffee-room">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <CoffeeRoom />
          </ProtectedRoute>
        </Route>

        <Route path="/inter-consultation">
          <ProtectedRoute requiredRoles={['doctor']}>
            <Header />
            <InterConsultationRequest />
          </ProtectedRoute>
        </Route>

        <Route path="/epidemiological-reports">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <EpidemiologicalReports />
          </ProtectedRoute>
        </Route>

        <Route path="/incomplete-consultations">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <IncompleteConsultations />
          </ProtectedRoute>
        </Route>

        <Route path="/nft-management">
          <ProtectedRoute requiredRoles={['doctor', 'admin', 'researcher']}>
            <Header />
            <NftManagement />
          </ProtectedRoute>
        </Route>

        <Route path="/pharmacy/reports">
          <ProtectedRoute requiredRoles={['pharmacist', 'admin']}>
            <Header />
            <PharmacyReportsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/pharmacy">
          <ProtectedRoute requiredRoles={['pharmacist', 'admin']}>
            <Header />
            <PharmacyDashboard />
          </ProtectedRoute>
        </Route>

        <Route path="/broker">
          <ProtectedRoute>
            <Header />
            <Broker />
          </ProtectedRoute>
        </Route>

        <Route path="/credits">
          <ProtectedRoute>
            <Header />
            <CreditsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/clinics">
          <ProtectedRoute>
            <Header />
            <ClinicsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/fhir-dashboard">
          <ProtectedRoute requiredRoles={['doctor', 'admin']}>
            <Header />
            <FHIRDashboard />
          </ProtectedRoute>
        </Route>
        
        <Route>
          <Header />
          <NotFound />
        </Route>
      </Switch>
      </Suspense>
      </div>}
      
      <footer className={`desktop-glass-footer ${isDesktopWindowed || isImmersiveMode ? "hidden" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="text-center text-sm text-muted-foreground">
            {t("footer.copyright")}
          </div>
        </div>
      </footer>
      
      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && <FloatingChatbot />}
      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && showRadiologyFeatures && <FloatingRadiologyAnalyzer />}
      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && showProfessionalWidgets && <FloatingECGAnalyzer />}
      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && showProfessionalWidgets && <FloatingStudyNotes />}

      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && showProfessionalWidgets && <DraggableWidgetButtons />}

      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && <VoiceAssistantPrompt />}

      {!isInVideoConsultation && !isImmersiveMode && !isAssistedMode && <VoiceAssistantOverlay />}

      {isImmersiveMode && location !== '/' && location !== '/dashboard' && <ImmersiveFloatingChat />}


    </div>
    </>
  );
}

import { Component, ErrorInfo, ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React Error Boundary caught:", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="text-center max-w-md space-y-4">
            <h2 className="text-xl font-bold text-red-600">Erro na aplicação</h2>
            <p className="text-sm text-gray-600">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ViewModeProvider>
            <AccessModalityProvider>
            <NavigationProvider>
              <LayoutSettingsProvider>
                <VoiceAssistantProvider>
                  <MinimizedPanelsProvider>
                    <DesktopWindowManagerProvider>
                      <TooltipProvider>
                        <Toaster />
                        <InactivityMonitor />
                        <ForceDisconnectGuard />
                        <PostLoadEffects />
                        <MinimizedPanelDock />
                        <UnifiedToolbox />
                        <Router />
                      </TooltipProvider>
                    </DesktopWindowManagerProvider>
                  </MinimizedPanelsProvider>
                </VoiceAssistantProvider>
              </LayoutSettingsProvider>
            </NavigationProvider>
            </AccessModalityProvider>
          </ViewModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
