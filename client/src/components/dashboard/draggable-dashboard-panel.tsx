import { type ReactNode, useState, useEffect, useCallback } from "react";
import { useDraggable } from "@/hooks/use-draggable";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import PanelWindowControls from "@/components/dashboard/panel-window-controls";

interface DraggableDashboardPanelProps {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  children: ReactNode;
  className?: string;
  defaultPosition?: { x: number; y: number };
  onClose?: () => void;
  showClose?: boolean;
  dashboardKey?: string;
}

export default function DraggableDashboardPanel({
  id,
  label,
  icon,
  badge,
  children,
  className = "",
  defaultPosition,
  onClose,
  showClose = true,
  dashboardKey = "main",
}: DraggableDashboardPanelProps) {
  const storageKey = `dashboard_${dashboardKey}_${id}`;
  const { isMinimized, minimize } = useMinimizedPanels();
  const [closed, setClosed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const {
    position,
    isDragging,
    onDragStart,
  } = useDraggable({
    storageKey,
    defaultPosition: defaultPosition || { x: -1, y: -1 },
    constrainToWindow: true,
  });

  const handleMinimize = useCallback(() => {
    const el = document.querySelector(`[data-panel-id="${id}"]`);
    const rect = el?.getBoundingClientRect();
    minimize({
      id,
      label,
      icon,
      badge,
      lastPosition: rect ? { x: rect.left, y: rect.top } : position,
      lastSize: rect ? { w: rect.width, h: rect.height } : undefined,
    });
  }, [id, label, icon, badge, minimize, position]);

  const handleClose = useCallback(() => {
    setClosed(true);
    onClose?.();
  }, [onClose]);

  if (isMinimized(id) || closed) return null;

  if (isMobile) {
    return (
      <div className={`relative ${className}`} data-panel-id={id}>
        <div className="absolute top-1 right-1 z-10 bg-background/70 backdrop-blur-sm rounded px-0.5">
          <PanelWindowControls
            onMinimize={handleMinimize}
            onClose={showClose ? handleClose : undefined}
            showGrip={false}
            size="md"
            alwaysVisible
          />
        </div>
        {children}
      </div>
    );
  }

  const useAbsolutePos = position.x >= 0 && position.y >= 0;

  return (
    <div
      className={`relative group transition-shadow duration-200 ${isDragging ? "shadow-2xl z-50 opacity-90" : ""} desktop-glass-panel ${className}`}
      data-panel-id={id}
      data-draggable-root
      style={useAbsolutePos ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 9999 : 30,
        width: "auto",
        minWidth: 280,
        maxWidth: "90vw",
      } : undefined}
    >
      <div className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded px-1 py-0.5">
        <PanelWindowControls
          onDragStart={onDragStart}
          onMinimize={handleMinimize}
          onClose={showClose ? handleClose : undefined}
        />
      </div>
      {children}
    </div>
  );
}
