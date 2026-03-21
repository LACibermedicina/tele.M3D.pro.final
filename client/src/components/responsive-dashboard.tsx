import { useState, useEffect } from "react";
import { useDeviceType } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useLocation } from "wouter";

import { MobileDoctorDashboard } from "@/components/mobile/mobile-doctor-dashboard";
import { MobilePatientDashboard } from "@/components/mobile/mobile-patient-dashboard";
import { MobileAdminDashboard } from "@/components/mobile/mobile-admin-dashboard";
import { MobileVisitorDashboard } from "@/components/mobile/mobile-visitor-dashboard";
import { MobileResearcherDashboard } from "@/components/mobile/mobile-researcher-dashboard";

import { MobileModePatient } from "@/components/mobile/mobile-mode-patient";
import { MobileModeDoctor } from "@/components/mobile/mobile-mode-doctor";

import { DesktopDoctorDashboard } from "@/components/desktop/desktop-doctor-dashboard";
import { DesktopPatientDashboard } from "@/components/desktop/desktop-patient-dashboard";
import { DesktopAdminDashboard } from "@/components/desktop/desktop-admin-dashboard";
import { DesktopVisitorDashboard } from "@/components/desktop/desktop-visitor-dashboard";
import { DesktopResearcherDashboard } from "@/components/desktop/desktop-researcher-dashboard";

import { ImmersiveLayout } from "@/components/immersive/immersive-layout";

import Dashboard from "@/pages/dashboard";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";

export function ResponsiveDashboard() {
  const deviceType = useDeviceType();
  const { user } = useAuth();
  const { viewMode, hasChosenMode } = useViewMode();
  const [, setLocation] = useLocation();
  const [showIAM3D, setShowIAM3D] = useState(false);
  
  const userRole = user?.role || 'visitor';
  const openIAM3D = () => setShowIAM3D(true);

  useEffect(() => {
    if (user && !hasChosenMode) {
      setLocation("/mode-selection");
    }
  }, [user, hasChosenMode, setLocation]);

  if (user && !hasChosenMode) {
    return null;
  }

  if (user && viewMode === 'immersive') {
    return <ImmersiveLayout />;
  }

  if (user && viewMode === 'mobile') {
    switch (userRole) {
      case 'doctor':
        return <MobileModeDoctor />;
      case 'patient':
        return <MobileModePatient />;
      case 'admin':
        return <MobileAdminDashboard />;
      case 'researcher':
        return <MobileResearcherDashboard />;
      case 'visitor':
        return <MobileVisitorDashboard onOpenIAM3D={openIAM3D} />;
      default:
        return <MobileVisitorDashboard onOpenIAM3D={openIAM3D} />;
    }
  }

  if (user && viewMode === 'desktop') {
    switch (userRole) {
      case 'admin':
        return <DesktopAdminDashboard />;
      case 'doctor':
        return <DesktopDoctorDashboard />;
      case 'patient':
        return <DesktopPatientDashboard />;
      case 'researcher':
        return <DesktopResearcherDashboard />;
      default:
        return <DesktopVisitorDashboard />;
    }
  }

  if (deviceType === 'mobile') {
    return (
      <>
        {userRole === 'admin' && <MobileAdminDashboard />}
        {userRole === 'doctor' && <MobileDoctorDashboard />}
        {userRole === 'patient' && <MobilePatientDashboard onOpenIAM3D={openIAM3D} />}
        {(userRole === 'visitor' || !['admin', 'doctor', 'patient', 'researcher'].includes(userRole)) && <MobileVisitorDashboard onOpenIAM3D={openIAM3D} />}
        {userRole === 'researcher' && <MobileResearcherDashboard />}
        <IAM3DVoiceAssistant isOpen={showIAM3D} onClose={() => setShowIAM3D(false)} />
      </>
    );
  }
  
  if (deviceType === 'desktop' || deviceType === 'tablet') {
    switch (userRole) {
      case 'admin':
        return <DesktopAdminDashboard />;
      case 'doctor':
        return <DesktopDoctorDashboard />;
      case 'patient':
        return <DesktopPatientDashboard />;
      case 'visitor':
        return <DesktopVisitorDashboard />;
      case 'researcher':
        return <DesktopResearcherDashboard />;
      default:
        return <DesktopVisitorDashboard />;
    }
  }
  
  return <Dashboard />;
}
