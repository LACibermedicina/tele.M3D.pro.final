import { ReactNode } from "react";
import AnimatedOrigamiBackground from "@/components/ui/animated-origami-background";
import FloatingOrigamiShapes from "@/components/ui/floating-origami-shapes";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gradient" | "subtle" | "medical" | "origami" | "admin";
  medicalBg?: string;
  enableOrigamiShapes?: boolean;
  origamiImage?: string;
}

export default function PageWrapper({ 
  children, 
  className = "", 
  variant = "default",
  medicalBg,
  enableOrigamiShapes = false,
  origamiImage
}: PageWrapperProps) {
  const variants: Record<string, string> = {
    default: "bg-background",
    gradient: "bg-gradient-to-br from-background via-muted/30 to-background",
    subtle: "bg-gradient-to-b from-background to-muted/20",
    medical: "medical-page-wrapper",
    origami: "relative overflow-hidden",
    admin: "relative overflow-hidden"
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

  if (variant === "admin") {
    return (
      <div className={`min-h-screen ${variants[variant]} ${className}`}>
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(99,102,241,0.4) 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/3 blur-[80px]" />
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </div>
    );
  }

  if (variant === "origami") {
    return (
      <div className={`min-h-screen ${variants[variant]} ${className}`}>
        <AnimatedOrigamiBackground />
        {origamiImage && (
          <div 
            className="fixed inset-0 pointer-events-none z-[2]"
            style={{
              backgroundImage: `url(${origamiImage})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.06,
              mixBlendMode: 'multiply'
            }}
          />
        )}
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
