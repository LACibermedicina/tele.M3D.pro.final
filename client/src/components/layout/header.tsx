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
import { LogOut, User, Settings, LayoutDashboard, Users, CalendarClock, MessageCircle, FileText, ClipboardList, BrainCircuit, BookOpenCheck, BarChart3, Shield, Ambulance, Menu, Command, LogIn, UserPlus, Loader2 } from "lucide-react";
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
      toast({
        title: "Erro no Login",
        description: error.message || "Credenciais inválidas",
        variant: "destructive",
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
        const supportMessage = `Olá! Preciso de suporte no sistema Telemed.`;
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
    <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-sm sticky top-0 z-50" data-testid="header-main">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          <div className="flex items-center space-x-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden w-10 h-10 hover:bg-primary/10"
                      data-testid="button-hamburger"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Menu</p>
                </TooltipContent>
              </Tooltip>
              
              <SheetContent side="right" className="w-80 px-0">
                <SheetHeader className="px-6 pb-6 border-b">
                  <SheetTitle className="text-left">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 flex items-center justify-center">
                        <img 
                          src={telemedLogo} 
                          alt="Telemed Logo" 
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
                            <i className={`${item.faIcon} ${isActive ? "text-white" : "text-muted-foreground"}`}></i>
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
                    alt="Telemed Logo" 
                    className="w-full h-full object-contain transition-transform group-hover:scale-110"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <span className="hidden lg:block text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  Telemed
                </span>
              </div>
            </Link>

            {user && (
              <div className="hidden md:flex items-center space-x-2">
                <div>
                  <p className="text-sm font-semibold text-foreground" data-testid="text-greeting">
                    {t("greeting.hello")}, {getShortName(user.name)}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleDisplay(user.role)}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 hover:bg-primary/10"
                      onClick={() => setIsCommandPaletteOpen(true)}
                      data-testid="button-command-palette"
                    >
                      <Command className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comandos (⌘K)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-10 h-10 hover:bg-primary/10 text-primary transition-colors"
                  data-testid="button-support"
                  onClick={handleSupportContact}
                >
                  <i className="fas fa-headset text-lg"></i>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("support.contact")}</p>
              </TooltipContent>
            </Tooltip>
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
                          className={`w-10 h-10 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "text-white shadow-md"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          }`}
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)"
                              : "transparent"
                          }}
                        >
                          <IconComponent className="h-5 w-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </TooltipProvider>

          <div className="flex items-center space-x-4">
            {!user && (
              <form onSubmit={handleQuickLogin} className="hidden lg:flex items-center space-x-3 animate-fade-in">
                <div className="relative">
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email ou usuário"
                    className="w-48 px-4 py-2 rounded-xl border-2 border-primary/30 bg-background/50 backdrop-blur-sm text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 hover:border-primary/50"
                    data-testid="input-quick-login-email"
                    disabled={isLoggingIn}
                  />
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Senha"
                    className="w-40 px-4 py-2 rounded-xl border-2 border-primary/30 bg-background/50 backdrop-blur-sm text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 hover:border-primary/50"
                    data-testid="input-quick-login-password"
                    disabled={isLoggingIn}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-xl px-4 shadow-md hover:shadow-lg transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}
                  disabled={isLoggingIn || !loginEmail || !loginPassword}
                  data-testid="button-quick-login"
                >
                  {isLoggingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}
            
            <LanguageSelector />
            
            {user ? (
              <>
                <NotificationCenter />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="w-10 h-10 text-destructive hover:bg-destructive/10 transition-colors"
                      data-testid="button-emergency"
                      onClick={handleEmergencyContact}
                    >
                      <Ambulance className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Emergência Médica</p>
                  </TooltipContent>
                </Tooltip>
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
                        <p className="text-sm font-semibold" data-testid="text-user-name">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                      className="w-10 h-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
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
                      <Ambulance className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Emergência Médica</p>
                  </TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-10 h-10 rounded-xl hover:bg-primary/10 text-primary/70 hover:text-primary transition-all"
                          data-testid="button-auth-menu"
                        >
                          <UserPlus className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cadastro e Login</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-auto p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-2 border-primary/20 shadow-2xl">
                    <div className="flex flex-col gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem 
                            onClick={() => navigate('/login')} 
                            data-testid="button-login"
                            className="cursor-pointer group p-0 hover:bg-transparent focus:bg-transparent relative"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-all">
                              <LogIn className="h-5 w-5 text-primary" />
                            </div>
                            <span className="absolute left-12 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium pointer-events-none px-2">
                              {t("auth.login")}
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{t("auth.login")}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem 
                            onClick={() => navigate('/register')} 
                            data-testid="button-register"
                            className="cursor-pointer group p-0 hover:bg-transparent focus:bg-transparent relative"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-all">
                              <UserPlus className="h-5 w-5 text-primary" />
                            </div>
                            <span className="absolute left-12 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium pointer-events-none px-2">
                              Cadastrar
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Cadastrar</p>
                        </TooltipContent>
                      </Tooltip>

                      <div className="h-px bg-border/30 my-1" />
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem 
                            onClick={() => {
                              toast({
                                title: "ℹ️ Informações Gerais",
                                description: "Telemed - Sistema de Telemedicina com IA",
                              });
                              navigate('/features');
                            }}
                            data-testid="button-info"
                            className="cursor-pointer group p-0 hover:bg-transparent focus:bg-transparent relative"
                          >
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-all">
                              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="absolute left-12 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium pointer-events-none px-2">
                              Informações
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Informações do Sistema</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem 
                            onClick={() => {
                              toast({
                                title: "🚨 Emergência Médica",
                                description: "Em caso de emergência, ligue 192 (SAMU) ou 193 (Bombeiros)",
                                variant: "destructive",
                              });
                              window.open('tel:192', '_blank');
                            }}
                            data-testid="button-emergency-menu"
                            className="cursor-pointer group p-0 hover:bg-transparent focus:bg-transparent relative"
                          >
                            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center group-hover:bg-destructive/30 transition-all">
                              <Ambulance className="h-5 w-5 text-destructive" />
                            </div>
                            <span className="absolute left-12 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium pointer-events-none px-2">
                              Emergência
                            </span>
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>Acionar Emergência Médica</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
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