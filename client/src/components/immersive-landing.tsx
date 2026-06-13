import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import LanguageSelector from "@/components/ui/language-selector";
import {
  LogIn,
  Info,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { formatErrorForToast } from "@/lib/error-handler";
import medicalBg from "@assets/stock_images/abstract_autumn_heal_864db12d.jpg";
import telemedLogo from "@/assets/logo-fundo.png";

type LandingView = "home" | "login" | "info";

const loginSchema = z.object({
  username: z.string().min(1, "Informe seu usuário"),
  password: z.string().min(1, "Informe sua senha"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const infoLinks = [
  {
    href: "/features",
    icon: Sparkles,
    title: "Recursos",
    description: "Funcionalidades da plataforma",
    testId: "link-info-features",
  },
  {
    href: "/documentation",
    icon: BookOpen,
    title: "Documentação",
    description: "Guias e referência técnica",
    testId: "link-info-documentation",
  },
  {
    href: "/faq",
    icon: HelpCircle,
    title: "Perguntas Frequentes",
    description: "Dúvidas comuns respondidas",
    testId: "link-info-faq",
  },
] as const;

export function ImmersiveLanding() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<LandingView>("home");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const handleLogin = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.username, data.password);
      toast({
        title: t("auth.login_success"),
        description: t("auth.login_success_desc"),
      });
      // AuthContext sets the user; ResponsiveDashboard then redirects
      // the now-authenticated user to mode selection automatically.
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

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      data-testid="immersive-landing"
    >
      {/* Background image + slate/indigo immersive gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-slate-950" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${medicalBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-slate-950/60 to-slate-900/85" />
      </div>

      {/* Language selector */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center">
              <img
                src={telemedLogo}
                alt="Tele<M3D>"
                className="h-full w-full object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Tele&lt;M3D&gt;
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Telemedicina com inteligência artificial
            </p>
          </div>

          {/* Glass card */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-xl">
            {view === "home" && (
              <div className="space-y-3" data-testid="landing-home">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="group flex w-full items-center gap-4 rounded-xl bg-white/95 p-4 text-left transition hover:bg-white"
                  data-testid="button-enter"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <LogIn className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-slate-900">
                      Entrar
                    </span>
                    <span className="block text-sm text-slate-500">
                      Acesse com seu usuário e senha
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setView("info")}
                  className="group flex w-full items-center gap-4 rounded-xl border border-white/20 bg-white/[0.06] p-4 text-left transition hover:bg-white/[0.12]"
                  data-testid="button-more-info"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <Info className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-white">
                      Mais informações
                    </span>
                    <span className="block text-sm text-white/60">
                      Conheça a plataforma
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-white/50 transition group-hover:translate-x-0.5" />
                </button>
              </div>
            )}

            {view === "login" && (
              <div data-testid="landing-login">
                <button
                  type="button"
                  onClick={() => setView("home")}
                  className="mb-4 flex items-center text-sm text-white/70 transition hover:text-white"
                  data-testid="button-back-from-login"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Voltar
                </button>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleLogin)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/90">
                            {t("ui.username")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("ui.username_placeholder")}
                              autoComplete="username"
                              className="border-white/25 bg-white/95 text-slate-900 placeholder:text-slate-400"
                              data-testid="input-landing-username"
                            />
                          </FormControl>
                          <FormMessage className="text-rose-300" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/90">
                            {t("ui.password")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder={t("ui.password_placeholder")}
                              autoComplete="current-password"
                              className="border-white/25 bg-white/95 text-slate-900 placeholder:text-slate-400"
                              data-testid="input-landing-password"
                            />
                          </FormControl>
                          <FormMessage className="text-rose-300" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
                      data-testid="button-landing-login-submit"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("ui.logging_in")}
                        </>
                      ) : (
                        t("ui.login_button")
                      )}
                    </Button>
                  </form>
                </Form>
              </div>
            )}

            {view === "info" && (
              <div data-testid="landing-info">
                <button
                  type="button"
                  onClick={() => setView("home")}
                  className="mb-4 flex items-center text-sm text-white/70 transition hover:text-white"
                  data-testid="button-back-from-info"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Voltar
                </button>
                <div className="space-y-3">
                  {infoLinks.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-4 rounded-xl border border-white/20 bg-white/[0.06] p-4 transition hover:bg-white/[0.12]"
                        data-testid={item.testId}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                          <ItemIcon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold text-white">
                            {item.title}
                          </span>
                          <span className="block text-sm text-white/60">
                            {item.description}
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 text-white/50 transition group-hover:translate-x-0.5" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Discreet create-account link */}
          {view !== "login" && (
            <p className="mt-6 text-center text-sm text-white/60">
              Não tem conta?{" "}
              <Link
                href="/register"
                className="text-white underline underline-offset-4 transition hover:text-white/80"
                data-testid="link-create-account"
              >
                Criar conta
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
