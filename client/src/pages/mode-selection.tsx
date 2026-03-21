import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useViewMode, ViewMode } from "@/contexts/ViewModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Tablet, Monitor, BookOpen, Star } from "lucide-react";

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

export default function ModeSelection() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { recommendedMode, setViewMode, hasChosenMode } = useViewMode();

  useEffect(() => {
    if (hasChosenMode) {
      setLocation("/");
    }
  }, [hasChosenMode, setLocation]);

  const handleSelect = (mode: ViewMode) => {
    setViewMode(mode);
    setLocation("/");
  };

  if (hasChosenMode) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">
            Bem-vindo{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
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
