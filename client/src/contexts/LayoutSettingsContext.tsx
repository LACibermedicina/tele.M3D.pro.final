import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type MobileMenuStyle = "slide" | "sidebar" | "bottom";

interface LayoutSettings {
  mobileMenuStyle: MobileMenuStyle;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

const LayoutSettingsContext = createContext<LayoutSettings>({
  mobileMenuStyle: "slide",
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
});

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    <LayoutSettingsContext.Provider value={{ mobileMenuStyle, sidebarCollapsed, setSidebarCollapsed }}>
      {children}
    </LayoutSettingsContext.Provider>
  );
}

export function useLayoutSettings() {
  return useContext(LayoutSettingsContext);
}
