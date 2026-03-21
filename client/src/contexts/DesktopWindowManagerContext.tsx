import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type WindowState = "open" | "minimized" | "closed";

export interface DesktopWindow {
  id: string;
  title: string;
  icon: LucideIcon;
  route: string;
  state: WindowState;
  position: { x: number; y: number };
  size: { w: number; h: number };
  zIndex: number;
  maximized?: boolean;
}

interface DesktopWindowManagerContextType {
  windows: DesktopWindow[];
  openWindow: (win: Omit<DesktopWindow, "state" | "zIndex" | "position" | "size"> & Partial<Pick<DesktopWindow, "position" | "size">>) => void;
  seedClosedWindow: (win: Omit<DesktopWindow, "state" | "zIndex" | "position" | "size"> & Partial<Pick<DesktopWindow, "position" | "size">>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  updateWindowPosition: (id: string, pos: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { w: number; h: number }) => void;
  activeWindowId: string | null;
  isDesktopMode: boolean;
}

const DesktopWindowManagerContext = createContext<DesktopWindowManagerContextType | null>(null);

const CASCADE_OFFSET = 32;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 600;

function getInitialPosition(existingCount: number): { x: number; y: number } {
  const baseX = 80;
  const baseY = 40;
  const offset = (existingCount % 8) * CASCADE_OFFSET;
  return { x: baseX + offset, y: baseY + offset };
}

export function DesktopWindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const zCounter = useRef(100);
  const [isDesktopMode] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);

  const openWindow = useCallback((win: Omit<DesktopWindow, "state" | "zIndex" | "position" | "size"> & Partial<Pick<DesktopWindow, "position" | "size">>) => {
    setWindows(prev => {
      const existing = prev.find(w => w.id === win.id);
      if (existing) {
        if (existing.state === "minimized" || existing.state === "closed") {
          zCounter.current += 1;
          return prev.map(w =>
            w.id === win.id
              ? { ...w, state: "open" as WindowState, zIndex: zCounter.current }
              : w
          );
        }
        zCounter.current += 1;
        return prev.map(w =>
          w.id === win.id ? { ...w, zIndex: zCounter.current } : w
        );
      }
      zCounter.current += 1;
      const openCount = prev.filter(w => w.state === "open").length;
      const pos = win.position || getInitialPosition(openCount);
      const size = win.size || { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
      return [
        ...prev,
        {
          ...win,
          state: "open" as WindowState,
          zIndex: zCounter.current,
          position: pos,
          size,
        },
      ];
    });
    setActiveWindowId(win.id);
  }, []);

  const seedClosedWindow = useCallback((win: Omit<DesktopWindow, "state" | "zIndex" | "position" | "size"> & Partial<Pick<DesktopWindow, "position" | "size">>) => {
    setWindows(prev => {
      if (prev.find(w => w.id === win.id)) return prev;
      const pos = win.position || getInitialPosition(prev.length);
      const size = win.size || { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
      return [
        ...prev,
        {
          ...win,
          state: "closed" as WindowState,
          zIndex: 0,
          position: pos,
          size,
        },
      ];
    });
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, state: "closed" as WindowState } : w
    ));
    setActiveWindowId(prev => prev === id ? null : prev);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, state: "minimized" as WindowState } : w
    ));
    setActiveWindowId(prev => prev === id ? null : prev);
  }, []);

  const restoreWindow = useCallback((id: string) => {
    zCounter.current += 1;
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, state: "open" as WindowState, zIndex: zCounter.current } : w
    ));
    setActiveWindowId(id);
  }, []);

  const focusWindow = useCallback((id: string) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, zIndex: z } : w
    ));
    setActiveWindowId(id);
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, maximized: !w.maximized } : w
    ));
  }, []);

  const updateWindowPosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, position: pos, maximized: false } : w
    ));
  }, []);

  const updateWindowSize = useCallback((id: string, size: { w: number; h: number }) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, size, maximized: false } : w
    ));
  }, []);

  return (
    <DesktopWindowManagerContext.Provider
      value={{
        windows,
        openWindow,
        seedClosedWindow,
        closeWindow,
        minimizeWindow,
        restoreWindow,
        focusWindow,
        toggleMaximize,
        updateWindowPosition,
        updateWindowSize,
        activeWindowId,
        isDesktopMode,
      }}
    >
      {children}
    </DesktopWindowManagerContext.Provider>
  );
}

export function useDesktopWindowManager() {
  const ctx = useContext(DesktopWindowManagerContext);
  if (!ctx) throw new Error("useDesktopWindowManager must be used within DesktopWindowManagerProvider");
  return ctx;
}
