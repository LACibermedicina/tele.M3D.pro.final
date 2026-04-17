import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useIsAdmin } from "@/hooks/use-admin";
import PageWrapper from "@/components/layout/page-wrapper";
import { TranslationLoading } from "@/components/ui/translation-loading";
import { useMultiContentTranslation } from "@/hooks/use-content-translation";
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
  ArrowRight,
  Download,
  AudioLines,
  Coins,
  Landmark,
  Pill,
  ClipboardList,
  Zap,
  Globe,
  LayoutDashboard,
  Monitor
} from "lucide-react";

const docLabels = {
  back: "Voltar",
  pageTitle: "Documentação do Sistema Tele<M3D>",
  pageSubtitle: "Manual completo de recursos, funcionalidades e guias de uso",
  updatedAt: "Atualizado em Abril 2026",
  version: "Versão 4.0",
  printBtn: "Documentação Completa para Impressão",
  dashboardTitle: "Dashboard Intuitivo",
  dashboardDesc: "Interface moderna e fácil de usar",
  videoTitle: "Consultas em Vídeo",
  videoDesc: "Atendimento online de qualidade",
  recordsTitle: "Prontuários Digitais",
  recordsDesc: "Gestão completa de dados médicos",
  featuresHeading: "Recursos e Funcionalidades",
  techSpecsHeading: "Especificações Técnicas",
  guidesHeading: "Guias de Uso por Perfil",
  helpTitle: "Precisa de Ajuda?",
  helpDesc: "Nossa equipe de suporte está disponível para auxiliar você",
  support247: "Suporte 24/7",
  chatOnline: "Chat Online",
  securityTitle: "Segurança e Privacidade",
  dataProtected: "Dados Protegidos",
  dataProtectedDesc: "Criptografia de ponta a ponta e armazenamento seguro",
  lgpdCompliant: "LGPD Compliant",
  lgpdCompliantDesc: "Total conformidade com a legislação de proteção de dados",
  accessControl: "Acesso Controlado",
  accessControlDesc: "Sistema robusto de autenticação e autorização",
  manualLink: "Manual do Usuário",
  manualLinkDesc: "Guia completo de uso da plataforma",
  faqLink: "FAQ",
  faqLinkDesc: "Perguntas frequentes",
  installLink: "Instalação",
  installLinkDesc: "Script e guia de instalação",
  altDashboard: "Dashboard",
  altVideo: "Videochamada",
  altRecords: "Prontuários"
};

export default function Documentation() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();

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
    },
    teal: {
      bgHeader: "bg-teal-50/90",
      borderHeader: "border-teal-200",
      icon: "text-teal-700",
      bullet: "bg-teal-600"
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
          features: ["Qualidade HD", "Compartilhamento de tela", "Gravação e transcrição em tempo real", "Chat integrado", "Convite a especialistas durante consulta"]
        },
        {
          title: "Agendamento Inteligente",
          description: "Agenda com 3 abas (Hoje, Futuro, Histórico), cancelamento em lote e limpeza de agenda",
          features: ["Agenda 3 abas: Hoje/Futuro/Histórico", "Cancelamento em lote", "Limpar agenda completa", "Múltiplas especialidades"]
        },
        {
          title: "Solicitação de Consultas",
          description: isAdmin ? "Dois caminhos: por especialidade ou triagem IA (Protocolo de Manchester)" : "Dois caminhos: por especialidade ou triagem automatizada (Protocolo de Manchester)",
          features: ["Consulta por especialidade", isAdmin ? "Triagem IA (Manchester 5 níveis)" : "Triagem automatizada (Manchester 5 níveis)", "QR Code e código curto de acesso", "Links temporários para visitantes"]
        },
        {
          title: "Atendimento 24/7",
          description: "Plantão médico disponível a qualquer hora com sistema de escalas e inter-consulta",
          features: ["Médicos de plantão", "Emergências priorizadas", "Inter-consulta entre médicos", "Continuidade do cuidado"]
        },
        {
          title: "Avaliação de Consultas",
          description: "Sistema de avaliação 1-5 estrelas com feedback opcional após consultas concluídas",
          features: ["Avaliação 1-5 estrelas", "Feedback textual opcional", "Disponível após conclusão", "Métricas de satisfação"]
        },
        {
          title: "Consultar Agora",
          description: "Botão de consulta imediata que encontra automaticamente o primeiro médico disponível",
          features: ["Auto-busca médico disponível", "Contagem de médicos online", "Sala de espera fallback", "Disponível no desktop"]
        }
      ]
    },
    {
      category: isAdmin ? "Inteligência Artificial" : "Suporte Clínico",
      icon: Bot,
      color: "purple",
      items: [
        {
          title: isAdmin ? "Assistente Médico IA" : "Assistente Médico",
          description: isAdmin ? "Motor de IA Médica (OMS/MS-Brasil/DSM-5) com fallback automático" : "Motor de suporte médico (OMS/MS-Brasil/DSM-5) com fallback automático",
          features: ["Suporte diagnóstico", "Interações medicamentosas", "Protocolos clínicos (OMS/MS-Brasil)", "Pesquisa de evidências"]
        },
        {
          title: "Classificação Diagnóstica Pós-Consulta",
          description: isAdmin ? "IA auto-gera prescrições, exames, encaminhamentos e classificação CID-10/11 e DSM-5/TR" : "Auto-gera prescrições, exames, encaminhamentos e classificação CID-10/11 e DSM-5/TR",
          features: ["Auto-geração pós-consulta", "CID-10/11 e DSM-5/TR", "Níveis de confiança", "Análise de interações medicamentosas"]
        },
        {
          title: isAdmin ? "Chatbot e Triagem IA" : "Chatbot e Triagem",
          description: "Assistente virtual com triagem Manchester e direcionamento inteligente",
          features: ["Disponível sem login", "Triagem Manchester 5 níveis", "Respostas instantâneas", "Direcionamento adequado"]
        },
        {
          title: isAdmin ? "Geração de Lista de Medicamentos por IA" : "Geração de Lista de Medicamentos",
          description: isAdmin ? "Planos de tratamento completos gerados por IA a partir de diagnóstico, sintomas e histórico" : "Planos de tratamento completos gerados a partir de diagnóstico, sintomas e histórico",
          features: ["Geração automática de tratamento", "Baseado em diagnóstico/sintomas", "Considera histórico do paciente", "Interações medicamentosas verificadas"]
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
          title: "Exportação de Dados (HL7 FHIR R4)",
          description: "Exportação multi-padrão: Brasil/SUS (RNDS, RAC, SBIS, LGPD), USA (HIPAA, USCDI v3), Europa (GDPR), Internacional (ICD-11, SNOMED)",
          features: ["Brasil: RNDS/RAC/SBIS/LGPD", "USA: HIPAA/USCDI v3", "Europa: GDPR", "Opção de desidentificação"]
        },
        {
          title: "Prescrições e Fluxo Pós-Consulta",
          description: isAdmin ? "Emissão de receitas com assinatura digital, análise de interações e workflow pós-consulta com IA" : "Emissão de receitas com assinatura digital, análise de interações e workflow pós-consulta automatizado",
          features: ["Assinatura digital FIPS", "PDF com QR Code verificação", "Análise de interações medicamentosas", "Fluxo pós-consulta automatizado", "Busca em bases externas (RxNorm, OpenFDA, ANVISA/RENAME)"]
        },
        {
          title: "Resultados de Exames",
          description: "Upload e visualização de exames laboratoriais e imagens",
          features: ["Upload seguro", "Visualizador integrado", "Compartilhamento", "Organização por data"]
        },
        {
          title: "PMD v1.0 (Prontuário Médico Digital)",
          description: "Prontuário médico digital em conformidade com CFM/LGPD/RGPD, com CRUD, audit logs e exportação multi-locale",
          features: ["Conformidade CFM/LGPD/RGPD", "CRUD com audit logs", "Exportação multi-locale (BR/ES/USA)", "Formatos JSON/PDF/XML/CSV"]
        },
        {
          title: "Prontuário Unificado",
          description: "Visão consolidada em timeline agrupando registros, consultas, prescrições e exames por dia",
          features: ["Timeline consolidada", "Cards com código de cores", "Agrupamento por dia", "Registros/consultas/prescrições/exames"]
        }
      ]
    },
    {
      category: "Comunicação",
      icon: MessageCircle,
      color: "orange",
      items: [
        {
          title: isAdmin ? "WhatsApp IA" : "WhatsApp",
          description: "Integração com WhatsApp para comunicação automatizada com status online de pacientes",
          features: ["Lembretes automáticos", "Confirmação de consultas", "Status online pacientes", "Suporte técnico"]
        },
        {
          title: "Inter-Consultas Médicas",
          description: "Agendamento de inter-consultas entre médicos e salas de discussão de equipes",
          features: ["Inter-consulta entre médicos", "Equipes médicas", "Salas de discussão", "Notas de equipe"]
        },
        {
          title: "Notificações em Tempo Real",
          description: "Sistema de notificações push e em tempo real via WebSocket",
          features: ["WebSocket", "Alertas importantes", "Histórico completo", "Configurável"]
        }
      ]
    },
    {
      category: "Sistema de Créditos TM3D",
      icon: CreditCard,
      color: "amber",
      items: [
        {
          title: "Checkout Unificado de Pagamentos",
          description: "Múltiplos métodos de pagamento: PayPal, Stripe (cartão/Apple Pay) e PagBank (PIX/Boleto)",
          features: ["PayPal Checkout seguro", "Stripe (cartão/Apple Pay)", "PagBank (PIX/Boleto)", "6 pacotes de crédito", "Recibos automáticos"]
        },
        {
          title: "Carteira Digital",
          description: "Controle completo de saldo, transferências, histórico e vinculação de carteira externa",
          features: ["Saldo em tempo real", "Extrato detalhado", "Transferências", "Solicitação de saque"]
        },
        {
          title: "Auditoria Financeira",
          description: "Log de auditoria com filtros e resumos semanais de todas as transações",
          features: ["Log de auditoria completo", "Filtro por ação", "Resumos semanais", "Transparência total"]
        },
        {
          title: "Monitoramento de Pagamentos (Admin)",
          description: "Dashboard administrativo em /admin/payments com filtros, resumos e breakdown por provedor",
          features: ["Dashboard /admin/payments", "Filtros por provedor/status/data", "Cards de resumo", "Breakdown por provedor de pagamento"]
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
          title: "Conformidade Multi-Padrão",
          description: "LGPD, HIPAA, GDPR e conformidade FHIR R4",
          features: ["Conformidade LGPD", "Desidentificação HIPAA", "GDPR Europa", "FHIR R4 compliance"]
        },
        {
          title: "Detecção de Inatividade e Auto-Logout",
          description: "Timeout configurável com prompt, desconexão Agora e logout automático",
          features: ["Timeout configurável", "Prompt antes do logout", "Desconexão Agora automática", "RBAC granular"]
        },
        {
          title: "Assinatura Digital Verificável",
          description: "Dual-path RSA-PSS ICP-Brasil A3 + RSA-SHA256 com QR code de verificação e OCSP checks",
          features: ["RSA-PSS ICP-Brasil A3", "RSA-SHA256 fallback", "QR code para verificação pública", "OCSP checks e audit trail"]
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
          description: "Painel completo com tema escuro para gestão da plataforma",
          features: ["Métricas em tempo real", "Gestão de usuários", isAdmin ? "Configurações globais (inatividade, PayPal, IA)" : "Configurações globais (inatividade, PayPal, serviços)", "Tema escuro"]
        },
        {
          title: "Relatórios e Analytics",
          description: "Dashboard de relatórios: consultas, pacientes, financeiro, performance médica",
          features: ["Relatórios de consultas", "Análise de pacientes", "Financeiro detalhado", "Performance médica"]
        },
        {
          title: "Gestão Financeira Admin",
          description: "CRUD de pacotes de crédito, custos de funcionalidades e taxa de câmbio TM3D/USD",
          features: ["Pacotes de crédito CRUD", "15 custos de funcionalidades", "Taxa TM3D/USD", "Envio de créditos"]
        },
        {
          title: "Bloqueio de Pacientes",
          description: "Médicos podem bloquear pacientes de solicitar consultas",
          features: ["Bloqueio por médico", "Desbloqueio disponível", "Impede novas solicitações", "Registro de bloqueio"]
        },
        {
          title: isAdmin ? "Configuração de Prompts IA (ECG + Radiologia)" : "Configuração de Análise Clínica",
          description: isAdmin ? "Admin configura prompts customizados para análise de ECG e Radiologia via IA" : "Prompts otimizados para análise de ECG e imagens radiológicas",
          features: ["Prompt customizado para ECG", "Prompt customizado para Radiologia", isAdmin ? "Editável pelo admin em tempo real" : "Configurado pelo administrador", "Aplicado globalmente a todos os médicos"]
        },
        {
          title: "Desconexão em Massa",
          description: "Controles administrativos para desconexão em massa de usuários, médicos ou serviços do sistema",
          features: ["Desconectar todos os usuários", "Desconectar todos os médicos", "Desconectar todos os serviços", "Confirmação obrigatória antes da ação"]
        },
        {
          title: "Temas por Perfil (Per-Role)",
          description: "Personalização de cores de destaque e opacidade global por papel de usuário",
          features: ["Cores de destaque (accent) por papel", "Opacidade/transparência global", "Temas independentes por role", "Aplicação em tempo real"]
        }
      ]
    },
    {
      category: "Farmácia",
      icon: Pill,
      color: "emerald",
      items: [
        {
          title: "Painel da Farmácia",
          description: "Lista de prescrições com abas (Pendentes/Dispensadas/Todas), busca e estatísticas resumidas",
          features: ["Abas Pendentes/Dispensadas/Todas", "Busca por prescrição", "Estatísticas resumidas", "Interface tab-based"]
        },
        {
          title: "Verificação de Prescrições",
          description: "Verificação de assinatura digital e CRM do médico com confirmação de leitura",
          features: ["Verificação de assinatura digital", "Verificação de CRM", "Confirmação de leitura", "Status de verificação"]
        },
        {
          title: "Dispensação de Medicamentos",
          description: "Dispensação por item com rastreamento de lote, fabricante e validade",
          features: ["Dispensação por item", "Rastreamento de lote", "Registro de fabricante", "Controle de validade"]
        },
        {
          title: "Relatórios LGPD",
          description: "Relatórios diários/semanais/mensais/personalizados com breakdowns e toggle LGPD",
          features: ["Relatórios diários/semanais/mensais", "Período personalizado", "Breakdowns medicamento/médico/patologia", "Toggle LGPD de anonimização"]
        }
      ]
    },
    {
      category: isAdmin ? "Assistente de Voz IAM3D" : "Assistente de Voz",
      icon: AudioLines,
      color: "purple",
      items: [
        {
          title: "Assistente por Voz",
          description: isAdmin ? "IA de voz full-screen com esfera animada para interação natural" : "Assistente de voz full-screen com esfera animada para interação natural",
          features: [isAdmin ? "Web Speech API" : "Reconhecimento de voz", "Overlay full-screen", "Esfera animada 3D", "Fechamento por voz"]
        },
        {
          title: "Funcionalidades por Perfil",
          description: "Badges de capacidade baseados no papel do usuário com chamadas urgentes",
          features: ["Paciente: Triagem/Agendar/Urgente", "Médico: Diagnóstico/Protocolos/Plantão", "Chamadas urgentes a plantonistas", "Inter-consulta por voz"]
        },
        {
          title: "Integração com Chatbot",
          description: "Unificado com o chatbot para respostas contextuais e ações",
          features: ["Botões de ação na resposta", "Persistência de conversação", "Modo texto alternativo", "Navegação por voz"]
        }
      ]
    },
    {
      category: "Suporte Multilíngue",
      icon: Globe,
      color: "teal",
      items: [
        {
          title: "8 Idiomas Suportados",
          description: "Interface completa traduzida com seletor de idioma no cabeçalho",
          features: ["Português (BR)", "Espanhol (ES)", "Inglês (EN)", "Francês, Alemão, Italiano", "Chinês, Guarani", "Seletor no header"]
        },
        {
          title: isAdmin ? "IA e Voz Multilíngue" : "Voz Multilíngue",
          description: isAdmin ? "Respostas da IA, STT e TTS respeitam o idioma selecionado pelo usuário" : "Respostas, STT e TTS respeitam o idioma selecionado pelo usuário",
          features: ["Chatbot responde no idioma", isAdmin ? "IAM3D voz localizada" : "Voz localizada", "STT reconhece por locale", "TTS sintetiza por idioma"]
        },
        {
          title: "Internacionalização (i18n)",
          description: "Sistema i18next com fallback automático e traduções organizadas por módulo",
          features: ["react-i18next", "Fallback para PT-BR", "Chaves por módulo", "Formatação de data/hora"]
        }
      ]
    },
    {
      category: "Blockchain e NFTs",
      icon: Coins,
      color: "amber",
      items: [
        {
          title: "NFTs Dinâmicos de Dados Médicos",
          description: "Tokenização de insights clínicos anonimizados conforme LGPD com cotas de propriedade",
          features: ["Dados anonimizados LGPD", "NFTs dinâmicos", "Cotas de propriedade", "Rastreamento de valor"]
        },
        {
          title: "Broker Interno TM3D/NFT",
          description: "Plataforma de negociação com livro de ofertas, ordens e controle de supply TM3D",
          features: ["Livro de ofertas (order book)", "Ordens de compra/venda", "Histórico de negociações", "Controle de supply TM3D"]
        },
        {
          title: "Carteira Externa",
          description: "Integração com MetaMask e WalletConnect para operações externas e saques",
          features: ["Vincular MetaMask", "WalletConnect", "Solicitação de saque", "Auditoria completa"]
        }
      ]
    },
    {
      category: "Dashboard Interativo",
      icon: LayoutDashboard,
      color: "teal",
      items: [
        {
          title: "Painéis Arrastáveis",
          description: "Drag & drop para reorganizar painéis do dashboard com persistência de posição",
          features: ["Arrastar e soltar painéis", "Posição salva entre sessões", "Reset para layout padrão", "Compatível com todos os dashboards"]
        },
        {
          title: "Dock de Minimização",
          description: "Painéis e widgets minimizados ficam acessíveis no dock lateral",
          features: ["Minimizar painéis e widgets", "Restaurar com um clique", "Dock posicionável (esquerda/direita)", "Auto-ocultar quando vazio"]
        },
        {
          title: "Toolbox Unificado",
          description: "Barra de ferramentas flutuante com navegação contextual por papel do usuário",
          features: ["Atalhos filtrados por papel", "Acoplamento magnético às bordas", "Modo compacto (ícones)", "Categorias organizadas"]
        }
      ]
    },
    {
      category: "Interface e UX",
      icon: Monitor,
      color: "sky",
      items: [
        {
          title: "Ambiente Windowed Estilo Desktop OS",
          description: "Ambiente inspirado em macOS com janelas arrastáveis, redimensionáveis, minimizáveis e fecháveis",
          features: ["Janelas arrastáveis e redimensionáveis", "Minimizar/restaurar/fechar", "Múltiplas janelas simultâneas", "Barra de título escura em todos os painéis flutuantes"]
        },
        {
          title: "Três Modos de Interface",
          description: "Tela de seleção de modo pós-login: Imersiva (voz/chat), Mobile (tablets) e Desktop (completo)",
          features: ["Modo Imersiva: controle total por voz e chat", "Modo Mobile: botões essenciais para tablets", "Modo Desktop: interface completa com todos os recursos", "Recomendação automática com base no dispositivo"]
        },
        {
          title: "Aprimoramentos de UX Desktop",
          description: "Temas de papel de parede, sliders de opacidade global, sticky notes flutuantes, busca global ⌘K e painel de médicos disponíveis",
          features: ["Temas de wallpaper configuráveis", "Slider de opacidade/transparência global", "Sticky notes flutuantes", "Busca global ⌘K (Command Palette)", "Painel lateral de médicos disponíveis"]
        },
        {
          title: "CRM / Verificação de Licença Profissional",
          description: "Verificação automatizada de registro profissional via CFM (Brasil) e Ordem dos Médicos (Portugal)",
          features: ["Verificação CFM automatizada", "Integração Ordem dos Médicos (PT)", "Validação em tempo real", "Status de verificação exibido no perfil"]
        }
      ]
    }
  ];

  const technicalSpecs = [
    {
      title: "Arquitetura Frontend",
      items: ["React 18 com TypeScript", "Tailwind CSS + shadcn/ui", "Wouter para roteamento", "TanStack Query v5", isAdmin ? "Web Speech API (IAM3D)" : "Reconhecimento de voz", "i18next (8 idiomas)"]
    },
    {
      title: "Arquitetura Backend",
      items: ["Node.js com Express", "PostgreSQL (Neon)", "Drizzle ORM", "WebSocket para real-time", "61+ tabelas"]
    },
    {
      title: "Integrações",
      items: [isAdmin ? "Motor de IA Médica" : "Motor de Suporte Médico", isAdmin ? "Fallback IA automático" : "Fallback automático", "Agora.io Video SDK", "PayPal Checkout", "Stripe Checkout", "PagBank (PIX/Boleto)", "HL7 FHIR R4 Export"]
    },
    {
      title: "Segurança",
      items: ["HTTPS/TLS 1.3", "Criptografia AES-256", "RBAC granular", "LGPD/HIPAA/GDPR", "FHIR R4 compliance"]
    }
  ];

  const userGuides = [
    {
      role: "Pacientes",
      icon: Users,
      guides: [
        isAdmin ? "Como solicitar consulta (por especialidade ou triagem IA)" : "Como solicitar consulta (por especialidade ou triagem automatizada)",
        isAdmin ? "Como usar o assistente de voz IAM3D (consulta urgente)" : "Como usar o assistente de voz (consulta urgente)",
        "Como comprar créditos TM3D (PayPal, Stripe, PagBank PIX/Boleto)",
        "Como participar de videochamada",
        "Como acessar prescrições e prontuário",
        "Como exportar dados médicos (FHIR R4 - direito LGPD)",
        "Como funciona a detecção de inatividade",
        "Como avaliar uma consulta (1-5 estrelas + feedback)",
        "Como usar o botão Consultar Agora"
      ]
    },
    {
      role: "Médicos",
      icon: Activity,
      guides: [
        "Como gerenciar agenda (3 abas, limpar agenda)",
        isAdmin ? "Como usar o fluxo pós-consulta (IA auto-gera prescrições)" : "Como usar o fluxo pós-consulta (auto-geração de prescrições)",
        "Como revisar classificação diagnóstica (CID-10/DSM-5)",
        isAdmin ? "Como realizar consultas online com IA e convidar especialistas" : "Como realizar consultas online e convidar especialistas",
        "Como usar notas médicas (estilo macOS Notes)",
        "Como agendar inter-consultas entre médicos",
        "Como exportar dados de pacientes (FHIR R4)",
        "Como acessar o dashboard de relatórios",
        "Como usar o PMD v1.0 (criar/editar/exportar)",
        "Como visualizar o Prontuário Unificado",
        "Como bloquear/desbloquear pacientes",
        isAdmin ? "Como gerar lista de medicamentos por IA" : "Como gerar lista de medicamentos automaticamente",
        "Como verificar prescrições na farmácia",
        "Como usar o ambiente windowed Desktop OS (mover/redimensionar/minimizar janelas)",
        "Como verificar CRM junto ao CFM / Ordem dos Médicos",
        "Como usar o Toolbox — barra de ferramentas contextual"
      ]
    },
    {
      role: "Administradores",
      icon: Settings,
      guides: [
        "Como gerenciar usuários e licenças",
        "Como configurar timeout de inatividade",
        "Como configurar e-mail PayPal destinatário",
        "Como gerenciar pacotes de crédito e custos",
        "Como acessar o dashboard de relatórios",
        "Como auditar transações financeiras",
        "Como gerenciar conformidade FHIR e exportação",
        "Como monitorar pagamentos (Stripe/PagBank/PayPal)",
        "Como gerenciar farmacêuticos",
        isAdmin ? "Como configurar prompts IA (ECG e Radiologia)" : "Como configurar análise clínica",
        "Como usar a desconexão em massa (usuários/médicos/serviços)",
        "Como personalizar temas por perfil (accent/opacidade)",
        "Como configurar o ambiente Desktop (wallpaper, sticky notes, opacidade global)"
      ]
    },
    {
      role: "Farmacêuticos",
      icon: Pill,
      guides: [
        "Como acessar o painel da farmácia",
        "Como verificar assinatura digital de prescrições",
        "Como dispensar medicamentos (lote/fabricante/validade)",
        "Como gerar relatórios LGPD da farmácia",
        "Como usar filtros e busca de prescrições"
      ]
    }
  ];

  const translatableFeatures = useMemo(() => systemFeatures.map(f => ({
    category: f.category,
    items: f.items.map(i => ({ title: i.title, description: i.description, features: i.features }))
  })), []);

  const translatableSpecs = useMemo(() => technicalSpecs.map(s => ({
    title: s.title, items: s.items
  })), []);

  const translatableGuides = useMemo(() => userGuides.map(g => ({
    role: g.role, guides: g.guides
  })), []);

  const { data: txSections, isLoading } = useMultiContentTranslation({
    labels: docLabels,
    features: translatableFeatures,
    specs: translatableSpecs,
    guides: translatableGuides
  }, 'doc');

  const lb = (txSections.labels || docLabels) as typeof docLabels;
  const txFeatures = (txSections.features || translatableFeatures) as typeof translatableFeatures;
  const txSpecs = (txSections.specs || translatableSpecs) as typeof translatableSpecs;
  const txGuides = (txSections.guides || translatableGuides) as typeof translatableGuides;

  const mergedFeatures = systemFeatures.map((f, idx) => ({
    ...f,
    category: txFeatures[idx]?.category || f.category,
    items: f.items.map((item, iIdx) => ({
      ...item,
      title: txFeatures[idx]?.items?.[iIdx]?.title || item.title,
      description: txFeatures[idx]?.items?.[iIdx]?.description || item.description,
      features: txFeatures[idx]?.items?.[iIdx]?.features || item.features
    }))
  }));

  const mergedSpecs = technicalSpecs.map((s, idx) => ({
    ...s,
    title: txSpecs[idx]?.title || s.title,
    items: txSpecs[idx]?.items || s.items
  }));

  const mergedGuides = userGuides.map((g, idx) => ({
    ...g,
    role: txGuides[idx]?.role || g.role,
    guides: txGuides[idx]?.guides || g.guides
  }));

  return (
    <PageWrapper variant="medical" medicalBg={medicalBgImage}>
      <TranslationLoading isLoading={isLoading}>
      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-12">
            <Link href="/">
              <Button variant="ghost" className="mb-6 text-white hover:bg-white/10" data-testid="button-back-home">
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                {lb.back}
              </Button>
            </Link>
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-white" />
            <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">{lb.pageTitle}</h1>
            <p className="text-xl text-white/90 mb-6 drop-shadow-md">
              {lb.pageSubtitle}
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                <CheckCircle className="w-4 h-4 mr-2" />
                {lb.updatedAt}
              </Badge>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                <Star className="w-4 h-4 mr-2" />
                {lb.version}
              </Badge>
            </div>
            <div className="mt-6">
              <Button
                onClick={() => window.open('/api/docs/pdf', '_blank')}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-3"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                {lb.printBtn}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.dashboard} alt={lb.altDashboard} className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">{lb.dashboardTitle}</h3>
                <p className="text-sm text-slate-600">{lb.dashboardDesc}</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.video} alt={lb.altVideo} className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">{lb.videoTitle}</h3>
                <p className="text-sm text-slate-600">{lb.videoDesc}</p>
              </CardContent>
            </Card>
            <Card className="shadow-xl hover:shadow-2xl transition-all overflow-hidden bg-white/95 backdrop-blur-sm">
              <img src={randomImages.health} alt={lb.altRecords} className="w-full h-48 object-cover" />
              <CardContent className="p-4 text-center">
                <h3 className="font-bold text-slate-800">{lb.recordsTitle}</h3>
                <p className="text-sm text-slate-600">{lb.recordsDesc}</p>
              </CardContent>
            </Card>
          </div>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">{lb.featuresHeading}</h2>
            <div className="space-y-8">
              {mergedFeatures.map((category, idx) => {
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
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">{lb.techSpecsHeading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mergedSpecs.map((spec, idx) => (
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
            <h2 className="text-3xl font-bold text-white text-center mb-8 drop-shadow-lg">{lb.guidesHeading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mergedGuides.map((guide, idx) => (
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
                    <h2 className="text-2xl font-bold mb-4">{lb.helpTitle}</h2>
                    <p className="text-white/90 mb-6">
                      {lb.helpDesc}
                    </p>
                    <div className="flex justify-center gap-4 flex-wrap">
                      <Badge className="bg-white/20 text-white px-4 py-2">
                        <Clock className="w-4 h-4 mr-2" />
                        {lb.support247}
                      </Badge>
                      <Badge className="bg-white/20 text-white px-4 py-2">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {lb.chatOnline}
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
                  {lb.securityTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">{lb.dataProtected}</h3>
                    <p className="text-sm text-slate-700">
                      {lb.dataProtectedDesc}
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">{lb.lgpdCompliant}</h3>
                    <p className="text-sm text-slate-700">
                      {lb.lgpdCompliantDesc}
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-12 h-12 text-emerald-700" />
                    </div>
                    <h3 className="font-bold text-emerald-900 mb-2">{lb.accessControl}</h3>
                    <p className="text-sm text-slate-700">
                      {lb.accessControlDesc}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Link href="/manual">
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6 text-center">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-blue-600" />
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-1">{lb.manualLink}</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{lb.manualLinkDesc}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/faq">
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-6 text-center">
                  <ArrowRight className="w-10 h-10 mx-auto mb-3 text-purple-600" />
                  <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-1">{lb.faqLink}</h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">{lb.faqLinkDesc}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/installation">
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-6 text-center">
                  <Settings className="w-10 h-10 mx-auto mb-3 text-green-600" />
                  <h3 className="font-bold text-green-900 dark:text-green-100 mb-1">{lb.installLink}</h3>
                  <p className="text-sm text-green-700 dark:text-green-300">{lb.installLinkDesc}</p>
                </CardContent>
              </Card>
            </Link>
          </section>

        </div>
      </div>
      </TranslationLoading>
    </PageWrapper>
  );
}
