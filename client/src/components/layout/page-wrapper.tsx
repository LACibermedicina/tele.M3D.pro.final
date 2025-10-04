import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gradient" | "subtle" | "medical";
  medicalBg?: string;
}

export default function PageWrapper({ 
  children, 
  className = "", 
  variant = "default",
  medicalBg
}: PageWrapperProps) {
  const variants = {
    default: "bg-background",
    gradient: "bg-gradient-to-br from-background via-muted/30 to-background",
    subtle: "bg-gradient-to-b from-background to-muted/20",
    medical: "medical-page-wrapper"
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

  return (
    <div className={`min-h-screen ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
