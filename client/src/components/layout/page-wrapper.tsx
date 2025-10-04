import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "gradient" | "subtle";
}

export default function PageWrapper({ 
  children, 
  className = "", 
  variant = "default" 
}: PageWrapperProps) {
  const variants = {
    default: "bg-background",
    gradient: "bg-gradient-to-br from-background via-muted/30 to-background",
    subtle: "bg-gradient-to-b from-background to-muted/20"
  };

  return (
    <div className={`min-h-screen ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
