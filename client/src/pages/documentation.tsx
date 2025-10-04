import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import PageWrapper from "@/components/layout/page-wrapper";
import medicalBgImage from "@assets/stock_images/medical_dashboard_in_fa79cda0.jpg";

// Dashboard images (high resolution)
import dashboardImg1 from "@assets/stock_images/modern_medical_techn_078712be.jpg";
import dashboardImg2 from "@assets/stock_images/modern_medical_techn_b18d4623.jpg";
import dashboardImg3 from "@assets/stock_images/modern_medical_techn_2b8bed4e.jpg";
import dashboardImg4 from "@assets/stock_images/modern_medical_techn_ce6e6799.jpg";
import dashboardImg5 from "@assets/stock_images/modern_medical_techn_480a3367.jpg";

// Video consultation images (high resolution)
import videoConsultImg1 from "@assets/stock_images/telemedicine_video_c_37792252.jpg";
import videoConsultImg2 from "@assets/stock_images/telemedicine_video_c_93c81701.jpg";
import videoConsultImg3 from "@assets/stock_images/telemedicine_video_c_bd4a1444.jpg";
import videoConsultImg4 from "@assets/stock_images/telemedicine_video_c_9c8d96f0.jpg";
import videoConsultImg5 from "@assets/stock_images/telemedicine_video_c_1e021ed2.jpg";

// Health records images (high resolution)
import healthRecordsImg1 from "@assets/stock_images/electronic_health_re_cc05fe95.jpg";
import healthRecordsImg2 from "@assets/stock_images/electronic_health_re_e4203ca7.jpg";
import healthRecordsImg3 from "@assets/stock_images/electronic_health_re_fe455f7b.jpg";
import healthRecordsImg4 from "@assets/stock_images/electronic_health_re_7d9cdbe2.jpg";
import healthRecordsImg5 from "@assets/stock_images/electronic_health_re_d88b5606.jpg";

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

  // Random image selection (changes each page load)
  const randomImages = useMemo(() => {
    const dashboardImages = [dashboardImg1, dashboardImg2, dashboardImg3, dashboardImg4, dashboardImg5];
    const videoImages = [videoConsultImg1, videoConsultImg2, videoConsultImg3, videoConsultImg4, videoConsultImg5];
    const healthImages = [healthRecordsImg1, healthRecordsImg2, healthRecordsImg3, healthRecordsImg4, healthRecordsImg5];
    
    return {
      dashboard: dashboardImages[Math.floor(Math.random() * dashboardImages.length)],
      video: videoImages[Math.floor(Math.random() * videoImages.length)],
      health: healthImages[Math.floor(Math.random() * healthImages.length)]
    };
  }, []);

  // Autumn palette color mapping (warm, modern colors)
  const colorClasses = {
    amber: {
      bgHeader: "bg-amber-50/90",
      borderHeader: "border-amber-200",
      icon: "text-amber-700",
      bullet: "bg-amber-600"
    },
    orange: {
      bgHeader: "bg-orange-50/90",
      borderHeader: "border-orange-200",
      icon: "text-orange-700",
      bullet: "bg-orange-600"
    },
    rose: {
      bgHeader: "bg-rose-50/90",
      borderHeader: "border-rose-200",
      icon: "text-rose-700",
      bullet: "bg-rose-600"
    },
    emerald: {
      bgHeader: "bg-emerald-50/90",
      borderHeader: "border-emerald-200",
      icon: "text-emerald-700",
      bullet: "bg-emerald-600"
    },
    sky: {
      bgHeader: "bg-sky-50/90",
      borderHeader: "border-sky-200",
      icon: "text-sky-700",
      bullet: "bg-sky-600"
    },
    purple: {
      bgHeader: "bg-purple-50/90",
      borderHeader: "border-purple-200",
      icon: "text-purple-700",
      bullet: "bg-purple-600"
    },
    slate: {
      bgHeader: "bg-slate-50/90",
      borderHeader: "border-slate-200",
      icon: "text-slate-700",
      bullet: "bg-slate-600"
    }
  };

  const systemFeatures = [
    {
      category: "Consultas e Atendimento",
      icon: Video,
      color: "sky",
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
      color: "emerald",
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
      color: "amber",
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
      color: "rose",
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
      color: "slate",
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
            <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Documentação do Sistema Tele{"<"}M3D{">"}</h1>
            <p className="text-xl text-white/90 mb-6 drop-shadow-md">
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
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.dashboard} alt="Dashboard" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">Dashboard Intuitivo</h3>
                <p className="text-sm text-slate-600">Interface moderna e fácil de usar</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.video} alt="Videochamada" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">Consultas em Vídeo</h3>
                <p className="text-sm text-slate-600">Atendimento online de qualidade</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.health} alt="Prontuários" className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">Prontuários Digitais</h3>
                <p className="text-sm text-slate-600">Gestão completa de dados médicos</p>
              </CardContent>
            </Card>
          </div>

          {/* Recursos do Sistema */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">Recursos e Funcionalidades</h2>
            <div className="space-y-8">
              {systemFeatures.map((category, idx) => {
                const colors = colorClasses[category.color as keyof typeof colorClasses] || colorClasses.sky;
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
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">Especificações Técnicas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {technicalSpecs.map((spec, idx) => (
                <Card key={idx} className="shadow-xl bg-white/95 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-center">{spec.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {spec.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start text-sm">
                          <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 flex-shrink-0 mt-0.5" />
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
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">Guias de Uso por Perfil</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {userGuides.map((guide, idx) => (
                <Card key={idx} className="shadow-xl hover:shadow-2xl transition-all bg-white/95 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-br from-amber-50 to-orange-50">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <guide.icon className="w-8 h-8 text-amber-700" />
                    </div>
                    <CardTitle className="text-xl text-center">{guide.role}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ul className="space-y-3">
                      {guide.guides.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-center text-sm">
                          <ArrowRight className="w-4 h-4 mr-2 text-amber-600" />
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
            <Card className="shadow-xl bg-white/95 backdrop-blur-sm overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
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
              </div>
            </Card>
          </section>

          {/* Segurança e Privacidade */}
          <section>
            <Card className="shadow-xl bg-white/95 backdrop-blur-sm border-emerald-300">
              <CardHeader className="bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardTitle className="text-center text-2xl flex items-center justify-center">
                  <Lock className="w-8 h-8 mr-3 text-emerald-700" />
                  Segurança e Privacidade
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">Dados Protegidos</h3>
                    <p className="text-sm text-slate-700">
                      Criptografia de ponta a ponta e armazenamento seguro
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">LGPD Compliant</h3>
                    <p className="text-sm text-slate-700">
                      Total conformidade com a legislação de proteção de dados
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">Acesso Controlado</h3>
                    <p className="text-sm text-slate-700">
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
