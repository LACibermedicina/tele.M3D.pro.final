import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  HelpCircle, Search, ChevronDown, ChevronUp,
  Video, Calendar, MessageCircle, FileText, Bot, CreditCard,
  Shield, Settings,
  Wallet, Gem, Download, Mic, Clock, BarChart3, Stethoscope, ClipboardCheck
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
    answer: "Sim. Acesse 'Perfil' clicando no seu nome/avatar no canto superior direito. Lá você pode atualizar nome, especialidade (médicos), telefone, foto de perfil e outras informações."
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
    answer: "Sim. O médico pode gerar um 'Link de Acesso' na agenda. O paciente recebe o link e pode entrar diretamente na sala de espera virtual sem precisar criar uma conta. Também é possível gerar links de acesso temporário para visitantes."
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
    answer: "Sim. Durante a videoconsulta, clique em 'Convidar Especialista' para ver médicos online e enviar um convite. O especialista recebe uma notificação com link para entrar na sala. Isso facilita a interconsulta em tempo real."
  },
  {
    category: "Teleconsultas",
    question: "Como funciona o acesso por QR Code e código curto?",
    answer: "Ao criar uma consulta, o sistema gera automaticamente um QR Code e um código curto de 6 caracteres. O paciente pode escanear o QR Code com a câmera do celular ou digitar o código curto na página de acesso para entrar na sala de espera da consulta sem precisar de login."
  },
  {
    category: "Teleconsultas",
    question: "Como solicitar uma consulta?",
    answer: "Pacientes podem solicitar consultas de duas formas: 1) Por especialidade — selecione a especialidade desejada e escolha um médico disponível. 2) Por triagem IA — descreva seus sintomas e a IA classificará a urgência pelo Protocolo de Manchester, direcionando para o profissional mais adequado."
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
    category: "Agenda",
    question: "Quais são as 3 abas da agenda do médico?",
    answer: "A agenda do médico possui 3 abas: 1) Hoje — mostra todas as consultas do dia atual com ações rápidas. 2) Futuras — lista consultas agendadas para os próximos dias com possibilidade de cancelamento em massa. 3) Histórico — exibe consultas passadas (concluídas, canceladas) para referência."
  },
  {
    category: "Agenda",
    question: "Como limpar toda a agenda de uma vez?",
    answer: "Na aba 'Futuras' da agenda, use a função 'Limpar Agenda' para cancelar todas as consultas futuras de uma só vez. Uma confirmação será solicitada antes de executar a ação. Isso é útil para médicos que precisam reorganizar completamente seus horários."
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
    category: "Prontuários",
    question: "É possível exportar prontuários no padrão FHIR?",
    answer: "Sim. O sistema suporta exportação de dados do paciente no padrão HL7 FHIR R4, compatível com múltiplos padrões internacionais: Brasil/SUS (RNDS, RAC, SBIS, LGPD), EUA (HIPAA, USCDI v3), Europa (GDPR) e Internacional (ICD-11, SNOMED CT). A exportação pode ser feita com opção de des-identificação para pesquisa."
  },
  {
    category: "Prescrições",
    question: "Como criar uma prescrição digital?",
    answer: "Em 'Prescrições', clique em 'Nova Prescrição', selecione o paciente, adicione medicamentos com dosagens e instruções. Você pode buscar medicamentos na base local ou pesquisar em bases externas (RxNorm, OpenFDA, ANVISA/RENAME) com seletor de localidade (Brasil, EUA, Global). A prescrição recebe um número único e pode ser exportada em PDF com assinatura digital."
  },
  {
    category: "Prescrições",
    question: "Como funciona a busca de medicamentos em bases externas?",
    answer: "Na criação de prescrições, o campo 'Buscar Base de Dados' permite pesquisar medicamentos em bases oficiais: ANVISA/RENAME (Brasil, 50+ medicamentos comuns), RxNorm (base americana NIH) e OpenFDA (FDA americana). O sistema prioriza a base conforme o locale selecionado (Brasil → ANVISA primeiro, EUA → FDA primeiro). Os resultados mostram nome, princípio ativo, dosagem e fonte."
  },
  {
    category: "Prescrições",
    question: "O paciente pode ver suas prescrições?",
    answer: "Sim. Quando o paciente tem prescrições ativas (dentro da data de validade), o item 'Prescrições' aparece automaticamente no menu de navegação."
  },
  {
    category: "Créditos",
    question: "Como funcionam os créditos TM3D?",
    answer: "TM3D é a moeda virtual do sistema. Cada funcionalidade tem um custo definido (são 15 funcionalidades com custos específicos). Adquira pacotes de créditos na página 'Créditos' via PayPal — são 6 pacotes disponíveis com diferentes quantidades e preços."
  },
  {
    category: "Créditos",
    question: "Posso ver o histórico de transações?",
    answer: "Sim. Na página 'Créditos', role para baixo para ver o histórico completo de transações com indicadores de crédito/débito, timestamps e saldo acumulado."
  },
  {
    category: "Carteira Digital",
    question: "Como comprar créditos TM3D?",
    answer: "Acesse a página 'Carteira' ou 'Créditos' no menu. Escolha um dos 6 pacotes de créditos disponíveis e finalize a compra via PayPal. Os créditos são adicionados automaticamente ao seu saldo após a confirmação do pagamento."
  },
  {
    category: "Carteira Digital",
    question: "Como transferir créditos para outro usuário?",
    answer: "Na página da Carteira, use a função 'Transferir'. Informe o usuário destinatário e a quantidade de créditos TM3D. A transferência é instantânea e aparece no histórico de transações de ambos os usuários."
  },
  {
    category: "Carteira Digital",
    question: "Como ver meu histórico de transações na carteira?",
    answer: "Na página da Carteira, o histórico completo é exibido com filtros por tipo de transação (compra, transferência, débito, crédito). Cada entrada mostra valor, data, tipo e saldo resultante. Administradores também podem consultar o log de auditoria da carteira."
  },
  {
    category: "Carteira Digital",
    question: "Como vincular uma carteira externa (MetaMask/WalletConnect)?",
    answer: "Na página da Carteira, clique em 'Vincular Carteira Externa'. Você pode conectar carteiras MetaMask ou WalletConnect para interagir com funcionalidades blockchain do sistema, como NFTs e o broker TM3D. A vinculação é segura e pode ser revogada a qualquer momento."
  },
  {
    category: "Carteira Digital",
    question: "Como solicitar um saque de créditos?",
    answer: "Na página da Carteira, use a opção 'Solicitar Saque'. Informe o valor desejado e o método de recebimento. A solicitação será processada pelo administrador. O status pode ser acompanhado na seção de solicitações de saque."
  },
  {
    category: "NFTs e Broker",
    question: "O que são os NFTs médicos do sistema?",
    answer: "Os Dynamic NFTs (dNFTs) do Tele<M3D> representam dados clínicos anonimizados em conformidade com a LGPD. Eles podem ser gerados a partir de dados de consultas, com des-identificação automática para proteger a privacidade do paciente. São úteis para pesquisa e compartilhamento seguro de dados clínicos."
  },
  {
    category: "NFTs e Broker",
    question: "Como funciona o broker interno?",
    answer: "O broker interno permite a negociação de ações TM3D e NFTs entre usuários. Funciona com um livro de ordens (order book) onde compradores e vendedores podem colocar ofertas. O histórico de negociações é registrado e pode ser consultado na página do Broker."
  },
  {
    category: "NFTs e Broker",
    question: "Os NFTs são compatíveis com a LGPD?",
    answer: "Sim. Todos os NFTs gerados pelo sistema passam por um processo de anonimização e des-identificação dos dados do paciente, conforme exigido pela LGPD. Nenhum dado pessoal identificável é incluído nos metadados do NFT."
  },
  {
    category: "Exportação de Dados",
    question: "Como exportar dados do paciente no padrão FHIR?",
    answer: "Na página de prontuários ou perfil do paciente, clique em 'Exportar Dados'. Selecione o padrão desejado: Brasil/SUS (RNDS, RAC, SBIS, LGPD), EUA (HIPAA, USCDI v3), Europa (GDPR) ou Internacional (ICD-11, SNOMED CT). O sistema gera um bundle HL7 FHIR R4 com todos os recursos clínicos."
  },
  {
    category: "Exportação de Dados",
    question: "Quais padrões de exportação estão disponíveis?",
    answer: "O sistema suporta 4 categorias de padrões: 1) Brasil/SUS — RNDS, RAC, SBIS, LGPD. 2) EUA — HIPAA, USCDI v3. 3) Europa — GDPR. 4) Internacional — ICD-11, SNOMED CT. Cada padrão inclui os campos e codificações exigidos pela regulamentação correspondente."
  },
  {
    category: "Exportação de Dados",
    question: "O que é a opção de des-identificação na exportação?",
    answer: "A des-identificação remove ou mascara dados pessoais identificáveis (nome, CPF, endereço, etc.) do arquivo exportado, mantendo apenas dados clínicos relevantes. É útil para pesquisa científica e está em conformidade com HIPAA Safe Harbor e LGPD. Pode ser ativada ao marcar a opção 'Des-identificar' antes de exportar."
  },
  {
    category: "IAM3D",
    question: "O que é o assistente de voz IAM3D?",
    answer: "O IAM3D é um assistente de voz inteligente integrado ao sistema. Ele utiliza a Web Speech API para reconhecimento e síntese de voz, permitindo interação por comandos de voz. A interface apresenta uma esfera animada em tela cheia com badges de segurança baseadas no papel do usuário (paciente, médico, admin)."
  },
  {
    category: "IAM3D",
    question: "Como ativar o assistente de voz?",
    answer: "Clique no ícone de microfone flutuante no canto inferior da tela ou use o atalho de teclado configurado. O IAM3D abrirá em tela cheia com a esfera animada. Fale naturalmente para fazer perguntas médicas, navegar pelo sistema ou solicitar ações. O assistente responde por voz e texto."
  },
  {
    category: "IAM3D",
    question: "Posso solicitar uma consulta urgente por voz?",
    answer: "Sim. O IAM3D permite solicitar consultas urgentes por comando de voz. Ele pode conectar o paciente ao médico plantonista (on-duty) mais próximo, agendar consultas e até iniciar uma interconsulta durante uma videoconsulta em andamento."
  },
  {
    category: "IAM3D",
    question: "Quais comandos o IAM3D suporta?",
    answer: "O IAM3D suporta comandos como: consultar agenda, solicitar consulta, verificar prescrições, navegar para páginas do sistema, buscar informações médicas, solicitar consulta urgente com médico plantonista e iniciar interconsulta. Os comandos disponíveis variam conforme o papel do usuário (visitante, paciente, médico ou admin)."
  },
  {
    category: "Inatividade",
    question: "O que acontece quando fico inativo no sistema?",
    answer: "O sistema detecta inatividade (ausência de cliques, movimentos do mouse ou teclas pressionadas). Após o período configurado, um aviso é exibido na tela com contagem regressiva. Se não houver interação, o sistema realiza logout automático para proteger seus dados."
  },
  {
    category: "Inatividade",
    question: "Como funciona o timeout de inatividade?",
    answer: "O timeout é configurável pelo administrador nas Configurações do Sistema. Quando atingido, uma janela de aviso aparece com contagem regressiva. Qualquer interação (click, tecla, movimento) cancela o logout. Se houver uma videoconsulta ativa via Agora, ela será desconectada automaticamente antes do logout."
  },
  {
    category: "Inatividade",
    question: "Posso ajustar o tempo de inatividade?",
    answer: "Apenas administradores podem configurar o tempo de inatividade nas Configurações do Sistema (Admin > Configurações). O valor padrão pode ser ajustado conforme as necessidades da instituição. A alteração afeta todos os usuários do sistema."
  },
  {
    category: "Relatórios",
    question: "Como acessar o dashboard de relatórios?",
    answer: "No menu de navegação, clique em 'Relatórios'. O dashboard oferece visualizações gráficas e tabelas com dados consolidados. Médicos e administradores têm acesso a diferentes tipos de relatórios conforme seu papel."
  },
  {
    category: "Relatórios",
    question: "Quais tipos de relatórios estão disponíveis?",
    answer: "O sistema oferece 4 categorias de relatórios: 1) Consultas — número de atendimentos, taxa de conclusão, tempo médio. 2) Pacientes — cadastros, perfil demográfico, frequência. 3) Financeiros — créditos movimentados, receita, pacotes vendidos. 4) Desempenho médico — produtividade por médico, avaliações, tempo de resposta."
  },
  {
    category: "Relatórios",
    question: "O que são os relatórios epidemiológicos?",
    answer: "Os relatórios epidemiológicos utilizam IA para analisar dados clínicos agregados, identificando tendências e padrões de saúde. Os resultados incluem codificações MeSH e ICD para classificação padronizada. São úteis para vigilância epidemiológica e pesquisa em saúde pública."
  },
  {
    category: "Relatórios",
    question: "Posso exportar os relatórios?",
    answer: "Sim. Os relatórios podem ser exportados em diferentes formatos para análise externa. O dashboard de relatórios oferece opções de filtro por período, tipo de consulta e outros parâmetros antes da exportação."
  },
  {
    category: "Inter-Consulta",
    question: "Como funciona a inter-consulta entre médicos?",
    answer: "A inter-consulta permite que um médico solicite a participação de outro especialista em um caso clínico. O médico solicitante envia um convite com o contexto clínico. O especialista pode aceitar e participar de uma videoconsulta conjunta ou fornecer parecer por escrito. Todo o processo é registrado no histórico."
  },
  {
    category: "Inter-Consulta",
    question: "Posso agendar uma inter-consulta para depois?",
    answer: "Sim. Além da inter-consulta imediata durante uma videoconsulta ativa, você pode agendar inter-consultas para datas futuras. O sistema gerencia os horários entre os profissionais e envia notificações de lembrete."
  },
  {
    category: "Pós-Consulta",
    question: "O que a IA gera automaticamente após uma consulta?",
    answer: "Após finalizar uma teleconsulta, a IA pode gerar automaticamente: prescrições com medicamentos e dosagens, pedidos de exames laboratoriais, encaminhamentos para especialistas, e sugestões de acompanhamento (follow-up). O médico revisa, edita e aprova cada item antes de finalizar."
  },
  {
    category: "Pós-Consulta",
    question: "Como funciona a classificação diagnóstica pós-consulta?",
    answer: "Após a consulta, o sistema oferece a classificação diagnóstica com suporte a CID-10, CID-11 e DSM-5/TR. A IA sugere códigos diagnósticos com níveis de confiança. O médico pode aceitar, modificar ou adicionar classificações manualmente. As inferências diagnósticas ficam registradas para consulta futura."
  },
  {
    category: "Pós-Consulta",
    question: "O que é a análise de interação medicamentosa?",
    answer: "Ao criar prescrições, o sistema verifica automaticamente possíveis interações entre os medicamentos prescritos. Se uma interação potencialmente perigosa for detectada, um alerta é exibido ao médico com detalhes sobre a interação, severidade e recomendações. Isso ajuda a prevenir efeitos adversos."
  },
  {
    category: "Pós-Consulta",
    question: "O que é o painel de consultas incompletas?",
    answer: "O painel de consultas incompletas lista teleconsultas que foram realizadas mas ainda não tiveram o fluxo pós-consulta finalizado (prescrições, exames, classificação diagnóstica pendentes). Isso ajuda o médico a garantir que toda a documentação clínica esteja completa."
  },
  {
    category: "Segurança",
    question: "Meus dados são seguros?",
    answer: "Sim. O sistema utiliza: conexões criptografadas (HTTPS/WSS), autenticação por tokens, controle de acesso baseado em roles (RBAC), detecção de inatividade com auto-logout, e banco de dados PostgreSQL com backups. Dados de saúde são tratados conforme LGPD, HIPAA e GDPR."
  },
  {
    category: "Segurança",
    question: "Quem pode acessar os prontuários dos pacientes?",
    answer: "Apenas médicos e administradores podem acessar prontuários de pacientes. Pacientes só podem ver seus próprios registros em modo somente leitura. Todas as rotas possuem verificação de autenticação e autorização."
  },
  {
    category: "Segurança",
    question: "O sistema é compatível com HIPAA?",
    answer: "Sim. O sistema implementa controles compatíveis com HIPAA, incluindo: des-identificação de dados (Safe Harbor), controle de acesso baseado em papéis, log de auditoria, exportação FHIR R4 com USCDI v3, e proteção de dados em trânsito e em repouso. A exportação de dados inclui opção de des-identificação conforme HIPAA."
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
  "Carteira Digital": <Wallet className="h-4 w-4" />,
  "NFTs e Broker": <Gem className="h-4 w-4" />,
  "Exportação de Dados": <Download className="h-4 w-4" />,
  "IAM3D": <Mic className="h-4 w-4" />,
  "Inatividade": <Clock className="h-4 w-4" />,
  "Relatórios": <BarChart3 className="h-4 w-4" />,
  "Inter-Consulta": <Stethoscope className="h-4 w-4" />,
  "Pós-Consulta": <ClipboardCheck className="h-4 w-4" />,
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
