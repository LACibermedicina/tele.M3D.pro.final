import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type ViewMode = "immersive" | "mobile" | "desktop";

interface ViewModeContextType {
  viewMode: ViewMode | null;
  setViewMode: (mode: ViewMode) => void;
  recommendedMode: ViewMode;
  clearViewMode: () => void;
  hasChosenMode: boolean;
}

const VIEW_MODE_KEY = "telemed_view_mode";

function detectRecommendedMode(): ViewMode {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();
  const isMobileUA = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua);
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(ua);

  if (isMobileUA || width < 768) return "immersive";
  if (isTabletUA || (width >= 768 && width < 1024)) return "mobile";
  return "desktop";
}

const ViewModeContext = createContext<ViewModeContextType>({
  viewMode: null,
  setViewMode: () => {},
  recommendedMode: "desktop",
  clearViewMode: () => {},
  hasChosenMode: false,
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode | null>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && ["immersive", "mobile", "desktop"].includes(stored)) {
        return stored as ViewMode;
      }
    } catch {}
    return null;
  });

  const [recommendedMode] = useState<ViewMode>(detectRecommendedMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {}
  }, []);

  const clearViewMode = useCallback(() => {
    setViewModeState(null);
    try {
      localStorage.removeItem(VIEW_MODE_KEY);
    } catch {}
  }, []);

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        setViewMode,
        recommendedMode,
        clearViewMode,
        hasChosenMode: viewMode !== null,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
