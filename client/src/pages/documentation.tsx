import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/layout/page-wrapper";
import medicalBgImage from "@assets/stock_images/medical_dashboard_in_fa79cda0.jpg";
import dashboardImg from "@assets/stock_images/medical_dashboard_in_e5fdc287.jpg";
import videoConsultImg from "@assets/stock_images/telemedicine_doctor__163c5e09.jpg";
import healthRecordsImg from "@assets/stock_images/digital_health_recor_c30ace83.jpg";
import { 
  Video, 
  Shield, 
  MessageCircle, 
  Bot, 
  Calendar, 
  FileText, 
  Users, 
  CreditCard,
  CheckCircle,
  Star,
  Clock,
  Phone,
  Lock,
  Activity,
  BarChart,
  Settings,
  BookOpen,
  ArrowRight
} from "lucide-react";

export default function Documentation() {
  const { t } = useTranslation();

  // Color mapping for Tailwind classes (static strings)
  const colorClasses = {
    blue: {
      bgHeader: "bg-blue-50",
      borderHeader: "border-blue-100",
      icon: "text-blue-600",
      bullet: "bg-blue-500"
    },
    purple: {
      bgHeader: "bg-purple-50",
      borderHeader: "border-purple-100",
      icon: "text-purple-600",
      bullet: "bg-purple-500"
    },
    green: {
      bgHeader: "bg-green-50",
      borderHeader: "border-green-100",
      icon: "text-green-600",
      bullet: "bg-green-500"
    },
    orange: {
      bgHeader: "bg-orange-50",
      borderHeader: "border-orange-100",
      icon: "text-orange-600",
      bullet: "bg-orange-500"
    },
    yellow: {
      bgHeader: "bg-yellow-50",
      borderHeader: "border-yellow-100",
      icon: "text-yellow-600",
      bullet: "bg-yellow-500"
    },
    red: {
      bgHeader: "bg-red-50",
      borderHeader: "border-red-100",
      icon: "text-red-600",
      bullet: "bg-red-500"
    },
    gray: {
      bgHeader: "bg-gray-50",
      borderHeader: "border-gray-100",
      icon: "text-gray-600",
      bullet: "bg-gray-500"
    }
  };

  const systemFeatures = [
    {
      category: "Consultas e Atendimento",
      icon: Video,
      color: "blue",
      items: [
        {
          title: "Consultas por Vídeo",
          description: "Sistema de videochamada em tempo real com tecnologia Agora.io, suportando HD e baixa latência",
          features: ["Qualidade HD", "Compartilhamento de tela", "Gravação de consultas", "Chat integrado"]
        },
        {
          title: "Agendamento Inteligente",
          description: "Agenda automática com IA que sugere melhores horários e evita conflitos",
          features: ["Sincronização automática", "Lembretes por WhatsApp", "Reagendamento fácil", "Múltiplas especialidades"]
        },
        {
          title: "Atendimento 24/7",
          description: "Plantão médico disponível a qualquer hora com sistema de escalas",
          features: ["Médicos de plantão", "Emergências priorizadas", "Histórico acessível", "Continuidade do cuidado"]
        }
      ]
    },
    {
      category: "Inteligência Artificial",
      icon: Bot,
      color: "purple",
      items: [
        {
          title: "Assistente Médico IA",
          description: "Powered by Google Gemini com base de conhecimento Harrison's Principles",
          features: ["Suporte diagnóstico", "Interações medicamentosas", "Protocolos clínicos", "Pesquisa de evidências"]
        },
        {
          title: "Chatbot para Visitantes",
          description: "Assistente virtual para informações gerais sobre o sistema",
          features: ["Disponível sem login", "Respostas instantâneas", "Triagem inicial", "Direcionamento adequado"]
        },
        {
          title: "Análise Preditiva",
          description: "IA analisa padrões e sugere cuidados preventivos",
          features: ["Alertas de risco", "Tendências de saúde", "Recomendações personalizadas", "Machine Learning"]
        }
      ]
    },
    {
      category: "Gestão de Dados Médicos",
      icon: FileText,
      color: "green",
      items: [
        {
          title: "Prontuário Eletrônico",
          description: "Sistema completo de gestão de prontuários médicos digitais",
          features: ["Histórico completo", "Acesso controlado", "Backup automático", "Busca avançada"]
        },
        {
          title: "Prescrições Digitais",
          description: "Emissão de receitas com assinatura digital certificada",
          features: ["Assinatura FIPS", "QR Code verificação", "Exportação USB", "Validade jurídica"]
        },
        {
          title: "Resultados de Exames",
          description: "Upload e visualização de exames laboratoriais e imagens",
          features: ["Upload seguro", "Visualizador integrado", "Compartilhamento", "Organização por data"]
        }
      ]
    },
    {
      category: "Comunicação",
      icon: MessageCircle,
      color: "orange",
      items: [
        {
          title: "WhatsApp Business",
          description: "Integração oficial com WhatsApp para comunicação automatizada",
          features: ["Lembretes automáticos", "Confirmação de consultas", "Resultados de exames", "Suporte técnico"]
        },
        {
          title: "Notificações em Tempo Real",
          description: "Sistema de notificações push e em tempo real",
          features: ["WebSocket", "Alertas importantes", "Histórico completo", "Configurável"]
        },
        {
          title: "Central de Mensagens",
          description: "Comunicação segura entre médicos e pacientes",
          features: ["Criptografia E2E", "Anexos seguros", "Busca de conversas", "Arquivamento"]
        }
      ]
    },
    {
      category: "Sistema de Créditos TMC",
      icon: CreditCard,
      color: "yellow",
      items: [
        {
          title: "Compra de Créditos",
          description: "Sistema de pagamento integrado com PayPal para compra de créditos",
          features: ["PayPal seguro", "Pacotes variados", "Histórico de compras", "Recibos automáticos"]
        },
        {
          title: "Gestão de Créditos",
          description: "Controle completo de saldo e transações de créditos TMC",
          features: ["Saldo em tempo real", "Extrato detalhado", "Transferências", "Sistema de comissões"]
        },
        {
          title: "Cobrança Automática",
          description: "Débito automático de créditos por consultas realizadas",
          features: ["Tarifação justa", "Transparência total", "Relatórios mensais", "Baixas taxas"]
        }
      ]
    },
    {
      category: "Segurança e Conformidade",
      icon: Shield,
      color: "red",
      items: [
        {
          title: "Criptografia Avançada",
          description: "Proteção de dados com os mais altos padrões de segurança",
          features: ["AES-256", "TLS 1.3", "Chaves HSM", "Zero-knowledge"]
        },
        {
          title: "Conformidade LGPD",
          description: "Total adequação à Lei Geral de Proteção de Dados",
          features: ["Consentimento claro", "Direito ao esquecimento", "Portabilidade", "Auditoria contínua"]
        },
        {
          title: "Controle de Acesso",
          description: "Sistema robusto de autenticação e autorização",
          features: ["RBAC granular", "Sessões seguras", "Logs de auditoria", "2FA opcional"]
        }
      ]
    },
    {
      category: "Gestão Administrativa",
      icon: Settings,
      color: "gray",
      items: [
        {
          title: "Dashboard Administrativo",
          description: "Painel completo para gestão da plataforma",
          features: ["Métricas em tempo real", "Gestão de usuários", "Configurações globais", "Relatórios customizados"]
        },
        {
          title: "Analytics e Relatórios",
          description: "Sistema completo de análise e geração de relatórios",
          features: ["Gráficos interativos", "Exportação Excel/PDF", "Filtros avançados", "Comparativos"]
        },
        {
          title: "Gestão de Referências IA",
          description: "Upload e gerenciamento de PDFs médicos para base de conhecimento da IA",
          features: ["Upload seguro", "Validação automática", "Acesso controlado", "Versionamento"]
        }
      ]
    }
  ];

  const technicalSpecs = [
    {
      title: "Arquitetura Frontend",
      items: ["React 18 com TypeScript", "Tailwind CSS para estilização", "Wouter para roteamento", "TanStack Query para estado"]
    },
    {
      title: "Arquitetura Backend",
      items: ["Node.js com Express", "PostgreSQL (Neon)", "Drizzle ORM", "WebSocket para real-time"]
    },
    {
      title: "Integrações",
      items: ["Google Gemini API", "Agora.io Video SDK", "WhatsApp Business API", "PayPal Payment Gateway"]
    },
    {
      title: "Segurança",
      items: ["HTTPS/TLS 1.3", "Criptografia AES-256", "Sessões seguras", "RBAC completo"]
    }
  ];

  const userGuides = [
    {
      role: "Pacientes",
      icon: Users,
      guides: [
        "Como agendar uma consulta",
        "Como fazer upload de exames",
        "Como usar o chatbot de IA",
        "Como comprar créditos TMC",
        "Como participar de videochamada"
      ]
    },
    {
      role: "Médicos",
      icon: Activity,
      guides: [
        "Como gerenciar sua agenda",
        "Como realizar consultas online",
        "Como emitir prescrições digitais",
        "Como usar o assistente de IA",
        "Como receber pagamentos em TMC"
      ]
    },
    {
      role: "Administradores",
      icon: Settings,
      guides: [
        "Como gerenciar usuários",
        "Como fazer upload de referências médicas",
        "Como visualizar analytics",
        "Como configurar o sistema",
        "Como gerenciar créditos TMC"
      ]
    }
  ];

  return (
    <PageWrapper variant="medical" medicalBg={medicalBgImage}>
      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <Link href="/">
              <Button variant="ghost" className="mb-6 text-white hover:bg-white/10" data-testid="button-back-home">
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                Voltar
              </Button>
            </Link>
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-white" />
            <h1 className="text-4xl font-bold text-white mb-4">Documentação do Sistema Telemed</h1>
            <p className="text-xl text-white/90 mb-6">
              Manual completo de recursos, funcionalidades e guias de uso
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                Atualizado em Outubro 2025
              </Badge>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                <Star className="w-4 h-4 mr-2" />
                Versão 2.0
              </Badge>
            </div>
          </div>

          {/* Ilustrações principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden">
              <img src={dashboardImg} alt="Dashboard" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold">Dashboard Intuitivo</h3>
                <p className="text-sm text-muted-foreground">Interface moderna e fácil de usar</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden">
              <img src={videoConsultImg} alt="Videochamada" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold">Consultas em Vídeo</h3>
                <p className="text-sm text-muted-foreground">Atendimento online de qualidade</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden">
              <img src={healthRecordsImg} alt="Prontuários" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold">Prontuários Digitais</h3>
                <p className="text-sm text-muted-foreground">Gestão completa de dados médicos</p>
              </CardContent>
            </Card>
          </div>

          {/* Recursos do Sistema */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Recursos e Funcionalidades</h2>
            <div className="space-y-8">
              {systemFeatures.map((category, idx) => {
                const colors = colorClasses[category.color as keyof typeof colorClasses] || colorClasses.blue;
                return (
                  <Card key={idx} className="shadow-xl bg-white/95 backdrop-blur-sm">
                    <CardHeader className={`${colors.bgHeader} border-b ${colors.borderHeader}`}>
                      <CardTitle className="flex items-center text-2xl">
                        <category.icon className={`w-8 h-8 mr-3 ${colors.icon}`} />
                        {category.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {category.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="space-y-3">
                            <h3 className="font-bold text-lg flex items-center">
                              <CheckCircle className={`w-5 h-5 mr-2 ${colors.icon}`} />
                              {item.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <ul className="space-y-1">
                              {item.features.map((feature, fIdx) => (
                                <li key={fIdx} className="text-sm flex items-center">
                                  <div className={`w-1.5 h-1.5 rounded-full ${colors.bullet} mr-2`}></div>
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Especificações Técnicas */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Especificações Técnicas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {technicalSpecs.map((spec, idx) => (
                <Card key={idx} className="shadow-xl bg-gradient-to-br from-white to-gray-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-center">{spec.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {spec.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start text-sm">
                          <CheckCircle className="w-4 h-4 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Guias por Perfil */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8">Guias de Uso por Perfil</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {userGuides.map((guide, idx) => (
                <Card key={idx} className="shadow-xl hover:shadow-2xl transition-all">
                  <CardHeader className="bg-gradient-to-br from-primary/10 to-accent/10">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <guide.icon className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl text-center">{guide.role}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ul className="space-y-3">
                      {guide.guides.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-center text-sm">
                          <ArrowRight className="w-4 h-4 mr-2 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Suporte e Recursos Adicionais */}
          <section className="mb-12">
            <Card className="shadow-xl bg-gradient-to-r from-primary to-accent text-white">
              <CardContent className="p-8">
                <div className="text-center">
                  <Phone className="w-12 h-12 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-4">Precisa de Ajuda?</h2>
                  <p className="text-white/90 mb-6">
                    Nossa equipe de suporte está disponível para auxiliar você
                  </p>
                  <div className="flex justify-center gap-4 flex-wrap">
                    <Badge className="bg-white/20 text-white px-4 py-2">
                      <Clock className="w-4 h-4 mr-2" />
                      Suporte 24/7
                    </Badge>
                    <Badge className="bg-white/20 text-white px-4 py-2">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat Online
                    </Badge>
                    <Badge className="bg-white/20 text-white px-4 py-2">
                      <Phone className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Segurança e Privacidade */}
          <section>
            <Card className="shadow-xl bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-center text-2xl flex items-center justify-center">
                  <Lock className="w-8 h-8 mr-3 text-green-600" />
                  Segurança e Privacidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <Shield className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <h3 className="font-bold text-green-800 mb-2">Dados Protegidos</h3>
                    <p className="text-sm text-green-700">
                      Criptografia de ponta a ponta e armazenamento seguro
                    </p>
                  </div>
                  <div>
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <h3 className="font-bold text-green-800 mb-2">LGPD Compliant</h3>
                    <p className="text-sm text-green-700">
                      Total conformidade com a legislação de proteção de dados
                    </p>
                  </div>
                  <div>
                    <Lock className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <h3 className="font-bold text-green-800 mb-2">Acesso Controlado</h3>
                    <p className="text-sm text-green-700">
                      Sistema robusto de autenticação e autorização
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </PageWrapper>
  );
}
