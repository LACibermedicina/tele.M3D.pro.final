import { useState, useEffect } from "react";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
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

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName.toLowerCase()] || LayoutDashboard;
}

export function InlineTrayIcons() {
  const { minimizedPanels, restore, restoreAll } = useMinimizedPanels();

  if (minimizedPanels.length === 0) return null;

  return (
    <>
      {minimizedPanels.map(panel => {
        const Icon = getIcon(panel.icon);
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <button
                className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-slate-300 hover:text-white shrink-0"
                onClick={() => restore(panel.id)}
              >
                <Icon className="h-4 w-4" />
                {panel.badge !== undefined && panel.badge > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-3.5 min-w-[14px] px-0.5 text-[8px] flex items-center justify-center">
                    {panel.badge > 99 ? "99+" : panel.badge}
                  </Badge>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{panel.label}</p></TooltipContent>
          </Tooltip>
        );
      })}
      {minimizedPanels.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white shrink-0"
              onClick={restoreAll}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Restaurar todos</p></TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

export default function MinimizedPanelDock() {
  const { minimizedPanels, restore, restoreAll } = useMinimizedPanels();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (minimizedPanels.length === 0) return null;

  if (!isMobile) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 py-1.5 px-2 bg-background/95 backdrop-blur-sm border-t shadow-lg"
      style={{ overflowX: "auto" }}
    >
      {minimizedPanels.map(panel => {
        const Icon = getIcon(panel.icon);
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative shrink-0 hover:bg-primary/10"
                onClick={() => restore(panel.id)}
              >
                <Icon className="h-4 w-4" />
                {panel.badge !== undefined && panel.badge > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center">
                    {panel.badge > 99 ? "99+" : panel.badge}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top"><p>{panel.label}</p></TooltipContent>
          </Tooltip>
        );
      })}
      {minimizedPanels.length > 1 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={restoreAll}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p>Restaurar todos</p></TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
