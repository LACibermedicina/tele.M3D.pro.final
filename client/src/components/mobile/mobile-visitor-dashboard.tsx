import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Stethoscope, LogIn, Phone, MessageCircle, Brain, Shield, Clock } from "lucide-react"
import { Link } from "wouter"

interface MobileVisitorDashboardProps {
  onOpenIAM3D?: () => void;
}

export function MobileVisitorDashboard({ onOpenIAM3D }: MobileVisitorDashboardProps) {
  const supportPhone = '+5511960708817';

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent('Olá! Preciso de suporte com a plataforma Tele<M3D>.');
    window.open(`https://wa.me/${supportPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 px-4 py-6 space-y-6">

      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <CardContent className="p-6 text-center">
          <h1 className="text-2xl font-bold">Tele&lt;M3D&gt; Pro</h1>
          <p className="text-blue-100 mt-2">Conexão que cuida, cuidados que conectam</p>
          <div className="mt-4">
            <Badge className="bg-white/20 text-white border-white/30">Visitante</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-blue-200 dark:border-gray-700 dark:bg-gray-800">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300">Comece Agora</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/register/patient">
            <Button
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-base"
              aria-label="Registrar como paciente"
            >
              <UserPlus className="w-5 h-5 mr-3" />
              Sou Paciente
            </Button>
          </Link>
          <Link href="/register/doctor">
            <Button
              className="w-full h-16 bg-teal-600 hover:bg-teal-700 text-white text-base"
              aria-label="Registrar como médico"
            >
              <Stethoscope className="w-5 h-5 mr-3" />
              Sou Médico
            </Button>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full h-16 text-base dark:border-gray-600 dark:text-gray-200"
              aria-label="Fazer login"
            >
              <LogIn className="w-5 h-5 mr-3" />
              Já tenho conta
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold dark:text-gray-100">Serviços Disponíveis</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Card className="bg-blue-50 dark:bg-gray-700 border-blue-100 dark:border-gray-600">
            <CardContent className="p-4">
              <h3 className="font-medium dark:text-gray-100">Consulta Geral</h3>
              <p className="text-sm text-muted-foreground mt-1">Consulta médica geral online com profissionais qualificados</p>
              <div className="flex items-center mt-2 text-sm text-blue-600 dark:text-blue-400">
                <Clock className="w-3.5 h-3.5 mr-1" />
                <span>30 min</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-teal-50 dark:bg-gray-700 border-teal-100 dark:border-gray-600">
            <CardContent className="p-4">
              <h3 className="font-medium dark:text-gray-100">Orientação Médica</h3>
              <p className="text-sm text-muted-foreground mt-1">Esclarecimento de dúvidas e orientações preventivas</p>
              <div className="flex items-center mt-2 text-sm text-teal-600 dark:text-teal-400">
                <Clock className="w-3.5 h-3.5 mr-1" />
                <span>15 min</span>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="shadow-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-purple-200 dark:border-purple-700">
        <CardContent className="p-6 text-center space-y-4">
          <Brain className="w-12 h-12 mx-auto text-purple-600 dark:text-purple-400" />
          <h2 className="text-lg font-semibold text-purple-800 dark:text-purple-300">Assistente de Voz IAM3D</h2>
          <p className="text-sm text-purple-600 dark:text-purple-400">Converse por voz com nosso assistente</p>
          <Button
            className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white text-base"
            onClick={onOpenIAM3D}
            aria-label="Abrir assistente de voz IAM3D"
          >
            <Brain className="w-5 h-5 mr-3" />
            Falar com IAM3D
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-700">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-green-800 dark:text-green-300 flex items-center">
            <Phone className="w-5 h-5 mr-2" />
            Contato & Suporte
          </h2>
          <Button
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-base"
            onClick={handleWhatsAppContact}
            aria-label="Contato via WhatsApp"
          >
            <MessageCircle className="w-5 h-5 mr-3" />
            WhatsApp Suporte
          </Button>
          <div className="flex items-center rounded-lg bg-red-50 dark:bg-red-900/30 p-4 border border-red-200 dark:border-red-700">
            <Shield className="w-8 h-8 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-800 dark:text-red-300">SAMU 192</p>
              <p className="text-xs text-red-600 dark:text-red-400">Em caso de emergência, ligue 192 ou dirija-se ao hospital mais próximo</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
