import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Pill, Shield, CheckCircle, ClipboardList, QrCode, FileBarChart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatErrorForToast } from "@/lib/error-handler";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

const registerSchema = z.object({
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().min(1, "Telefone é obrigatório"),
  crf: z.string().min(1, "CRF é obrigatório para farmacêuticos"),
  pharmacyName: z.string().min(1, "Nome da farmácia é obrigatório"),
  cnpj: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function PharmacistRegister() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
      phone: "",
      crf: "",
      pharmacyName: "",
      cnpj: "",
      address: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      await register({
        username: data.username,
        password: data.password,
        name: data.name,
        email: data.email,
        phone: data.phone,
        medicalLicense: data.crf,
        specialization: data.pharmacyName,
        role: "pharmacist" as const,
      });

      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo à plataforma Tele<M3D>. Você já pode acessar o painel da farmácia.",
      });
    } catch (error) {
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

  const pharmacistBenefits = [
    {
      icon: ClipboardList,
      title: "Gestão de Prescrições",
      description: "Receba e dispense prescrições digitais com verificação automática"
    },
    {
      icon: QrCode,
      title: "Verificação por QR Code",
      description: "Verifique autenticidade de prescrições via QR Code e assinatura digital"
    },
    {
      icon: FileBarChart,
      title: "Relatórios LGPD",
      description: "Gere relatórios completos com conformidade LGPD"
    },
    {
      icon: Shield,
      title: "Segurança Garantida",
      description: "Dados protegidos com criptografia e conformidade regulatória"
    }
  ];

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">

        <div className="text-center mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 text-white hover:bg-white/10" data-testid="button-back-home">
              ← Voltar para Início
            </Button>
          </Link>
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Pill className="w-12 h-12 text-white drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Registro de Farmacêutico</h1>
          </div>
          <p className="text-lg text-white/90 drop-shadow-md">
            Crie sua conta e gerencie prescrições com segurança
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          <Card className="shadow-xl border-medical-primary/20 bg-white/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-center text-xl">Criar Conta de Farmacêutico</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Digite seu nome completo" data-testid="input-pharmacist-name" />
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
                        <FormLabel>Nome de Usuário</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Escolha um nome de usuário" data-testid="input-pharmacist-username" />
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
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Crie uma senha segura" data-testid="input-pharmacist-password" />
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
                        <FormLabel>Email (Opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="seu@email.com" data-testid="input-pharmacist-email" />
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
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(11) 99999-9999" data-testid="input-pharmacist-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="crf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CRF (Conselho Regional de Farmácia)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: CRF-SP 12345" data-testid="input-pharmacist-crf" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pharmacyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Farmácia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome do estabelecimento" data-testid="input-pharmacist-pharmacy" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00.000.000/0000-00" data-testid="input-pharmacist-cnpj" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Endereço da farmácia" data-testid="input-pharmacist-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isSubmitting}
                    data-testid="button-pharmacist-register"
                  >
                    {isSubmitting ? "Criando conta..." : "Criar Conta de Farmacêutico"}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Já tem uma conta?{" "}
                  <Link href="/login" className="text-emerald-600 hover:underline">
                    Fazer login
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg bg-white/95 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-6 h-6 mr-2 text-emerald-600" />
                  Benefícios para Farmacêuticos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pharmacistBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
              <CardContent className="p-6">
                <div className="text-center">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
                  <h3 className="font-bold text-emerald-800 mb-2">Conformidade Regulatória</h3>
                  <p className="text-sm text-emerald-600">
                    Sistema em conformidade com ANVISA, CRF e LGPD para dispensação segura de medicamentos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </PageWrapper>
  );
}
