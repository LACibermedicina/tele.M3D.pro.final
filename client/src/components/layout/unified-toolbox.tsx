import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useDraggable } from "@/hooks/use-draggable";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  GripVertical, Minus, X, Wrench, ChevronUp, ChevronDown,
  LayoutDashboard, Users, CalendarClock, MessageCircle, FileText,
  ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield,
  Stethoscope, StickyNote, Video, Pill, Activity, AlertCircle,
  Microscope, Wallet, FileBarChart, Gem, TrendingUp, Coffee,
  HeartPulse, CreditCard, UserPlus,
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
        { path: "/assistant", label: "Assistente IA", icon: BrainCircuit, roles: ["admin", "doctor", "patient"] },
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

type DockMode = "floating" | "top" | "bottom" | "left" | "right";

const EDGE_THRESHOLD_PCT = 0.10;
const STORAGE_KEY_DOCK = "unified_toolbox_dock_mode";
const STORAGE_KEY_VISIBLE = "unified_toolbox_visible";

export default function UnifiedToolbox() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const { minimize, isMinimized } = useMinimizedPanels();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_VISIBLE) !== "false"; } catch { return true; }
  });

  const [dockMode, setDockMode] = useState<DockMode>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY_DOCK);
      if (v === "top" || v === "bottom" || v === "left" || v === "right" || v === "floating") return v as DockMode;
    } catch {}
    return "floating";
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { position, isDragging, onDragStart } = useDraggable({
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
    minimize({ id: "unified-toolbox", label: "Toolbox", icon: "settings" });
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY_VISIBLE, "false"); } catch {}
  }, [minimize]);

  const handleClose = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY_VISIBLE, "false"); } catch {}
  }, []);

  useEffect(() => {
    if (!isMinimized("unified-toolbox") && !visible) {
      setVisible(true);
      try { localStorage.setItem(STORAGE_KEY_VISIBLE, "true"); } catch {}
    }
  }, [isMinimized, visible]);

  if (isMobile || !visible || !user) return null;

  const filteredGroups = getNavGroups(user.role, t);

  const isDocked = dockMode !== "floating";
  const isHorizontal = dockMode === "top" || dockMode === "bottom";
  const isVertical = dockMode === "left" || dockMode === "right";

  const getDockedStyle = (): React.CSSProperties => {
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
    <div
      className={`bg-background/95 backdrop-blur-md border shadow-xl transition-all duration-200 ${
        isDocked ? "" : "rounded-xl"
      } ${isDragging ? "opacity-90 shadow-2xl" : ""} ${
        isHorizontal ? "rounded-none" : ""
      } ${isVertical ? "rounded-none overflow-y-auto" : ""}`}
      style={getDockedStyle()}
      data-draggable-root
    >
      <div className={`flex items-center gap-1 px-2 py-1 border-b bg-muted/30 ${isHorizontal ? "" : ""}`}>
        <div
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        {!collapsed && <span className="text-xs font-medium text-muted-foreground flex-1">Toolbox</span>}
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
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <Link href={item.path}>
                          <button
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs w-full transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {!isHorizontal && <span className="truncate">{item.label}</span>}
                          </button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side={isVertical ? (dockMode === "left" ? "right" : "left") : "bottom"}>
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
