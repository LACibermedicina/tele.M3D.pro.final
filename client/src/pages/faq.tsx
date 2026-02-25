import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  HelpCircle, Search, ChevronDown, ChevronUp,
  Video, Calendar, MessageCircle, FileText, Bot, CreditCard,
  Shield, Users, Settings, MonitorSmartphone, AlertTriangle
} from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FaqItem[] = [
  {
    category: "Conta e Acesso",
    question: "Como criar uma conta no Tele<M3D>?",
    answer: "Acesse a página inicial e clique em 'Registrar'. Escolha seu tipo de conta (Médico, Paciente ou Administrador), preencha os dados solicitados e confirme. Após o registro, faça login com seu e-mail e senha."
  },
  {
    category: "Conta e Acesso",
    question: "Esqueci minha senha. Como recuperar?",
    answer: "Na página de login, clique em 'Esqueceu sua senha?' e siga as instruções para redefinição. Você receberá um e-mail com um link para criar uma nova senha."
  },
  {
    category: "Conta e Acesso",
    question: "Posso alterar meus dados de perfil?",
    answer: "Sim. Acesse 'Perfil' clicando no seu nome/avatar no canto superior direito. Lá você pode atualizar nome, especialidade (médicos), telefone e outras informações."
  },
  {
    category: "Teleconsultas",
    question: "Como iniciar uma teleconsulta com um paciente?",
    answer: "Existem três formas: 1) Na Agenda, clique em 'Iniciar' na consulta agendada. 2) Use 'Consulta Instantânea' na agenda para chamar um paciente online. 3) No Consultório Virtual, abra a sala e gere um link de acesso para o paciente."
  },
  {
    category: "Teleconsultas",
    question: "Minha câmera ou microfone não funciona na teleconsulta. O que fazer?",
    answer: "Verifique se o navegador tem permissão para acessar câmera e microfone (clique no ícone de cadeado na barra de endereço). O sistema funciona melhor em Chrome ou Edge. Certifique-se de que nenhum outro aplicativo está usando a câmera."
  },
  {
    category: "Teleconsultas",
    question: "O paciente pode entrar na consulta sem conta?",
    answer: "Sim. O médico pode gerar um 'Link de Acesso' na agenda. O paciente recebe o link e pode entrar diretamente na sala de espera virtual sem precisar criar uma conta."
  },
  {
    category: "Teleconsultas",
    question: "Posso compartilhar minha tela durante a consulta?",
    answer: "Sim (apenas médicos). Durante a videoconsulta, clique no botão de compartilhamento de tela na barra de controles. Você pode compartilhar a tela inteira, uma janela ou uma aba do navegador."
  },
  {
    category: "Teleconsultas",
    question: "Como funciona a transcrição automática?",
    answer: "A transcrição usa o reconhecimento de voz do navegador (disponível em Chrome e Edge). Clique no botão de transcrição para ativar. Você pode identificar o falante (Doutor/Paciente), exportar para .txt ou salvar nas notas da consulta."
  },
  {
    category: "Teleconsultas",
    question: "Posso convidar outro médico para a consulta?",
    answer: "Sim. Durante a videoconsulta, clique em 'Convidar Especialista' para ver médicos online e enviar um convite. O especialista recebe uma notificação com link para entrar na sala."
  },
  {
    category: "Agenda",
    question: "Como configurar meus horários de atendimento?",
    answer: "Vá em 'Disponibilidade' no menu. Configure seus horários semanais (dia, horário de início/fim, duração da consulta). Ative 'Status Online' para aparecer disponível e 'Disponível para Consulta Imediata' para a sala de espera."
  },
  {
    category: "Agenda",
    question: "Posso ver o histórico de consultas anteriores?",
    answer: "Sim. Na Agenda, clique na aba 'Histórico' para ver todas as consultas concluídas, canceladas e teleconsultas realizadas. Os pacientes também podem ver o histórico na aba 'Histórico' em 'Minhas Consultas'."
  },
  {
    category: "Agenda",
    question: "O que é a Consulta Instantânea?",
    answer: "É uma funcionalidade que permite ao médico iniciar uma videoconsulta imediata com qualquer paciente. Na Agenda, clique em 'Consulta Instantânea', selecione um paciente (com indicação de quem está online) e inicie a chamada. O paciente recebe uma notificação em tempo real."
  },
  {
    category: "Agenda",
    question: "Posso exportar minha agenda?",
    answer: "Sim. Na barra lateral da agenda, clique em 'Exportar Agenda' para gerar um arquivo iCal (.ics) compatível com Google Calendar, Outlook e Apple Calendar. Também é possível importar agendas de outros sistemas."
  },
  {
    category: "IA Médica",
    question: "Quais diretrizes a IA utiliza?",
    answer: "A IA é baseada em três conjuntos de diretrizes: 1) OMS - Diretrizes clínicas internacionais (mhGAP, GINA, GOLD). 2) Ministério da Saúde do Brasil - Cadernos de Atenção Básica, PCDT/CONITEC, RENAME, Previne Brasil. 3) DSM-5/DSM-5-TR - Critérios diagnósticos para transtornos mentais."
  },
  {
    category: "IA Médica",
    question: "Posso confiar nas respostas da IA?",
    answer: "A IA é um assistente de apoio à decisão clínica, NÃO substitui o julgamento médico. Todas as respostas devem ser avaliadas pelo profissional de saúde. A IA utiliza modelos de linguagem (Gemini/GPT) com diretrizes médicas, mas pode cometer erros."
  },
  {
    category: "IA Médica",
    question: "O que é a classificação de risco automática?",
    answer: "O sistema utiliza o Protocolo de Manchester (MTS) para classificar a urgência em 5 níveis: Emergência (vermelho), Muito Urgente (laranja), Urgente (amarelo), Padrão (verde) e Não Urgente (azul). A classificação é feita pela IA ao analisar os sintomas do paciente."
  },
  {
    category: "WhatsApp",
    question: "Preciso de uma conta WhatsApp Business para usar?",
    answer: "Não. O módulo WhatsApp IA funciona internamente no sistema mesmo sem credenciais da API do WhatsApp Business. As mensagens são salvas no banco de dados e entregues via notificações em tempo real."
  },
  {
    category: "WhatsApp",
    question: "O paciente pode responder às mensagens do médico?",
    answer: "Sim, se o médico ativar a opção 'Resposta habilitada' ao enviar a mensagem. Quando ativada, o paciente vê um botão 'Responder' na sua central de notificações. A resposta aparece no chat do WhatsApp do médico em tempo real."
  },
  {
    category: "WhatsApp",
    question: "Como funciona o status online do paciente?",
    answer: "O sistema rastreia conexões WebSocket em tempo real. Quando o paciente está conectado ao sistema (com a página aberta), aparece como 'Online' (ponto verde). Quando desconecta, aparece como 'Offline' (ponto cinza). O status é atualizado a cada 10 segundos."
  },
  {
    category: "Prontuários",
    question: "O paciente pode ver seu próprio prontuário?",
    answer: "Sim. Se o paciente possui registros clínicos, o item 'Meu Prontuário' aparece automaticamente no menu de navegação. A visualização é somente leitura."
  },
  {
    category: "Prontuários",
    question: "Posso gerar PDF dos registros clínicos?",
    answer: "Sim. Na página de prontuários, selecione o registro desejado e clique em 'Gerar PDF'. O sistema utiliza jsPDF para criar documentos formatados com todas as informações clínicas."
  },
  {
    category: "Prescrições",
    question: "Como criar uma prescrição digital?",
    answer: "Em 'Prescrições', clique em 'Nova Prescrição', selecione o paciente, adicione medicamentos com dosagens e instruções. A prescrição recebe um número único e pode ser exportada em PDF."
  },
  {
    category: "Prescrições",
    question: "O paciente pode ver suas prescrições?",
    answer: "Sim. Quando o paciente tem prescrições ativas (dentro da data de validade), o item 'Prescrições' aparece automaticamente no menu de navegação."
  },
  {
    category: "Créditos",
    question: "Como funcionam os créditos TMC?",
    answer: "TMC (Tele-Medicina Credits) é a moeda virtual do sistema. Cada funcionalidade tem um custo: Teleconsulta (50 TMC), WhatsApp (10 TMC), Análise IA (15 TMC). Adquira pacotes de créditos na página 'Créditos' via PayPal."
  },
  {
    category: "Créditos",
    question: "Posso ver o histórico de transações?",
    answer: "Sim. Na página 'Créditos', role para baixo para ver o histórico completo de transações com indicadores de crédito/débito, timestamps e saldo acumulado."
  },
  {
    category: "Segurança",
    question: "Meus dados são seguros?",
    answer: "Sim. O sistema utiliza: conexões criptografadas (HTTPS/WSS), autenticação por tokens, controle de acesso baseado em roles (RBAC), e banco de dados PostgreSQL com backups. Dados de saúde são tratados com rigor conforme regulamentações aplicáveis."
  },
  {
    category: "Segurança",
    question: "Quem pode acessar os prontuários dos pacientes?",
    answer: "Apenas médicos e administradores podem acessar prontuários de pacientes. Pacientes só podem ver seus próprios registros em modo somente leitura. Todas as rotas possuem verificação de autenticação e autorização."
  },
  {
    category: "Técnico",
    question: "Quais navegadores são suportados?",
    answer: "O sistema funciona em todos os navegadores modernos: Chrome (recomendado), Edge, Firefox e Safari. Para teleconsultas com transcrição automática, recomendamos Chrome ou Edge (suporte a SpeechRecognition API)."
  },
  {
    category: "Técnico",
    question: "Posso usar no celular?",
    answer: "Sim. A interface é responsiva e se adapta a dispositivos móveis. As teleconsultas por vídeo também funcionam em navegadores mobile (Chrome Android, Safari iOS)."
  },
  {
    category: "Técnico",
    question: "O sistema funciona offline?",
    answer: "Não. O Tele<M3D> requer conexão com a internet para todas as funcionalidades, incluindo teleconsultas, IA médica, mensagens e acesso a prontuários."
  }
];

const categories = [...new Set(faqData.map(f => f.category))];

const categoryIcons: Record<string, any> = {
  "Conta e Acesso": <Shield className="h-4 w-4" />,
  "Teleconsultas": <Video className="h-4 w-4" />,
  "Agenda": <Calendar className="h-4 w-4" />,
  "IA Médica": <Bot className="h-4 w-4" />,
  "WhatsApp": <MessageCircle className="h-4 w-4" />,
  "Prontuários": <FileText className="h-4 w-4" />,
  "Prescrições": <FileText className="h-4 w-4" />,
  "Créditos": <CreditCard className="h-4 w-4" />,
  "Segurança": <Shield className="h-4 w-4" />,
  "Técnico": <Settings className="h-4 w-4" />,
};

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const filteredFaq = faqData.filter(item => {
    const matchesSearch = !searchQuery || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <PageWrapper variant="origami">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Perguntas Frequentes (FAQ)
              </h1>
              <p className="text-muted-foreground">
                Respostas para as dúvidas mais comuns sobre o Tele{"<"}M3D{">"}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pergunta ou resposta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={selectedCategory === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >
            Todas ({faqData.length})
          </Badge>
          {categories.map(cat => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className="cursor-pointer flex items-center gap-1"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              {categoryIcons[cat]}
              {cat} ({faqData.filter(f => f.category === cat).length})
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFaq.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Nenhum resultado encontrado</h3>
                <p className="text-sm text-muted-foreground">Tente buscar com outros termos.</p>
              </CardContent>
            </Card>
          ) : (
            filteredFaq.map((item, index) => {
              const globalIndex = faqData.indexOf(item);
              const isExpanded = expandedItems.has(globalIndex);
              return (
                <Card 
                  key={globalIndex} 
                  className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}
                  onClick={() => toggleItem(globalIndex)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {categoryIcons[item.category] || <HelpCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                          </div>
                          <h3 className="font-medium text-sm">{item.question}</h3>
                          {isExpanded && (
                            <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-line">
                              {item.answer}
                            </p>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
