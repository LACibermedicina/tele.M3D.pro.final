import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, X, Send, Brain, Calendar, Stethoscope, Minimize2, Maximize2, ClipboardList, Users, Activity, FileText, HeartPulse, BarChart3, Mic, MicOff, Volume2, VolumeX, AudioLines } from 'lucide-react';

interface SuggestedAppointment {
  dateIso: string;
  time: string;
  doctorId: string;
  doctorName: string;
  type?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  metadata?: {
    isSchedulingRequest?: boolean;
    isClinicalQuestion?: boolean;
    diagnosticHypotheses?: Array<{
      condition: string;
      probability: number;
      reasoning: string;
    }>;
    suggestedAction?: string;
    suggestedAppointment?: SuggestedAppointment;
    interviewId?: string;
    interviewStage?: string;
    urgencyLevel?: 'low' | 'medium' | 'high' | 'emergency';
    isComplete?: boolean;
    urgentFlag?: boolean;
  };
}

interface ChatbotResponse {
  response: string;
  isSchedulingRequest?: boolean;
  isClinicalQuestion?: boolean;
  diagnosticHypotheses?: Array<{
    condition: string;
    probability: number;
    reasoning: string;
  }>;
  suggestedAction?: string;
  suggestedAppointment?: SuggestedAppointment;
  interviewId?: string;
  interviewStage?: string;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'emergency';
  isComplete?: boolean;
  urgentFlag?: boolean;
}

export default function FloatingChatbot() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [activeInterviewId, setActiveInterviewId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voice_assistant_preference');
      return saved === 'enabled';
    }
    return false;
  });
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voice_assistant_preference');
      return saved === 'enabled';
    }
    return false;
  });
  const [showVoicePrompt, setShowVoicePrompt] = useState(false);
  const [voicePromptShown, setVoicePromptShown] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('voice_assistant_preference') !== null;
    }
    return false;
  });
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setCurrentMessage(finalTranscript);
        } else if (interimTranscript) {
          setCurrentMessage(interimTranscript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast({
            title: 'Microfone bloqueado',
            description: 'Permita o acesso ao microfone nas configurações do navegador.',
            variant: 'destructive',
          });
        }
      };

      recognitionRef.current = recognition;
    }

    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      setVoiceEnabled(true);
      setVoicePromptShown(true);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && !user && !voicePromptShown) {
      setShowVoicePrompt(true);
    }
  }, [isOpen, user, voicePromptShown]);

  const handleVoicePreference = (enabled: boolean) => {
    setVoiceEnabled(enabled);
    setTtsEnabled(enabled);
    setVoicePromptShown(true);
    setShowVoicePrompt(false);
    localStorage.setItem('voice_assistant_preference', enabled ? 'enabled' : 'disabled');
    if (!enabled && synthRef.current) {
      synthRef.current.cancel();
    }
  };

  const isVoiceActive = user ? true : voiceEnabled;

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setCurrentMessage('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current || !ttsEnabled || !isVoiceActive) return;
    synthRef.current.cancel();
    const cleanText = text
      .replace(/[📅🔑👋⚠️✅🩺📊📋🎯💡🚨⚡🔴🟠🟡🟢🔵]/g, '')
      .replace(/\*\*/g, '')
      .replace(/•/g, '')
      .replace(/\n+/g, '. ')
      .trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt-BR')) || voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    synthRef.current.speak(utterance);
  };

  const getWelcomeMessage = () => {
    if (!user) {
      return '👋 Olá! Sou o assistente virtual da Tele<M3D>. Posso ajudá-lo com:\n\n📅 Agendar uma consulta médica\n🔑 Solicitar acesso temporário para conhecer a plataforma\n\nPara acesso completo, faça login ou registre-se!';
    }
    return t('chatbot.welcome_message');
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: getWelcomeMessage(),
      timestamp: new Date(),
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mutation for confirming appointment
  const confirmAppointmentMutation = useMutation({
    mutationFn: async (appointment: SuggestedAppointment) => {
      const res = await apiRequest('POST', '/api/chatbot/confirm-appointment', appointment);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Consulta Confirmada!",
        description: `Sua consulta com Dr(a). ${data.appointment.doctorName} foi agendada com sucesso.`,
      });
      
      // Add confirmation message to chat
      const confirmMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: `✅ Perfeito! Sua consulta foi confirmada para ${new Date(data.appointment.scheduledAt).toLocaleDateString('pt-BR')} às ${new Date(data.appointment.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} com Dr(a). ${data.appointment.doctorName}.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmMessage]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao Confirmar",
        description: error.message || "Não foi possível confirmar o agendamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Enhanced AI Chat mutation using unified chatbot endpoint
  const chatMutation = useMutation({
    mutationFn: async (message: string): Promise<ChatbotResponse> => {
      // Use different endpoints based on authentication status
      const endpoint = user ? '/api/chatbot/message' : '/api/chatbot/visitor-message';
      
      const res = await apiRequest('POST', endpoint, {
        message
      });
      
      const data = await res.json();
      
      // For authenticated users, parse full metadata
      if (user) {
        return {
          response: data.message?.content || data.response || 'Como posso ajudá-lo hoje?',
          isSchedulingRequest: data.type === 'appointment',
          isClinicalQuestion: data.type === 'clinical',
          suggestedAction: data.metadata?.actionType || (data.metadata?.suggestedAppointment ? 'schedule' : undefined),
          suggestedAppointment: data.metadata?.suggestedAppointment,
          diagnosticHypotheses: data.metadata?.diagnosticHypotheses,
          interviewId: data.metadata?.interviewId,
          interviewStage: data.metadata?.interviewStage,
          urgencyLevel: data.metadata?.urgencyLevel,
          isComplete: data.metadata?.isComplete,
          urgentFlag: data.metadata?.urgentFlag || data.metadata?.actionType === 'urgent_consultation'
        };
      } else {
        // For visitors, simpler response structure (no advanced features)
        return {
          response: data.response || 'Como posso ajudá-lo hoje?',
        };
      }
    },
    onSuccess: (data) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        metadata: {
          isSchedulingRequest: data.isSchedulingRequest,
          isClinicalQuestion: data.isClinicalQuestion,
          diagnosticHypotheses: data.diagnosticHypotheses,
          suggestedAction: data.suggestedAction,
          suggestedAppointment: data.suggestedAppointment,
          interviewId: data.interviewId,
          interviewStage: data.interviewStage,
          urgencyLevel: data.urgencyLevel,
          isComplete: data.isComplete,
          urgentFlag: data.urgentFlag
        }
      };
      
      // Handle interview completion
      if (data.isComplete) {
        setActiveInterviewId(null);
      }
      
      // Show urgent warning if needed
      if (data.urgentFlag) {
        toast({
          title: "🚨 Atenção - Emergência Médica",
          description: "Baseado nos sintomas, recomendamos atendimento médico urgente!",
          variant: "destructive"
        });
      }
      
      setMessages(prev => [...prev, aiMessage]);
      speakText(data.response);
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: t('chatbot.error_message'),
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: t('chatbot.error_title'),
        description: t('chatbot.error_description'),
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!currentMessage.trim() || chatMutation.isPending) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send to AI
    chatMutation.mutate(currentMessage);
    setCurrentMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'ai',
        content: getWelcomeMessage(),
        timestamp: new Date(),
      }
    ]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageIcon = (metadata?: ChatMessage['metadata']) => {
    if (metadata?.urgentFlag) return <span className="text-red-500">🚨</span>;
    if (metadata?.urgencyLevel === 'emergency') return <span className="text-red-600">⚡</span>;
    if (metadata?.urgencyLevel === 'high') return <span className="text-orange-500">⚠️</span>;
    if (metadata?.isClinicalQuestion) return <Stethoscope className="w-4 h-4" />;
    if (metadata?.isSchedulingRequest) return <Calendar className="w-4 h-4" />;
    if (metadata?.diagnosticHypotheses?.length) return <Brain className="w-4 h-4" />;
    return null;
  };

  const getUrgencyColor = (urgencyLevel?: string) => {
    switch (urgencyLevel) {
      case 'emergency': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getInterviewProgress = () => {
    const lastMessage = messages[messages.length - 1];
    const metadata = lastMessage?.metadata;
    if (!metadata?.interviewStage) return null;
    
    const stages = ['initial', 'duration', 'intensity', 'quality', 'factors', 'history', 'analysis'];
    const currentIndex = stages.indexOf(metadata.interviewStage);
    const progress = ((currentIndex + 1) / stages.length) * 100;
    
    return {
      stage: metadata.interviewStage,
      progress: Math.min(progress, 100),
      urgency: metadata.urgencyLevel
    };
  };

  const voicePromptDialog = (
    <Dialog open={showVoicePrompt} onOpenChange={setShowVoicePrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AudioLines className="w-5 h-5 text-primary" />
            Assistente de Voz
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            Deseja ativar o assistente de voz? Com ele, você pode falar com o assistente usando o microfone e ouvir as respostas em áudio.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={() => handleVoicePreference(true)}
            className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white"
          >
            <Volume2 className="w-4 h-4 mr-2" />
            Sim, ativar voz
          </Button>
          <Button
            variant="outline"
            onClick={() => handleVoicePreference(false)}
            className="w-full"
          >
            <VolumeX className="w-4 h-4 mr-2" />
            Não, apenas texto
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Você pode alterar essa preferência a qualquer momento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!isOpen) {
    return (
      <>
        {voicePromptDialog}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            size="sm"
            className="rounded-full w-10 h-10 p-0 hover:scale-105 transition-transform bg-gradient-to-br from-primary/90 to-medical-primary/90 hover:from-primary hover:to-medical-primary border-2 border-gray-800 dark:border-gray-700 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            data-testid="button-open-chatbot"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
    {voicePromptDialog}
    <div className="fixed bottom-20 right-6 z-50">
      <Card className={`w-96 shadow-xl border-2 border-white/20 dark:border-gray-700 backdrop-blur-sm ${isMinimized ? 'h-16' : 'h-[500px]'} transition-all duration-300`}>
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary to-medical-primary text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-medium">
                Assistente Virtual IA - Tele{"<"}M3D{">"}
              </CardTitle>
            </div>
            <div className="flex items-center space-x-1">
              {isVoiceActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTtsEnabled(!ttsEnabled);
                    if (ttsEnabled && synthRef.current) synthRef.current.cancel();
                  }}
                  className="text-white hover:bg-white/20 w-8 h-8 p-0"
                  title={ttsEnabled ? 'Desativar voz' : 'Ativar voz'}
                  data-testid="button-toggle-tts"
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 w-8 h-8 p-0"
                data-testid="button-minimize-chatbot"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  if (synthRef.current) synthRef.current.cancel();
                }}
                className="text-white hover:bg-white/20 w-8 h-8 p-0"
                data-testid="button-close-chatbot"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[calc(500px-4rem)]">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-3 py-2 ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      data-testid={`message-${message.type}-${message.id}`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.type === 'ai' && getMessageIcon(message.metadata) && (
                          <div className="mt-1">
                            {getMessageIcon(message.metadata)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm">{message.content}</p>
                          
                          {/* Show diagnostic hypotheses if available */}
                          {message.metadata?.diagnosticHypotheses && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs font-medium">{t('chatbot.diagnostic_hypotheses')}:</p>
                              {message.metadata.diagnosticHypotheses.slice(0, 3).map((hypothesis, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                  <span>{hypothesis.condition}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {hypothesis.probability}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Show appointment confirmation button if available */}
                          {message.metadata?.suggestedAppointment && user && user.role === 'patient' && (
                            <div className="mt-3 space-y-2">
                              <div className="p-2 bg-primary/10 rounded-md">
                                <p className="text-xs font-medium mb-1">Agendamento Sugerido:</p>
                                <p className="text-xs">
                                  📅 {new Date(message.metadata.suggestedAppointment.dateIso).toLocaleDateString('pt-BR')}<br/>
                                  ⏰ {message.metadata.suggestedAppointment.time}<br/>
                                  👨‍⚕️ Dr(a). {message.metadata.suggestedAppointment.doctorName}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => confirmAppointmentMutation.mutate(message.metadata!.suggestedAppointment!)}
                                disabled={confirmAppointmentMutation.isPending}
                                data-testid="button-confirm-appointment"
                              >
                                {confirmAppointmentMutation.isPending ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Confirmando...
                                  </>
                                ) : (
                                  <>
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Confirmar Agendamento
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          
                          <p className="text-xs opacity-70 mt-1">
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 max-w-xs">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-sm text-muted-foreground">
                          {t('chatbot.typing')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-3">
              <div className="flex space-x-1.5">
                {voiceSupported && isVoiceActive && (
                  <Button
                    onClick={toggleListening}
                    size="sm"
                    variant={isListening ? "default" : "outline"}
                    className={`shrink-0 ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : ''}`}
                    data-testid="button-voice-input"
                    title={isListening ? 'Parar gravação' : 'Falar com o assistente'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                )}
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isListening ? 'Ouvindo...' : t('chatbot.input_placeholder')}
                  disabled={chatMutation.isPending}
                  className={`flex-1 ${isListening ? 'border-red-300 bg-red-50/50' : ''}`}
                  data-testid="input-chatbot-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || chatMutation.isPending}
                  size="sm"
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {isListening && (
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-4 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    <span className="w-1 h-5 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                    <span className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '250ms' }} />
                  </div>
                  <span className="text-xs text-red-600 font-medium">Ouvindo... fale agora</span>
                </div>
              )}
              
              {/* Quick Actions */}
              {/* Clinical Interview Progress */}
              {activeInterviewId && getInterviewProgress() && (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Entrevista Clínica</span>
                    <span className={`px-2 py-1 rounded text-white text-xs ${getUrgencyColor(getInterviewProgress()?.urgency)}`}>
                      {getInterviewProgress()?.urgency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getUrgencyColor(getInterviewProgress()?.urgency)}`}
                      style={{ width: `${getInterviewProgress()?.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Etapa: {getInterviewProgress()?.stage} ({Math.round(getInterviewProgress()?.progress || 0)}%)
                  </div>
                </div>
              )}
              
              {/* Role-specific Quick Actions */}
              <div className="flex flex-wrap gap-1 mt-2">
                {!user && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Gostaria de agendar uma consulta médica')}
                      className="text-xs"
                      data-testid="button-quick-scheduling"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Agendar Consulta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Gostaria de solicitar um acesso temporário para conhecer a plataforma')}
                      className="text-xs"
                      data-testid="button-request-temp-access"
                    >
                      <Stethoscope className="w-3 h-3 mr-1" />
                      Solicitar Acesso Temporário
                    </Button>
                  </>
                )}
                {user?.role === 'patient' && (
                  <>
                    {!activeInterviewId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMessage('Estou com alguns sintomas e gostaria de uma orientação médica')}
                        className="text-xs"
                        data-testid="button-start-clinical-interview"
                      >
                        <HeartPulse className="w-3 h-3 mr-1" />
                        Triagem
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage(t('chatbot.quick_scheduling'))}
                      className="text-xs"
                      data-testid="button-quick-scheduling-patient"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Agendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Quais são minhas consultas agendadas?')}
                      className="text-xs"
                    >
                      <ClipboardList className="w-3 h-3 mr-1" />
                      Consultas
                    </Button>
                  </>
                )}
                {user?.role === 'doctor' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Quais pacientes tenho agendados para hoje?')}
                      className="text-xs"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Pacientes Hoje
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Preciso de uma segunda opinião sobre um caso clínico')}
                      className="text-xs"
                    >
                      <Brain className="w-3 h-3 mr-1" />
                      Apoio Clínico
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Mostrar protocolos e guidelines médicos disponíveis')}
                      className="text-xs"
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Protocolos
                    </Button>
                  </>
                )}
                {user?.role === 'admin' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Mostre as estatísticas gerais da plataforma')}
                      className="text-xs"
                    >
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Estatísticas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Quantos pacientes estão em espera agora?')}
                      className="text-xs"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Fila de Espera
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentMessage('Ver todas as consultas agendadas de hoje')}
                      className="text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Consultas Hoje
                    </Button>
                  </>
                )}
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearChat();
                      setActiveInterviewId(null);
                    }}
                    className="text-xs"
                    data-testid="button-clear-chat"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
    </>
  );
}