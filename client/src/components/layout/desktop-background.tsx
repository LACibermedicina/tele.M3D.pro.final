import { useState, useEffect } from "react";
import telemedLogo from "@/assets/logo-fundo.png";

export default function DesktopBackground() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />

      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-indigo-500/[0.07] blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-purple-500/[0.05] blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
      <div className="absolute top-2/3 left-1/3 w-64 h-64 rounded-full bg-blue-500/[0.04] blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 opacity-[0.06]">
          <img
            src={telemedLogo}
            alt=""
            className="w-28 h-28 object-contain"
            draggable={false}
          />
          <span className="text-white text-lg font-light tracking-[0.3em] uppercase">
            tele.m3d.pro
          </span>
        </div>
      </div>
    </div>
  );
}
