import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDesktopNavigation, isWindowedRoute } from "@/components/layout/desktop-window-layer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DoorOpen, DoorClosed, HeartPulse, ClipboardList, X, Loader2 } from "lucide-react";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface OfficeStatus {
  isOpen: boolean;
  doctorName?: string;
  channelName?: string;
  currentSessionId?: string | null;
  openedAt?: string | null;
  lastHeartbeatAt?: string | null;
}

/**
 * Mounted once globally (App.tsx). While the doctor's office is open, sends a
 * lightweight heartbeat so the session doesn't auto-close from inactivity when
 * the office was opened via the bar toggle without visiting the office page.
 * It intentionally omits participantCount so it never overwrites the real
 * count reported by the doctor-office page.
 */
export function GlobalOfficeHeartbeat() {
  const { user } = useAuth();
  const isDoctor = user?.role === "doctor";

  const { data: officeStatus } = useQuery<OfficeStatus>({
    queryKey: ["/api/doctor-office/status", user?.id],
    enabled: !!user?.id && isDoctor,
    refetchInterval: 15000,
  });

  const { data: presenceCfg } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings/public/presence"],
    enabled: !!user?.id && isDoctor,
  });
  const heartbeatMs = Math.max(5, parseInt(presenceCfg?.doctor_office_heartbeat_seconds || "30", 10)) * 1000;

  const isOpen = !!officeStatus?.isOpen;

  useEffect(() => {
    if (!isDoctor || !isOpen) return;
    const send = () => {
      fetch("/api/doctor-office/heartbeat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => {});
    };
    send();
    const interval = setInterval(send, heartbeatMs);
    return () => clearInterval(interval);
  }, [isDoctor, isOpen, heartbeatMs]);

  return null;
}

export function OfficeToggleButton({
  tooltipSide = "bottom",
  triggerClassName = "w-9 h-9 rounded-xl",
  iconClassName = "h-4 w-4",
}: {
  tooltipSide?: TooltipSide;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmClose, setConfirmClose] = useState<{ count: number } | null>(null);
  const [isCheckingPending, setIsCheckingPending] = useState(false);

  const isDoctor = user?.role === "doctor";

  const { data: officeStatus } = useQuery<OfficeStatus>({
    queryKey: ["/api/doctor-office/status", user?.id],
    enabled: !!user?.id && isDoctor,
    refetchInterval: 15000,
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/doctor-office/open");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-office/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/available"] });
      toast({
        title: "Consultório aberto",
        description: "Você está visível para os pacientes. Entre no consultório para atender.",
      });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível abrir o consultório.", variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/doctor-office/close");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-office/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/available"] });
      setConfirmClose(null);
      toast({ title: "Consultório fechado", description: "Você não está mais disponível para atendimento imediato." });
    },
    onError: () => {
      setConfirmClose(null);
      toast({ title: "Erro", description: "Não foi possível fechar o consultório.", variant: "destructive" });
    },
  });

  if (!user || !isDoctor) return null;

  const isOpen = !!officeStatus?.isOpen;
  const isBusy = openMutation.isPending || closeMutation.isPending || isCheckingPending;

  const handleToggle = async () => {
    if (isBusy) return;
    if (!isOpen) {
      openMutation.mutate();
      return;
    }
    setIsCheckingPending(true);
    try {
      const res = await apiRequest("GET", "/api/doctor-office/pending-requests");
      const pending = await res.json();
      const count = Array.isArray(pending) ? pending.length : 0;
      if (count > 0) {
        setConfirmClose({ count });
      } else {
        closeMutation.mutate();
      }
    } catch {
      closeMutation.mutate();
    } finally {
      setIsCheckingPending(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleToggle}
              disabled={isBusy}
              className={`relative flex items-center justify-center transition-all duration-200 disabled:opacity-60 ${
                isOpen
                  ? "text-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/40 hover:bg-emerald-500/25"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
              } ${triggerClassName}`}
              data-testid="button-office-toggle"
              aria-label={isOpen ? "Fechar consultório" : "Abrir consultório"}
            >
              {isBusy ? (
                <Loader2 className={`animate-spin ${iconClassName}`} />
              ) : isOpen ? (
                <DoorOpen className={iconClassName} />
              ) : (
                <DoorClosed className={iconClassName} />
              )}
              {isOpen && !isBusy && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>
            <p>{isOpen ? "Consultório aberto — clique para fechar" : "Consultório fechado — clique para abrir"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {confirmClose && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-sm w-full p-5">
            <h3 className="text-base font-semibold mb-1">Fechar consultório?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmClose.count === 1
                ? "Há 1 paciente aguardando atendimento."
                : `Há ${confirmClose.count} pacientes aguardando atendimento.`}{" "}
              Ao fechar, eles serão notificados de que você não está mais disponível.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmClose(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
                data-testid="button-office-close-cancel"
              >
                Cancelar
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                data-testid="button-office-close-confirm"
              >
                {closeMutation.isPending ? "Fechando..." : "Fechar mesmo assim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface MyConsultationsSummary {
  upcoming?: { id: string; status: string }[];
  activeVideoConsultations?: { id: string }[];
  total?: number;
}

export function PatientShortcutIcons({
  tooltipSide = "bottom",
  triggerClassName = "w-9 h-9 rounded-xl",
  iconClassName = "h-4 w-4",
}: {
  tooltipSide?: TooltipSide;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const { user } = useAuth();
  const [location] = useLocation();
  const { navigateToWindow, isDesktopMode: isDesktopNav } = useDesktopNavigation();

  const isPatient = user?.role === "patient";

  const { data: myConsultations } = useQuery<MyConsultationsSummary>({
    queryKey: ["/api/my-consultations"],
    enabled: !!user && isPatient,
    refetchInterval: 60000,
  });

  if (!user || !isPatient) return null;

  const badgeCount =
    (myConsultations?.upcoming?.length || 0) + (myConsultations?.activeVideoConsultations?.length || 0);

  const shortcuts = [
    {
      path: "/consultation-request",
      label: "Solicitar Atendimento",
      icon: HeartPulse,
      iconColor: "text-rose-400",
      testId: "button-shortcut-request-consultation",
      badge: 0,
    },
    {
      path: "/my-consultations",
      label: "Meus Atendimentos",
      icon: ClipboardList,
      iconColor: "text-sky-400",
      testId: "button-shortcut-my-consultations",
      badge: badgeCount,
    },
  ];

  return (
    <TooltipProvider>
      {shortcuts.map((s) => {
        const IconComponent = s.icon;
        const isActive = location === s.path;
        return (
          <Tooltip key={s.path}>
            <TooltipTrigger asChild>
              <Link
                href={s.path}
                onClick={(e: React.MouseEvent) => {
                  if (isDesktopNav && navigateToWindow(s.path)) e.preventDefault();
                }}
                data-testid={s.testId}
              >
                <div
                  className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isActive ? "bg-white/15 ring-1 ring-white/25" : "hover:bg-white/10"
                  } ${s.iconColor} ${triggerClassName}`}
                >
                  <IconComponent className={iconClassName} />
                  {s.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] px-0.5 flex items-center justify-center">
                      {s.badge > 9 ? "9+" : s.badge}
                    </span>
                  )}
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <p>{s.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </TooltipProvider>
  );
}

export function FullscreenPageClose() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  if (!user) return null;
  if (location === "/" || location === "/dashboard") return null;
  if (!isWindowedRoute(location)) return null;

  return (
    <button
      onClick={() => navigate("/dashboard")}
      className="fixed top-[4.5rem] right-3 z-[9000] w-9 h-9 rounded-full flex items-center justify-center bg-slate-900/80 text-white/90 border border-white/20 shadow-lg backdrop-blur-md hover:bg-red-600 hover:text-white active:scale-95 transition-all"
      aria-label="Fechar e voltar ao início"
      data-testid="button-fullscreen-close"
    >
      <X className="h-4.5 w-4.5" />
    </button>
  );
}
