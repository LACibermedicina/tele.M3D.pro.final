import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDraggable } from "@/hooks/use-draggable";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import PanelWindowControls from "@/components/dashboard/panel-window-controls";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import {
  GripVertical, Minus, X, Wrench, ChevronUp, ChevronDown,
  LayoutDashboard, Users, CalendarClock, MessageCircle, FileText,
  ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield,
  Stethoscope, StickyNote, Video, Pill, Activity, AlertCircle,
  Microscope, Wallet, FileBarChart, Gem, TrendingUp, Coffee,
  HeartPulse, CreditCard, UserPlus, ExternalLink, RotateCcw,
  type LucideIcon
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

interface NavGroup {
  category: string;
  label: string;
  items: NavItem[];
}

function getNavGroups(userRole: string | undefined, t: (k: string) => string): NavGroup[] {
  const groups: NavGroup[] = [
    {
      category: "principal",
      label: "Principal",
      items: [
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "doctor", "patient"] },
        { path: "/assistant", label: userRole === 'admin' ? "Assistente IA" : "Assistente", icon: BrainCircuit, roles: ["admin", "doctor", "patient"] },
        { path: "/fhir-dashboard", label: "Análise de Estudos", icon: HeartPulse, roles: ["admin", "doctor"] },
      ],
    },
    {
      category: "clinico",
      label: "Clínico",
      items: [
        { path: "/patients", label: "Pacientes", icon: Users, roles: ["admin", "doctor"] },
        { path: "/schedule", label: "Agenda", icon: CalendarClock, roles: ["admin", "doctor"] },
        { path: "/records", label: "Prontuários", icon: FileText, roles: ["admin", "doctor", "patient"] },
        { path: "/prescriptions", label: "Prescrições", icon: ClipboardList, roles: ["admin", "doctor", "patient"] },
        { path: "/inter-consultation", label: "Interconsulta", icon: Stethoscope, roles: ["doctor"] },
        { path: "/doctor-notes", label: "Anotações", icon: StickyNote, roles: ["doctor"] },
        { path: "/doctor-referrals", label: "Indicações", icon: UserPlus, roles: ["doctor"] },
      ],
    },
    {
      category: "paciente",
      label: "Consultas",
      items: [
        { path: "/consultation-request", label: "Solicitar Consulta", icon: Stethoscope, roles: ["patient"] },
        { path: "/immediate-consultation", label: "Sala de Espera", icon: Video, roles: ["patient", "visitor"] },
        { path: "/my-consultations", label: "Minhas Consultas", icon: CalendarClock, roles: ["patient"] },
      ],
    },
    {
      category: "revisao",
      label: "Revisão",
      items: [
        { path: "/incomplete-consultations", label: "Pendências", icon: AlertCircle, roles: ["doctor"] },
        { path: "/post-consultation-review", label: "Revisão Pós-Consulta", icon: ClipboardList, roles: ["doctor"] },
        { path: "/diagnostic-review", label: "Inferências", icon: Microscope, roles: ["doctor"] },
      ],
    },
    {
      category: "comunicacao",
      label: "Comunicação",
      items: [
        { path: "/whatsapp", label: "WhatsApp IA", icon: MessageCircle, roles: ["admin", "doctor"] },
        { path: "/medical-references", label: "Referências", icon: BookOpenCheck, roles: ["admin", "doctor"] },
        { path: "/coffee-room", label: "Cafeteria", icon: Coffee, roles: ["doctor"] },
      ],
    },
    {
      category: "financeiro",
      label: "Financeiro",
      items: [
        { path: "/wallet", label: "Carteira", icon: Wallet, roles: ["doctor", "patient", "admin", "researcher"] },
        { path: "/nft-management", label: "NFTs", icon: Gem, roles: ["admin", "doctor", "researcher"] },
        { path: "/broker", label: "Broker", icon: TrendingUp, roles: ["admin", "doctor", "patient", "researcher"] },
      ],
    },
    {
      category: "relatorios",
      label: "Relatórios",
      items: [
        { path: "/epidemiological-reports", label: "Epidemiologia", icon: Activity, roles: ["admin", "doctor"] },
        { path: "/reports", label: "Relatórios", icon: FileBarChart, roles: ["admin", "doctor"] },
        { path: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin"] },
      ],
    },
    {
      category: "farmacia",
      label: "Farmácia",
      items: [
        { path: "/pharmacy", label: "Farmácia", icon: Pill, roles: ["pharmacist", "admin"] },
      ],
    },
    {
      category: "admin",
      label: "Admin",
      items: [
        { path: "/admin", label: t("navigation.admin"), icon: Shield, roles: ["admin"] },
        { path: "/admin/payments", label: "Pagamentos", icon: CreditCard, roles: ["admin"] },
      ],
    },
  ];

  return groups.map(g => ({
    ...g,
    items: g.items.filter(item => userRole ? item.roles.includes(userRole) : item.roles.includes("visitor")),
  })).filter(g => g.items.length > 0);
}

const DETACHED_STORAGE_KEY = "unified_toolbox_detached";

function loadDetached(): string[] {
  try {
    const v = localStorage.getItem(DETACHED_STORAGE_KEY);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function saveDetached(paths: string[]) {
  try { localStorage.setItem(DETACHED_STORAGE_KEY, JSON.stringify(paths)); } catch {}
}

function DetachedNavPanel({ path, label, icon: Icon, onReattach }: {
  path: string; label: string; icon: LucideIcon; onReattach: (path: string) => void;
}) {
  const [location] = useLocation();
  const { minimize, isMinimized } = useMinimizedPanels();
  const [wasMinimized, setWasMinimized] = useState(false);
  const panelId = `detached-${path.replace(/\//g, "-")}`;
  const iconName = path.replace(/^\//, "").replace(/\//g, "-") || "link";

  const { position, isDragging, onDragStart } = useDraggable({
    storageKey: `detached_nav_${path}`,
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
  });

  const handleMinimize = useCallback(() => {
    minimize({ id: panelId, label, icon: iconName });
  }, [minimize, panelId, label, iconName]);

  const handleClose = useCallback(() => {
    onReattach(path);
  }, [onReattach, path]);

  useEffect(() => {
    if (isMinimized(panelId)) {
      setWasMinimized(true);
    } else if (wasMinimized) {
      setWasMinimized(false);
    }
  }, [isMinimized, panelId, wasMinimized]);

  if (isMinimized(panelId)) return null;

  const isActive = location === path;
  const style: React.CSSProperties = position.x >= 0 && position.y >= 0
    ? { position: "fixed", left: position.x, top: position.y, zIndex: isDragging ? 9999 : 46 }
    : { position: "fixed", right: 220, top: 70, zIndex: 46 };

  return (
    <div
      className={`bg-background/95 backdrop-blur-md border shadow-xl rounded-lg transition-all duration-200 ${isDragging ? "opacity-90 shadow-2xl" : ""}`}
      style={style}
      data-draggable-root
    >
      <div className="flex items-center gap-1 px-1.5 py-1 border-b bg-muted/30 rounded-t-lg">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground flex-1 truncate max-w-[100px]">{label}</span>
        <PanelWindowControls
          onDragStart={onDragStart}
          onMinimize={handleMinimize}
          onClose={handleClose}
          alwaysVisible
        />
      </div>
      <div className="p-1">
        <Link href={path}>
          <button className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full transition-colors ${
            isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </Link>
      </div>
    </div>
  );
}

type DockMode = "floating" | "top" | "bottom" | "left" | "right";

const EDGE_THRESHOLD_PCT = 0.10;
const STORAGE_KEY_DOCK = "unified_toolbox_dock_mode";
const STORAGE_KEY_VISIBLE = "unified_toolbox_visible";

export default function UnifiedToolbox() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { minimize, isMinimized, restoreAll } = useMinimizedPanels();
  const { resetAllLayout, navDockMode } = useLayoutSettings();
  const [collapsed, setCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [detachedPaths, setDetachedPaths] = useState<string[]>(loadDetached);

  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_VISIBLE) !== "false"; } catch { return true; }
  });

  const [dockMode, setDockMode] = useState<DockMode>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_DOCK);
      if (v === "top" || v === "bottom" || v === "left" || v === "right" || v === "floating") return v as DockMode;
    } catch {}
    return "right";
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { position, setPosition, isDragging, onDragStart } = useDraggable({
    storageKey: "unified_toolbox",
    defaultPosition: { x: -1, y: -1 },
    constrainToWindow: true,
  });

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const thresholdX = vw * EDGE_THRESHOLD_PCT;
    const thresholdY = vh * EDGE_THRESHOLD_PCT;

    let newMode: DockMode = "floating";
    if (position.x < thresholdX) newMode = "left";
    else if (position.x > vw - thresholdX - 200) newMode = "right";
    else if (position.y < thresholdY) newMode = "top";
    else if (position.y > vh - thresholdY - 50) newMode = "bottom";

    setDockMode(newMode);
    try { localStorage.setItem(STORAGE_KEY_DOCK, newMode); } catch {}
  }, [isDragging, position]);

  useEffect(() => {
    const handleMouseUp = () => handleDragEnd();
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleDragEnd]);

  const handleMinimize = useCallback(() => {
    if (navDockMode !== 'bottom') {
      minimize({ id: "unified-toolbox", label: "Toolbox", icon: "settings" });
    }
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY_VISIBLE, "false"); } catch {}
    window.dispatchEvent(new CustomEvent('toolbox-state-changed', { detail: { visible: false } }));
  }, [minimize, navDockMode]);

  const [wasMinimizedToDock, setWasMinimizedToDock] = useState(false);

  const handleClose = useCallback(() => {
    handleMinimize();
  }, [handleMinimize]);

  useEffect(() => {
    if (isMinimized("unified-toolbox")) {
      setWasMinimizedToDock(true);
    } else if (wasMinimizedToDock && !visible) {
      setVisible(true);
      setWasMinimizedToDock(false);
      try { localStorage.setItem(STORAGE_KEY_VISIBLE, "true"); } catch {}
      window.dispatchEvent(new CustomEvent('toolbox-state-changed', { detail: { visible: true } }));
    }
  }, [isMinimized, visible, wasMinimizedToDock]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toolbox-state-changed', { detail: { visible } }));
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      setVisible(prev => {
        const next = !prev;
        try { localStorage.setItem(STORAGE_KEY_VISIBLE, String(next)); } catch {}
        if (next) {
          setCollapsed(false);
          if (navDockMode === 'bottom') {
            setPosition({ x: -1, y: -1 });
          }
        }
        window.dispatchEvent(new CustomEvent('toolbox-state-changed', { detail: { visible: next } }));
        return next;
      });
    };
    window.addEventListener('toggle-toolbox-visibility', handleToggle);
    return () => window.removeEventListener('toggle-toolbox-visibility', handleToggle);
  }, [navDockMode, setPosition]);

  const handleDetach = useCallback((path: string) => {
    setDetachedPaths(prev => {
      const next = [...prev, path];
      saveDetached(next);
      return next;
    });
  }, []);

  const handleReattach = useCallback((path: string) => {
    setDetachedPaths(prev => {
      const next = prev.filter(p => p !== path);
      saveDetached(next);
      return next;
    });
  }, []);

  const filteredGroups = user ? getNavGroups(user.role, t) : [];

  const allItems = filteredGroups.flatMap(g => g.items);
  const detachedItems = allItems.filter(item => detachedPaths.includes(item.path));

  const detachedPanels = detachedItems.map(item => (
    <DetachedNavPanel
      key={item.path}
      path={item.path}
      label={item.label}
      icon={item.icon}
      onReattach={handleReattach}
    />
  ));

  if (isMobile || !user) return <>{detachedPanels}</>;
  if (!visible) return <>{detachedPanels}</>;

  const isBottomNavMode = navDockMode === 'bottom';

  const isDocked = dockMode !== "floating";
  const isHorizontal = dockMode === "top" || dockMode === "bottom";
  const isVertical = dockMode === "left" || dockMode === "right";

  const getDockedStyle = (): React.CSSProperties => {
    if (isBottomNavMode) {
      const hasDraggedPosition = position.x >= 0 && position.y >= 0;
      if (hasDraggedPosition) {
        return {
          position: "fixed",
          left: position.x,
          top: position.y,
          zIndex: isDragging ? 9999 : 49,
          width: collapsed ? 48 : 240,
          maxHeight: 'calc(100vh - 120px)',
        };
      }
      return {
        position: "fixed",
        bottom: 58,
        right: 8,
        zIndex: 49,
        width: collapsed ? 48 : 240,
        maxHeight: 'calc(100vh - 120px)',
      };
    }
    switch (dockMode) {
      case "top": return { position: "fixed", top: 60, left: 0, right: 0, zIndex: 45 };
      case "bottom": return { position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 45 };
      case "left": return { position: "fixed", top: 60, left: 0, bottom: 0, zIndex: 45, width: collapsed ? 48 : 200 };
      case "right": return { position: "fixed", top: 60, right: 0, bottom: 0, zIndex: 45, width: collapsed ? 48 : 200 };
      default:
        return position.x >= 0 && position.y >= 0
          ? { position: "fixed", left: position.x, top: position.y, zIndex: isDragging ? 9999 : 45 }
          : { position: "fixed", right: 16, top: 70, zIndex: 45 };
    }
  };

  return (
    <>
      {detachedPanels}
      <div
        className={`bg-background/95 backdrop-blur-md border shadow-xl transition-all duration-200 ${
          isBottomNavMode ? "rounded-xl" : isDocked ? "" : "rounded-xl"
        } ${isDragging ? "opacity-90 shadow-2xl" : ""} ${
          !isBottomNavMode && isHorizontal ? "rounded-none" : ""
        } ${!isBottomNavMode && isVertical ? "rounded-none overflow-y-auto" : ""}`}
        style={getDockedStyle()}
        data-draggable-root
      >
        <div
          className={`flex items-center gap-1 px-2 py-1 border-b bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors ${isHorizontal ? "" : ""}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, [role="button"]')) return;
            setCollapsed(!collapsed);
          }}
        >
          <div
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          {!collapsed && <span className="text-xs font-medium text-muted-foreground flex-1">Toolbox</span>}
          {collapsed && <span className="text-[10px] text-muted-foreground">Menu</span>}
          <div className="flex items-center gap-0.5" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleMinimize}>
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive" onClick={handleClose}>
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {!collapsed && (
          <div className={`p-1.5 ${isHorizontal ? "flex items-center gap-1 overflow-x-auto" : isVertical ? "space-y-0.5" : "space-y-0.5"} max-h-[calc(100vh-120px)] overflow-y-auto`}>
            {filteredGroups.map((group, gi) => (
              <div key={group.category}>
                {gi > 0 && (isHorizontal ? <Separator orientation="vertical" className="h-6 mx-1" /> : <Separator className="my-1" />)}
                {!isHorizontal && !collapsed && (
                  <div className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {group.label}
                  </div>
                )}
                <div className={isHorizontal ? "flex items-center gap-0.5" : "space-y-0.5"}>
                  {group.items
                    .filter(item => !detachedPaths.includes(item.path))
                    .map(item => {
                    const ItemIcon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <div key={item.path} className="group relative flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={item.path}>
                              <button
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full transition-colors ${
                                  isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                              >
                                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                                {!isHorizontal && <span className="truncate">{item.label}</span>}
                              </button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side={isVertical ? (dockMode === "left" ? "right" : "left") : "bottom"}>
                            <p>{item.label}</p>
                          </TooltipContent>
                        </Tooltip>
                        {!isHorizontal && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                                onClick={(e) => { e.stopPropagation(); handleDetach(item.path); }}
                              >
                                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right"><p>Destacar como painel flutuante</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!isHorizontal && (
              <>
                <Separator className="my-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => { resetAllLayout(); restoreAll(); window.location.reload(); }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Reset Interface</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side={isVertical ? (dockMode === "left" ? "right" : "left") : "bottom"}>
                    <p>Restaurar posições padrão</p>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
