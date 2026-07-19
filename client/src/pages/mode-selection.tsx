import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode, ViewMode } from "@/contexts/ViewModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Tablet, Monitor, BookOpen, Star, Sparkles, Briefcase, Minimize2 } from "lucide-react";
import LanguageSelector from "@/components/ui/language-selector";
import { useAccessModality, AccessModality } from "@/contexts/AccessModalityContext";
import { useToast } from "@/hooks/use-toast";

const modeConfig: Record<ViewMode, { icon: typeof Smartphone; title: string; description: string; color: string; gradient: string }> = {
  immersive: {
    icon: Smartphone,
    title: "Imersiva",
    description: "Controle total por voz e chat. Otimizado para celulares com foco em acessibilidade.",
    color: "text-purple-600 dark:text-purple-400",
    gradient: "from-purple-500 to-indigo-600",
  },
  mobile: {
    icon: Tablet,
    title: "Mobile",
    description: "Interface simplificada com botões essenciais. Ideal para tablets.",
    color: "text-blue-600 dark:text-blue-400",
    gradient: "from-blue-500 to-cyan-600",
  },
  desktop: {
    icon: Monitor,
    title: "Desktop",
    description: "Interface completa com todos os recursos e menus. Para notebooks e desktops.",
    color: "text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-500 to-teal-600",
  },
};

const accessModalityConfig: Record<AccessModality, { icon: typeof Sparkles; title: string; description: string; gradient: string }> = {
  classic: {
    icon: Minimize2,
    title: "Clássica",
    description: "Experiência minimalista — apenas o essencial, sem painéis avançados.",
    gradient: "from-slate-500 to-slate-700",
  },
  professional: {
    icon: Briefcase,
    title: "Profissional",
    description: "Experiência completa com ferramentas integradas e radiologia avançada.",
    gradient: "from-blue-600 to-indigo-700",
  },
  assisted: {
    icon: Sparkles,
    title: "Assistida",
    description: "Modo autônomo guiado por voz e visão da IAM3D, com narrativa contextual.",
    gradient: "from-fuchsia-500 to-purple-700",
  },
};

export default function ModeSelection() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { recommendedMode, setViewMode, hasChosenMode } = useViewMode();
  const { modality, setModality } = useAccessModality();
  const { toast } = useToast();

  const allowRevisit = typeof window !== "undefined" && window.location.search.includes("force=1");

  useEffect(() => {
    if (hasChosenMode && !allowRevisit) {
      setLocation("/");
    }
  }, [hasChosenMode, setLocation, allowRevisit]);

  const handleSelect = (mode: ViewMode) => {
    setViewMode(mode);
    setLocation("/");
  };

  if (hasChosenMode && !allowRevisit) return null;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">
            Bem-vindo{user?.name ? <span data-no-translate>{`, ${user.name.split(" ")[0]}`}</span> : ""}!
          </h1>
          <p className="text-muted-foreground">
            Escolha a modalidade de uso que melhor se adapta ao seu dispositivo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["immersive", "mobile", "desktop"] as ViewMode[]).map((mode) => {
            const config = modeConfig[mode];
            const Icon = config.icon;
            const isRecommended = mode === recommendedMode;

            return (
              <Card
                key={mode}
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] relative ${
                  isRecommended ? "ring-2 ring-primary shadow-md" : ""
                }`}
                onClick={() => handleSelect(mode)}
              >
                {isRecommended && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Recomendado
                  </Badge>
                )}
                <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${config.gradient} text-white`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{config.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {config.description}
                    </p>
                  </div>
                  <Button
                    className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white`}
                  >
                    Selecionar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-center space-y-1">
            <h2 className="text-lg md:text-xl font-semibold">Modalidade de Acesso</h2>
            <p className="text-sm text-muted-foreground">
              Escolha o nível de assistência da plataforma. Pode ser alterado a qualquer momento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(accessModalityConfig) as AccessModality[]).map((m) => {
              const cfg = accessModalityConfig[m];
              const Icon = cfg.icon;
              const active = modality === m;
              return (
                <button
                  key={m}
                  data-testid={`btn-pick-modality-${m}`}
                  onClick={async () => {
                    try {
                      await setModality(m);
                      toast({ title: "Modalidade atualizada", description: cfg.title });
                    } catch (e: any) {
                      toast({ title: "Falha ao atualizar", description: e?.message || "Erro", variant: "destructive" });
                    }
                  }}
                  className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${cfg.gradient} text-white mb-2`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold">{cfg.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{cfg.description}</div>
                  {active && <div className="mt-2 text-xs font-medium text-primary">Ativa</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/manual")}
            className="text-muted-foreground"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Manual do Usuário
          </Button>
        </div>
      </div>
    </div>
  );
}
