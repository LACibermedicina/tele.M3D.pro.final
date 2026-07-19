import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { User, UserCheck, Stethoscope, MessageCircle, Send, Loader2 } from "lucide-react";
import telemedLogo from "@/assets/logo-fundo.png";
import origamiHeroImage from "@assets/LogoOrigami_1759774106948.png";
import { formatErrorForToast } from "@/lib/error-handler";
import PageWrapper from "@/components/layout/page-wrapper";
import { apiRequest } from "@/lib/queryClient";
import { useViewMode } from "@/contexts/ViewModeContext";

// Create schemas using translation function
const createLoginSchema = (t: any) => z.object({
  username: z.string().min(1, t("forms.validation.username_required")),
  password: z.string().min(1, t("forms.validation.password_required")),
});

const createRegisterSchema = (t: any) => z.object({
  username: z.string().min(3, t("forms.validation.username_min_length")),
  password: z.string().min(6, t("forms.validation.password_min_length")),
  name: z.string().min(1, t("forms.validation.name_required")),
  role: z.enum(["doctor", "patient", "admin", "researcher"] as const),
  email: z.string().email(t("forms.validation.email_invalid")).optional().or(z.literal("")),
  phone: z.string().optional(),
  // Doctor fields
  medicalLicense: z.string().optional(),
  specialization: z.string().optional(),
  // Patient fields
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  bloodType: z.string().optional(),
  allergies: z.string().optional(),
});

type LoginForm = z.infer<ReturnType<typeof createLoginSchema>>;
type RegisterForm = z.infer<ReturnType<typeof createRegisterSchema>>;

// Subcomponent for login form with its own useForm hook
function LoginFormSection({ defaultValues, onSubmit, isSubmitting, formRef }: {
  defaultValues: LoginForm;
  onSubmit: (data: LoginForm) => void;
  isSubmitting: boolean;
  formRef: React.MutableRefObject<{ getValues: () => LoginForm } | null>;
}) {
  const { t } = useTranslation();
  const loginSchema = createLoginSchema(t);
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues,
  });
  
  // Expose getValues to parent via ref
  useEffect(() => {
    formRef.current = { getValues: form.getValues };
  }, [form.getValues, formRef]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.username")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("ui.username_placeholder")}
                    data-testid="input-login-username"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.password")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={t("ui.password_placeholder")}
                    data-testid="input-login-password"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full mobile-touch-optimized bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            disabled={isSubmitting}
            data-testid="button-login-submit"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                {t("ui.logging_in")}
              </>
            ) : (
              t("ui.login_button")
            )}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}

// Subcomponent for register form with its own useForm hook
function RegisterFormSection({ defaultValues, onSubmit, isSubmitting, getRoleIcon, formRef, avatarFile, setAvatarFile, avatarPreview, setAvatarPreview }: {
  defaultValues: RegisterForm;
  onSubmit: (data: RegisterForm) => void;
  isSubmitting: boolean;
  getRoleIcon: (role: string) => JSX.Element;
  formRef: React.MutableRefObject<{ getValues: () => RegisterForm } | null>;
  avatarFile: File | null;
  setAvatarFile: (file: File | null) => void;
  avatarPreview: string | null;
  setAvatarPreview: (url: string | null) => void;
}) {
  const { t } = useTranslation();
  const registerSchema = createRegisterSchema(t);
  const { toast } = useToast();
  
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues,
  });
  
  // Watch for role changes to show/hide conditional fields
  const selectedRole = form.watch("role");
  
  // Expose getValues to parent via ref
  useEffect(() => {
    formRef.current = { getValues: form.getValues };
  }, [form.getValues, formRef]);

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O avatar deve ter no máximo 5MB.",
          variant: "destructive",
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.user_type")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-register-role" className="mobile-input-enhanced">
                      <SelectValue placeholder={t("ui.user_type_placeholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="patient" data-testid="option-role-patient">
                      <div className="flex items-center gap-2">
                        {getRoleIcon("patient")}
                        {t("roles.patient")}
                      </div>
                    </SelectItem>
                    <SelectItem value="doctor" data-testid="option-role-doctor">
                      <div className="flex items-center gap-2">
                        {getRoleIcon("doctor")}
                        {t("roles.doctor")}
                      </div>
                    </SelectItem>
                    <SelectItem value="admin" data-testid="option-role-admin">
                      <div className="flex items-center gap-2">
                        {getRoleIcon("admin")}
                        {t("roles.admin")}
                      </div>
                    </SelectItem>
                    <SelectItem value="researcher" data-testid="option-role-researcher">
                      <div className="flex items-center gap-2">
                        {getRoleIcon("researcher")}
                        {t("roles.researcher")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.full_name")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("ui.fullname_placeholder")}
                    data-testid="input-register-name"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.username")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("ui.username_register_placeholder")}
                    data-testid="input-register-username"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.password")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={t("ui.password_register_placeholder")}
                    data-testid="input-register-password"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.email_optional")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder={t("ui.email_placeholder")}
                    data-testid="input-register-email"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("ui.phone_optional")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("ui.phone_placeholder")}
                    data-testid="input-register-phone"
                    className="mobile-input-enhanced"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Avatar upload */}
          <div className="space-y-2">
            <FormLabel>Foto de Perfil (Opcional)</FormLabel>
            <div className="flex items-center space-x-4">
              {avatarPreview && (
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary">
                  <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                data-testid="input-register-avatar"
                className="mobile-input-enhanced"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: JPG, PNG, GIF, WEBP. Máximo 5MB.
            </p>
          </div>
          
          {/* Doctor-specific fields */}
          {selectedRole === "doctor" && (
            <>
              <FormField
                control={form.control}
                name="medicalLicense"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CRM (Registro Médico) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: CRM-SP 123456"
                        data-testid="input-register-medical-license"
                        className="mobile-input-enhanced"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialização *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Cardiologia, Pediatria"
                        data-testid="input-register-specialization"
                        className="mobile-input-enhanced"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          
          {/* Patient-specific fields */}
          {selectedRole === "patient" && (
            <>
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        data-testid="input-register-dob"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gênero</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-register-gender" className="mobile-input-enhanced">
                          <SelectValue placeholder="Selecione o gênero" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bloodType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Sanguíneo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-register-blood-type" className="mobile-input-enhanced">
                          <SelectValue placeholder="Selecione o tipo sanguíneo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alergias</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Penicilina, Dipirona"
                        data-testid="input-register-allergies"
                        className="mobile-input-enhanced"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full mobile-touch-optimized bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            disabled={isSubmitting}
            data-testid="button-register-submit"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                {t("ui.creating_account")}
              </>
            ) : (
              t("ui.register_button")
            )}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function LoginSimplifiedChat() {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<{ id: string; role: "user" | "ai"; content: string }[]>([
    { id: "1", role: "ai", content: "Olá! Sou o assistente virtual da Tele<M3D>. Posso tirar dúvidas sobre a plataforma, agendar consultas ou ajudar com triagem de sintomas. Como posso ajudar?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: msg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await apiRequest("POST", "/api/chatbot/visitor-message", { message: msg });
      const data = await res.json();
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: data.response || "Como posso ajudar?" }]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full h-12 border-dashed border-2 border-primary/30 hover:border-primary/50 text-primary/70 hover:text-primary"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Fale com o Assistente IA
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-6 shadow-md border-primary/20">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Assistente IA</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </div>
        <div ref={chatScrollRef} className="h-40 overflow-y-auto space-y-2 pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleChatSend(); } }}
            placeholder="Faça uma pergunta..."
            className="text-xs h-8"
          />
          <Button size="sm" className="h-8 w-8 p-0" onClick={handleChatSend} disabled={chatLoading}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Login() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { login, register: registerUser, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { hasChosenMode } = useViewMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      if (hasChosenMode) {
        setLocation("/");
      } else {
        setLocation("/mode-selection");
      }
    }
  }, [isAuthenticated, setLocation, hasChosenMode]);

  // Form state hoisted to parent to preserve across language changes
  const [loginValues, setLoginValues] = useState<LoginForm>({ username: "", password: "" });
  const [registerValues, setRegisterValues] = useState<RegisterForm>({
    username: "", password: "", name: "", role: "patient", email: "", phone: ""
  });
  
  // Refs to access current form values before remount
  const loginFormRef = useRef<{ getValues: () => LoginForm } | null>(null);
  const registerFormRef = useRef<{ getValues: () => RegisterForm } | null>(null);
  
  // Capture form values before language change remount
  useEffect(() => {
    const captureFormValues = () => {
      if (loginFormRef.current) {
        setLoginValues(loginFormRef.current.getValues());
      }
      if (registerFormRef.current) {
        setRegisterValues(registerFormRef.current.getValues());
      }
    };
    
    // Capture values before language change
    captureFormValues();
  }, [i18n.language]);

  // Form submission handlers
  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(data.username, data.password);
      toast({
        title: t("auth.login_success"),
        description: t("auth.login_success_desc"),
      });
    } catch (error: any) {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      // Create FormData to send file with other data
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);
      formData.append('role', data.role);
      formData.append('name', data.name);
      if (data.email) formData.append('email', data.email);
      if (data.phone) formData.append('phone', data.phone);
      if (data.medicalLicense) formData.append('medicalLicense', data.medicalLicense);
      if (data.specialization) formData.append('specialization', data.specialization);
      if (data.dateOfBirth) formData.append('dateOfBirth', data.dateOfBirth);
      if (data.gender) formData.append('gender', data.gender);
      if (data.bloodType) formData.append('bloodType', data.bloodType);
      if (data.allergies) formData.append('allergies', data.allergies);
      if (avatarFile) formData.append('avatar', avatarFile);

      // Send FormData to server
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      const result = await response.json();

      // Admin accounts are created pending approval by the root superuser —
      // no auto-login (the account is deactivated until approved).
      if (result.pendingApproval) {
        toast({
          title: "Cadastro recebido",
          description: result.message || "Sua conta de Administrador aguarda aprovação do superusuário root antes do primeiro acesso.",
        });
        return;
      }

      // Log in with the new credentials
      await login(data.username, data.password);
      
      toast({
        title: t("auth.register_success"),
        description: t("auth.register_success_desc"),
      });
    } catch (error: any) {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const getRoleIcon = (role: string) => {
    switch (role) {
      case "doctor":
        return <Stethoscope className="h-4 w-4" />;
      case "admin":
        return <UserCheck className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 flex items-center justify-center">
              <img 
                src={telemedLogo} 
                alt="Tele<M3D> Logo" 
                className="w-full h-full object-contain brightness-0 invert"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {t("ui.app_title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("ui.app_subtitle")}
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">
                {t("ui.login_tab")}
              </TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">
                {t("ui.register_tab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader>
                <CardTitle>{t("ui.login_title")}</CardTitle>
                <CardDescription>
                  {t("ui.login_description")}
                </CardDescription>
              </CardHeader>
              <LoginFormSection 
                key={i18n.language}
                defaultValues={loginValues}
                onSubmit={handleLogin}
                isSubmitting={isSubmitting}
                formRef={loginFormRef}
              />
            </TabsContent>

            <TabsContent value="register">
              <CardHeader>
                <CardTitle>{t("ui.register_title")}</CardTitle>
                <CardDescription>
                  {t("ui.register_description")}
                </CardDescription>
              </CardHeader>
              <RegisterFormSection 
                key={i18n.language}
                defaultValues={registerValues}
                onSubmit={handleRegister}
                isSubmitting={isSubmitting}
                getRoleIcon={getRoleIcon}
                formRef={registerFormRef}
                avatarFile={avatarFile}
                setAvatarFile={setAvatarFile}
                avatarPreview={avatarPreview}
                setAvatarPreview={setAvatarPreview}
              />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Registration Links */}
        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Não tem uma conta? Cadastre-se como:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/register/patient">
              <Button 
                variant="outline" 
                className="w-full h-12 text-sm"
                data-testid="link-register-patient"
              >
                <User className="w-4 h-4 mr-1.5 flex-shrink-0" />
                Paciente
              </Button>
            </Link>
            <Link href="/register/doctor">
              <Button 
                variant="outline" 
                className="w-full h-12 text-sm"
                data-testid="link-register-doctor"
              >
                <Stethoscope className="w-4 h-4 mr-1.5 flex-shrink-0" />
                Médico
              </Button>
            </Link>
          </div>
        </div>

        <LoginSimplifiedChat />

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            {t("ui.app_subtitle")}
          </p>
          <p className="mt-2 text-xs">
            Plataforma de telemedicina com consultas por vídeo, triagem por IA, prontuários digitais e gestão de créditos TM3D.
          </p>
        </div>
      </div>
      </div>
    </PageWrapper>
  );
}