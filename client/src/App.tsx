import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import InactivityMonitor from "@/components/inactivity-monitor";
import { NavigationProvider } from "@/contexts/NavigationContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientProfile from "@/pages/patient-profile";
import Profile from "@/pages/profile";
import Schedule from "@/pages/schedule";
import WhatsApp from "@/pages/whatsapp";
import MedicalRecords from "@/pages/medical-records";
import PatientRecords from "@/pages/patient-records";
import Prescriptions from "@/pages/prescriptions";
import Analytics from "@/pages/analytics";
import AdminPage from "@/pages/admin";
import AdminPaymentsPage from "@/pages/admin-payments";
import Login from "@/pages/login";
import PatientJoin from "@/pages/patient-join";
import VideoConsultation from "@/pages/video-consultation";
import NotFound from "@/pages/not-found";
import Features from "@/pages/features";
import Documentation from "@/pages/documentation";
import RegisterSelect from "@/pages/register/index";
import PatientRegister from "@/pages/register/patient";
import DoctorRegister from "@/pages/register/doctor";
import AdminRegister from "@/pages/register/admin";
import PharmacistRegister from "@/pages/register/pharmacist";
import PharmacyDashboard from "@/pages/pharmacy";
import PharmacyReportsPage from "@/pages/pharmacy-reports";
import PatientAgenda from "@/pages/patient-agenda";
import MedicalAssistant from "@/pages/medical-assistant";
import MedicalReferences from "@/pages/medical-references";
import ConsultationRequest from "@/pages/consultation-request";
import MyConsultations from "@/pages/my-consultations";
import ConsultationSession from "@/pages/consultation-session";
import ClinicalDashboard from "@/pages/clinical-dashboard";
import DoctorAvailability from "@/pages/doctor-availability";
import DoctorReferrals from "@/pages/doctor-referrals";
import ImmediateConsultation from "@/pages/immediate-consultation";
import DoctorChat from "@/pages/doctor-chat";
import DoctorNotesPage from "@/pages/doctor-notes";
import MedicalTeams from "@/pages/medical-teams";
import TeamRoom from "@/pages/team-room";
import MedicalCafe from "@/pages/medical-cafe";
import DoctorOffice from "@/pages/doctor-office";
import CoffeeRoom from "@/pages/coffee-room";
import InterConsultationRequest from "@/pages/inter-consultation-request";
import PatientVideoConsultation from "@/pages/patient-video-consultation";
import EpidemiologicalReports from "@/pages/epidemiological-reports";
import IncompleteConsultations from "@/pages/incomplete-consultations";
import PostConsultationReview from "@/pages/post-consultation-review";
import DiagnosticReview from "@/pages/diagnostic-review";
import WalletPage from "@/pages/wallet";
import ConsultationAccess from "@/pages/consultation-access";
import Manual from "@/pages/manual";
import FAQ from "@/pages/faq";
import Installation from "@/pages/installation";
import Broker from "@/pages/broker";
import ClinicsPage from "@/pages/clinics";
import Reports from "@/pages/reports";
import FHIRDashboard from "@/pages/fhir-dashboard";
import NftManagement from "@/pages/nft-management";
import UrgentAlertOverlay from "@/components/notifications/urgent-alert-overlay";
import Header from "@/components/layout/header";
import FloatingChatbot from "@/components/ui/floating-chatbot";
import CommandPalette from "@/components/command-palette";
import QuickActionsBar from "@/components/quick-actions-bar";
import { VoiceAssistantProvider } from "@/contexts/VoiceAssistantContext";
import { LayoutSettingsProvider, useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { VoiceAssistantPrompt } from "@/components/voice-assistant-prompt";
import { VoiceAssistantOverlay } from "@/components/voice-assistant-overlay";

// Responsive Dashboard Components
import { ResponsiveDashboard } from "@/components/responsive-dashboard";

// Global shortcuts hooks
import { useGlobalShortcuts, useCommandEvents, useApplicationShortcuts } from "@/hooks/use-shortcuts";

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
  const { isCommandPaletteOpen, setIsCommandPaletteOpen } = useGlobalShortcuts();
  const { mobileMenuStyle, sidebarCollapsed } = useLayoutSettings();
  
  // Enable command events and global shortcuts
  useCommandEvents();
  useApplicationShortcuts();

  const [location] = useLocation();
  const isInVideoConsultation = location.startsWith('/consultation/video') || location.startsWith('/patient/video');

  const sidebarMargin = mobileMenuStyle === 'sidebar' && user
    ? (sidebarCollapsed ? 'md:ml-0 ml-[60px]' : 'md:ml-0 ml-64')
    : '';
  const bottomPadding = mobileMenuStyle === 'bottom' && user ? 'md:pb-0 pb-16' : '';

  return (
    <div className={`min-h-screen bg-background transition-all duration-300 ${sidebarMargin} ${bottomPadding}`}>
      {user && <UrgentAlertOverlay />}
      
      {/* Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)}
        userRole={user?.role}
      />

      {user && !isInVideoConsultation && <QuickActionsBar userRole={user.role} />}

      <Switch>
        {/* Public routes */}
        <Route path="/login">
          <Header />
          <Login />
        </Route>
        <Route path="/acesso/:code">
          <Header />
          <ConsultationAccess />
        </Route>
        <Route path="/acesso">
          <Header />
          <ConsultationAccess />
        </Route>
        <Route path="/join/:token">
          <Header />
          <PatientJoin />
        </Route>
        
        {/* Registration routes - public */}
        <Route path="/register">
          <Header />
          <RegisterSelect />
        </Route>
        <Route path="/register/patient">
          <Header />
          <PatientRegister />
        </Route>
        <Route path="/register/doctor">
          <Header />
          <DoctorRegister />
        </Route>
        <Route path="/register/admin">
          <Header />
          <AdminRegister />
        </Route>
        <Route path="/register/pharmacist">
          <Header />
          <PharmacistRegister />
        </Route>
        
        {/* Features page - public */}
        <Route path="/features">
          <Header />
          <Features />
        </Route>
        
        {/* Documentation page - public */}
        <Route path="/documentation">
          <Header />
          <Documentation />
        </Route>
        <Route path="/manual">
          <Header />
          <Manual />
        </Route>
        <Route path="/faq">
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
      
      {/* Enhanced Footer with Quick Access */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <i className="fas fa-video text-accent"></i>
                <span>Teleconsultas Ativas</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-heartbeat text-accent"></i>
                <span>Sistema de Monitoramento</span>
              </div>
              <div className="flex items-center space-x-2">
                <i className="fas fa-users-cog text-accent"></i>
                <span>Gestão Integrada</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {t("footer.copyright")}
            </div>
          </div>
        </div>
      </footer>
      
      {!isInVideoConsultation && <FloatingChatbot />}
      
      {user && !isInVideoConsultation && <QuickActionsBar userRole={user.role} />}

      {!isInVideoConsultation && <VoiceAssistantPrompt />}
      
      {!isInVideoConsultation && <VoiceAssistantOverlay />}
      
    </div>
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
          <NavigationProvider>
            <LayoutSettingsProvider>
              <VoiceAssistantProvider>
                <TooltipProvider>
                  <Toaster />
                  <InactivityMonitor />
                  <Router />
                </TooltipProvider>
              </VoiceAssistantProvider>
            </LayoutSettingsProvider>
          </NavigationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
