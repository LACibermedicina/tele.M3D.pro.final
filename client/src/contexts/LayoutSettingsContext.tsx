import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type MobileMenuStyle = "slide" | "sidebar" | "bottom";
export type NavDockMode = "top" | "left" | "right" | "bottom" | "floating";

interface LayoutSettings {
  mobileMenuStyle: MobileMenuStyle;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  navDockMode: NavDockMode;
  setNavDockMode: (mode: NavDockMode) => void;
  navFloatingPosition: { x: number; y: number };
  setNavFloatingPosition: (pos: { x: number; y: number }) => void;
}

const LayoutSettingsContext = createContext<LayoutSettings>({
  mobileMenuStyle: "slide",
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  navDockMode: "top",
  setNavDockMode: () => {},
  navFloatingPosition: { x: 100, y: 100 },
  setNavFloatingPosition: () => {},
});

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [navDockMode, setNavDockModeState] = useState<NavDockMode>(() => {
    try {
      const stored = localStorage.getItem('nav_dock_mode');
      if (stored && ['top', 'left', 'right', 'bottom', 'floating'].includes(stored)) {
        return stored as NavDockMode;
      }
    } catch {}
    return 'top';
  });

  const [navFloatingPosition, setNavFloatingPositionState] = useState<{ x: number; y: number }>(() => {
    try {
      const stored = localStorage.getItem('nav_floating_position');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
      }
    } catch {}
    return { x: 100, y: 100 };
  });

  const setNavDockMode = (mode: NavDockMode) => {
    setNavDockModeState(mode);
    try { localStorage.setItem('nav_dock_mode', mode); } catch {}
  };

  const setNavFloatingPosition = (pos: { x: number; y: number }) => {
    setNavFloatingPositionState(pos);
    try { localStorage.setItem('nav_floating_position', JSON.stringify(pos)); } catch {}
  };

  const { data: layoutData } = useQuery<any[]>({
    queryKey: ["/api/layout-settings/public"],
  });

  const mobileMenuStyle: MobileMenuStyle = (() => {
    if (!layoutData) return "slide";
    const setting = layoutData.find((s: any) => s.settingKey === "mobile_menu_style");
    const val = setting?.settingValue;
    if (val === "slide" || val === "sidebar" || val === "bottom") return val;
    return "slide";
  })();

  return (
    <LayoutSettingsContext.Provider value={{
      mobileMenuStyle,
      sidebarCollapsed,
      setSidebarCollapsed,
      navDockMode,
      setNavDockMode,
      navFloatingPosition,
      setNavFloatingPosition,
    }}>
      {children}
    </LayoutSettingsContext.Provider>
  );
}

export function useLayoutSettings() {
  return useContext(LayoutSettingsContext);
}
