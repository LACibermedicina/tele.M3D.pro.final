import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import LanguageSelector from "@/components/ui/language-selector";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogOut, User, Settings, LayoutDashboard, Users, CalendarClock, MessageCircle, FileText, ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield, Ambulance, Menu, Command, LogIn, UserPlus, Loader2, BookOpen, Stethoscope, Coffee, Zap, Video, StickyNote, Pill, Activity, HelpCircle, Terminal, AlertCircle, Microscope, Wallet, FileBarChart, Gem, TrendingUp, AudioLines, ChevronDown, CalendarX2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatErrorForToast } from "@/lib/error-handler";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NotificationCenter from "@/components/notifications/notification-center";
import CommandPalette from "@/components/command-palette";
import telemedLogo from "@/assets/logo-fundo.png";
import userIcon from "@/assets/user-icon.png";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

export default function Header() {
  const [location, navigate] = useLocation();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { voiceMode, setVoiceMode, hasDecided } = useVoiceAssistant();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showClearScheduleConfirm, setShowClearScheduleConfirm] = useState(false);

  const clearScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/appointments/cancel-all', {
        doctorId: user?.id,
        scope: 'all',
      });
      return res.json();
    },
    onSuccess: (data) => {
      const totalCancelled = (data.cancelled || 0) + (data.cancelledInterConsultations || 0);
      toast({
        title: "Agenda Limpa",
        description: totalCancelled > 0
          ? `${data.cancelled} consulta(s) e ${data.cancelledInterConsultations || 0} interconsulta(s) canceladas. Todas as partes foram notificadas.`
          : "Não havia consultas agendadas para cancelar.",
      });
      setShowClearScheduleConfirm(false);
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error, '/api/appointments/cancel-all', 'POST');
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
        errorCode: errorInfo.errorCode,
      });
    },
  });

  // Handle scroll effect for header background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Determine if we're on an authenticated page (not home/login)
  const isAuthenticatedPage = user !== null && location !== '/' && location !== '/login';

  // Get text color based on page type and scroll state
  const getTextColor = () => {
    if (isAuthenticatedPage) {
      // Authenticated pages: dark when not scrolled (light mode), white in dark mode or when scrolled
      return isScrolled ? 'text-white' : 'text-gray-800 dark:text-white';
    } else {
      // Home/Login: always white
      return 'text-white';
    }
  };

  // Get shadow effect based on page type and scroll state
  const getShadowEffect = () => {
    if (isAuthenticatedPage) {
      // No shadow on authenticated pages when not scrolled
      return isScrolled ? 'none' : 'none';
    } else {
      // Shadow on home/login when not scrolled
      return isScrolled ? 'none' : '0 4px 20px rgba(0,0,0,0.3), 0 2px 10px rgba(0,0,0,0.2)';
    }
  };

  // Get only first and second name
  const getShortName = (fullName: string) => {
    const names = fullName.trim().split(' ');
    if (names.length <= 2) return fullName;
    return `${names[0]} ${names[1]}`;
  };

  // Listen for ⌘K / Ctrl+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
      const response = await apiRequest('POST', '/api/auth/login', { 
        username: loginEmail, 
        password: loginPassword 
      });

      if (response.ok) {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      const errorInfo = formatErrorForToast(error, '/api/auth/login', 'POST');
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
        errorCode: errorInfo.errorCode,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: t("auth.logout_success"),
        description: t("auth.logout_success_desc"),
      });
    } catch (error) {
      toast({
        title: t("auth.logout_error"),
        description: t("auth.logout_error_desc"),
        variant: "destructive",
      });
    }
  };

  const handleSupportContact = async () => {
    try {
      // Get support configuration first
      const configResponse = await fetch('/api/support/config');
      const supportConfig = await configResponse.json();
      
      if (supportConfig.whatsappNumber && supportConfig.supportChatbotEnabled) {
        // Open WhatsApp directly with support number
        // Privacy-conscious message without PII in URL
        const supportMessage = `Olá! Preciso de suporte no sistema Tele<M3D>.`;
        const whatsappUrl = `https://wa.me/55${supportConfig.whatsappNumber}?text=${encodeURIComponent(supportMessage)}`;
        
        // Try to open WhatsApp
        window.open(whatsappUrl, '_blank');
        
        toast({
          title: "WhatsApp Aberto",
          description: "Chat do WhatsApp foi aberto para contato direto com suporte!",
        });
        
        // Also send internal notification for tracking
        await apiRequest('POST', '/api/support/contact', {
          message: 'Usuário abriu WhatsApp para suporte direto',
          userInfo: {
            name: user?.name,
            email: user?.email,
            phone: user?.phone
          },
          priority: 'low'
        });
        
      } else {
        // Fallback to old method if WhatsApp not available
        const response: any = await apiRequest('POST', '/api/support/contact', {
          message: 'Solicitação de suporte através da interface do sistema',
          userInfo: {
            name: user?.name,
            email: user?.email,
            phone: user?.phone
          },
          priority: 'medium'
        });

        toast({
          title: "Suporte Contactado",
          description: response.message || "Mensagem enviada com sucesso!",
        });

        if (response.method === 'whatsapp' && response.autoResponse) {
          setTimeout(() => {
            toast({
              title: "Resposta Automática",
              description: response.autoResponse,
            });
          }, 1000);
        }
      }
    } catch (error) {
      toast({
        title: "Erro no Suporte",
        description: "Não foi possível contatar o suporte. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEmergencyContact = async () => {
    try {
      // Try to get user's location for emergency
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const response: any = await apiRequest('POST', '/api/support/emergency', {
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            },
            userInfo: {
              name: user?.name,
              phone: user?.phone
            },
            type: 'samu_whatsapp'
          });

          if (response.phone) {
            const whatsappUrl = `https://wa.me/${response.phone}?text=Emergência médica - Solicito atendimento imediato`;
            window.open(whatsappUrl, '_blank');
          }

          toast({
            title: "Emergência Médica",
            description: response.message || "Contato de emergência acionado",
          });
        }, async () => {
          // Fallback without location
          const response: any = await apiRequest('POST', '/api/support/emergency', {
            userInfo: {
              name: user?.name,
              phone: user?.phone
            },
            type: 'samu_whatsapp'
          });

          if (response.phone) {
            const whatsappUrl = `https://wa.me/${response.phone}?text=Emergência médica - Solicito atendimento imediato`;
            window.open(whatsappUrl, '_blank');
          }

          toast({
            title: "Emergência Médica",
            description: response.message || "Contato de emergência acionado",
          });
        });
      } else {
        // No geolocation support
        const response: any = await apiRequest('POST', '/api/support/emergency', {
          userInfo: {
            name: user?.name,
            phone: user?.phone
          },
          type: 'samu_whatsapp'
        });

        if (response.phone) {
          const whatsappUrl = `https://wa.me/${response.phone}?text=Emergência médica - Solicito atendimento imediato`;
          window.open(whatsappUrl, '_blank');
        }

        toast({
          title: "Emergência Médica",
          description: response.message || "Contato de emergência acionado",
        });
      }
    } catch (error) {
      toast({
        title: "Erro na Emergência",
        description: "Não foi possível acionar o contato de emergência. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'doctor':
        return t('roles.doctor');
      case 'admin':
        return t('roles.admin');
      case 'patient':
        return t('roles.patient');
      default:
        return role;
    }
  };

  const { data: patientPrescriptions } = useQuery<any[]>({
    queryKey: ['/api/prescriptions/recent'],
    enabled: user?.role === 'patient',
    select: (data) => data || [],
  });

  const { data: patientRecords } = useQuery<any[]>({
    queryKey: ['/api/medical-records/my'],
    enabled: user?.role === 'patient',
    select: (data) => data || [],
  });

  const hasActivePrescriptions = patientPrescriptions?.some((p: any) => {
    return p.status === 'active' && new Date(p.expiresAt) >= new Date();
  }) || false;

  const hasRecords = (patientRecords && patientRecords.length > 0);

  const navGroups = [
    {
      category: "principal",
      label: "Principal",
      items: [
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, faIcon: "fas fa-chart-line", roles: ["admin", "doctor", "patient"] },
        { path: "/assistant", label: "Assistente IA", icon: BrainCircuit, faIcon: "fas fa-robot", roles: ["admin", "doctor", "patient"] },
      ],
    },
    {
      category: "clinico",
      label: "Clínico",
      items: [
        { path: "/patients", label: "Pacientes", icon: Users, faIcon: "fas fa-users", roles: ["admin", "doctor"] },
        { path: "/schedule", label: "Agenda", icon: CalendarClock, faIcon: "fas fa-calendar-alt", roles: ["admin", "doctor"] },
        { path: "/records", label: "Prontuários", icon: FileText, faIcon: "fas fa-file-medical", roles: ["admin", "doctor"] },
        { path: "/prescriptions", label: "Prescrições", icon: ClipboardList, faIcon: "fas fa-prescription-bottle-alt", roles: ["admin", "doctor"] },
        { path: "/inter-consultation", label: "Interconsulta", icon: Stethoscope, faIcon: "fas fa-user-md", roles: ["doctor"] },
        { path: "/doctor-notes", label: "Anotações", icon: StickyNote, faIcon: "fas fa-sticky-note", roles: ["doctor"] },
      ],
    },
    {
      category: "paciente",
      label: "Consultas",
      items: [
        { path: "/consultation-request", label: "Solicitar Consulta", icon: Stethoscope, faIcon: "fas fa-stethoscope", roles: ["patient"] },
        { path: "/immediate-consultation", label: "Sala de Espera", icon: Video, faIcon: "fas fa-hospital", roles: ["patient"] },
        { path: "/my-consultations", label: "Minhas Consultas", icon: CalendarClock, faIcon: "fas fa-calendar-check", roles: ["patient"] },
      ],
    },
    {
      category: "revisao",
      label: "Revisão & Diagnóstico",
      items: [
        { path: "/incomplete-consultations", label: "Pendências", icon: AlertCircle, faIcon: "fas fa-exclamation-circle", roles: ["doctor"] },
        { path: "/post-consultation-review", label: "Revisão Pós-Consulta", icon: ClipboardList, faIcon: "fas fa-clipboard-check", roles: ["doctor"] },
        { path: "/diagnostic-review", label: "Inferências Diagnósticas", icon: Microscope, faIcon: "fas fa-microscope", roles: ["doctor"] },
      ],
    },
    {
      category: "comunicacao",
      label: "Comunicação & IA",
      items: [
        { path: "/whatsapp", label: "WhatsApp IA", icon: MessageCircle, faIcon: "fab fa-whatsapp", roles: ["admin", "doctor"] },
        { path: "/medical-references", label: "Referências Médicas", icon: BookOpenCheck, faIcon: "fas fa-file-pdf", roles: ["admin", "doctor"] },
        { path: "/coffee-room", label: "Cafeteria Virtual", icon: Coffee, faIcon: "fas fa-mug-hot", roles: ["doctor"] },
      ],
    },
    {
      category: "financeiro",
      label: "Financeiro & Blockchain",
      items: [
        { path: "/wallet", label: "Carteira Digital", icon: Wallet, faIcon: "fas fa-wallet", roles: ["doctor", "patient", "admin", "researcher"] },
        { path: "/nft-management", label: "NFTs Dinâmicos", icon: Gem, faIcon: "fas fa-gem", roles: ["admin", "doctor", "researcher"] },
        { path: "/broker", label: "Broker", icon: TrendingUp, faIcon: "fas fa-exchange-alt", roles: ["admin", "doctor", "patient", "researcher"] },
      ],
    },
    {
      category: "relatorios",
      label: "Relatórios & Analytics",
      items: [
        { path: "/epidemiological-reports", label: "Epidemiologia", icon: Activity, faIcon: "fas fa-chart-area", roles: ["admin", "doctor"] },
        { path: "/reports", label: "Relatórios", icon: FileBarChart, faIcon: "fas fa-file-chart-line", roles: ["admin", "doctor"] },
        { path: "/analytics", label: "Analytics", icon: BarChart3, faIcon: "fas fa-chart-bar", roles: ["admin"] },
      ],
    },
    {
      category: "admin",
      label: "Administração",
      items: [
        { path: "/admin", label: t("navigation.admin"), icon: Shield, faIcon: "fas fa-shield-alt", roles: ["admin"] },
      ],
    },
  ];

  if (user?.role === 'patient' && hasActivePrescriptions) {
    const patientGroup = navGroups.find(g => g.category === 'paciente');
    if (patientGroup) patientGroup.items.push({ path: "/prescriptions", label: "Minhas Prescrições", icon: Pill, faIcon: "fas fa-pills", roles: ["patient"] });
  }
  if (user?.role === 'patient') {
    const patientGroup = navGroups.find(g => g.category === 'paciente');
    if (patientGroup) patientGroup.items.push({ path: "/records", label: hasRecords ? "Meu Prontuário" : "Minhas Solicitações", icon: hasRecords ? FileText : ClipboardList, faIcon: hasRecords ? "fas fa-file-medical" : "fas fa-clipboard-list", roles: ["patient"] });
  }

  const allNavItems = navGroups.flatMap(g => g.items);

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (user?.role) return item.roles.includes(user.role);
      return item.roles.includes('visitor');
    }),
  })).filter(group => group.items.length > 0);

  const navItems = allNavItems.filter(item => {
    if (user?.role) return item.roles.includes(user.role);
    return item.roles.includes('visitor');
  });

  const { data: pendingPostItems } = useQuery<any[]>({
    queryKey: ["/api/post-consultation/pending"],
    enabled: !!user && user.role === "doctor",
    refetchInterval: 60000,
  });
  const pendingPostCount = pendingPostItems?.length || 0;

  return (
    <header 
      className={`border-b sticky top-0 z-50 transition-all duration-300 w-full ${
        isScrolled 
          ? 'bg-slate-900/80 backdrop-blur-md border-slate-700 shadow-lg' 
          : 'bg-transparent border-transparent'
      }`} 
      data-testid="header-main"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-20 lg:h-24">
          <div className="flex items-center space-x-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`md:hidden w-10 h-10 hover:bg-primary/10 transition-colors duration-300 ${getTextColor()}`}
                      data-testid="button-hamburger"
                    >
                      <Menu 
                        className={`h-5 w-5 transition-all duration-300 ${getTextColor()}`}
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                      />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-white">Menu</p>
                </TooltipContent>
              </Tooltip>
              
              <SheetContent side="left" className="w-80 px-0 overflow-y-auto">
                <SheetHeader className="px-6 pb-4 border-b">
                  <SheetTitle className="text-left">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 flex items-center justify-center">
                        <img 
                          src={telemedLogo} 
                          alt="Tele<M3D> Logo" 
                          className="w-full h-full object-contain"
                          style={{ filter: 'brightness(0) invert(1)' }}
                        />
                      </div>
                      {user ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("greeting.hello")}, {getShortName(user.name)}!
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplay(user.role)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-foreground">Tele&lt;M3D&gt;</p>
                          <p className="text-xs text-muted-foreground">Telemedicina com IA</p>
                        </div>
                      )}
                    </div>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Menu de navegação principal e informações do usuário
                  </SheetDescription>
                </SheetHeader>
                
                <nav className="flex flex-col px-4 py-3 space-y-0.5 pb-32">
                  {user && filteredGroups.map((group, groupIdx) => (
                    <div key={group.category}>
                      {groupIdx > 0 && <div className="my-2 border-t border-border/50" />}
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-1 mt-1">{group.label}</p>
                      {group.items.map((item) => {
                        const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
                        const mobileBadge = item.path === '/post-consultation-review' && pendingPostCount > 0;
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            data-testid={`link-mobile-nav-${item.path.slice(1) || 'dashboard'}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <div
                              className={`flex items-center space-x-3 p-2.5 rounded-xl transition-all duration-200 ${
                                isActive
                                  ? "text-white shadow-lg"
                                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                              }`}
                              style={{
                                background: isActive
                                  ? "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)"
                                  : "transparent"
                              }}
                            >
                              <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive ? "bg-white/20" : "bg-muted"
                              }`}>
                                <i className={`${item.faIcon} text-xs`}></i>
                                {mobileBadge && (
                                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                                    {pendingPostCount > 9 ? '9+' : pendingPostCount}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-sm">{item.label}</span>
                              {mobileBadge && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                                  {pendingPostCount}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}

                  <div className="my-2 border-t border-border/50" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-1 mt-1">Acesso</p>
                  {user ? (
                    <div
                      onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                      className="flex items-center space-x-3 p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                        <LogOut className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">Sair</span>
                    </div>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="flex items-center space-x-3 p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                            <LogIn className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm">Entrar</span>
                        </div>
                      </Link>
                      <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="flex items-center space-x-3 p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                            <UserPlus className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm">Cadastrar</span>
                        </div>
                      </Link>
                      <Link href="/features" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="flex items-center space-x-3 p-2.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                            <Shield className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm">Sobre o Sistema</span>
                        </div>
                      </Link>
                      <div 
                        className="flex items-center space-x-3 p-2.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/5 cursor-pointer"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          toast({
                            title: "Emergência Médica",
                            description: "Em caso de emergência, ligue 192 (SAMU) ou 193 (Bombeiros)",
                            variant: "destructive",
                          });
                          window.open('tel:192', '_blank');
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30 shrink-0">
                          <Ambulance className="h-4 w-4 text-red-500" />
                        </div>
                        <span className="font-medium text-sm text-red-600 dark:text-red-400">Emergência Médica</span>
                      </div>
                    </>
                  )}
                </nav>


                {user ? (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}>
                            {getUserInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-mobile-user-name">
                            {getShortName(user.name)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplay(user.role)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setIsMobileMenuOpen(false); navigate('/profile'); }}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleLogout}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid="button-mobile-logout"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </SheetContent>
            </Sheet>

            <Link href="/" data-testid="link-logo">
              <div className="flex items-center space-x-3 cursor-pointer group">
                <div className="w-12 h-12 md:w-20 md:h-20 flex items-center justify-center">
                  <img 
                    src={telemedLogo} 
                    alt="Tele<M3D> Logo" 
                    className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                    style={{ 
                      filter: isAuthenticatedPage 
                        ? (isScrolled 
                            ? 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.25))' 
                            : 'brightness(0) invert(0) drop-shadow(0 2px 6px rgba(0,0,0,0.25))')
                        : (isScrolled 
                            ? 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.25))' 
                            : 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.25))')
                    }}
                  />
                  {/* Dark mode override for authenticated pages when not scrolled */}
                  <style>{`
                    .dark img[alt="Tele<M3D> Logo"] {
                      ${isAuthenticatedPage && !isScrolled ? 'filter: brightness(0) invert(1) !important;' : ''}
                    }
                  `}</style>
                </div>
                <span 
                  className={`hidden md:block text-xl font-bold group-hover:text-primary transition-all duration-300 ${getTextColor()}`}
                  style={{
                    textShadow: getShadowEffect()
                  }}
                >
                  Tele&lt;M3D&gt;
                </span>
              </div>
            </Link>

            {user && (
              <div className="hidden md:flex items-center space-x-2">
                <div>
                  <p 
                    className={`text-sm font-semibold transition-all duration-300 ${getTextColor()}`}
                    data-testid="text-greeting"
                    style={{
                      textShadow: getShadowEffect()
                    }}
                  >
                    {t("greeting.hello")}, {getShortName(user.name)}!
                  </p>
                  <p 
                    className={`text-xs transition-all duration-300 ${isAuthenticatedPage && !isScrolled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-200'}`}
                    style={{
                      textShadow: isAuthenticatedPage ? 'none' : getShadowEffect()
                    }}
                  >
                    {getRoleDisplay(user.role)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Navigation - Grouped by functional area with dropdown menus */}
          <TooltipProvider>
            <nav className="hidden md:flex items-center space-x-1" data-testid="nav-main">
              {filteredGroups.map((group, groupIdx) => {
                const groupHasActive = group.items.some(item => location === item.path || (location === "/" && item.path === "/dashboard"));
                const groupHasBadge = group.items.some(item => item.path === '/post-consultation-review' && pendingPostCount > 0);
                const FirstIcon = group.items[0]?.icon;

                if (group.items.length === 1) {
                  const item = group.items[0];
                  const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
                  const IconComponent = item.icon;
                  return (
                    <div key={group.category} className="flex items-center">
                      {groupIdx > 0 && (
                        <div className={`mx-1 h-6 w-px ${isAuthenticatedPage ? 'bg-border/50' : (isScrolled ? 'bg-white/20' : 'bg-white/15')}`} />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.path} data-testid={`link-nav-${item.path.slice(1) || 'dashboard'}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`icon-link-primary group w-9 h-9 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg ${
                                isActive ? "text-white shadow-md" : `${getTextColor()} hover:bg-primary/10`
                              }`}
                              style={{
                                background: isActive ? "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" : "transparent"
                              }}
                            >
                              <IconComponent 
                                className={`h-4.5 w-4.5 transition-all duration-300 ${isActive ? 'text-white' : getTextColor()} group-hover:drop-shadow-[0_2px_12px_rgba(234,120,54,0.8)]`}
                                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                              />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-primary text-white font-medium px-3 py-2 shadow-lg">
                          <p className="text-white">{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                }

                return (
                  <div key={group.category} className="flex items-center">
                    {groupIdx > 0 && (
                      <div className={`mx-1 h-6 w-px ${isAuthenticatedPage ? 'bg-border/50' : (isScrolled ? 'bg-white/20' : 'bg-white/15')}`} />
                    )}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className={`icon-link-primary group h-9 px-2 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                                groupHasActive ? "text-white shadow-md" : `${getTextColor()} hover:bg-primary/10`
                              }`}
                              style={{
                                background: groupHasActive ? "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" : "transparent"
                              }}
                              data-testid={`dropdown-nav-${group.category}`}
                            >
                              <div className="relative flex items-center gap-0.5">
                                {FirstIcon && (
                                  <FirstIcon 
                                    className={`h-4.5 w-4.5 transition-all duration-300 ${groupHasActive ? 'text-white' : getTextColor()} group-hover:drop-shadow-[0_2px_12px_rgba(234,120,54,0.8)]`}
                                    style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                                  />
                                )}
                                <ChevronDown className={`h-3 w-3 transition-all duration-300 ${groupHasActive ? 'text-white/70' : getTextColor()} opacity-60`} />
                                {groupHasBadge && (
                                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md animate-pulse">
                                    {pendingPostCount > 9 ? '9+' : pendingPostCount}
                                  </span>
                                )}
                              </div>
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-primary text-white font-medium px-3 py-2 shadow-lg">
                          <p className="text-white">{group.label}</p>
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="center" className="w-56 bg-background/95 backdrop-blur-lg border-primary/20 shadow-2xl">
                        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          {group.label}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {group.items.map((item) => {
                          const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
                          const IconComponent = item.icon;
                          const hasBadge = item.path === '/post-consultation-review' && pendingPostCount > 0;
                          return (
                            <DropdownMenuItem
                              key={item.path}
                              onClick={() => navigate(item.path)}
                              className={`cursor-pointer py-2.5 px-3 transition-all ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-primary/5'}`}
                              data-testid={`link-nav-${item.path.slice(1) || 'dashboard'}`}
                            >
                              <IconComponent className={`mr-3 h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }} />
                              <span className="flex-1">{item.label}</span>
                              {hasBadge && (
                                <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {pendingPostCount > 9 ? '9+' : pendingPostCount}
                                </span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </nav>
          </TooltipProvider>

          <div className="flex items-center space-x-1 md:space-x-3">
            {/* Quick Actions Menu - only for logged-in users */}
            {user && <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`icon-link-primary group w-8 h-8 md:w-10 md:h-10 hover:bg-gradient-to-r hover:from-orange-500 hover:to-amber-500 transition-all duration-300 hover:scale-110 hover:shadow-xl ${getTextColor()}`}
                      data-testid="button-quick-actions"
                    >
                      <Zap 
                        className={`h-5 w-5 transition-all duration-300 ${getTextColor()} group-hover:text-white group-hover:drop-shadow-[0_2px_12px_rgba(251,191,36,1)]`}
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium px-3 py-2 shadow-lg">
                  <p className="text-white">Ações Rápidas</p>
                </TooltipContent>
              </Tooltip>
              
              <DropdownMenuContent align="end" className="w-64 bg-background/95 backdrop-blur-lg border-primary/20 shadow-2xl">
                <DropdownMenuLabel className="text-base font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  ⚡ Ações Rápidas
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {user && (
                  <DropdownMenuItem 
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="cursor-pointer hover:bg-primary/10 py-3"
                    data-testid="menu-command-palette"
                  >
                    <Command className="mr-3 h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-semibold">Paleta de Comandos</p>
                      <p className="text-xs text-muted-foreground">⌘K para abrir</p>
                    </div>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  onClick={handleSupportContact}
                  className="cursor-pointer hover:bg-primary/10 py-3"
                  data-testid="menu-support"
                >
                  <i className="fas fa-headset mr-3 text-lg text-orange-500"></i>
                  <div>
                    <p className="font-semibold">{t("support.contact")}</p>
                    <p className="text-xs text-muted-foreground">Contato com suporte</p>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  onClick={() => navigate('/documentation')}
                  className="cursor-pointer hover:bg-primary/10 py-3"
                  data-testid="menu-documentation"
                >
                  <BookOpen className="mr-3 h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-semibold">Documentação</p>
                    <p className="text-xs text-muted-foreground">Guias e tutoriais</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/manual')}
                  className="cursor-pointer hover:bg-primary/10 py-3"
                >
                  <BookOpen className="mr-3 h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-semibold">Manual do Usuário</p>
                    <p className="text-xs text-muted-foreground">Guia completo de uso</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate('/faq')}
                  className="cursor-pointer hover:bg-primary/10 py-3"
                >
                  <HelpCircle className="mr-3 h-5 w-5 text-pink-500" />
                  <div>
                    <p className="font-semibold">FAQ</p>
                    <p className="text-xs text-muted-foreground">Perguntas frequentes</p>
                  </div>
                </DropdownMenuItem>
                {user?.role === 'admin' && (
                  <DropdownMenuItem 
                    onClick={() => navigate('/installation')}
                    className="cursor-pointer hover:bg-primary/10 py-3"
                  >
                    <Terminal className="mr-3 h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-semibold">Instalação</p>
                      <p className="text-xs text-muted-foreground">Script de instalação</p>
                    </div>
                  </DropdownMenuItem>
                )}
                
                {user?.role === 'doctor' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate('/doctor-office')}
                      className="cursor-pointer hover:bg-blue-500/10 py-3"
                      data-testid="menu-doctor-office"
                    >
                      <Stethoscope className="mr-3 h-5 w-5 text-blue-500 animate-pulse" />
                      <div>
                        <p className="font-semibold text-blue-600 dark:text-blue-400">Abrir Consultório</p>
                        <p className="text-xs text-muted-foreground">Sala de atendimento</p>
                      </div>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.preventDefault();
                        setShowClearScheduleConfirm(true);
                      }}
                      className="cursor-pointer hover:bg-red-500/10 py-3"
                      data-testid="menu-clear-schedule"
                    >
                      <CalendarX2 className="mr-3 h-5 w-5 text-red-500" />
                      <div>
                        <p className="font-semibold text-red-600 dark:text-red-400">Limpar Agenda</p>
                        <p className="text-xs text-muted-foreground">Cancelar todas as consultas</p>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleEmergencyContact}
                  className="cursor-pointer hover:bg-destructive/10 py-3"
                  data-testid="menu-emergency"
                >
                  <Ambulance className="mr-3 h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-600 dark:text-red-400">Emergência Médica</p>
                    <p className="text-xs text-muted-foreground">Contato de emergência</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}

            {!user && (
              <form onSubmit={handleQuickLogin} className="hidden md:flex items-center space-x-2 bg-background/30 backdrop-blur-sm rounded-full px-3 py-1.5 border border-primary/10 animate-fade-in">
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email"
                  className="w-32 px-2 py-1 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none focus:placeholder:text-white/60 transition-all drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
                  data-testid="input-quick-login-email"
                  disabled={isLoggingIn}
                />
                <div className="h-4 w-px bg-border/50" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-24 px-2 py-1 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none focus:placeholder:text-white/60 transition-all drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
                  data-testid="input-quick-login-password"
                  disabled={isLoggingIn}
                />
                <button
                  type="submit"
                  disabled={isLoggingIn || !loginEmail || !loginPassword}
                  className="ml-1 p-1.5 rounded-full hover:bg-primary/10 disabled:opacity-40 transition-all"
                  data-testid="button-quick-login"
                >
                  {isLoggingIn ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]" />
                  ) : (
                    <LogIn className="h-3.5 w-3.5 text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]" />
                  )}
                </button>
              </form>
            )}
            
            {hasDecided && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setVoiceMode(!voiceMode)}
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      voiceMode 
                        ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30" 
                        : "bg-slate-200/80 dark:bg-slate-700/80 text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    <AudioLines className="w-4 h-4" />
                    {voiceMode && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{voiceMode ? "Desativar IAM3D" : "Ativar IAM3D"}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <LanguageSelector />
            
            {user ? (
              <>
                <NotificationCenter isScrolled={isScrolled} />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-3 p-2 rounded-xl hover:bg-primary/5 transition-colors"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}>
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden md:block text-left">
                        <p 
                          className={`text-sm font-semibold transition-all duration-300 ${getTextColor()}`}
                          data-testid="text-user-name"
                          style={{
                            textShadow: getShadowEffect()
                          }}
                        >
                          {user.name}
                        </p>
                        <p 
                          className={`text-xs transition-all duration-300 ${isAuthenticatedPage && !isScrolled ? 'text-gray-600 dark:text-gray-300' : 'text-gray-200'}`}
                          style={{
                            textShadow: isAuthenticatedPage ? 'none' : getShadowEffect()
                          }}
                        >
                          {getRoleDisplay(user.role)}
                        </p>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-muted-foreground font-normal">
                          {user.email || user.username}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="button-profile">
                      <User className="mr-2 h-4 w-4" />
                      {t("auth.profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="button-settings">
                      <Settings className="mr-2 h-4 w-4" />
                      {t("auth.settings")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                      data-testid="button-desktop-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("auth.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="hidden md:flex items-center space-x-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="icon-link-accent group w-10 h-10 rounded-xl hover:bg-primary/10 transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      data-testid="button-info-visitor"
                      onClick={() => {
                        toast({
                          title: "ℹ️ Informações Gerais",
                          description: "Tele<M3D> - Sistema de Telemedicina com IA",
                        });
                        navigate('/features');
                      }}
                    >
                      <Shield 
                        className="h-5 w-5 text-white group-hover:drop-shadow-[0_2px_12px_rgba(59,130,246,0.8)] transition-all duration-300" 
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-blue-500 text-white font-medium px-3 py-2 shadow-lg">
                    <p className="text-white">Informações do Sistema</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="icon-link-destructive group w-10 h-10 text-white rounded-xl hover:bg-destructive/10 transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      data-testid="button-emergency-visitor"
                      onClick={() => {
                        toast({
                          title: "🚨 Emergência Médica",
                          description: "Em caso de emergência, ligue 192 (SAMU) ou 193 (Bombeiros)",
                          variant: "destructive",
                        });
                        window.open('tel:192', '_blank');
                      }}
                    >
                      <Ambulance 
                        className="h-5 w-5 text-white group-hover:drop-shadow-[0_2px_12px_rgba(239,68,68,0.8)] transition-all duration-300" 
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-destructive text-white font-medium px-3 py-2 shadow-lg">
                    <p className="text-white">Emergência Médica</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="icon-link-primary group w-10 h-10 rounded-xl hover:bg-primary/10 transition-all duration-300 hover:scale-110 hover:shadow-lg"
                      data-testid="button-register-icon"
                      onClick={() => navigate('/register')}
                    >
                      <UserPlus 
                        className="h-5 w-5 text-white group-hover:drop-shadow-[0_2px_12px_rgba(234,120,54,0.8)] transition-all duration-300" 
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-primary text-white font-medium px-3 py-2 shadow-lg">
                    <p className="text-white">Cadastrar</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)}
        userRole={user?.role}
      />

      {showClearScheduleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowClearScheduleConfirm(false)}>
          <div 
            className="bg-background rounded-2xl shadow-2xl border border-destructive/20 p-6 max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <CalendarX2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Limpar Agenda</h3>
                <p className="text-sm text-muted-foreground">Ação irreversível</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Esta ação irá cancelar <span className="font-semibold text-foreground">todas as consultas agendadas</span> e <span className="font-semibold text-foreground">interconsultas pendentes</span>.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Todos os pacientes e médicos envolvidos serão notificados sobre o cancelamento.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowClearScheduleConfirm(false)}
                disabled={clearScheduleMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => clearScheduleMutation.mutate()}
                disabled={clearScheduleMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {clearScheduleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <CalendarX2 className="mr-2 h-4 w-4" />
                    Confirmar Limpeza
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}