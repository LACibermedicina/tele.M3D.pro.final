import { type ReactNode, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@/hooks/use-draggable";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import PanelWindowControls from "@/components/dashboard/panel-window-controls";
import {
  LayoutDashboard, Brain, Calendar, MessageSquare, MessageCircle, Activity,
  FileText, Stethoscope, Zap, BookOpen, Pill, Shield, Users,
  CreditCard, BarChart3, FlaskConical, Scan, Heart, ClipboardList,
  Settings, Bell, Globe, Wallet, Share2, TrendingUp, Building2,
  Video, Home, Layout, Wrench, User,
  type LucideIcon
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  brain: Brain,
  calendar: Calendar,
  message: MessageSquare,
  "message-circle": MessageCircle,
  activity: Activity,
  filetext: FileText,
  stethoscope: Stethoscope,
  zap: Zap,
  bookopen: BookOpen,
  "book-open": BookOpen,
  pill: Pill,
  shield: Shield,
  users: Users,
  user: User,
  creditcard: CreditCard,
  barchart: BarChart3,
  flask: FlaskConical,
  scan: Scan,
  heart: Heart,
  clipboard: ClipboardList,
  settings: Settings,
  bell: Bell,
  globe: Globe,
  wallet: Wallet,
  share: Share2,
  trending: TrendingUp,
  building: Building2,
  video: Video,
  home: Home,
  layout: Layout,
  wrench: Wrench,
};

function getPanelIcon(iconName: string): LucideIcon {
  return iconMap[iconName.toLowerCase()] || LayoutDashboard;
}

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
  const Icon = getPanelIcon(icon);

  const panel = (
    <div
      className={`relative group transition-shadow duration-200 ${isDragging ? "shadow-2xl z-50 opacity-90" : ""} desktop-glass-panel ${className} flex flex-col`}
      data-panel-id={id}
      data-draggable-root
      style={useAbsolutePos ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: isDragging ? 9999 : 9000,
        width: "auto",
        minWidth: 280,
        maxWidth: "90vw",
      } : undefined}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-slate-900 rounded-t-lg border-b border-white/10 shrink-0 select-none cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        <div className="flex items-center gap-2 pointer-events-none min-w-0">
          <Icon className="h-3.5 w-3.5 text-white/70 shrink-0" />
          <span className="text-xs font-medium text-white/80 truncate">{label}</span>
        </div>
        <div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          <PanelWindowControls
            onMinimize={handleMinimize}
            onClose={showClose ? handleClose : undefined}
            showGrip={false}
            alwaysVisible
            dark
          />
        </div>
      </div>
      {children}
    </div>
  );

  if (useAbsolutePos && typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }
  return panel;
}
