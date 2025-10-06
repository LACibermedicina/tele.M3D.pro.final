import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/LogoOrigami_1759774106948.png";
import telemedLogo from "@/assets/logo-fundo.png";
import { Users, Stethoscope, Shield, Heart, CheckCircle } from "lucide-react";

export default function RegisterSelect() {
  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-5xl mx-auto w-full">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 flex items-center justify-center">
              <img 
                src={telemedLogo} 
                alt="Tele<M3D> Logo" 
                className="w-full h-full object-contain brightness-0"
                style={{ filter: 'brightness(0)' }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-3">
            Escolha seu Tipo de Conta
          </h1>
          <p className="text-lg text-muted-foreground">
            Selecione o perfil que melhor descreve você
          </p>
        </div>

        {/* Registration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          
          {/* Patient Card */}
          <Link href="/register/patient" className="block group">
            <Card className="shadow-lg border-0 bg-white/98 dark:bg-gray-900/98 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6 h-full">
                <div className="w-24 h-24 bg-gradient-to-br from-medical-primary/20 to-medical-primary/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-12 h-12 text-medical-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-medical-primary mb-2">Sou Paciente</h3>
                  <p className="text-sm text-muted-foreground">
                    Cuide da sua saúde com facilidade
                  </p>
                </div>
                <Button 
                  className="w-full bg-medical-primary hover:bg-medical-primary/90 group-hover:shadow-lg transition-shadow" 
                  data-testid="button-register-patient-select"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Doctor Card */}
          <Link href="/register/doctor" className="block group">
            <Card className="shadow-lg border-0 bg-white/98 dark:bg-gray-900/98 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6 h-full">
                <div className="w-24 h-24 bg-gradient-to-br from-medical-secondary/20 to-medical-secondary/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Stethoscope className="w-12 h-12 text-medical-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-medical-secondary mb-2">Sou Médico</h3>
                  <p className="text-sm text-muted-foreground">
                    Conecte-se com seus pacientes
                  </p>
                </div>
                <Button 
                  className="w-full bg-medical-secondary hover:bg-medical-secondary/90 group-hover:shadow-lg transition-shadow" 
                  data-testid="button-register-doctor-select"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </Link>

          {/* Admin Card */}
          <Link href="/register/admin" className="block group">
            <Card className="shadow-lg border-0 bg-white/98 dark:bg-gray-900/98 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer h-full">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6 h-full">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-12 h-12 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-2">Sou Administrador</h3>
                  <p className="text-sm text-muted-foreground">
                    Gerencie toda a plataforma
                  </p>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 group-hover:shadow-lg transition-shadow" 
                  data-testid="button-register-admin-select"
                >
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Security & Trust Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className="shadow-md border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Segurança Garantida</h3>
                  <p className="text-xs text-muted-foreground">
                    Criptografia avançada e conformidade LGPD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Cuidado Humanizado</h3>
                  <p className="text-xs text-muted-foreground">
                    Tecnologia a serviço do cuidado personalizado
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Already have account */}
        <div className="text-center mt-10">
          <p className="text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/" className="text-primary hover:underline font-semibold">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
      </div>
    </PageWrapper>
  );
}