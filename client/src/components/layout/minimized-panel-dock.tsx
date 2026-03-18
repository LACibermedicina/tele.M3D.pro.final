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

export default function MinimizedPanelDock() {
  const { minimizedPanels, restore, restoreAll, dockSide, setDockSide } = useMinimizedPanels();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (minimizedPanels.length === 0) return null;

  const isLeft = dockSide === "left";

  if (isMobile) {
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

  return (
    <div
      className={`fixed top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1 py-2 px-1 bg-background/95 backdrop-blur-sm border shadow-lg rounded-lg transition-all duration-300 ${
        isLeft ? "left-1 border-r rounded-l-lg" : "right-1 border-l rounded-r-lg"
      }`}
      style={{ maxHeight: "80vh", overflowY: "auto" }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mb-1 text-muted-foreground hover:text-foreground"
            onClick={() => setDockSide(isLeft ? "right" : "left")}
          >
            <Share2 className="h-3 w-3" style={{ transform: isLeft ? "scaleX(-1)" : "none" }} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={isLeft ? "right" : "left"}>
          <p>Mover dock para {isLeft ? "direita" : "esquerda"}</p>
        </TooltipContent>
      </Tooltip>

      <div className="w-6 border-t mb-1" />

      {minimizedPanels.map(panel => {
        const Icon = getIcon(panel.icon);
        return (
          <Tooltip key={panel.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative hover:bg-primary/10 transition-all duration-200 hover:scale-110"
                onClick={() => restore(panel.id)}
              >
                <Icon className="h-4 w-4" />
                {panel.badge !== undefined && panel.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center"
                  >
                    {panel.badge > 99 ? "99+" : panel.badge}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isLeft ? "right" : "left"}>
              <p>{panel.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {minimizedPanels.length > 1 && (
        <>
          <div className="w-6 border-t mt-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mt-1 text-muted-foreground hover:text-foreground"
                onClick={restoreAll}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isLeft ? "right" : "left"}>
              <p>Restaurar todos</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
