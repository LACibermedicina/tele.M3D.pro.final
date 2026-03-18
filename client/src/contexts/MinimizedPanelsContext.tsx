import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface MinimizedPanel {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  lastPosition?: { x: number; y: number };
  lastSize?: { w: number; h: number };
}

interface MinimizedPanelsContextType {
  minimizedPanels: MinimizedPanel[];
  minimize: (panel: MinimizedPanel) => void;
  restore: (id: string) => MinimizedPanel | undefined;
  isMinimized: (id: string) => boolean;
  restoreAll: () => void;
  updateBadge: (id: string, badge: number) => void;
  dockSide: "left" | "right";
  setDockSide: (side: "left" | "right") => void;
}

const MinimizedPanelsContext = createContext<MinimizedPanelsContextType | null>(null);

const STORAGE_KEY = "minimized_panels";
const DOCK_SIDE_KEY = "minimized_dock_side";

function loadPanels(): MinimizedPanel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function savePanels(panels: MinimizedPanel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  } catch {}
}

export function MinimizedPanelsProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<MinimizedPanel[]>(loadPanels);
  const [dockSide, setDockSideState] = useState<"left" | "right">(() => {
    try {
      const v = localStorage.getItem(DOCK_SIDE_KEY);
      if (v === "left" || v === "right") return v;
    } catch {}
    return "right";
  });

  const setDockSide = useCallback((side: "left" | "right") => {
    setDockSideState(side);
    try { localStorage.setItem(DOCK_SIDE_KEY, side); } catch {}
  }, []);

  const minimize = useCallback((panel: MinimizedPanel) => {
    setPanels(prev => {
      if (prev.some(p => p.id === panel.id)) return prev;
      const next = [...prev, panel];
      savePanels(next);
      return next;
    });
  }, []);

  const restore = useCallback((id: string): MinimizedPanel | undefined => {
    let found: MinimizedPanel | undefined;
    setPanels(prev => {
      found = prev.find(p => p.id === id);
      const next = prev.filter(p => p.id !== id);
      savePanels(next);
      return next;
    });
    return found;
  }, []);

  const isMinimized = useCallback((id: string) => {
    return panels.some(p => p.id === id);
  }, [panels]);

  const restoreAll = useCallback(() => {
    setPanels([]);
    savePanels([]);
  }, []);

  const updateBadge = useCallback((id: string, badge: number) => {
    setPanels(prev => {
      const next = prev.map(p => p.id === id ? { ...p, badge } : p);
      savePanels(next);
      return next;
    });
  }, []);

  return (
    <MinimizedPanelsContext.Provider value={{ minimizedPanels: panels, minimize, restore, isMinimized, restoreAll, updateBadge, dockSide, setDockSide }}>
      {children}
    </MinimizedPanelsContext.Provider>
  );
}

export function useMinimizedPanels() {
  const ctx = useContext(MinimizedPanelsContext);
  if (!ctx) throw new Error("useMinimizedPanels must be used within MinimizedPanelsProvider");
  return ctx;
}
