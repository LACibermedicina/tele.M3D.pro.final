import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Calendar, Send, Loader2, User, Check, HeartPulse, ClipboardList, Users, Brain, FileText, BarChart3, Stethoscope, Settings, AlertTriangle, LogIn, MessageCircle } from "lucide-react";
import { FormattedText } from "@/components/ui/formatted-text";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'appointment' | 'action';
  metadata?: any;
}

interface AIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContext?: string;
  mode?: 'symptoms' | 'questions' | 'general';
}

const MAX_VISITOR_QUESTIONS = 10;

export function AIAssistant({ open, onOpenChange, initialContext, mode = 'general' }: AIAssistantProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [visitorQuestionCount, setVisitorQuestionCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = getGreeting();
      setMessages([{
        id: '1',
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
        type: 'text'
      }]);
      setVisitorQuestionCount(0);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setVisitorQuestionCount(0);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getGreeting = () => {
    if (!user) {
      return `👋 Olá! Sou o assistente virtual da Tele<M3D>. Posso ajudá-lo com:

📅 Agendar uma consulta médica
🔑 Solicitar acesso temporário para conhecer a plataforma

Para acesso completo (triagem, prontuário, teleconsulta), faça login ou registre-se!`;
    }

    const name = user.name.split(' ')[0];
    
    if (user.role === 'admin') {
      return `👋 Olá, ${name}! Como administrador, posso mostrar:
• Todas as consultas agendadas de todos os médicos
• Estatísticas gerais da plataforma
• Status de pacientes em espera
• Configurações do sistema

Como posso ajudar?`;
    }

    if (user.role === 'doctor') {
      return `👋 Olá, Dr(a). ${name}! Posso mostrar:
• Suas consultas agendadas
• Pacientes que agendaram com você
• Suas consultas em andamento e completadas
• Gestão da sua agenda

O que você gostaria de ver?`;
    }

    if (user.role === 'patient') {
      if (mode === 'symptoms') {
        return `🩺 Análise de Sintomas - Olá, ${name}!

Vou realizar uma triagem clínica completa baseada nos protocolos:
• Protocolo de Manchester (MTS)
• Diretrizes OMS/WHO
• Protocolos do Ministério da Saúde do Brasil
• DSM-5/DSM-5-TR (para questões de saúde mental)

Descreva seus sintomas com o máximo de detalhes possível:`;
      }
      return `👋 Olá, ${name}! Posso ajudar com:
• Agendar nova consulta
• Ver suas consultas agendadas
• Análise de sintomas
• Orientações médicas

Como posso ajudar hoje?`;
    }

    return `👋 Olá, ${name}! Como posso ajudar você hoje?`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!user && visitorQuestionCount >= MAX_VISITOR_QUESTIONS) {
      toast({
        title: "Limite atingido",
        description: "Você atingiu o limite de perguntas como visitante. Registre-se para continuar.",
        variant: "destructive"
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (!user) {
      setVisitorQuestionCount(prev => prev + 1);
    }

    try {
      const endpoint = user ? '/api/chatbot/message' : '/api/chatbot/visitor-message';
      
      const body: any = { message: input };
      if (!user && mode === 'symptoms') {
        body.mode = 'symptoms';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message?.content || 'Como posso ajudá-lo?',
        timestamp: new Date(),
        type: data.type || 'text',
        metadata: data.metadata
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.metadata?.suggestedAppointment) {
        handleAppointmentSuggestion(data.metadata.suggestedAppointment);
      }

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Erro",
        description: "Não foi possível processar sua mensagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppointmentSuggestion = (appointment: any) => {
    const suggestionMessage: Message = {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: `📅 Encontrei um horário disponível:
      
Data: ${new Date(appointment.date).toLocaleDateString('pt-BR')}
Horário: ${appointment.time}
Tipo: ${appointment.type}

Deseja confirmar este agendamento?`,
      timestamp: new Date(),
      type: 'appointment',
      metadata: appointment
    };
    
    setMessages(prev => [...prev, suggestionMessage]);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  const handleConfirmAppointment = async (appointment: any) => {
    try {
      setIsLoading(true);
      
      const res = await fetch('/api/chatbot/schedule', {
        method: 'POST',
        body: JSON.stringify(appointment),
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to schedule appointment');
      }

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '✅ Consulta agendada com sucesso! Você receberá uma confirmação por email e WhatsApp.',
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, confirmMessage]);

      toast({
        title: "Sucesso!",
        description: "Consulta agendada com sucesso.",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível agendar a consulta.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  const quickActions = user?.role === 'patient' ? [
    { label: "Triagem de Sintomas", icon: HeartPulse, message: "Estou com alguns sintomas e gostaria de orientação" },
    { label: "Agendar Consulta", icon: Calendar, message: "Gostaria de agendar uma consulta" },
    { label: "Minhas Consultas", icon: ClipboardList, message: "Quais são minhas consultas agendadas?" },
  ] : user?.role === 'doctor' ? [
    { label: "Pacientes Hoje", icon: Users, message: "Quais pacientes tenho agendados para hoje?" },
    { label: "Apoio Clínico", icon: Brain, message: "Preciso de uma segunda opinião sobre um caso clínico" },
    { label: "Protocolos", icon: FileText, message: "Mostrar protocolos e guidelines médicos disponíveis" },
  ] : user?.role === 'admin' ? [
    { label: "Estatísticas", icon: BarChart3, message: "Mostre as estatísticas gerais da plataforma" },
    { label: "Fila de Espera", icon: Users, message: "Quantos pacientes estão em espera agora?" },
    { label: "Consultas Hoje", icon: Calendar, message: "Ver todas as consultas agendadas de hoje" },
  ] : [
    { label: "Agendar Consulta", icon: Calendar, message: "Gostaria de agendar uma consulta médica" },
    { label: "Acesso Temporário", icon: LogIn, message: "Gostaria de solicitar um acesso temporário para conhecer a plataforma" },
  ];

  const getDialogTitle = () => {
    if (mode === 'symptoms') return 'Análise de Sintomas';
    if (mode === 'questions') return 'Tirar Dúvidas';
    return 'Assistente Virtual IA';
  };

  const getHeaderGradient = () => {
    if (mode === 'symptoms') return 'from-red-50 to-orange-50';
    if (mode === 'questions') return 'from-blue-50 to-cyan-50';
    return 'from-purple-50 to-indigo-50';
  };

  const getIconColor = () => {
    if (mode === 'symptoms') return 'text-red-600';
    if (mode === 'questions') return 'text-blue-600';
    return 'text-purple-600';
  };

  const getBubbleColor = () => {
    if (mode === 'symptoms') return 'bg-red-50 text-red-900';
    if (mode === 'questions') return 'bg-blue-50 text-blue-900';
    return 'bg-gray-100 text-gray-800';
  };

  const visitorLimitReached = !user && visitorQuestionCount >= MAX_VISITOR_QUESTIONS;
  const remainingQuestions = !user ? MAX_VISITOR_QUESTIONS - visitorQuestionCount : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className={`px-6 py-4 border-b bg-gradient-to-r ${getHeaderGradient()}`}>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              {mode === 'symptoms' ? (
                <HeartPulse className={`w-5 h-5 mr-2 ${getIconColor()}`} />
              ) : mode === 'questions' ? (
                <MessageCircle className={`w-5 h-5 mr-2 ${getIconColor()}`} />
              ) : (
                <Bot className={`w-5 h-5 mr-2 ${getIconColor()}`} />
              )}
              <span>{getDialogTitle()} - Tele{"<"}M3D{">"}</span>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Badge variant="outline" className="ml-2">
                  {user.role === 'admin' ? 'Admin' : user.role === 'doctor' ? 'Médico' : user.role === 'patient' ? 'Paciente' : user.role}
                </Badge>
              )}
              {!user && remainingQuestions !== null && (
                <Badge variant={remainingQuestions <= 3 ? "destructive" : "secondary"} className="text-xs">
                  {remainingQuestions} restantes
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : mode === 'symptoms' ? 'bg-red-100 text-red-600' 
                      : mode === 'questions' ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}>
                    {message.role === 'user' ? <User className="w-4 h-4" /> : mode === 'symptoms' ? <HeartPulse className="w-4 h-4" /> : mode === 'questions' ? <MessageCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex flex-col">
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : getBubbleColor()
                    }`}>
                      {message.role === 'assistant' ? (
                        <FormattedText content={message.content} className="text-sm" />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                    {message.type === 'appointment' && message.metadata && message.role === 'assistant' && user && (
                      <Button
                        size="sm"
                        className="mt-2 w-fit"
                        onClick={() => handleConfirmAppointment(message.metadata)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirmar Agendamento
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground mt-1">
                      {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    mode === 'symptoms' ? 'bg-red-100 text-red-600' : mode === 'questions' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {mode === 'symptoms' ? <HeartPulse className="w-4 h-4" /> : mode === 'questions' ? <MessageCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`rounded-lg p-3 ${getBubbleColor()}`}>
                    <Loader2 className={`w-4 h-4 animate-spin ${getIconColor()}`} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t bg-gray-50">
          {visitorLimitReached ? (
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Limite de perguntas atingido</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Registre-se gratuitamente para continuar usando o assistente sem limites.
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/register">
                  <Button size="sm" className="gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    Criar Conta Grátis
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Fazer Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {messages.length <= 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.label}
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAction(action.message)}
                        disabled={isLoading}
                        className="gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              )}
              <div className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                  placeholder={mode === 'symptoms' ? "Descreva seus sintomas..." : mode === 'questions' ? "Qual sua dúvida?" : "Digite sua pergunta..."}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {!user && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  💡 Para funcionalidades completas, <Link href="/register"><span className="text-blue-600 underline cursor-pointer">registre-se</span></Link> ou <Link href="/login"><span className="text-blue-600 underline cursor-pointer">faça login</span></Link>.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
