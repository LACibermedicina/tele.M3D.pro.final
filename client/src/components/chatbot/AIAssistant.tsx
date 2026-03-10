import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Calendar, Send, Loader2, User, Check, HeartPulse, ClipboardList, Users, Brain, FileText, BarChart3, Stethoscope, Settings, AlertTriangle, LogIn, MessageCircle, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { FormattedText } from "@/components/ui/formatted-text";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const langToSpeechLocale: Record<string, string> = {
  pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', zh: 'zh-CN', gn: 'pt-BR',
};
const langToDateLocale: Record<string, string> = {
  pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', zh: 'zh-CN', gn: 'pt-BR',
};

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
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const speechLocale = langToSpeechLocale[currentLang] || 'pt-BR';
  const dateLocale = langToDateLocale[currentLang] || 'pt-BR';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [visitorQuestionCount, setVisitorQuestionCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = speechLocale;
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
          setInput(finalTranscript);
        } else if (interimTranscript) {
          setInput(interimTranscript);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast({ title: t('assistant.mic_blocked'), description: t('assistant.mic_allow'), variant: 'destructive' });
        }
      };

      recognitionRef.current = recognition;
    }
    if (window.speechSynthesis) synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) try { recognitionRef.current.abort(); } catch {}
      if (synthRef.current) synthRef.current.cancel();
    };
  }, [speechLocale]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current || !ttsEnabled) return;
    synthRef.current.cancel();
    const cleanText = text.replace(/[📅🔑👋⚠️✅🩺📊📋🎯💡🚨⚡🔴🟠🟡🟢🔵]/g, '').replace(/\*\*/g, '').replace(/•/g, '').replace(/\n+/g, '. ').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechLocale;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    const voices = synthRef.current.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(speechLocale)) || voices.find(v => v.lang.startsWith(currentLang));
    if (matchedVoice) utterance.voice = matchedVoice;
    synthRef.current.speak(utterance);
  };

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
      return t('assistant.greeting_visitor');
    }

    const name = user.name.split(' ')[0];
    
    if (user.role === 'admin') {
      return t('assistant.greeting_admin', { name });
    }

    if (user.role === 'doctor') {
      return t('assistant.greeting_doctor', { name });
    }

    if (user.role === 'patient') {
      if (mode === 'symptoms') {
        return t('assistant.greeting_symptoms', { name });
      }
      return t('assistant.greeting_patient', { name });
    }

    return t('assistant.greeting_generic', { name });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!user && visitorQuestionCount >= MAX_VISITOR_QUESTIONS) {
      toast({
        title: t('assistant.limit_reached'),
        description: t('assistant.limit_desc'),
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
      
      const body: any = { message: input, language: currentLang };
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
        content: data.response || data.message?.content || t('assistant.how_help'),
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
        content: t('assistant.error_processing'),
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: t('common.error'),
        description: t('assistant.error_desc'),
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
      content: t('assistant.slot_found', {
        date: new Date(appointment.date).toLocaleDateString(dateLocale),
        time: appointment.time,
        type: appointment.type,
      }),
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
        content: t('assistant.appointment_confirmed'),
        timestamp: new Date(),
        type: 'text'
      };

      setMessages(prev => [...prev, confirmMessage]);

      toast({
        title: t('common.success'),
        description: t('assistant.appointment_success'),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('assistant.appointment_error');
      toast({
        title: t('common.error'),
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  const quickActions = user?.role === 'patient' ? [
    { label: t('assistant.qa_triage'), icon: HeartPulse, message: t('assistant.qa_triage_msg') },
    { label: t('assistant.qa_schedule'), icon: Calendar, message: t('assistant.qa_schedule_msg') },
    { label: t('assistant.qa_my_appointments'), icon: ClipboardList, message: t('assistant.qa_my_appointments_msg') },
  ] : user?.role === 'doctor' ? [
    { label: t('assistant.qa_patients_today'), icon: Users, message: t('assistant.qa_patients_today_msg') },
    { label: t('assistant.qa_clinical'), icon: Brain, message: t('assistant.qa_clinical_msg') },
    { label: t('assistant.qa_protocols'), icon: FileText, message: t('assistant.qa_protocols_msg') },
  ] : user?.role === 'admin' ? [
    { label: t('assistant.qa_stats'), icon: BarChart3, message: t('assistant.qa_stats_msg') },
    { label: t('assistant.qa_waiting'), icon: Users, message: t('assistant.qa_waiting_msg') },
    { label: t('assistant.qa_today'), icon: Calendar, message: t('assistant.qa_today_msg') },
  ] : [
    { label: t('assistant.qa_schedule'), icon: Calendar, message: t('assistant.qa_schedule_msg') },
    { label: t('assistant.qa_temp_access'), icon: LogIn, message: t('assistant.qa_temp_access_msg') },
  ];

  const getDialogTitle = () => {
    if (mode === 'symptoms') return t('assistant.title_symptoms');
    if (mode === 'questions') return t('assistant.title_questions');
    return t('assistant.title_default');
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
                  {t(`user.role_${user.role}`)}
                </Badge>
              )}
              {!user && remainingQuestions !== null && (
                <Badge variant={remainingQuestions <= 3 ? "destructive" : "secondary"} className="text-xs">
                  {t('assistant.remaining', { count: remainingQuestions })}
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
                        {t('assistant.confirm_appointment')}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground mt-1">
                      {message.timestamp.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
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
                <span className="font-medium">{t('assistant.limit_reached')}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('assistant.register_to_continue')}
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/register">
                  <Button size="sm" className="gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    {t('assistant.create_free_account')}
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    {t('ui.login_button')}
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
                  placeholder={mode === 'symptoms' ? t('assistant.placeholder_symptoms') : mode === 'questions' ? t('assistant.placeholder_questions') : t('assistant.placeholder_default')}
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
                  {t('assistant.full_access_hint')}
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
