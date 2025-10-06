import { ReactNode } from "react";
import AnimatedOrigamiBackground from "@/components/ui/animated-origami-background";
import FloatingOrigamiShapes from "@/components/ui/floating-origami-shapes";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gradient" | "subtle" | "medical" | "origami";
  medicalBg?: string;
  enableOrigamiShapes?: boolean;
}

export default function PageWrapper({ 
  children, 
  className = "", 
  variant = "default",
  medicalBg,
  enableOrigamiShapes = false
}: PageWrapperProps) {
  const variants = {
    default: "bg-background",
    gradient: "bg-gradient-to-br from-background via-muted/30 to-background",
    subtle: "bg-gradient-to-b from-background to-muted/20",
    medical: "medical-page-wrapper",
    origami: "relative overflow-hidden"
  };

  if (variant === "medical") {
    return (
      <div className={`min-h-screen ${variants[variant]} ${className}`}>
        <div className="medical-bg-container">
          {medicalBg && (
            <img 
              src={medicalBg} 
              alt="" 
              className="medical-bg-image"
            />
          )}
          <div className="medical-bg-overlay" />
          <div className="medical-particles">
            <div className="particle"></div>
            <div className="particle"></div>
            <div className="particle"></div>
            <div className="particle"></div>
            <div className="particle"></div>
          </div>
        </div>
        <div className="medical-content">
          {children}
        </div>
      </div>
    );
  }

  if (variant === "origami") {
    return (
      <div className={`min-h-screen ${variants[variant]} ${className}`}>
        <AnimatedOrigamiBackground />
        {enableOrigamiShapes && <FloatingOrigamiShapes />}
        {/* Camada adicional de contraste */}
        <div 
          className="fixed inset-0 pointer-events-none z-[5]" 
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 100%)'
          }}
        />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${variants[variant]} ${className}`}>
      {enableOrigamiShapes && <FloatingOrigamiShapes />}
      {children}
    </div>
  );
}
