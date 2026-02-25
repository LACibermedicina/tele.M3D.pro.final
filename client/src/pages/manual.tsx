import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  BookOpen, Video, Calendar, MessageCircle, FileText, Users, Shield,
  Bot, CreditCard, Activity, Settings, MonitorSmartphone, Stethoscope,
  ClipboardList, Bell, Search, Phone, ArrowRight, CheckCircle, AlertTriangle
} from "lucide-react";

const sections = [
  {
    id: "getting-started",
    title: "Primeiros Passos",
    icon: <BookOpen className="h-5 w-5" />,
    content: [
      {
        title: "1. Criando sua Conta",
        text: `Para começar a usar o Tele<M3D>, acesse a página inicial e clique em "Registrar". Existem três tipos de conta:

- **Médico**: Acesso completo ao sistema de gestão, teleconsultas, prontuários e IA médica.
- **Paciente**: Solicitar consultas, acessar sala de espera, ver prescrições e prontuários.
- **Administrador**: Gerenciamento completo do sistema, analytics e painel administrativo.

Após o registro, faça login com seu e-mail e senha para acessar o painel principal.`
      },
      {
        title: "2. Navegação Principal",
        text: `O sistema possui um menu de navegação no topo da tela que se adapta ao seu perfil:

- **Painel de Atalhos Rápidos**: Pressione Ctrl+K (ou Cmd+K no Mac) para abrir a paleta de comandos e navegar rapidamente.
- **Menu Superior**: Links diretos para todas as funcionalidades principais.
- **Notificações**: Ícone de sino no canto superior direito com alertas em tempo real.
- **Perfil**: Acesse suas configurações clicando no seu nome/avatar.`
      },
      {
        title: "3. Dashboard",
        text: `O dashboard é sua central de informações:

- **Médico**: Cards com estatísticas (consultas do dia, pacientes ativos, prontuários), acesso rápido à agenda e sala de espera.
- **Paciente**: Status das consultas solicitadas, próximas consultas e acesso ao assistente IA.
- **Admin**: Visão geral do sistema, métricas de uso e gestão de usuários.`
      }
    ]
  },
  {
    id: "teleconsultas",
    title: "Teleconsultas por Vídeo",
    icon: <Video className="h-5 w-5" />,
    content: [
      {
        title: "Iniciar uma Teleconsulta (Médico)",
        text: `Existem três formas de iniciar uma videoconsulta:

1. **Pela Agenda**: Vá em "Agenda", encontre o agendamento e clique em "Iniciar" para abrir a sala de vídeo.
2. **Consulta Instantânea**: Na agenda, clique em "Consulta Instantânea" para selecionar um paciente online e iniciar uma chamada imediata. O paciente recebe uma notificação em tempo real.
3. **Pelo Consultório Virtual**: Em "Consultório", abra sua sala e gere um link de acesso para o paciente.

Durante a consulta, você tem acesso a:
- Chat em tempo real com o paciente
- Consulta à IA diagnóstica (envie perguntas clínicas)
- Anotações e notas clínicas
- Transcrição automática de áudio (Chrome/Edge)
- Compartilhamento de tela
- Convite para especialistas`
      },
      {
        title: "Participar de uma Consulta (Paciente)",
        text: `Como paciente, você pode:

1. **Solicitar Consulta**: Vá em "Solicitar Consulta", descreva seus sintomas e a IA fará uma triagem automática pelo Protocolo de Manchester. Você receberá recomendações de especialistas.
2. **Sala de Espera**: Acesse "Sala de Espera" para ver médicos online disponíveis.
3. **Notificação**: Quando o médico inicia uma consulta instantânea, você recebe uma notificação com botão para entrar na sala de vídeo.
4. **Link de Acesso**: O médico pode enviar um link direto para você entrar na consulta.`
      },
      {
        title: "Recursos Durante a Consulta",
        text: `- **Vídeo e Áudio**: Controles para ligar/desligar câmera e microfone.
- **Chat**: Mensagens em tempo real entre médico e paciente.
- **Compartilhamento de Tela**: O médico pode compartilhar sua tela (prontuários, exames).
- **Transcrição**: Ativação de transcrição automática por reconhecimento de voz.
- **Notas**: O médico pode fazer anotações que são salvas automaticamente.
- **IA Diagnóstica**: O médico pode consultar a IA durante o atendimento.`
      }
    ]
  },
  {
    id: "agenda",
    title: "Agenda e Agendamentos",
    icon: <Calendar className="h-5 w-5" />,
    content: [
      {
        title: "Agenda do Médico",
        text: `A agenda possui duas abas principais:

- **Agenda do Dia**: Mostra consultas agendadas (status "Agendado" ou "Em andamento"). Consultas nos próximos 30 minutos são destacadas com animação.
- **Histórico**: Lista de consultas concluídas, canceladas e teleconsultas realizadas, com informações do paciente, duração e notas.

Para cada consulta, você pode: Iniciar videochamada, Gerar link de acesso para o paciente, ou Editar detalhes.`
      },
      {
        title: "Configurar Disponibilidade",
        text: `Em "Disponibilidade":

- **Status Online**: Ative para aparecer como disponível para pacientes.
- **Disponível para Consulta Imediata**: Permite que pacientes o encontrem na sala de espera.
- **Modo Plantão 24h**: Ative para ficar disponível continuamente.
- **Horários Semanais**: Configure dias, horários de início/fim e duração das consultas.`
      },
      {
        title: "Agenda do Paciente",
        text: `Em "Minhas Consultas", o paciente vê três abas:

- **Próximas**: Consultas pendentes ou aceitas, com botão para entrar na sala de vídeo.
- **Solicitações**: Histórico de solicitações concluídas ou recusadas.
- **Histórico**: Teleconsultas realizadas com informações do médico, duração e notas clínicas.`
      }
    ]
  },
  {
    id: "whatsapp",
    title: "WhatsApp IA",
    icon: <MessageCircle className="h-5 w-5" />,
    content: [
      {
        title: "Central de Mensagens",
        text: `O módulo WhatsApp IA permite comunicação médico-paciente:

- **Lista de Pacientes**: Exibe todos os pacientes com status online/offline em tempo real.
- **Chat**: Interface de chat com histórico completo de mensagens.
- **Painel de Detalhes**: Informações clínicas do paciente (histórico, prescrições, exames).

As mensagens são identificadas por remetente: Doutor(a) (azul), Paciente (cinza) e IA MedPro (indicador especial).`
      },
      {
        title: "Toggle de Resposta do Paciente",
        text: `Ao enviar uma mensagem, o médico pode controlar se o paciente pode responder:

- **Resposta habilitada** (verde): O paciente vê um botão "Responder" na notificação e pode enviar uma resposta diretamente.
- **Sem resposta** (cinza): A mensagem é enviada como informativo, sem opção de resposta.

As respostas do paciente aparecem no chat do WhatsApp em tempo real via WebSocket.`
      },
      {
        title: "IA Automática",
        text: `Mensagens recebidas dos pacientes são automaticamente analisadas pela IA:

- Detecção de solicitações de agendamento
- Análise de questões clínicas
- Respostas automáticas geradas pela IA baseadas nas diretrizes OMS, Ministério da Saúde e DSM-5`
      }
    ]
  },
  {
    id: "prontuarios",
    title: "Prontuários Eletrônicos",
    icon: <FileText className="h-5 w-5" />,
    content: [
      {
        title: "Prontuários do Médico",
        text: `Em "Prontuários", o médico pode:

- Visualizar o histórico completo do paciente
- Criar novos registros clínicos (SOAP)
- Anexar exames e resultados
- Gerar relatórios em PDF
- Consultar a IA para análise de registros`
      },
      {
        title: "Prontuário do Paciente",
        text: `Pacientes com registros existentes podem acessar "Meu Prontuário" no menu (aparece automaticamente quando há dados). Visualização somente leitura dos registros clínicos.`
      }
    ]
  },
  {
    id: "prescricoes",
    title: "Prescrições",
    icon: <ClipboardList className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciar Prescrições",
        text: `O módulo de prescrições permite:

- **Médico**: Criar prescrições digitais com medicamentos, dosagens e instruções. Gerar PDF para download. Compartilhar com o paciente.
- **Paciente**: Visualizar prescrições ativas (o item "Prescrições" aparece no menu apenas quando há prescrições dentro da validade). Acessar detalhes completos e fazer download do PDF.`
      }
    ]
  },
  {
    id: "ia",
    title: "Assistente IA Médica",
    icon: <Bot className="h-5 w-5" />,
    content: [
      {
        title: "Chatbot Médico",
        text: `O assistente IA está disponível em toda a plataforma através do ícone flutuante no canto inferior direito. Funcionalidades:

- **Consultas Clínicas**: Pergunte sobre sintomas, diagnósticos diferenciais, protocolos de tratamento.
- **Referências**: A IA utiliza diretrizes da OMS, Ministério da Saúde do Brasil (CABs, PCDT/CONITEC) e DSM-5/DSM-5-TR.
- **Contexto do Paciente**: Durante teleconsultas, a IA tem acesso ao histórico do paciente para respostas contextualizadas.
- **Triagem**: Classificação automática pelo Protocolo de Manchester em 5 níveis (emergência, muito urgente, urgente, padrão, não urgente).`
      },
      {
        title: "Referências Médicas",
        text: `Em "Referências Médicas", gerencie as bases de conhecimento da IA:

- Adicione protocolos e diretrizes personalizados
- Configure prioridades de referência
- Ative/desative referências para uso diagnóstico`
      }
    ]
  },
  {
    id: "triagem",
    title: "Classificação de Risco",
    icon: <AlertTriangle className="h-5 w-5" />,
    content: [
      {
        title: "Protocolo de Manchester",
        text: `O sistema utiliza o Protocolo de Manchester (MTS) com 5 níveis de classificação:

- 🔴 **Emergência**: Atendimento imediato (risco de morte)
- 🟠 **Muito Urgente**: Atendimento em até 10 minutos
- 🟡 **Urgente**: Atendimento em até 60 minutos
- 🟢 **Padrão**: Atendimento em até 120 minutos
- 🔵 **Não Urgente**: Atendimento em até 240 minutos

A classificação é feita automaticamente pela IA durante a solicitação de consulta e pode ser visualizada em todos os módulos (consultas, WhatsApp, prontuários).`
      }
    ]
  },
  {
    id: "creditos",
    title: "Créditos e Pagamentos",
    icon: <CreditCard className="h-5 w-5" />,
    content: [
      {
        title: "Sistema de Créditos TMC",
        text: `O sistema utiliza créditos TMC (Tele-Medicina Credits) para funcionalidades:

- **Teleconsulta por Vídeo**: 50 TMC
- **Mensagem WhatsApp**: 10 TMC
- **Análise IA de Exame**: 15 TMC
- **Relatório Epidemiológico**: 20 TMC

Adquira pacotes de créditos em "Créditos" no menu. O histórico de transações mostra todas as movimentações com saldo atualizado.`
      }
    ]
  },
  {
    id: "equipes",
    title: "Equipes Médicas",
    icon: <Users className="h-5 w-5" />,
    content: [
      {
        title: "Gestão de Equipes",
        text: `Em "Equipes Médicas":

- **Criar Equipes**: Organize médicos em equipes por especialidade ou setor.
- **Sala da Equipe**: Cada equipe tem uma sala com 3 abas: Discussão, Inter-Consulta e Arquivos.
- **Inter-Consulta**: Solicite pareceres de outros especialistas com indicação de urgência.
- **Notas**: Compartilhe notas clínicas, resumos de casos e perguntas clínicas com a equipe.`
      }
    ]
  },
  {
    id: "epidemiologia",
    title: "Relatórios Epidemiológicos",
    icon: <Activity className="h-5 w-5" />,
    content: [
      {
        title: "Análise Epidemiológica",
        text: `Em "Epidemiologia", a IA analisa dados clínicos para gerar:

- **Visão Geral**: Resumo com análise IA dos dados do período.
- **Sintomas/MeSH**: Frequência de sintomas com códigos MeSH extraídos pela IA.
- **Diagnósticos**: Tendências diagnósticas com códigos ICD.
- **Classificação de Risco**: Distribuição por nível de triagem.

Filtre por período (7, 30, 90 ou 365 dias) e gere análises detalhadas.`
      }
    ]
  }
];

export default function Manual() {
  return (
    <PageWrapper variant="origami">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Manual do Usuário
              </h1>
              <p className="text-muted-foreground">
                Guia completo de uso da plataforma Tele{"<"}M3D{">"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Índice</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <nav className="space-y-1 px-4 pb-4">
                    {sections.map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {section.icon}
                        {section.title}
                      </a>
                    ))}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-8">
            {sections.map((section) => (
              <Card key={section.id} id={section.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {section.icon}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.content.map((item, idx) => (
                    <div key={idx}>
                      {idx > 0 && <Separator className="mb-6" />}
                      <h3 className="font-semibold text-lg mb-3">{item.title}</h3>
                      <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
