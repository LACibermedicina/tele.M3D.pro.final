import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MessageSquare, User, FileText, Video, Send, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { format } from "date-fns";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

interface ChatThread {
  id: string;
  patientId: string;
  doctorId: string;
  messages: ChatMessage[];
  lastMessageAt: string;
  status: string;
  patient: Patient;
  consultationRequest: ConsultationRequest;
}

interface ChatMessage {
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  allergies?: string;
  bloodType?: string;
}

interface ConsultationRequest {
  id: string;
  symptoms: string;
  urgencyLevel: string;
  status: string;
}

interface PatientHistory {
  patient: Patient;
  medicalRecords: any[];
  appointments: any[];
}

export default function DoctorChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [message, setMessage] = useState("");
  const [patientHistory, setPatientHistory] = useState<PatientHistory | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat threads
  const { data: threads = [], isLoading, refetch } = useQuery<ChatThread[]>({
    queryKey: ['/api/chat/doctor/threads'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads.length > 0 && !selectedThread) {
      setSelectedThread(threads[0]);
    }
  }, [threads, selectedThread]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedThread?.messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { threadId: string; content: string }) => {
      const res = await apiRequest('POST', `/api/chat/threads/${data.threadId}/messages`, {
        content: data.content
      });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/chat/doctor/threads'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    },
  });

  // Start consultation mutation
  const startConsultationMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest('POST', `/api/chat/start-consultation/${requestId}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Consulta Iniciada",
        description: "Redirecionando para sala de consulta...",
      });
      setTimeout(() => {
        setLocation(data.redirectUrl);
      }, 1000);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao iniciar consulta",
        variant: "destructive",
      });
    },
  });

  // Fetch patient history
  const fetchPatientHistory = async (patientId: string) => {
    try {
      const res = await fetch(`/api/chat/patient/${patientId}/history`, {
        credentials: 'include'
      });
      const data = await res.json();
      setPatientHistory(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao buscar histórico do paciente",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = () => {
    if (!selectedThread || !message.trim()) return;

    sendMessageMutation.mutate({
      threadId: selectedThread.id,
      content: message
    });
  };

  const handleStartConsultation = () => {
    if (!selectedThread) return;
    startConsultationMutation.mutate(selectedThread.consultationRequest.id);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'immediate': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'emergency': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (!user || user.role !== 'doctor') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Acesso restrito a médicos
              </p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-3 sm:p-6 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Chat com Pacientes</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Converse com pacientes que solicitaram atendimento
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 min-h-[500px] lg:h-[calc(100vh-200px)]">
        {/* Threads List */}
        <Card className="lg:col-span-1">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Solicitações de Atendimento</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Pacientes aguardando resposta</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64 lg:h-[calc(100vh-320px)]">
              {isLoading ? (
                <div className="p-3 sm:p-4 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : threads.length === 0 ? (
                <div className="p-3 sm:p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma solicitação pendente</p>
                </div>
              ) : (
                <div className="space-y-2 p-2 sm:p-3">
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedThread?.id === thread.id
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'hover:bg-muted border-2 border-transparent'
                      }`}
                      data-testid={`thread-${thread.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar>
                            <AvatarImage src={thread.patient.photoUrl || undefined} />
                            <AvatarFallback>
                              {thread.patient.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {thread.consultationRequest.status === 'pending' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white animate-pulse" title="Solicitando atendimento" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{thread.patient.name}</p>
                            <Badge className={getUrgencyColor(thread.consultationRequest.urgencyLevel)}>
                              {thread.consultationRequest.urgencyLevel}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {thread.messages.length > 0
                              ? thread.messages[thread.messages.length - 1].content
                              : thread.consultationRequest.symptoms}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2">
          {selectedThread ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedThread.patient.photoUrl || undefined} />
                      <AvatarFallback>
                        {selectedThread.patient.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{selectedThread.patient.name}</CardTitle>
                        {selectedThread.consultationRequest.status === 'pending' && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            <div className="w-2 h-2 rounded-full bg-orange-500 mr-1.5 animate-pulse" />
                            Solicitando Atendimento
                          </Badge>
                        )}
                        {selectedThread.consultationRequest.status === 'accepted' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                            Em Atendimento
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {selectedThread.patient.phone || selectedThread.patient.email}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchPatientHistory(selectedThread.patient.id)}
                          data-testid="button-view-history"
                        >
                          <History className="h-4 w-4 mr-2" />
                          Histórico
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Histórico Clínico - {selectedThread.patient.name}</DialogTitle>
                          <DialogDescription>
                            Informações médicas e consultas anteriores
                          </DialogDescription>
                        </DialogHeader>
                        {patientHistory && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-semibold mb-2">Informações Básicas</h3>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {patientHistory.patient.bloodType && (
                                  <p><strong>Tipo Sanguíneo:</strong> {patientHistory.patient.bloodType}</p>
                                )}
                                {patientHistory.patient.allergies && (
                                  <p><strong>Alergias:</strong> {patientHistory.patient.allergies}</p>
                                )}
                              </div>
                            </div>
                            
                            <div>
                              <h3 className="font-semibold mb-2">Prontuários Médicos ({patientHistory.medicalRecords.length})</h3>
                              {patientHistory.medicalRecords.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum prontuário registrado</p>
                              ) : (
                                <div className="space-y-2">
                                  {patientHistory.medicalRecords.slice(0, 5).map((record: any) => (
                                    <div key={record.id} className="border rounded p-3 text-sm">
                                      <p><strong>Diagnóstico:</strong> {record.diagnosis}</p>
                                      <p className="text-muted-foreground">
                                        {format(new Date(record.createdAt), 'dd/MM/yyyy')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <h3 className="font-semibold mb-2">Consultas Anteriores ({patientHistory.appointments.length})</h3>
                              {patientHistory.appointments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhuma consulta registrada</p>
                              ) : (
                                <div className="space-y-2">
                                  {patientHistory.appointments.slice(0, 5).map((apt: any) => (
                                    <div key={apt.id} className="border rounded p-3 text-sm">
                                      <p><strong>Tipo:</strong> {apt.type}</p>
                                      <p className="text-muted-foreground">
                                        {format(new Date(apt.scheduledAt), 'dd/MM/yyyy HH:mm')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {selectedThread.consultationRequest.status === 'pending' && (
                      <Button
                        onClick={handleStartConsultation}
                        disabled={startConsultationMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                        data-testid="button-start-consultation"
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Atender Paciente
                      </Button>
                    )}
                    {selectedThread.consultationRequest.status === 'accepted' && (
                      <Button
                        onClick={handleStartConsultation}
                        disabled={startConsultationMutation.isPending}
                        data-testid="button-start-consultation"
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Iniciar Vídeo Consulta
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-480px)] p-4">
                  <div className="space-y-4">
                    {/* Consultation Request Info */}
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm font-semibold mb-2">Motivo da Consulta:</p>
                      <p className="text-sm">{selectedThread.consultationRequest.symptoms}</p>
                      <Badge className={`mt-2 ${getUrgencyColor(selectedThread.consultationRequest.urgencyLevel)}`}>
                        Urgência: {selectedThread.consultationRequest.urgencyLevel}
                      </Badge>
                    </div>

                    {/* Messages */}
                    {selectedThread.messages.map((msg, index) => {
                      const isDoctor = msg.senderId === user.id;
                      return (
                        <div
                          key={index}
                          className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isDoctor
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm font-semibold mb-1">{msg.senderName}</p>
                            <p className="text-sm">{msg.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {format(new Date(msg.timestamp), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={2}
                      data-testid="textarea-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa para começar</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
    </PageWrapper>
  );
}
