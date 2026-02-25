import { useState } from "react";
import { useDeviceType } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

import { MobileDoctorDashboard } from "@/components/mobile/mobile-doctor-dashboard";
import { MobilePatientDashboard } from "@/components/mobile/mobile-patient-dashboard";
import { MobileAdminDashboard } from "@/components/mobile/mobile-admin-dashboard";
import { MobileVisitorDashboard } from "@/components/mobile/mobile-visitor-dashboard";
import { MobileResearcherDashboard } from "@/components/mobile/mobile-researcher-dashboard";

import { DesktopDoctorDashboard } from "@/components/desktop/desktop-doctor-dashboard";
import { DesktopPatientDashboard } from "@/components/desktop/desktop-patient-dashboard";
import { DesktopAdminDashboard } from "@/components/desktop/desktop-admin-dashboard";
import { DesktopVisitorDashboard } from "@/components/desktop/desktop-visitor-dashboard";
import { DesktopResearcherDashboard } from "@/components/desktop/desktop-researcher-dashboard";

import Dashboard from "@/pages/dashboard";
import { IAM3DVoiceAssistant } from "@/components/iam3d/voice-assistant";

export function ResponsiveDashboard() {
  const deviceType = useDeviceType();
  const { user } = useAuth();
  const [showIAM3D, setShowIAM3D] = useState(false);
  
  const userRole = user?.role || 'visitor';
  const openIAM3D = () => setShowIAM3D(true);
  
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