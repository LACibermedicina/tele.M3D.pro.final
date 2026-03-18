import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import PageWrapper from "@/components/layout/page-wrapper";
import { TranslationLoading } from "@/components/ui/translation-loading";
import { useMultiContentTranslation } from "@/hooks/use-content-translation";
import { useMemo } from "react";
import {
  BookOpen, Video, Calendar, MessageCircle, FileText, Users, Shield,
  Bot, CreditCard, Activity, Settings, MonitorSmartphone, Stethoscope,
  ClipboardList, Bell, Search, Phone, ArrowRight, CheckCircle, AlertTriangle,
  Globe, Mic, QrCode, Download, Lock, Wallet, BarChart3, UserCog,
  Eye, Heart, Clock, Share2, Briefcase, Database, Key, LogOut, Pill, Star,
  Ban, Sparkles, Layers
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: JSX.Element;
  content: { title: string; text: string }[];
}

const visitorSections: Section[] = [
  {
    id: "v-welcome",
    title: "Bem-vindo",
    icon: <Globe className="h-5 w-5" />,
    content: [
      {
        title: "Acesso como Visitante",
        text: `O Tele<M3D> Pro oferece acesso limitado para visitantes que ainda não possuem conta. Como visitante, você pode:

- Explorar as funcionalidades do sistema na página de **Features**
- Interagir com o **assistente de voz**
- Utilizar o **chatbot** de informações gerais
- Registrar-se como Paciente, Médico ou Administrador
- Acessar consultas via **links temporários de acesso**`
      }
    ]
  },
  {
    id: "v-iam3d",
    title: "Assistente de Voz",
    icon: <Mic className="h-5 w-5" />,
    content: [
      {
        title: "O que é o Assistente de Voz?",
        text: `O Assistente de Voz é um assistente inteligente com interface visual de esfera animada em tela cheia. Ele utiliza a Web Speech API para reconhecimento e síntese de voz.

Como visitante, você pode:
- **Ativar o assistente** clicando no ícone de microfone ou dizendo "Olá Assistente"
- **Fazer perguntas gerais** sobre a plataforma e suas funcionalidades
- **Solicitar informações** sobre como se registrar e começar a usar o sistema
- **Acesso de emergência**: Diga "emergência" ou "192" para receber orientações de emergência médica (SAMU)

O assistente exibe badges de segurança de acordo com o nível de acesso (visitante, paciente, médico, admin).`
      }
    ]
  },
  {
    id: "v-chatbot",
    title: "Chatbot Informativo",
    icon: <Bot className="h-5 w-5" />,
    content: [
      {
        title: "Usando o Chatbot",
        text: `O chatbot flutuante está disponível no canto inferior direito da tela. Para visitantes, ele oferece:

- Informações sobre a plataforma Tele<M3D>
- Orientações sobre o processo de registro
- Perguntas frequentes sobre teleconsultas
- Informações sobre segurança e privacidade dos dados

O chatbot oferece orientações com referências da OMS, Ministério da Saúde do Brasil e DSM-5.`
      }
    ]
  },
  {
    id: "v-features",
    title: "Página de Funcionalidades",
    icon: <Eye className="h-5 w-5" />,
    content: [
      {
        title: "Explorando as Funcionalidades",
        text: `A página de Features apresenta todas as capacidades do sistema:

- **Teleconsultas por Vídeo**: Consultas em tempo real com suporte diagnóstico integrado
- **Triagem por Protocolo de Manchester**: Classificação automática de risco em 5 níveis
- **Prontuários Eletrônicos**: Gestão completa de registros médicos
- **WhatsApp**: Comunicação inteligente médico-paciente
- **Carteira Digital TM3D**: Sistema de créditos e pagamentos
- **NFTs Médicos**: Tokenização de dados clínicos anonimizados
- **Exportação FHIR R4**: Exportação de dados em padrões internacionais

Explore cada funcionalidade para entender como o sistema pode beneficiar sua prática médica.`
      }
    ]
  },
  {
    id: "v-register",
    title: "Registro e Login",
    icon: <Key className="h-5 w-5" />,
    content: [
      {
        title: "Criando sua Conta",
        text: `Para se registrar no Tele<M3D>, clique em "Registrar" na página inicial. Existem três perfis:

- **Paciente**: Solicitar consultas, acessar prontuários, usar a carteira digital
- **Médico**: Acesso completo a gestão clínica, teleconsultas, prescrições e suporte médico
- **Administrador**: Gerenciamento do sistema, configurações, relatórios e gestão financeira

Preencha o formulário com seus dados pessoais e profissionais. Após o registro, faça login com e-mail e senha.`
      },
      {
        title: "Login",
        text: `Na página de login, insira seu e-mail e senha cadastrados. O sistema identificará automaticamente seu perfil e direcionará para o dashboard correspondente.

Dica: Use a paleta de comandos (Ctrl+K / Cmd+K) para navegar rapidamente entre as funcionalidades.`
      }
    ]
  },
  {
    id: "v-temporary-access",
    title: "Links Temporários de Acesso",
    icon: <Share2 className="h-5 w-5" />,
    content: [
      {
        title: "Acesso Temporário a Consultas",
        text: `Visitantes podem acessar consultas específicas através de links temporários gerados por médicos:

- O médico gera um **link de acesso** ou **código curto** para a consulta
- O visitante acessa o link e entra diretamente na sala de espera
- O acesso é limitado à consulta específica e expira conforme configuração do sistema
- Não é necessário criar uma conta para este tipo de acesso

Os links temporários são seguros e possuem tempo de expiração configurável pelo administrador do sistema.`
      }
    ]
  },
  {
    id: "v-waiting-room",
    title: "Sala de Espera",
    icon: <Clock className="h-5 w-5" />,
    content: [
      {
        title: "Acessando a Sala de Espera",
        text: `Ao receber um link temporário de acesso, você será direcionado à sala de espera virtual:

- Aguarde o médico iniciar a consulta
- Você receberá uma notificação quando o médico estiver pronto
- A interface mostra informações básicas sobre a consulta agendada
- O acesso ao vídeo é liberado automaticamente quando a consulta começa`
      }
    ]
  },
  {
    id: "v-idiomas",
    title: "Suporte Multilíngue",
    icon: <Globe className="h-5 w-5" />,
    content: [
      {
        title: "Escolhendo o Idioma",
        text: `O Tele<M3D> Pro suporta 8 idiomas. Para alterar o idioma:

1. **Clique no seletor de idioma** no canto superior direito do cabeçalho (ícone de bandeira ou código do idioma)
2. **Selecione o idioma desejado** na lista suspensa
3. A mudança é aplicada **instantaneamente** em toda a interface

**Idiomas disponíveis:**
- 🇧🇷 Português (BR) — idioma padrão
- 🇪🇸 Español (ES)
- 🇺🇸 English (EN)
- 🇫🇷 Français (FR)
- 🇩🇪 Deutsch (DE)
- 🇮🇹 Italiano (IT)
- 🇨🇳 中文 (ZH)
- 🇵🇾 Guaraní (GN)

O chatbot e o assistente de voz também respondem no idioma selecionado. O reconhecimento de voz (STT) e a síntese de fala (TTS) são ajustados automaticamente para o locale correspondente.`
      }
    ]
  }
];

const patientSections: Section[] = [
  {
    id: "p-dashboard",
    title: "Dashboard do Paciente",
    icon: <MonitorSmartphone className="h-5 w-5" />,
    content: [
      {
        title: "Visão Geral do Painel",
        text: `O dashboard do paciente é sua central de informações e acesso rápido:

- **Status das Consultas**: Veja consultas pendentes, aceitas e em andamento
- **Próximas Consultas**: Lista de consultas agendadas com contagem regressiva
- **Assistente Virtual**: Acesso rápido ao chatbot médico e ao assistente de voz
- **Notificações**: Alertas em tempo real sobre consultas, mensagens e atualizações
- **Ações Rápidas**: Botões para solicitar consulta, acessar prontuário e ver prescrições

O painel se adapta automaticamente para desktop e mobile, oferecendo a melhor experiência em qualquer dispositivo.`
      }
    ]
  },
  {
    id: "p-consultation-request",
    title: "Solicitar Consulta",
    icon: <Stethoscope className="h-5 w-5" />,
    content: [
      {
        title: "Dois Caminhos para Solicitar Consulta",
        text: `Existem duas formas de solicitar uma consulta:

**1. Por Especialidade**
- Selecione a especialidade médica desejada (cardiologia, dermatologia, etc.)
- Descreva seus sintomas e motivo da consulta
- O sistema mostrará médicos disponíveis naquela especialidade
- Escolha um médico e envie sua solicitação

**2. Por Triagem Automatizada**
- Descreva seus sintomas em linguagem natural
- O sistema realizará uma triagem automática pelo **Protocolo de Manchester** (5 níveis)
- Com base na análise, será recomendada a especialidade mais adequada
- O sistema classificará a urgência: 🔴 Emergência, 🟠 Muito Urgente, 🟡 Urgente, 🟢 Padrão, 🔵 Não Urgente
- Médicos disponíveis serão sugeridos com base na triagem

Após o envio, aguarde a aceitação do médico. Você receberá uma notificação quando a consulta for aceita.`
      }
    ]
  },
  {
    id: "p-waiting-room",
    title: "Sala de Espera",
    icon: <Clock className="h-5 w-5" />,
    content: [
      {
        title: "Aguardando Atendimento",
        text: `A Sala de Espera permite ver médicos online disponíveis:

- **Médicos Disponíveis**: Lista de médicos online com suas especialidades
- **Status em Tempo Real**: Indicadores de disponibilidade atualizados via WebSocket
- **Consulta Imediata**: Quando um médico inicia uma consulta instantânea com você, uma notificação aparecerá com o botão para entrar na sala de vídeo
- **Posição na Fila**: Quando aplicável, veja sua posição estimada na fila de atendimento`
      }
    ]
  },
  {
    id: "p-video-consultation",
    title: "Videoconsulta",
    icon: <Video className="h-5 w-5" />,
    content: [
      {
        title: "Participando da Consulta por Vídeo",
        text: `Durante uma teleconsulta, você tem acesso a:

- **Vídeo e Áudio**: Controles para ligar/desligar câmera e microfone
- **Chat em Tempo Real**: Troque mensagens de texto com o médico durante a consulta
- **Compartilhamento de Tela**: O médico pode compartilhar sua tela para mostrar exames ou explicações visuais
- **Transcrição Automática**: Em navegadores compatíveis (Chrome/Edge), a conversa é transcrita automaticamente
- **Notificações**: Receba alertas sobre ações do médico (convite de especialista, encerramento)

Ao final da consulta, você poderá avaliar o atendimento e receber um resumo com prescrições e orientações.`
      }
    ]
  },
  {
    id: "p-prescriptions",
    title: "Prescrições",
    icon: <ClipboardList className="h-5 w-5" />,
    content: [
      {
        title: "Visualizando suas Prescrições",
        text: `O item "Prescrições" aparece no menu quando você possui prescrições ativas (dentro da validade):

- **Lista de Prescrições**: Visualize todas as prescrições emitidas por seus médicos
- **Detalhes**: Veja medicamentos, dosagens, instruções e período de validade
- **Download PDF**: Faça download do PDF da prescrição com assinatura digital do médico
- **Histórico**: Acesse prescrições anteriores mesmo após a validade

As prescrições são geradas pelo médico, podendo ser criadas manualmente ou auto-geradas após a consulta.`
      }
    ]
  },
  {
    id: "p-medical-records",
    title: "Prontuário Médico",
    icon: <FileText className="h-5 w-5" />,
    content: [
      {
        title: "Acessando seu Prontuário",
        text: `Em "Meu Prontuário" (disponível quando há registros), você pode:

- **Visualizar Histórico**: Registros clínicos completos em formato SOAP
- **Exames e Resultados**: Veja resultados de exames laboratoriais e de imagem
- **Notas Médicas**: Acompanhe as anotações dos seus médicos
- **Evolução Clínica**: Acompanhe a evolução do seu tratamento ao longo do tempo

O prontuário é somente leitura para pacientes — apenas médicos podem adicionar ou modificar registros.`
      }
    ]
  },
  {
    id: "p-data-export",
    title: "Exportação de Dados (LGPD)",
    icon: <Download className="h-5 w-5" />,
    content: [
      {
        title: "Seu Direito de Acesso aos Dados",
        text: `Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito à portabilidade dos seus dados médicos. O sistema suporta exportação no padrão **HL7 FHIR R4**:

- **Brasil/SUS**: Formato compatível com RNDS, RAC, SBIS e LGPD
- **EUA**: Formato compatível com HIPAA e USCDI v3
- **Europa**: Formato compatível com GDPR
- **Internacional**: Compatível com ICD-11 e SNOMED CT

Opções de exportação:
- Exportação completa de todos os dados
- Exportação com **desidentificação** (dados anonimizados para pesquisa)
- Seleção de período e tipo de dados

Acesse a exportação pelo menu do seu perfil ou na página de prontuários.`
      }
    ]
  },
  {
    id: "p-wallet",
    title: "Carteira Digital e Créditos",
    icon: <Wallet className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando seus Créditos TM3D",
        text: `O sistema utiliza créditos TM3D (Tele-Medicina Credits) para funcionalidades:

- **Saldo**: Visualize seu saldo atual de TM3D
- **Comprar Créditos**: Adquira pacotes via PayPal, Stripe (cartão/Apple Pay) ou PagBank (PIX/Boleto)
- **Transferências**: Envie créditos para outros usuários
- **Histórico**: Veja todas as transações com detalhes (data, tipo, valor, saldo)

Custos das principais funcionalidades:
- Teleconsulta por Vídeo: 50 TM3D
- Mensagem WhatsApp: 10 TM3D
- Análise de Exame: 15 TM3D
- Relatório Epidemiológico: 20 TM3D

Acesse "Carteira" no menu para gerenciar seus créditos e visualizar o histórico de transações.`
      }
    ]
  },
  {
    id: "p-rating",
    title: "Avaliação de Consultas",
    icon: <Star className="h-5 w-5" />,
    content: [
      {
        title: "Avaliando uma Consulta",
        text: `Após a conclusão de uma consulta, você pode avaliá-la:

- **Estrelas (1-5)**: Atribua uma nota de 1 a 5 estrelas para o atendimento recebido
- **Feedback Opcional**: Escreva um comentário sobre sua experiência
- **Onde Encontrar**: Acesse a aba "Histórico" nas suas consultas para avaliar consultas concluídas
- **Não Obrigatória**: A avaliação é opcional, mas encorajada para melhorar a qualidade do atendimento

A avaliação ajuda a plataforma a manter a qualidade dos atendimentos e a identificar áreas de melhoria.`
      }
    ]
  },
  {
    id: "p-immediate",
    title: "Consultar Agora",
    icon: <Stethoscope className="h-5 w-5" />,
    content: [
      {
        title: "Consulta Imediata",
        text: `O botão "Consultar Agora" (disponível no desktop) permite iniciar uma consulta rapidamente:

- **Auto-busca**: O sistema encontra automaticamente o primeiro médico disponível
- **Contagem de Médicos**: Veja quantos médicos estão online no momento
- **Sala de Espera**: Se nenhum médico estiver disponível, você é direcionado à sala de espera
- **Sem Agendamento**: Não é necessário agendar — basta clicar e aguardar o atendimento

Ideal para consultas urgentes ou quando você precisa de atendimento rápido.`
      }
    ]
  },
  {
    id: "p-iam3d",
    title: "Assistente de Voz",
    icon: <Mic className="h-5 w-5" />,
    content: [
      {
        title: "Usando o Assistente de Voz como Paciente",
        text: `O assistente de voz oferece funcionalidades específicas para pacientes:

- **Consultas Rápidas**: Pergunte sobre medicamentos, efeitos colaterais e orientações gerais
- **Consulta Urgente**: Diga "urgência" ou "preciso de consulta urgente" para ser conectado a um médico de plantão disponível
- **Navegação por Voz**: Peça para navegar a uma página específica ("ir para prescrições", "abrir prontuário")
- **Emergência (192)**: Diga "emergência" para receber orientações do SAMU

O assistente exibe um badge de segurança com seu nível de acesso (paciente) para garantir transparência.`
      }
    ]
  },
  {
    id: "p-profile",
    title: "Perfil e Configurações",
    icon: <UserCog className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando seu Perfil",
        text: `Em "Perfil", você pode:

- **Dados Pessoais**: Editar nome, telefone e informações de contato
- **Foto de Perfil**: Fazer upload de uma foto de perfil
- **Informações Médicas**: Atualizar alergias, medicamentos em uso e condições pré-existentes
- **Preferências**: Configurar idioma e notificações

Mantenha seus dados atualizados para garantir um atendimento mais preciso.`
      }
    ]
  },
  {
    id: "p-inactivity",
    title: "Detecção de Inatividade",
    icon: <LogOut className="h-5 w-5" />,
    content: [
      {
        title: "Auto-Logout por Inatividade",
        text: `Para sua segurança, o sistema detecta inatividade e realiza logout automático:

- Após um período de inatividade (configurável pelo administrador), um aviso aparecerá na tela
- Você terá tempo para confirmar que ainda está presente clicando em "Continuar"
- Se não houver resposta, o sistema realizará logout automático
- Durante videoconsultas ativas, a conexão Agora é desconectada de forma segura
- Seus dados e sessão são protegidos contra acesso não autorizado

O timeout padrão é configurado pelo administrador do sistema.`
      }
    ]
  },
  {
    id: "p-notifications",
    title: "Notificações",
    icon: <Bell className="h-5 w-5" />,
    content: [
      {
        title: "Central de Notificações",
        text: `O ícone de sino no canto superior direito exibe suas notificações em tempo real:

- **Consultas**: Notificações de aceitação, início e encerramento de consultas
- **Mensagens**: Alertas de novas mensagens do WhatsApp
- **Prescrições**: Aviso quando uma nova prescrição é emitida
- **Sistema**: Avisos de manutenção, atualizações e lembretes

As notificações são atualizadas em tempo real via WebSocket. Clique em uma notificação para navegar diretamente à funcionalidade correspondente.`
      }
    ]
  }
];

const doctorSections: Section[] = [
  {
    id: "d-dashboard",
    title: "Dashboard do Médico",
    icon: <MonitorSmartphone className="h-5 w-5" />,
    content: [
      {
        title: "Painel Principal",
        text: `O dashboard do médico apresenta informações consolidadas:

- **Estatísticas do Dia**: Consultas realizadas, pacientes atendidos, prontuários atualizados
- **Agenda do Dia**: Próximas consultas com contagem regressiva e botão para iniciar
- **Pacientes Online**: Lista de pacientes conectados disponíveis para consulta imediata
- **Status em Tempo Real**: Indicadores de WebSocket e disponibilidade
- **Ações Rápidas**: Iniciar consulta, abrir agenda, ver prontuários, acessar WhatsApp

O painel é responsivo e se adapta para desktop (layout completo) e mobile (layout compacto com cards empilhados).`
      }
    ]
  },
  {
    id: "d-availability",
    title: "Disponibilidade e Plantão",
    icon: <Clock className="h-5 w-5" />,
    content: [
      {
        title: "Configurar Disponibilidade",
        text: `Em "Disponibilidade", configure como os pacientes podem encontrá-lo:

- **Status Online**: Ative para aparecer como disponível na plataforma
- **Consulta Imediata**: Permita que pacientes da sala de espera solicitem consulta instantânea
- **Modo Plantão 24h**: Ative para ficar disponível continuamente para consultas urgentes — o sistema pode direcionar pacientes diretamente para médicos de plantão
- **Horários Semanais**: Configure dias da semana, horários de início/fim e duração padrão das consultas`
      }
    ]
  },
  {
    id: "d-schedule",
    title: "Agenda (3 Abas)",
    icon: <Calendar className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando sua Agenda",
        text: `A agenda possui três abas principais:

**1. Hoje**
- Consultas agendadas para o dia atual
- Status visual: Agendado, Em andamento, Concluído
- Consultas nos próximos 30 minutos são destacadas com animação
- Botão "Iniciar" para abrir a sala de vídeo

**2. Futuras**
- Consultas agendadas para os próximos dias
- Calendário para navegação rápida entre datas
- Possibilidade de cancelamento individual ou em lote (bulk cancellation)

**3. Histórico**
- Consultas concluídas, canceladas e teleconsultas realizadas
- Detalhes do paciente, duração, notas clínicas e classificação diagnóstica
- Filtros por período e status`
      },
      {
        title: "Limpar Agenda (Clear Schedule)",
        text: `Na aba de consultas futuras, você pode:

- **Cancelamento em Lote**: Selecione múltiplas consultas e cancele de uma vez
- **Limpar Agenda Completa**: Remova todas as consultas futuras (com confirmação)
- **Justificativa**: Ao cancelar, informe o motivo para o registro e notificação dos pacientes
- Os pacientes são notificados automaticamente sobre cancelamentos`
      }
    ]
  },
  {
    id: "d-video-consultation",
    title: "Teleconsultas por Vídeo",
    icon: <Video className="h-5 w-5" />,
    content: [
      {
        title: "Iniciando uma Teleconsulta",
        text: `Existem três formas de iniciar uma videoconsulta:

1. **Pela Agenda**: Encontre o agendamento e clique em "Iniciar"
2. **Consulta Instantânea**: Selecione um paciente online e inicie uma chamada imediata
3. **Pelo Consultório Virtual**: Abra sua sala e gere um link de acesso`
      },
      {
        title: "Ferramentas Durante a Consulta",
        text: `Durante a consulta, você tem acesso a:

- **Chat em Tempo Real**: Troque mensagens com o paciente
- **Suporte Diagnóstico**: Envie perguntas clínicas e receba respostas baseadas em evidências (OMS, MS-Brasil, DSM-5)
- **Transcrição Automática**: Transcrição de áudio em tempo real (Chrome/Edge)
- **Compartilhamento de Tela**: Mostre exames, prontuários ou explicações visuais
- **Notas Clínicas**: Faça anotações salvas automaticamente
- **Convite de Especialista**: Convide outro médico para participar da consulta em tempo real`
      },
      {
        title: "QR Code e Códigos de Acesso",
        text: `Para facilitar o acesso do paciente à consulta:

- **QR Code**: Gere um QR code que o paciente pode escanear com o celular para entrar na sala
- **Código Curto**: Gere um código alfanumérico curto que o paciente pode digitar para acessar
- **Link Temporário**: Copie e envie um link direto de acesso à sala de vídeo

Esses códigos têm validade configurável e são descartados após o uso.`
      }
    ]
  },
  {
    id: "d-post-consultation",
    title: "Fluxo Pós-Consulta",
    icon: <CheckCircle className="h-5 w-5" />,
    content: [
      {
        title: "Auto-Geração Pós-Consulta",
        text: `Ao finalizar uma consulta, o sistema automaticamente gera:

- **Prescrições**: Medicamentos com dosagens, baseados no diálogo da consulta
- **Pedidos de Exames**: Exames laboratoriais e de imagem sugeridos
- **Encaminhamentos**: Referências a especialistas quando necessário
- **Follow-up**: Sugestões de acompanhamento e retorno
- **Análise de Interações Medicamentosas**: Verificação automática de interações entre medicamentos prescritos e medicamentos em uso pelo paciente

Todos os itens são sugestões automatizadas — você pode revisar, editar, aprovar ou rejeitar cada um antes da finalização.`
      },
      {
        title: "Classificação Diagnóstica",
        text: `O sistema de classificação pós-consulta permite:

- **CID-10/CID-11**: Código de classificação internacional de doenças
- **DSM-5/DSM-5-TR**: Classificação para condições de saúde mental
- **Nível de Confiança**: Indicador de confiança na classificação (alto, médio, baixo)
- **Diagnósticos Diferenciais**: Lista de diagnósticos alternativos considerados

O sistema sugere a classificação automaticamente com base na transcrição e notas da consulta. O médico revisa e confirma antes do registro final.`
      }
    ]
  },
  {
    id: "d-medical-records",
    title: "Prontuários Eletrônicos",
    icon: <FileText className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando Prontuários",
        text: `Em "Prontuários", o médico pode:

- **Visualizar Histórico Completo**: Todos os registros clínicos do paciente em formato SOAP
- **Criar Novos Registros**: Adicione registros com subjective, objective, assessment e plan
- **Anexar Exames**: Vincule resultados de exames ao prontuário
- **Gerar Relatórios PDF**: Exporte prontuários completos em PDF
- **Consultar Assistente**: Solicite análise do histórico com sugestões de diagnósticos ou tratamentos

Os prontuários são acessíveis durante teleconsultas, permitindo consulta em tempo real durante o atendimento.`
      }
    ]
  },
  {
    id: "d-prescriptions",
    title: "Prescrições e Interações",
    icon: <ClipboardList className="h-5 w-5" />,
    content: [
      {
        title: "Criando Prescrições",
        text: `O módulo de prescrições oferece:

- **Criação Manual**: Adicione medicamentos com dosagem, via, frequência e duração
- **Busca em Bases Externas**: Pesquise medicamentos em RxNorm (NIH), OpenFDA e ANVISA/RENAME com seletor de localidade (Brasil, EUA, Global)
- **Auto-Geração**: Prescrições sugeridas automaticamente após consultas
- **Templates**: Use modelos pré-definidos para prescrições comuns
- **PDF com Assinatura Digital**: Gere PDF da prescrição com sua assinatura digital
- **Compartilhamento**: Envie a prescrição diretamente ao paciente`
      },
      {
        title: "Análise de Interações Medicamentosas",
        text: `Ao criar uma prescrição, o sistema verifica automaticamente:

- **Interações entre medicamentos prescritos**: Alertas de interações graves, moderadas e leves
- **Interações com medicamentos em uso**: Cruzamento com a lista de medicamentos atuais do paciente
- **Classificação de severidade**: Cada interação é classificada por gravidade
- **Recomendações**: Sugestões de substituição quando há interações graves

Estas verificações são realizadas em tempo real durante a criação da prescrição.`
      }
    ]
  },
  {
    id: "d-doctor-notes",
    title: "Notas do Médico",
    icon: <FileText className="h-5 w-5" />,
    content: [
      {
        title: "Organizando suas Notas",
        text: `O módulo de Notas do Médico tem estilo inspirado no macOS Notes:

- **Pastas**: Organize suas notas em pastas personalizadas
- **Notas Fixadas (Pin)**: Fixe notas importantes no topo da lista
- **Cores**: Atribua cores diferentes para categorização visual
- **Busca**: Pesquise rapidamente em todas as notas
- **Editor Rico**: Formate suas notas com negrito, itálico, listas e mais

As notas são privadas e acessíveis apenas pelo médico que as criou. Ideais para rascunhos, lembretes clínicos e anotações pessoais.`
      }
    ]
  },
  {
    id: "d-whatsapp",
    title: "WhatsApp",
    icon: <MessageCircle className="h-5 w-5" />,
    content: [
      {
        title: "Central de Mensagens",
        text: `O módulo WhatsApp permite comunicação inteligente médico-paciente:

- **Lista de Pacientes**: Todos os pacientes com status online/offline em tempo real
- **Chat**: Interface com histórico completo de mensagens
- **Painel Clínico**: Informações do paciente (histórico, prescrições, exames) no painel lateral
- **Toggle de Resposta**: Controle se o paciente pode responder (habilitado/desabilitado)
- **Análise Automática**: Mensagens recebidas são analisadas para detectar solicitações de agendamento e questões clínicas

Cores das mensagens: Doutor(a) em azul, Paciente em cinza, Sistema com indicador especial.`
      }
    ]
  },
  {
    id: "d-inter-consultation",
    title: "Inter-Consultas",
    icon: <Users className="h-5 w-5" />,
    content: [
      {
        title: "Solicitando Parecer de Especialistas",
        text: `O módulo de Inter-Consultas permite:

- **Solicitar Parecer**: Envie uma solicitação de parecer a outro médico especialista
- **Urgência**: Indique o nível de urgência do parecer solicitado
- **Documentação**: Anexe resumo do caso, exames relevantes e perguntas específicas
- **Acompanhamento**: Acompanhe o status da solicitação (pendente, aceita, respondida)
- **Inter-Consulta**: Durante uma videoconsulta, solicite um especialista para participar em tempo real

As inter-consultas são registradas no prontuário do paciente para documentação completa.`
      }
    ]
  },
  {
    id: "d-medical-teams",
    title: "Equipes Médicas",
    icon: <Briefcase className="h-5 w-5" />,
    content: [
      {
        title: "Gestão de Equipes",
        text: `Em "Equipes Médicas":

- **Criar Equipes**: Organize médicos em equipes por especialidade ou setor
- **Sala da Equipe**: Cada equipe tem 3 abas: Discussão, Inter-Consulta e Arquivos
- **Discussão**: Compartilhe casos clínicos, perguntas e resumos com a equipe
- **Inter-Consulta em Grupo**: Solicite pareceres de múltiplos especialistas simultaneamente
- **Notas Compartilhadas**: Crie e compartilhe notas clínicas com os membros da equipe`
      }
    ]
  },
  {
    id: "d-epidemiology",
    title: "Relatórios Epidemiológicos",
    icon: <Activity className="h-5 w-5" />,
    content: [
      {
        title: "Análise Epidemiológica",
        text: `Em "Epidemiologia", o sistema analisa dados clínicos agregados:

- **Visão Geral**: Resumo com análise dos dados do período
- **Sintomas/MeSH**: Frequência de sintomas com códigos MeSH extraídos automaticamente
- **Diagnósticos**: Tendências diagnósticas com códigos ICD
- **Classificação de Risco**: Distribuição por nível de triagem (Manchester)

Filtre por período (7, 30, 90 ou 365 dias) e gere análises detalhadas para vigilância epidemiológica.`
      }
    ]
  },
  {
    id: "d-reports",
    title: "Dashboard de Relatórios",
    icon: <BarChart3 className="h-5 w-5" />,
    content: [
      {
        title: "Relatórios e Métricas",
        text: `O dashboard de relatórios oferece visão consolidada:

- **Consultas**: Total de consultas realizadas, canceladas e pendentes por período
- **Pacientes**: Crescimento da base de pacientes, distribuição por faixa etária e região
- **Financeiro**: Receita de consultas, créditos consumidos e movimentações
- **Performance Médica**: Tempo médio de consulta, taxa de satisfação, consultas por período

Exporte relatórios em diferentes formatos para análise externa.`
      }
    ]
  },
  {
    id: "d-wallet",
    title: "Carteira, NFTs e Broker",
    icon: <Wallet className="h-5 w-5" />,
    content: [
      {
        title: "Carteira Digital TM3D",
        text: `Gerencie seus créditos TM3D:

- **Saldo e Histórico**: Veja saldo atual e histórico completo de transações
- **Comprar Créditos**: Pacotes via PayPal, Stripe (cartão/Apple Pay) ou PagBank (PIX/Boleto)
- **Transferências**: Envie créditos para outros usuários
- **Vincular Carteira Externa**: Conecte MetaMask ou WalletConnect
- **Solicitações de Saque**: Solicite conversão de TM3D para moeda fiduciária`
      },
      {
        title: "NFTs Médicos e Broker",
        text: `O sistema de NFTs permite:

- **NFTs Dinâmicos**: Tokenização de dados clínicos anonimizados (LGPD-compliant)
- **Gestão de NFTs**: Crie, visualize e transfira NFTs médicos
- **Broker Interno**: Negocie ações TM3D/NFT no livro de ordens interno
- **Histórico de Negociações**: Acompanhe compras e vendas realizadas
- **Carteira Externa**: Vincule carteiras blockchain para operações externas`
      }
    ]
  },
  {
    id: "d-patient-export",
    title: "Exportação de Dados (FHIR)",
    icon: <Download className="h-5 w-5" />,
    content: [
      {
        title: "Exportação HL7 FHIR R4",
        text: `O sistema suporta exportação de dados de pacientes no padrão HL7 FHIR R4:

- **Brasil/SUS**: RNDS, RAC, SBIS, LGPD
- **EUA**: HIPAA, USCDI v3
- **Europa**: GDPR
- **Internacional**: ICD-11, SNOMED CT

Opções:
- Exportação completa ou por período
- Desidentificação (anonimização HIPAA-compliant)
- Seleção de tipos de dados (prontuários, prescrições, exames, consultas)

Acesse a exportação pela página do paciente ou pelo menu de prontuários.`
      }
    ]
  },
  {
    id: "d-iam3d",
    title: "Assistente de Voz para Médicos",
    icon: <Mic className="h-5 w-5" />,
    content: [
      {
        title: "Assistente de Voz",
        text: `O assistente de voz oferece funcionalidades avançadas para médicos:

- **Consultas Clínicas por Voz**: Pergunte sobre protocolos, medicamentos e diagnósticos
- **Inter-Consulta por Voz**: Durante uma videoconsulta, solicite um especialista por voz
- **Chamadas Urgentes**: O sistema pode direcionar pacientes em situação urgente para médicos de plantão
- **Navegação por Voz**: Acesse qualquer funcionalidade da plataforma por comando de voz
- **Badge de Segurança**: Indicador visual do nível de acesso (médico) para transparência

O assistente é especialmente útil durante consultas, permitindo consultas sem sair da interface de vídeo.`
      }
    ]
  },
  {
    id: "d-pharmacy",
    title: "Farmácia",
    icon: <Pill className="h-5 w-5" />,
    content: [
      {
        title: "Integração com Farmácia",
        text: `O módulo de Farmácia permite integração entre médicos e farmacêuticos:

- **Prescrições Visíveis**: Suas prescrições ficam automaticamente disponíveis para farmacêuticos verificarem
- **Assinatura Digital**: Cada prescrição possui assinatura digital verificável pelo farmacêutico
- **Status de Dispensação**: Acompanhe em tempo real se os medicamentos foram dispensados
- **Rastreabilidade**: Veja lote, fabricante e validade dos medicamentos dispensados ao paciente`
      }
    ]
  },
  {
    id: "d-pmd",
    title: "PMD v1.0 (Prontuário Médico Digital)",
    icon: <FileText className="h-5 w-5" />,
    content: [
      {
        title: "Prontuário Médico Digital",
        text: `O PMD v1.0 é o Prontuário Médico Digital em conformidade com CFM, LGPD e RGPD:

- **Criar Registros**: Adicione registros clínicos estruturados com campos padronizados
- **Editar Registros**: Modifique registros existentes com log de auditoria automático
- **Audit Logs**: Todas as alterações são registradas com timestamp, usuário e detalhes da modificação
- **Exportação Multi-Locale**: Exporte em formatos para Brasil (BR), Espanha (ES) e EUA (USA)
- **Formatos de Exportação**: JSON, PDF, XML e CSV disponíveis para cada registro`
      }
    ]
  },
  {
    id: "d-unified-record",
    title: "Prontuário Unificado",
    icon: <Layers className="h-5 w-5" />,
    content: [
      {
        title: "Visão Consolidada do Paciente",
        text: `O Prontuário Unificado oferece uma visão timeline completa do paciente:

- **Timeline Unificada**: Todos os registros médicos, consultas, prescrições e exames em uma única linha do tempo
- **Agrupamento por Dia**: Eventos são agrupados por data para fácil navegação
- **Cards Coloridos**: Cada tipo de evento possui uma cor distinta para identificação visual rápida
- **Visão Completa**: Substitui a necessidade de navegar entre múltiplas telas para ver o histórico do paciente`
      }
    ]
  },
  {
    id: "d-block-patients",
    title: "Bloqueio de Pacientes",
    icon: <Ban className="h-5 w-5" />,
    content: [
      {
        title: "Bloquear/Desbloquear Pacientes",
        text: `O módulo de bloqueio permite controlar quais pacientes podem solicitar consultas:

- **Bloquear Paciente**: Impeça que um paciente específico solicite novas consultas com você
- **Desbloquear**: Remova o bloqueio a qualquer momento para permitir novas solicitações
- **Motivo**: Registre um motivo para o bloqueio (opcional)
- **Transparência**: O paciente é notificado sobre o bloqueio e pode procurar outros médicos

Acesse a opção de bloqueio pela página do paciente ou pela lista de pacientes.`
      }
    ]
  },
  {
    id: "d-ai-medications",
    title: "Geração de Medicamentos",
    icon: <Sparkles className="h-5 w-5" />,
    content: [
      {
        title: "Planos de Tratamento",
        text: `O sistema pode gerar listas completas de medicamentos para tratamento:

- **Baseado em Diagnóstico**: Informe o diagnóstico e o sistema sugere medicamentos apropriados
- **Sintomas e Histórico**: O sistema considera sintomas relatados e histórico do paciente
- **Plano Completo**: Inclui medicamento, dosagem, via de administração, frequência e duração
- **Interações**: Verificação automática de interações com medicamentos em uso pelo paciente
- **Revisão Médica**: Todas as sugestões são revisáveis — edite, aprove ou rejeite cada item

Disponível durante a criação de prescrições e no fluxo pós-consulta.`
      }
    ]
  },
  {
    id: "d-incomplete",
    title: "Consultas Incompletas",
    icon: <AlertTriangle className="h-5 w-5" />,
    content: [
      {
        title: "Dashboard de Consultas Incompletas",
        text: `O módulo de Consultas Incompletas exibe:

- **Consultas sem Encerramento**: Consultas que foram iniciadas mas não concluídas corretamente
- **Pós-Consulta Pendente**: Consultas concluídas mas sem revisão pós-consulta (prescrições, diagnósticos)
- **Ações Pendentes**: Lista de ações que precisam ser completadas para cada consulta
- **Priorização**: Ordenação por urgência e tempo decorrido

Complete as consultas pendentes para manter o registro clínico atualizado e completo.`
      }
    ]
  },
  {
    id: "d-interactive-dashboard",
    title: "Dashboard Interativo",
    icon: <Layers className="h-5 w-5" />,
    content: [
      {
        title: "Painéis Arrastáveis",
        text: `Todos os painéis do dashboard podem ser reorganizados livremente:

- **Arrastar e Soltar**: Clique na barra de título (ícone de grip) e arraste para reposicionar
- **Controles de Janela**: Cada painel possui botões de minimizar e fechar
- **Persistência**: Posições salvas automaticamente entre sessões
- **Reset Layout**: Botão para restaurar o layout padrão original
- **Mobile**: Em dispositivos móveis, painéis usam layout em coluna (sem drag)`
      },
      {
        title: "Dock de Painéis Minimizados",
        text: `Painéis minimizados ficam acessíveis no dock lateral:

- **Minimizar**: Clique no ícone de traço (—) para enviar ao dock
- **Restaurar**: Clique no ícone do painel no dock para restaurá-lo
- **Posição**: O dock pode ser movido entre lado esquerdo e direito da tela
- **Auto-ocultar**: O dock desaparece automaticamente quando não há painéis minimizados`
      },
      {
        title: "Toolbox Unificado",
        text: `A barra de ferramentas flutuante agrupa todos os atalhos de navegação:

- **Navegação Contextual**: Atalhos filtrados pelo seu papel (médico, admin, paciente)
- **Categorias**: Principal, Clínico, Consultas, Ferramentas, Administração
- **Acoplamento Magnético**: O toolbox se acopla automaticamente às bordas da tela
- **Modo Compacto**: Recolha para exibir apenas ícones
- **Minimizar**: Use o botão (—) para enviar ao dock lateral`
      },
      {
        title: "Widgets Flutuantes",
        text: `Chatbot e Notas de Estudo possuem controle de minimização:

- **Chatbot**: Minimize com o botão (—) → restaure pelo dock lateral
- **Notas de Estudo**: Minimize com o botão (—) → restaure pelo dock lateral
- **Ícones no Dock**: Cada widget tem seu próprio ícone identificável no dock`
      }
    ]
  }
];

const adminSections: Section[] = [
  {
    id: "a-dashboard",
    title: "Dashboard Administrativo",
    icon: <MonitorSmartphone className="h-5 w-5" />,
    content: [
      {
        title: "Painel Administrativo",
        text: `O dashboard administrativo possui tema escuro e apresenta:

- **Métricas do Sistema**: Usuários ativos, consultas realizadas, receita gerada
- **Status dos Serviços**: Indicadores de saúde do banco de dados, WebSocket e serviços
- **Atividade Recente**: Log de ações recentes no sistema
- **Alertas**: Notificações de erros, problemas de performance e eventos críticos
- **Acesso Rápido**: Links para configurações, gestão de usuários e relatórios`
      }
    ]
  },
  {
    id: "a-user-management",
    title: "Gestão de Usuários",
    icon: <Users className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando Usuários",
        text: `O módulo de gestão de usuários permite:

- **Lista de Usuários**: Visualize todos os usuários com filtro por role (médico, paciente, admin)
- **Detalhes do Usuário**: Veja informações completas, histórico de login e atividade
- **Editar Perfil**: Modifique dados de qualquer usuário (nome, especialidade, status)
- **Ativar/Desativar**: Controle o acesso de usuários ao sistema
- **Créditos**: Visualize e gerencie o saldo de créditos de cada usuário
- **Enviar Créditos**: Envie créditos TM3D diretamente para um usuário específico`
      }
    ]
  },
  {
    id: "a-system-settings",
    title: "Configurações do Sistema",
    icon: <Settings className="h-5 w-5" />,
    content: [
      {
        title: "Parâmetros Configuráveis",
        text: `Em "Configurações", ajuste todos os parâmetros do sistema:

- **Expiração de Links**: Tempo de validade dos links de consulta temporários
- **Expiração de Tokens**: Tempo de validade dos tokens de acesso
- **Triagem Automatizada**: Ative/desative a triagem automática pelo Protocolo de Manchester
- **Timeout de Inatividade**: Configure o tempo de inatividade antes do auto-logout (em minutos)
- **E-mail PayPal**: Configure o e-mail de destino para pagamentos PayPal
- **Configurações Financeiras**: Taxa de câmbio TM3D/USD, limites de transação

Cada alteração é salva imediatamente e afeta todos os usuários do sistema.`
      }
    ]
  },
  {
    id: "a-financial",
    title: "Gestão Financeira",
    icon: <CreditCard className="h-5 w-5" />,
    content: [
      {
        title: "Pacotes de Créditos",
        text: `Gerencie os pacotes de créditos TM3D:

- **CRUD de Pacotes**: Crie, edite e remova pacotes de créditos (6 pacotes padrão)
- **Preços e Quantidades**: Defina o preço em USD e quantidade de TM3D de cada pacote
- **Pacotes Destacados**: Marque pacotes como "destaque" para promoção
- **Descrições**: Adicione descrições e benefícios para cada pacote`
      },
      {
        title: "Custos de Funcionalidades",
        text: `Configure o custo em TM3D de cada funcionalidade (15 funcionalidades):

- Teleconsulta por vídeo, mensagem WhatsApp, análise de exames, relatórios, etc.
- Ajuste os preços conforme a estratégia de monetização
- As alterações são aplicadas imediatamente a todas as novas transações`
      },
      {
        title: "Taxa de Câmbio e Envio de Créditos",
        text: `- **Taxa TM3D/USD**: Configure a taxa de conversão entre TM3D e dólares americanos
- **Enviar Créditos**: Envie créditos gratuitamente a qualquer usuário (promoções, bônus, suporte)
- **Solicitações de Saque**: Aprove ou rejeite solicitações de conversão de TM3D para moeda fiduciária`
      }
    ]
  },
  {
    id: "a-audit-log",
    title: "Log de Auditoria",
    icon: <Database className="h-5 w-5" />,
    content: [
      {
        title: "Auditoria da Carteira",
        text: `O log de auditoria registra todas as ações financeiras:

- **Filtro por Ação**: Filtre por tipo de ação (compra, transferência, saque, envio)
- **Detalhes**: Usuário, timestamp, valor, tipo de transação e metadata
- **Resumos Semanais**: Relatórios automáticos com totais da semana
- **Exportação**: Exporte logs para análise externa

O log de auditoria é imutável e garante rastreabilidade completa de todas as operações financeiras.`
      }
    ]
  },
  {
    id: "a-reports",
    title: "Dashboard de Relatórios",
    icon: <BarChart3 className="h-5 w-5" />,
    content: [
      {
        title: "Relatórios Administrativos",
        text: `O dashboard de relatórios oferece visão completa do sistema:

- **Consultas**: Métricas de teleconsultas realizadas, canceladas, tempo médio
- **Pacientes**: Crescimento da base, distribuição demográfica, retenção
- **Financeiro**: Receita total, pacotes vendidos, créditos em circulação
- **Performance Médica**: Avaliação de desempenho dos médicos, taxa de satisfação
- **Uso do Sistema**: Funcionalidades mais utilizadas, horários de pico, erros

Exporte relatórios em diferentes formatos para apresentações e análises.`
      }
    ]
  },
  {
    id: "a-medical-references",
    title: "Referências Médicas",
    icon: <BookOpen className="h-5 w-5" />,
    content: [
      {
        title: "Gerenciando Referências Médicas",
        text: `Em "Referências Médicas", gerencie as bases de conhecimento do sistema:

- **Adicionar Referências**: Faça upload de protocolos, diretrizes e artigos
- **Prioridades**: Configure a prioridade de cada referência para uso diagnóstico
- **Ativar/Desativar**: Controle quais referências o sistema utiliza
- **Formatos Suportados**: PDF, texto e documentos formatados
- **Referências Padrão**: O sistema inclui diretrizes OMS, MS-Brasil e DSM-5 como base`
      }
    ]
  },
  {
    id: "a-payments-monitoring",
    title: "Monitoramento de Pagamentos",
    icon: <CreditCard className="h-5 w-5" />,
    content: [
      {
        title: "Dashboard de Pagamentos",
        text: `O dashboard administrativo de pagamentos (/admin/payments) oferece visão completa:

- **Filtros**: Filtre por provedor (PayPal, Stripe, PagBank), status e período
- **Cards de Resumo**: Total de transações, receita, taxa de aprovação e ticket médio
- **Breakdown por Provedor**: Distribuição de pagamentos entre PayPal, Stripe e PagBank
- **Lista de Transações**: Detalhes de cada pagamento com status, valor e metadata
- **Exportação**: Exporte relatórios de pagamentos para análise

Acompanhe em tempo real todas as transações financeiras da plataforma.`
      }
    ]
  },
  {
    id: "a-pharmacists",
    title: "Farmacêuticos",
    icon: <Pill className="h-5 w-5" />,
    content: [
      {
        title: "Gestão de Farmacêuticos",
        text: `O módulo de gestão de farmacêuticos permite:

- **Cadastro**: Registre farmacêuticos com CRF, especialidade e dados profissionais
- **Permissões**: Configure acessos específicos para o perfil farmacêutico
- **Monitoramento**: Acompanhe atividade de dispensação e verificação de prescrições
- **Relatórios**: Visualize relatórios de atividade por farmacêutico

Os farmacêuticos possuem um dashboard dedicado com funcionalidades específicas de verificação e dispensação.`
      }
    ]
  },
  {
    id: "a-installation",
    title: "Guia de Instalação",
    icon: <Settings className="h-5 w-5" />,
    content: [
      {
        title: "Acesso ao Guia de Instalação",
        text: `Como administrador, você tem acesso ao guia de instalação completo:

- **Replit**: Deploy rápido com configuração de variáveis de ambiente
- **Local**: Instalação com Docker ou manual com Node.js e PostgreSQL
- **Produção**: Deploy em servidores com Docker Compose, SSL e configurações de segurança

Variáveis de ambiente necessárias:
- DATABASE_URL (obrigatório): Conexão PostgreSQL
- GEMINI_API_KEY (obrigatório): API de serviço médico
- AGORA_APP_ID / AGORA_APP_CERTIFICATE (opcional): Vídeo via Agora.io
- SESSION_SECRET (opcional): Criptografia de sessão
- PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (opcional): Pagamentos PayPal
- STRIPE_SECRET_KEY / VITE_STRIPE_PUBLIC_KEY (opcional): Pagamentos Stripe
- PAGBANK_TOKEN / PAGBANK_EMAIL (opcional): Pagamentos PagBank (PIX/Boleto)
- PHARMACY_ENABLED (opcional): Habilitar módulo de Farmácia
- PMD_AUDIT_ENABLED (opcional): Habilitar audit logs do PMD
- AI_INTEGRATIONS_OPENAI_API_KEY (opcional): Fallback de IA

O sistema utiliza 61 tabelas no PostgreSQL e migra automaticamente na inicialização.`
      }
    ]
  }
];

const pharmacistSections: Section[] = [
  {
    id: "ph-dashboard",
    title: "Dashboard do Farmacêutico",
    icon: <MonitorSmartphone className="h-5 w-5" />,
    content: [
      {
        title: "Painel da Farmácia",
        text: `O dashboard do farmacêutico é a central de operações da farmácia:

- **Estatísticas**: Total de prescrições pendentes, dispensadas e rejeitadas
- **Abas de Prescrições**: Navegue entre Pendentes, Dispensadas e Todas as prescrições
- **Busca**: Pesquise prescrições por paciente, médico ou medicamento
- **Cards de Resumo**: Visão rápida das métricas do dia (prescrições recebidas, dispensadas, pendentes)
- **Alertas**: Notificações de novas prescrições e prescrições próximas do vencimento

O painel é atualizado em tempo real para garantir que nenhuma prescrição fique sem atendimento.`
      }
    ]
  },
  {
    id: "ph-verification",
    title: "Verificação de Prescrições",
    icon: <Shield className="h-5 w-5" />,
    content: [
      {
        title: "Verificando Prescrições",
        text: `A verificação de prescrições garante a autenticidade e validade:

- **Assinatura Digital**: Verifique a assinatura digital do médico prescritor
- **Verificação CRM**: Confirme o registro profissional (CRM) do médico junto ao conselho
- **Confirm-Read**: Marque a prescrição como lida e verificada antes de iniciar a dispensação
- **Alertas de Inconsistência**: O sistema alerta sobre dosagens incomuns ou interações medicamentosas
- **Histórico de Verificações**: Registro completo de todas as verificações realizadas

A verificação é obrigatória antes de qualquer dispensação de medicamentos.`
      }
    ]
  },
  {
    id: "ph-dispensing",
    title: "Dispensação de Medicamentos",
    icon: <Pill className="h-5 w-5" />,
    content: [
      {
        title: "Fluxo de Dispensação",
        text: `O processo de dispensação segue etapas padronizadas:

1. **Selecionar Prescrição**: Escolha uma prescrição verificada da lista de pendentes
2. **Verificar Itens**: Revise cada medicamento da prescrição
3. **Informar Dados do Lote**: Para cada medicamento, preencha:
   - **Lote**: Número do lote do medicamento
   - **Fabricante**: Nome do laboratório fabricante
   - **Validade**: Data de validade do lote
4. **Confirmar Dispensação**: Submeta a dispensação — o status é atualizado automaticamente
5. **Registro**: A dispensação é registrada com timestamp e farmacêutico responsável

Todos os dados de dispensação são armazenados para rastreabilidade e conformidade regulatória.`
      }
    ]
  },
  {
    id: "ph-reports",
    title: "Relatórios LGPD",
    icon: <BarChart3 className="h-5 w-5" />,
    content: [
      {
        title: "Gerando Relatórios da Farmácia",
        text: `O módulo de relatórios permite gerar análises detalhadas:

- **Períodos**: Selecione diário, semanal, mensal ou período personalizado
- **Breakdowns**: Análise por medicamento, médico prescritor, patologia e horário de dispensação
- **Toggle LGPD**: Ative a anonimização para relatórios compatíveis com a LGPD
- **Dados Anonimizados**: Com LGPD ativo, dados do paciente são desidentificados
- **Exportação**: Exporte relatórios em PDF ou CSV

Os relatórios são essenciais para controle de estoque, auditoria regulatória e análise de padrões de prescrição. Com o toggle LGPD ativo, os relatórios podem ser compartilhados externamente sem comprometer dados pessoais dos pacientes.`
      }
    ]
  }
];

function TabContent({ sections, indexLabel }: { sections: Section[]; indexLabel?: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <Card className="sticky top-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{indexLabel || "Índice"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <nav className="space-y-1 px-4 pb-4">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {section.icon}
                    <span className="truncate">{section.title}</span>
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
  );
}

const manualLabels = {
  title: "Manual do Usuário",
  subtitle: "Guia completo de uso da plataforma Tele<M3D> Pro — v3.5",
  visitors: "Visitantes",
  visitorsShort: "Visit.",
  patients: "Pacientes",
  patientsShort: "Pacient.",
  doctors: "Médicos",
  doctorsShort: "Méd.",
  admins: "Administradores",
  adminsShort: "Admin",
  pharmacists: "Farmacêuticos",
  pharmacistsShort: "Farm.",
  index: "Índice"
};

function extractSectionTexts(sections: Section[]) {
  return sections.map(s => ({
    id: s.id,
    title: s.title,
    content: s.content.map(c => ({ title: c.title, text: c.text }))
  }));
}

function mergeSectionTexts(original: Section[], translated: any[]): Section[] {
  return original.map((s, i) => ({
    ...s,
    title: translated[i]?.title || s.title,
    content: s.content.map((c, j) => ({
      title: translated[i]?.content?.[j]?.title || c.title,
      text: translated[i]?.content?.[j]?.text || c.text
    }))
  }));
}

export default function Manual() {
  const txVisitors = useMemo(() => extractSectionTexts(visitorSections), []);
  const txPatients = useMemo(() => extractSectionTexts(patientSections), []);
  const txDoctors = useMemo(() => extractSectionTexts(doctorSections), []);
  const txAdmins = useMemo(() => extractSectionTexts(adminSections), []);
  const txPharmacists = useMemo(() => extractSectionTexts(pharmacistSections), []);

  const { data: txSections, isLoading } = useMultiContentTranslation({
    labels: manualLabels,
    visitors: txVisitors,
    patients: txPatients,
    doctors: txDoctors,
    admins: txAdmins,
    pharmacists: txPharmacists
  }, 'manual');

  const lb = (txSections.labels || manualLabels) as typeof manualLabels;

  const mergedVisitors = mergeSectionTexts(visitorSections, txSections.visitors || txVisitors);
  const mergedPatients = mergeSectionTexts(patientSections, txSections.patients || txPatients);
  const mergedDoctors = mergeSectionTexts(doctorSections, txSections.doctors || txDoctors);
  const mergedAdmins = mergeSectionTexts(adminSections, txSections.admins || txAdmins);
  const mergedPharmacists = mergeSectionTexts(pharmacistSections, txSections.pharmacists || txPharmacists);

  return (
    <PageWrapper variant="origami">
      <TranslationLoading isLoading={isLoading}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {lb.title}
              </h1>
              <p className="text-muted-foreground">
                {lb.subtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">HL7 FHIR R4</Badge>
            <Badge variant="outline">Protocolo de Manchester</Badge>
            <Badge variant="outline">LGPD</Badge>
            <Badge variant="outline">PMD v1.0</Badge>
            <Badge variant="outline">Farmácia</Badge>
            <Badge variant="outline">Stripe/PagBank</Badge>
            <Badge variant="outline">61 Tabelas</Badge>
          </div>
        </div>

        <Tabs defaultValue="visitors" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="visitors" className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{lb.visitors}</span>
              <span className="sm:hidden">{lb.visitorsShort}</span>
            </TabsTrigger>
            <TabsTrigger value="patients" className="flex items-center gap-1.5">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">{lb.patients}</span>
              <span className="sm:hidden">{lb.patientsShort}</span>
            </TabsTrigger>
            <TabsTrigger value="doctors" className="flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">{lb.doctors}</span>
              <span className="sm:hidden">{lb.doctorsShort}</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{lb.admins}</span>
              <span className="sm:hidden">{lb.adminsShort}</span>
            </TabsTrigger>
            <TabsTrigger value="pharmacists" className="flex items-center gap-1.5">
              <Pill className="h-4 w-4" />
              <span className="hidden sm:inline">{lb.pharmacists}</span>
              <span className="sm:hidden">{lb.pharmacistsShort}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visitors">
            <TabContent sections={mergedVisitors} indexLabel={lb.index} />
          </TabsContent>

          <TabsContent value="patients">
            <TabContent sections={mergedPatients} indexLabel={lb.index} />
          </TabsContent>

          <TabsContent value="doctors">
            <TabContent sections={mergedDoctors} indexLabel={lb.index} />
          </TabsContent>

          <TabsContent value="admins">
            <TabContent sections={mergedAdmins} indexLabel={lb.index} />
          </TabsContent>

          <TabsContent value="pharmacists">
            <TabContent sections={mergedPharmacists} indexLabel={lb.index} />
          </TabsContent>
        </Tabs>
      </div>
      </TranslationLoading>
    </PageWrapper>
  );
}
