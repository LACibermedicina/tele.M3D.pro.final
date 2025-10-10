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
import { LogOut, User, Settings, LayoutDashboard, Users, CalendarClock, MessageCircle, FileText, ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield, Ambulance, Menu, Command, LogIn, UserPlus, Loader2, BookOpen, Stethoscope, Coffee, Zap } from "lucide-react";
import { formatErrorForToast } from "@/lib/error-handler";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NotificationCenter from "@/components/notifications/notification-center";
import CommandPalette from "@/components/command-palette";
import telemedLogo from "@/assets/logo-fundo.png";
import userIcon from "@/assets/user-icon.png";

export default function Header() {
  const [location, navigate] = useLocation();
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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

  const allNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, faIcon: "fas fa-chart-line", roles: ["admin", "doctor", "patient"] },
    { path: "/patients", label: "Pacientes", icon: Users, faIcon: "fas fa-users", roles: ["admin", "doctor"] },
    { path: "/schedule", label: "Agenda", icon: CalendarClock, faIcon: "fas fa-calendar-alt", roles: ["admin", "doctor"] },
    { path: "/whatsapp", label: "WhatsApp IA", icon: MessageCircle, faIcon: "fab fa-whatsapp", roles: ["admin", "doctor"] },
    { path: "/records", label: "Prontuários", icon: FileText, faIcon: "fas fa-file-medical", roles: ["admin", "doctor", "patient"] },
    { path: "/prescriptions", label: "Prescrições", icon: ClipboardList, faIcon: "fas fa-prescription-bottle-alt", roles: ["admin", "doctor"] },
    { path: "/assistant", label: "Assistente IA", icon: BrainCircuit, faIcon: "fas fa-robot", roles: ["admin", "doctor", "patient"] },
    { path: "/medical-references", label: "Referências Médicas", icon: BookOpenCheck, faIcon: "fas fa-file-pdf", roles: ["admin", "doctor"] },
    { path: "/analytics", label: "Analytics", icon: BarChart3, faIcon: "fas fa-chart-bar", roles: ["admin"] },
    { path: "/admin", label: t("navigation.admin"), icon: Shield, faIcon: "fas fa-shield-alt", roles: ["admin"] },
  ];

  // Filter navigation items based on user role
  const navItems = allNavItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

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
        <div className="flex justify-between items-center h-16 sm:h-20 lg:h-24">
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
                        style={{
                          filter: isAuthenticatedPage ? 'none' : (isScrolled ? 'none' : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))')
                        }}
                      />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-white">Menu</p>
                </TooltipContent>
              </Tooltip>
              
              <SheetContent side="right" className="w-80 px-0">
                <SheetHeader className="px-6 pb-6 border-b">
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
                      {user && (
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("greeting.hello")}, {user.name}!
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplay(user.role)}
                          </p>
                        </div>
                      )}
                    </div>
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Menu de navegação principal e informações do usuário
                  </SheetDescription>
                </SheetHeader>
                
                <nav className="flex flex-col p-6 space-y-2">
                  {navItems.map((item) => {
                    const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        data-testid={`link-mobile-nav-${item.path.slice(1) || 'dashboard'}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div
                          className={`flex items-center space-x-4 p-4 rounded-xl transition-all duration-200 ${
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
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isActive ? "bg-white/20" : "bg-muted"
                          }`}>
                            <i className={`${item.faIcon} text-white`}></i>
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>

                {/* Mobile User Info */}
                {user ? (
                  <div className="absolute bottom-6 left-6 right-6 p-4 bg-muted/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="text-white font-semibold" style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}>
                            {getUserInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm" data-testid="text-mobile-user-name">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleDisplay(user.role)}
                          </p>
                        </div>
                      </div>
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
                ) : (
                  <div className="absolute bottom-6 left-6 right-6">
                    <Button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full"
                      data-testid="button-mobile-login"
                    >
                      <i className="fas fa-sign-in-alt mr-2"></i>
                      {t("auth.login")}
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link href="/" data-testid="link-logo">
              <div className="flex items-center space-x-3 cursor-pointer group">
                <div className="w-20 h-20 flex items-center justify-center">
                  <img 
                    src={telemedLogo} 
                    alt="Tele<M3D> Logo" 
                    className="w-full h-full object-contain transition-all duration-300 group-hover:scale-110"
                    style={{ 
                      filter: isAuthenticatedPage 
                        ? (isScrolled 
                            ? 'brightness(0) invert(1)' 
                            : 'brightness(0) invert(0)')
                        : (isScrolled 
                            ? 'brightness(0) invert(1)' 
                            : 'brightness(0) invert(1) drop-shadow(0 4px 20px rgba(0,0,0,0.3))')
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

          {/* Desktop Navigation */}
          <TooltipProvider>
            <nav className="hidden md:flex items-center space-x-2" data-testid="nav-main">
              {navItems.map((item) => {
                const isActive = location === item.path || (location === "/" && item.path === "/dashboard");
                const IconComponent = item.icon;
                
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.path}
                        data-testid={`link-nav-${item.path.slice(1) || 'dashboard'}`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`icon-link-primary group w-10 h-10 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg ${
                            isActive
                              ? "text-white shadow-md"
                              : `${getTextColor()} hover:bg-primary/10`
                          }`}
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)"
                              : "transparent"
                          }}
                        >
                          <IconComponent 
                            className={`h-5 w-5 transition-all duration-300 ${isActive ? 'text-white' : getTextColor()} group-hover:drop-shadow-[0_2px_12px_rgba(234,120,54,0.8)]`}
                            style={{
                              filter: isActive 
                                ? 'drop-shadow(0 2px 8px rgba(255,255,255,0.3))'
                                : (isAuthenticatedPage ? 'none' : (isScrolled ? 'none' : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))'))
                            }}
                          />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-primary text-white font-medium px-3 py-2 shadow-lg">
                      <p className="text-white">{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </TooltipProvider>

          <div className="flex items-center space-x-3">
            {/* Quick Actions Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`icon-link-primary group w-10 h-10 hover:bg-gradient-to-r hover:from-orange-500 hover:to-amber-500 transition-all duration-300 hover:scale-110 hover:shadow-xl ${getTextColor()}`}
                      data-testid="button-quick-actions"
                    >
                      <Zap 
                        className={`h-5 w-5 transition-all duration-300 ${getTextColor()} group-hover:text-white group-hover:drop-shadow-[0_2px_12px_rgba(251,191,36,1)]`}
                        style={{
                          filter: isAuthenticatedPage ? 'none' : (isScrolled ? 'none' : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))')
                        }}
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
                      onClick={() => navigate('/coffee-room')}
                      className="cursor-pointer hover:bg-amber-500/10 py-3"
                      data-testid="menu-coffee-room"
                    >
                      <Coffee className="mr-3 h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-semibold">Cafeteria Virtual</p>
                        <p className="text-xs text-muted-foreground">Área de descanso</p>
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
            </DropdownMenu>

            {!user && (
              <form onSubmit={handleQuickLogin} className="hidden md:flex items-center space-x-2 bg-background/30 backdrop-blur-sm rounded-full px-3 py-1.5 border border-primary/10 animate-fade-in">
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email"
                  className="w-32 px-2 py-1 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none focus:placeholder:text-white/60 transition-all"
                  data-testid="input-quick-login-email"
                  disabled={isLoggingIn}
                />
                <div className="h-4 w-px bg-border/50" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Senha"
                  className="w-24 px-2 py-1 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none focus:placeholder:text-white/60 transition-all"
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
                      <div className="hidden sm:block text-left">
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
              <>
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
                        style={{
                          filter: isScrolled 
                            ? 'none' 
                            : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))'
                        }}
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
                        style={{
                          filter: isScrolled 
                            ? 'none' 
                            : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))'
                        }}
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
                        style={{
                          filter: isScrolled 
                            ? 'none' 
                            : 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))'
                        }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-primary text-white font-medium px-3 py-2 shadow-lg">
                    <p className="text-white">Cadastrar</p>
                  </TooltipContent>
                </Tooltip>
              </>
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
    </header>
  );
}