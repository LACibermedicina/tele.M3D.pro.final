import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Stethoscope, 
  FileText, 
  Sparkles, 
  Loader2,
  Calendar,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  BookOpenCheck,
  Pill,
  Activity,
  Brain,
  Database,
  TrendingUp,
  Shield
} from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referencesUsed?: string[];
};

type Conversation = {
  id: string;
  userId: string;
  userRole: string;
  messages: Message[];
  context: string;
  referencesUsed: string[];
  lastMessageAt: string;
  isActive: boolean;
  createdAt: string;
};

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  color: string;
};

export default function MedicalAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputMessage, setInputMessage] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading } = useQuery<Conversation>({
    queryKey: ['/api/chatbot/conversation', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/chatbot/conversation', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }
      return response.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (conversation?.id) {
      setCurrentConversationId(conversation.id);
    }
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/chatbot/message', {
        message,
        conversationId: currentConversationId,
        context: getRoleContext(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/conversation', user?.id] });
      setInputMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível processar sua pergunta.',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInputMessage(prompt);
  };

  const getRoleContext = () => {
    switch (user?.role) {
      case 'doctor':
        return 'doctor_diagnostics';
      case 'admin':
        return 'admin_analytics';
      default:
        return 'patient_health_query';
    }
  };

  const getRoleConfig = () => {
    const role = user?.role || 'patient';
    
    const configs: Record<string, {
      title: string;
      subtitle: string;
      gradient: string;
      quickActions: QuickAction[];
    }> = {
      patient: {
        title: 'Assistente de Saúde AI',
        subtitle: 'Tire dúvidas sobre sintomas e receba orientações personalizadas',
        gradient: 'from-orange-500 via-amber-500 to-yellow-500',
        quickActions: [
          {
            icon: <Calendar className="w-5 h-5" />,
            label: 'Agendar Consulta',
            prompt: 'Quero agendar uma consulta médica',
            color: 'bg-blue-500/20 hover:bg-blue-500/30'
          },
          {
            icon: <Stethoscope className="w-5 h-5" />,
            label: 'Verificar Sintomas',
            prompt: 'Estou com alguns sintomas e gostaria de orientação',
            color: 'bg-purple-500/20 hover:bg-purple-500/30'
          },
          {
            icon: <FileText className="w-5 h-5" />,
            label: 'Histórico Médico',
            prompt: 'Quero acessar meu histórico médico completo',
            color: 'bg-green-500/20 hover:bg-green-500/30'
          },
          {
            icon: <Pill className="w-5 h-5" />,
            label: 'Minhas Receitas',
            prompt: 'Mostrar minhas receitas e prescrições médicas',
            color: 'bg-pink-500/20 hover:bg-pink-500/30'
          },
          {
            icon: <Activity className="w-5 h-5" />,
            label: 'Exames Recentes',
            prompt: 'Ver resultados dos meus exames mais recentes',
            color: 'bg-cyan-500/20 hover:bg-cyan-500/30'
          },
          {
            icon: <ClipboardList className="w-5 h-5" />,
            label: 'Orientações Gerais',
            prompt: 'Preciso de orientações sobre saúde e bem-estar',
            color: 'bg-indigo-500/20 hover:bg-indigo-500/30'
          }
        ]
      },
      doctor: {
        title: 'Assistente Médico AI',
        subtitle: 'Suporte clínico avançado com análise diagnóstica e literatura médica',
        gradient: 'from-blue-600 via-cyan-500 to-teal-500',
        quickActions: [
          {
            icon: <Brain className="w-5 h-5" />,
            label: 'Análise Diagnóstica',
            prompt: 'Analisar caso clínico com diagnósticos diferenciais',
            color: 'bg-purple-500/20 hover:bg-purple-500/30'
          },
          {
            icon: <FileText className="w-5 h-5" />,
            label: 'Protocolos Clínicos',
            prompt: 'Consultar protocolos e guidelines para tratamento',
            color: 'bg-blue-500/20 hover:bg-blue-500/30'
          },
          {
            icon: <Pill className="w-5 h-5" />,
            label: 'Interações Medicamentosas',
            prompt: 'Verificar interações medicamentosas e contraindicações',
            color: 'bg-red-500/20 hover:bg-red-500/30'
          },
          {
            icon: <ClipboardList className="w-5 h-5" />,
            label: 'Criar Prescrição',
            prompt: 'Auxiliar na criação de prescrição médica',
            color: 'bg-green-500/20 hover:bg-green-500/30'
          },
          {
            icon: <BookOpenCheck className="w-5 h-5" />,
            label: 'Literatura Médica',
            prompt: 'Buscar evidências científicas recentes sobre um tema',
            color: 'bg-amber-500/20 hover:bg-amber-500/30'
          },
          {
            icon: <Activity className="w-5 h-5" />,
            label: 'Análise de Exames',
            prompt: 'Interpretar resultados de exames laboratoriais',
            color: 'bg-cyan-500/20 hover:bg-cyan-500/30'
          }
        ]
      },
      admin: {
        title: 'Assistente Administrativo AI',
        subtitle: 'Análise de dados, relatórios e gestão do sistema',
        gradient: 'from-purple-600 via-pink-500 to-red-500',
        quickActions: [
          {
            icon: <BarChart3 className="w-5 h-5" />,
            label: 'Relatórios de Análise',
            prompt: 'Gerar relatório estatístico do sistema',
            color: 'bg-blue-500/20 hover:bg-blue-500/30'
          },
          {
            icon: <Users className="w-5 h-5" />,
            label: 'Gestão de Usuários',
            prompt: 'Analisar estatísticas de usuários e atividades',
            color: 'bg-purple-500/20 hover:bg-purple-500/30'
          },
          {
            icon: <TrendingUp className="w-5 h-5" />,
            label: 'Performance do Sistema',
            prompt: 'Análise de performance e uso do sistema',
            color: 'bg-green-500/20 hover:bg-green-500/30'
          },
          {
            icon: <Database className="w-5 h-5" />,
            label: 'Análise de Dados',
            prompt: 'Consultar dados agregados e insights',
            color: 'bg-cyan-500/20 hover:bg-cyan-500/30'
          },
          {
            icon: <Shield className="w-5 h-5" />,
            label: 'Segurança e Compliance',
            prompt: 'Verificar status de segurança e conformidade',
            color: 'bg-red-500/20 hover:bg-red-500/30'
          },
          {
            icon: <Settings className="w-5 h-5" />,
            label: 'Configurações',
            prompt: 'Ajustar configurações e parâmetros do sistema',
            color: 'bg-amber-500/20 hover:bg-amber-500/30'
          }
        ]
      }
    };

    return configs[role] || configs.patient;
  };

  const config = getRoleConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando assistente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Medical Pattern Background */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <pattern id="medical-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="2" fill="currentColor" />
            <path d="M 50 30 L 50 70 M 30 50 L 70 50" stroke="currentColor" strokeWidth="2" />
            <path d="M 80 15 Q 85 20 80 25 Q 75 20 80 15" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#medical-pattern)" />
        </svg>
      </div>

      <div className="container mx-auto p-4 md:p-6 max-w-7xl relative">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block p-6 rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl border-2 border-white/30 dark:border-gray-700/30 shadow-2xl">
            <h1 className={`text-3xl md:text-4xl font-bold bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent mb-2`}>
              {config.title.toUpperCase()}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions Panel */}
          <div className="lg:col-span-1 space-y-4 animate-fade-in">
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-2 border-white/30 dark:border-gray-700/30 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Ações Rápidas</h3>
                    <p className="text-xs text-muted-foreground">Escolha uma opção abaixo</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {config.quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleQuickAction(action.prompt)}
                      className={`h-auto py-4 flex flex-col items-center justify-center gap-2 ${action.color} border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105`}
                      data-testid={`button-quick-${index}`}
                    >
                      <div className="text-primary">
                        {action.icon}
                      </div>
                      <span className="text-xs font-medium text-center leading-tight">
                        {action.label}
                      </span>
                    </Button>
                  ))}
                </div>

                {/* User Info Badge */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}>
                      <UserIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{user?.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {user?.role === 'doctor' ? 'Médico' : user?.role === 'admin' ? 'Administrador' : 'Paciente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Stats Card */}
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-2 border-white/30 dark:border-gray-700/30 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Status da IA</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Modelo</span>
                    <Badge>Gemini 1.5 Flash</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Referências</span>
                    <span className="text-sm font-semibold">{conversation?.referencesUsed?.length || 0} PDFs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Mensagens</span>
                    <span className="text-sm font-semibold">{conversation?.messages?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${config.gradient} animate-pulse`} style={{ width: '85%' }}></div>
                    </div>
                    <span className="text-xs font-semibold">85%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-2 animate-fade-in">
            <Card className="h-[calc(100vh-200px)] flex flex-col bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border-2 border-white/30 dark:border-gray-700/30 shadow-xl">
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4">
                    {!conversation?.messages || conversation.messages.length === 0 ? (
                      <div className="text-center py-12">
                        <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-2xl animate-pulse`}>
                          <Sparkles className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Bem-vindo ao Assistente AI</h3>
                        <p className="text-muted-foreground max-w-md mx-auto mb-6">
                          {user?.role === 'doctor'
                            ? 'Faça perguntas sobre diagnósticos, tratamentos, guidelines médicos ou literatura científica.'
                            : user?.role === 'admin'
                            ? 'Consulte análises, relatórios e estatísticas do sistema.'
                            : 'Tire suas dúvidas sobre saúde, agende consultas e acesse seu histórico médico.'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                          {config.quickActions.slice(0, 3).map((action, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => handleQuickAction(action.prompt)}
                            >
                              {action.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      conversation.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.role === 'assistant' && (
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                              <Bot className="w-5 h-5 text-white" />
                            </div>
                          )}
                          
                          <div
                            className={`max-w-[75%] rounded-2xl p-5 backdrop-blur-sm ${
                              message.role === 'user'
                                ? `bg-gradient-to-br ${config.gradient} text-white shadow-lg`
                                : 'bg-white/80 dark:bg-gray-700/80 border border-white/40 dark:border-gray-600/40 shadow-md'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </div>
                            
                            {message.referencesUsed && message.referencesUsed.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-white/20 dark:border-gray-600/20">
                                <div className="flex items-center gap-2 text-xs opacity-80">
                                  <FileText className="w-4 h-4" />
                                  <span>Baseado em {message.referencesUsed.length} referência(s) médica(s)</span>
                                </div>
                              </div>
                            )}
                            
                            <div className={`text-xs mt-3 ${message.role === 'user' ? 'opacity-80' : 'text-muted-foreground'}`}>
                              {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          
                          {message.role === 'user' && (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                              <UserIcon className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    
                    {sendMessageMutation.isPending && (
                      <div className="flex gap-3 justify-start">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-2xl p-5 border border-white/40 dark:border-gray-600/40 shadow-md">
                          <div className="flex items-center gap-3 text-sm">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-muted-foreground">Analisando com IA médica...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t border-white/30 dark:border-gray-700/30 p-6 bg-gradient-to-r from-white/40 to-white/20 dark:from-gray-800/40 dark:to-gray-800/20 backdrop-blur-sm">
                  <div className="flex gap-3">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        user?.role === 'doctor'
                          ? 'Digite sua pergunta médica...'
                          : user?.role === 'admin'
                          ? 'Consultar dados ou relatórios...'
                          : 'Digite sua dúvida de saúde...'
                      }
                      disabled={sendMessageMutation.isPending}
                      className="flex-1 h-12 bg-white/80 dark:bg-gray-700/80 border-2 border-primary/20 focus:border-primary/60 rounded-xl shadow-sm"
                      data-testid="input-chat-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                      className={`h-12 px-6 rounded-xl shadow-lg bg-gradient-to-r ${config.gradient} hover:scale-105 transition-transform`}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  
                  <div className="mt-3 text-xs text-muted-foreground text-center">
                    {user?.role === 'doctor' ? (
                      <span>💡 Respostas baseadas em guidelines médicos e literatura científica</span>
                    ) : user?.role === 'admin' ? (
                      <span>📊 Análises e relatórios gerados com inteligência artificial</span>
                    ) : (
                      <span>⚠️ Este assistente fornece orientações gerais. Em emergências, procure atendimento médico</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
