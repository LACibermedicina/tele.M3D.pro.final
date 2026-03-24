import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export type MobileMenuStyle = "slide" | "sidebar" | "bottom";
export type NavDockMode = "top" | "left" | "right" | "bottom" | "floating";

export interface RoleThemeConfig {
  accentColor?: string;
  glassOpacity?: number;
}

export const LAYOUT_DEFAULTS = {
  navDockMode: "bottom" as NavDockMode,
  navFloatingPosition: { x: 100, y: 100 },
  toolboxDockMode: "right",
};

const LAYOUT_STORAGE_KEYS = [
  'nav_dock_mode',
  'nav_floating_position',
  'unified_toolbox_dock_mode',
  'unified_toolbox_visible',
  'unified_toolbox_detached',
  'minimized_panels',
  'minimized_dock_side',
];

interface LayoutSettings {
  mobileMenuStyle: MobileMenuStyle;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  navDockMode: NavDockMode;
  setNavDockMode: (mode: NavDockMode) => void;
  navFloatingPosition: { x: number; y: number };
  setNavFloatingPosition: (pos: { x: number; y: number }) => void;
  resetAllLayout: () => void;
  roleThemeConfig: Record<string, RoleThemeConfig>;
}

const LayoutSettingsContext = createContext<LayoutSettings>({
  mobileMenuStyle: "slide",
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
  navDockMode: "bottom",
  setNavDockMode: () => {},
  navFloatingPosition: { x: 100, y: 100 },
  setNavFloatingPosition: () => {},
  resetAllLayout: () => {},
  roleThemeConfig: {},
});

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [navDockMode, setNavDockModeState] = useState<NavDockMode>(() => {
    try {
      const stored = localStorage.getItem('nav_dock_mode');
      if (stored && ['top', 'left', 'right', 'bottom', 'floating'].includes(stored)) {
        return stored as NavDockMode;
      }
    } catch {}
    return 'bottom';
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

  const resetAllLayout = useCallback(() => {
    LAYOUT_STORAGE_KEYS.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
    const dynamicKeys = Object.keys(localStorage).filter(k =>
      k.startsWith("draggable_") ||
      k.startsWith("dashboard_") ||
      k.startsWith("detached_nav_") ||
      k.startsWith("unified_toolbox") ||
      k.startsWith("widget-buttons") ||
      k.startsWith("quick-actions") ||
      k.startsWith("study-notes") ||
      k.startsWith("chatbot-widget") ||
      k.startsWith("ecg-widget") ||
      k.startsWith("radiology-widget") ||
      k.startsWith("panel_") ||
      k.startsWith("tray_") ||
      k === "quick-actions-panel" ||
      k === "widget-buttons-column"
    );
    dynamicKeys.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
    setNavDockModeState(LAYOUT_DEFAULTS.navDockMode);
    setNavFloatingPositionState(LAYOUT_DEFAULTS.navFloatingPosition);
    setSidebarCollapsed(false);
    window.dispatchEvent(new Event('reset-tray-buttons'));
  }, []);

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

  const roleThemeConfig: Record<string, RoleThemeConfig> = (() => {
    if (!layoutData) return {};
    const config: Record<string, RoleThemeConfig> = {};
    layoutData.forEach((s: any) => {
      if (s.category === 'theme') {
        const accentMatch = s.settingKey?.match(/^accent_color_(\w+)$/);
        if (accentMatch) {
          const role = accentMatch[1];
          if (!config[role]) config[role] = {};
          config[role].accentColor = s.settingValue;
        }
        const roleOpacityMatch = s.settingKey?.match(/^glass_opacity_(\w+)$/);
        if (roleOpacityMatch) {
          const role = roleOpacityMatch[1];
          if (!config[role]) config[role] = {};
          config[role].glassOpacity = parseFloat(s.settingValue) / 100;
        }
        if (s.settingKey === 'desktop_glass_opacity') {
          if (!config['_global']) config['_global'] = {};
          config['_global'].glassOpacity = parseFloat(s.settingValue) / 100;
        }
      }
    });
    return config;
  })();

  useEffect(() => {
    const userRole = user?.role;
    const cfg = (userRole && roleThemeConfig[userRole]) ? roleThemeConfig[userRole] : roleThemeConfig['_global'];
    if (!cfg) return;
    if (cfg.accentColor) {
      document.documentElement.style.setProperty('--role-accent-color', cfg.accentColor);
    }
    if (cfg.glassOpacity !== undefined && !isNaN(cfg.glassOpacity)) {
      const opacity = Math.max(0.1, Math.min(1, cfg.glassOpacity));
      document.documentElement.style.setProperty('--card-glass', `hsla(230, 21%, 18%, ${opacity})`);
      document.documentElement.style.setProperty('--bg-glass', `hsla(230, 21%, 11%, ${Math.max(0, opacity - 0.05)})`);
      document.documentElement.style.setProperty('--footer-glass', `hsla(230, 21%, 13%, ${Math.min(1, opacity + 0.05)})`);
    }
  }, [roleThemeConfig, user?.role]);

  return (
    <LayoutSettingsContext.Provider value={{
      mobileMenuStyle,
      sidebarCollapsed,
      setSidebarCollapsed,
      navDockMode,
      setNavDockMode,
      navFloatingPosition,
      setNavFloatingPosition,
      resetAllLayout,
      roleThemeConfig,
    }}>
      {children}
    </LayoutSettingsContext.Provider>
  );
}

export function useLayoutSettings() {
  return useContext(LayoutSettingsContext);
}
