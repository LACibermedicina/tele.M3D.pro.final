import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Video, Users, MessageSquare, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

export default function MedicalCafe() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [onlineDoctors, setOnlineDoctors] = useState(0);

  useEffect(() => {
    // Simulate online doctors count - in production, fetch from WebSocket or API
    const interval = setInterval(() => {
      setOnlineDoctors(Math.floor(Math.random() * 15) + 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinCafe = () => {
    // Redirect to the coffee room page
    setLocation('/coffee-room');
  };

  if (!user || user.role !== 'doctor') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Acesso restrito a médicos
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Coffee className="h-8 w-8 text-white" />
            </div>
          </div>
          
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Cafeteria Médica
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Canal público de videochamada para suporte, networking e socialização entre médicos
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-green-600 border-green-600 px-4 py-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              {onlineDoctors} médicos online
            </Badge>
            <Badge variant="outline" className="px-4 py-2">
              <Video className="h-3 w-3 mr-2" />
              Sala Aberta 24/7
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Card - Join */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Entrar na Sala
              </CardTitle>
              <CardDescription>
                Conecte-se com outros médicos em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg p-6 text-center">
                <Coffee className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  A Cafeteria Médica é um espaço aberto para todos os médicos da plataforma.
                  Aqui você pode trocar experiências, tirar dúvidas, discutir casos e fazer networking.
                </p>
                <Button
                  onClick={handleJoinCafe}
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  data-testid="button-join-cafe"
                >
                  <Video className="h-5 w-5 mr-2" />
                  Entrar na Cafeteria
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                <p>✓ Videochamada em grupo</p>
                <p>✓ Chat em tempo real</p>
                <p>✓ Compartilhamento de tela</p>
              </div>
            </CardContent>
          </Card>

          {/* Right Card - Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Sobre a Cafeteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Suporte Entre Pares</h3>
                    <p className="text-sm text-muted-foreground">
                      Tire dúvidas e compartilhe conhecimento com colegas de profissão
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                    <Coffee className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Networking</h3>
                    <p className="text-sm text-muted-foreground">
                      Conheça outros médicos, faça contatos e expanda sua rede profissional
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Discussões Clínicas</h3>
                    <p className="text-sm text-muted-foreground">
                      Discuta casos interessantes e aprenda com a experiência coletiva
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
                <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
                  Dicas de Etiqueta
                </h4>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Mantenha o microfone desligado quando não estiver falando</li>
                  <li>• Use o chat para compartilhar links e referências</li>
                  <li>• Seja respeitoso e profissional em todas as interações</li>
                  <li>• Evite discutir informações confidenciais de pacientes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Banner */}
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-200 dark:border-amber-800">
          <CardContent className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-amber-600 mb-1">24/7</div>
                <p className="text-sm text-muted-foreground">Disponível o tempo todo</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-1">Ilimitado</div>
                <p className="text-sm text-muted-foreground">Sem limite de participantes</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-600 mb-1">Gratuito</div>
                <p className="text-sm text-muted-foreground">Incluído na plataforma</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
