import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export type MobileMenuStyle = "slide" | "sidebar" | "bottom";
export type NavDockMode = "top" | "left" | "right" | "bottom" | "floating";

export interface RoleThemeConfig {
  accentColor?: string;
  panelBgColor?: string;
  textColor?: string;
  titlebarColor?: string;
  iconColor?: string;
  glassOpacity?: number;
  titlebarOpacity?: number;
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

interface LayoutSettingRow {
  settingKey: string;
  settingValue: string;
  category?: string;
}

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
  const { user, isLoading: authLoading } = useAuth();
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

  // On a fresh login (transition from logged-out to logged-in within this
  // app session), reset the nav bar to the default bottom dock, ignoring any
  // stale stored position. The user can still move/dock it afterwards.
  const prevUserIdRef = useRef<string | number | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const currentId = (user as any)?.id ?? null;
    const prevId = prevUserIdRef.current;
    if (prevId === null && currentId !== null) {
      setNavDockModeState(LAYOUT_DEFAULTS.navDockMode);
      setNavFloatingPositionState(LAYOUT_DEFAULTS.navFloatingPosition);
      try {
        localStorage.setItem('nav_dock_mode', LAYOUT_DEFAULTS.navDockMode);
        localStorage.removeItem('nav_floating_position');
      } catch {}
    }
    prevUserIdRef.current = currentId;
  }, [user, authLoading]);

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
    const setting = layoutData.find((s: LayoutSettingRow) => s.settingKey === "mobile_menu_style");
    const val = setting?.settingValue;
    if (val === "slide" || val === "sidebar" || val === "bottom") return val;
    return "slide";
  })();

  const roleThemeConfig: Record<string, RoleThemeConfig> = (() => {
    if (!layoutData) return {};
    const config: Record<string, RoleThemeConfig> = {};
    layoutData.forEach((s: LayoutSettingRow) => {
      if (s.category === 'theme') {
        const roles = ['admin', 'doctor', 'patient', 'pharmacist', 'researcher'];
        for (const role of roles) {
          if (s.settingKey?.endsWith(`_${role}`)) {
            const prefix = s.settingKey.slice(0, -(role.length + 1));
            if (!config[role]) config[role] = {};
            if (prefix === 'theme_accent') config[role].accentColor = s.settingValue;
            else if (prefix === 'theme_panel_bg') config[role].panelBgColor = s.settingValue;
            else if (prefix === 'theme_text') config[role].textColor = s.settingValue;
            else if (prefix === 'theme_titlebar') config[role].titlebarColor = s.settingValue;
            else if (prefix === 'theme_icon') config[role].iconColor = s.settingValue;
            break;
          }
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
        if (s.settingKey === 'desktop_titlebar_opacity') {
          if (!config['_global']) config['_global'] = {};
          config['_global'].titlebarOpacity = parseFloat(s.settingValue) / 100;
        }
      }
    });
    return config;
  })();

  useEffect(() => {
    const userRole = user?.role;
    const globalCfg = roleThemeConfig['_global'] || {};
    const roleCfg = (userRole && roleThemeConfig[userRole]) ? roleThemeConfig[userRole] : {};
    const cfg: RoleThemeConfig = { ...globalCfg, ...roleCfg };

    const defaults: Record<string, string> = {
      '--role-accent-color': '#6366f1',
      '--role-panel-bg': 'rgba(255,255,255,0.08)',
      '--role-text-color': '#e2e8f0',
      '--role-icon-color': '#38bdf8',
      '--titlebar-active': 'rgba(15, 23, 42, 0.92)',
      '--titlebar-inactive': 'rgba(15, 23, 42, 0.78)',
      '--card-glass': 'hsla(230, 21%, 18%, 0.70)',
      '--bg-glass': 'hsla(230, 21%, 11%, 0.65)',
      '--footer-glass': 'hsla(230, 21%, 13%, 0.75)',
    };
    Object.entries(defaults).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });

    if (cfg.accentColor) {
      document.documentElement.style.setProperty('--role-accent-color', cfg.accentColor);
    }
    if (cfg.panelBgColor) {
      document.documentElement.style.setProperty('--role-panel-bg', cfg.panelBgColor);
    }
    if (cfg.textColor) {
      document.documentElement.style.setProperty('--role-text-color', cfg.textColor);
    }
    if (cfg.titlebarColor) {
      document.documentElement.style.setProperty('--titlebar-active', cfg.titlebarColor);
      const hex = cfg.titlebarColor.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        document.documentElement.style.setProperty('--titlebar-inactive', `rgba(${r}, ${g}, ${b}, 0.7)`);
      } else {
        document.documentElement.style.setProperty('--titlebar-inactive', cfg.titlebarColor);
      }
    }
    if (cfg.iconColor) {
      document.documentElement.style.setProperty('--role-icon-color', cfg.iconColor);
    }
    if (cfg.glassOpacity !== undefined && !isNaN(cfg.glassOpacity)) {
      const opacity = Math.max(0.1, Math.min(1, cfg.glassOpacity));
      document.documentElement.style.setProperty('--card-glass', `hsla(230, 21%, 18%, ${opacity})`);
      document.documentElement.style.setProperty('--bg-glass', `hsla(230, 21%, 11%, ${Math.max(0, opacity - 0.05)})`);
      document.documentElement.style.setProperty('--footer-glass', `hsla(230, 21%, 13%, ${Math.min(1, opacity + 0.05)})`);
    }
    if (!cfg.titlebarColor && cfg.titlebarOpacity !== undefined && !isNaN(cfg.titlebarOpacity)) {
      const tbOpacity = Math.max(0.05, Math.min(0.95, cfg.titlebarOpacity));
      document.documentElement.style.setProperty('--titlebar-active', `rgba(15, 23, 42, ${tbOpacity})`);
      document.documentElement.style.setProperty('--titlebar-inactive', `rgba(15, 23, 42, ${Math.max(0.03, tbOpacity * 0.7)})`);
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
