import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { TriageBadge } from "@/components/triage/triage-badge";
import { TriageHelpDialog } from "@/components/triage/triage-help-dialog";

function PatientDetailsPanel({ patient, onClose }: { patient: any; onClose: () => void }) {
  const { data: consultationRequests, isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: [`/api/consultation-requests?patientId=${patient.id}`],
  });

  const { data: medicalRecords, isLoading: loadingRecords } = useQuery<any[]>({
    queryKey: [`/api/medical-records/${patient.id}`],
  });

  const { data: prescriptions, isLoading: loadingRx } = useQuery<any[]>({
    queryKey: [`/api/patients/${patient.id}/prescriptions`],
  });

  const { data: whatsappMessages } = useQuery<any[]>({
    queryKey: ['/api/whatsapp/messages', patient.id],
  });

  const patientRequests = Array.isArray(consultationRequests) ? consultationRequests : [];
  const records = Array.isArray(medicalRecords) ? medicalRecords : [];
  const rxList = Array.isArray(prescriptions) ? prescriptions : [];
  const msgList = Array.isArray(whatsappMessages) ? whatsappMessages : [];

  const totalMessages = msgList.length;
  const patientMessages = msgList.filter((m: any) => m.senderRole === 'patient' || m.direction === 'inbound').length;
  const doctorMessages = msgList.filter((m: any) => m.senderRole === 'doctor' || m.direction === 'doctor_to_patient').length;
  const aiMessages = msgList.filter((m: any) => m.isFromAI || m.senderRole === 'ai').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-lg">Detalhes do Paciente</h3>
        <div className="flex items-center gap-1">
          <TriageHelpDialog trigger={
            <Button variant="ghost" size="sm" title="Guia de Triagem">
              <i className="fas fa-question-circle text-muted-foreground"></i>
            </Button>
          } />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <i className="fas fa-times"></i>
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-primary text-xl"></i>
            </div>
            <div>
              <h4 className="font-semibold text-lg">{patient.name}</h4>
              <p className="text-sm text-muted-foreground">{patient.whatsappNumber || patient.phone}</p>
              {patient.email && <p className="text-xs text-muted-foreground">{patient.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {patient.bloodType && (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
                <i className="fas fa-tint text-red-500 text-sm"></i>
                <p className="text-xs text-muted-foreground mt-1">Tipo Sanguíneo</p>
                <p className="font-semibold text-sm">{patient.bloodType}</p>
              </div>
            )}
            {patient.allergies && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-2 text-center">
                <i className="fas fa-exclamation-triangle text-yellow-500 text-sm"></i>
                <p className="text-xs text-muted-foreground mt-1">Alergias</p>
                <p className="font-semibold text-sm truncate" title={patient.allergies}>{patient.allergies}</p>
              </div>
            )}
            {patient.healthStatus && (
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center">
                <i className="fas fa-heartbeat text-green-500 text-sm"></i>
                <p className="text-xs text-muted-foreground mt-1">Status</p>
                <p className="font-semibold text-sm">{patient.healthStatus}</p>
              </div>
            )}
            {patient.dateOfBirth && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
                <i className="fas fa-calendar text-blue-500 text-sm"></i>
                <p className="text-xs text-muted-foreground mt-1">Nascimento</p>
                <p className="font-semibold text-sm">{format(new Date(patient.dateOfBirth), 'dd/MM/yyyy')}</p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center space-x-2 mb-3">
              <i className="fas fa-chart-bar text-primary text-sm"></i>
              <h5 className="font-semibold text-sm">Resumo da Conversa</h5>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold">{totalMessages}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-gray-600">{patientMessages}</p>
                <p className="text-xs text-muted-foreground">Paciente</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-blue-600">{doctorMessages}</p>
                <p className="text-xs text-muted-foreground">Doutor(a)</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold text-purple-600">{aiMessages}</p>
                <p className="text-xs text-muted-foreground">IA</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-clipboard-list text-orange-500 text-sm"></i>
                <h5 className="font-semibold text-sm">Solicitações de Consulta</h5>
              </div>
              <Badge variant="outline" className="text-xs">{patientRequests.length}</Badge>
            </div>
            {loadingRequests ? (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                <span>Carregando...</span>
              </div>
            ) : patientRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma solicitação registrada</p>
            ) : (
              <div className="space-y-2">
                {patientRequests.slice(0, 5).map((req: any) => (
                  <div key={req.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <TriageBadge level={req.urgencyLevel || req.aiTriageLevel || 'standard'} size="sm" />
                      <Badge variant={
                        req.status === 'accepted' ? 'default' :
                        req.status === 'pending' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {req.status === 'accepted' ? 'Aceita' :
                         req.status === 'pending' ? 'Pendente' :
                         req.status === 'declined' ? 'Recusada' : req.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{req.symptoms}</p>
                    {req.clinicalPresentation && (
                      <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                        <i className="fas fa-robot text-purple-400 mr-1"></i>
                        {req.clinicalPresentation}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(req.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-file-medical text-green-500 text-sm"></i>
                <h5 className="font-semibold text-sm">Prontuários</h5>
              </div>
              <Badge variant="outline" className="text-xs">{records.length}</Badge>
            </div>
            {loadingRecords ? (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                <span>Carregando...</span>
              </div>
            ) : records.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum prontuário registrado</p>
            ) : (
              <div className="space-y-2">
                {records.slice(0, 5).map((record: any) => (
                  <div key={record.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">{record.diagnosis || 'Consulta'}</span>
                      <span className="text-xs text-muted-foreground">
                        {record.createdAt ? format(new Date(record.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : ''}
                      </span>
                    </div>
                    {record.symptoms && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <strong>Queixa:</strong> {record.symptoms}
                      </p>
                    )}
                    {record.treatment && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <strong>Tratamento:</strong> {record.treatment}
                      </p>
                    )}
                    {record.prescription && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <strong>Prescrição:</strong> {record.prescription}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <i className="fas fa-pills text-blue-500 text-sm"></i>
                <h5 className="font-semibold text-sm">Prescrições</h5>
              </div>
              <Badge variant="outline" className="text-xs">{rxList.length}</Badge>
            </div>
            {loadingRx ? (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                <span>Carregando...</span>
              </div>
            ) : rxList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma prescrição registrada</p>
            ) : (
              <div className="space-y-2">
                {rxList.slice(0, 5).map((rx: any) => (
                  <div key={rx.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={rx.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {rx.status === 'active' ? 'Ativa' : rx.status === 'expired' ? 'Expirada' : rx.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {rx.createdAt ? format(new Date(rx.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : ''}
                      </span>
                    </div>
                    {rx.prescriptionText && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{rx.prescriptionText}</p>
                    )}
                    {rx.items && rx.items.length > 0 && (
                      <div className="mt-1">
                        {rx.items.slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            <i className="fas fa-capsules text-blue-400 mr-1"></i>
                            {item.medicationName || item.name} {item.dosage ? `- ${item.dosage}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function WhatsApp() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { messages: wsMessages } = useWebSocket();

  const { data: patients } = useQuery({
    queryKey: ['/api/patients'],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedPatientId],
    enabled: !!selectedPatientId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { to: string; message: string }) => 
      apiRequest('POST', '/api/whatsapp/send', data),
    onSuccess: () => {
      if (selectedPatientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedPatientId] });
      }
      setNewMessage("");
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const whatsappMessages = wsMessages.filter(msg => msg.type === 'whatsapp_message');
    if (whatsappMessages.length > 0) {
      whatsappMessages.forEach(wsMsg => {
        const patientId = wsMsg.data?.patientId;
        if (patientId) {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', patientId] });
        }
      });
    }
  }, [wsMessages, queryClient]);

  const patientsList = Array.isArray(patients) ? patients : [];
  const selectedPatient = patientsList.find((p: any) => p.id === selectedPatientId);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedPatient) return;

    sendMessageMutation.mutate({
      to: selectedPatient.whatsappNumber || selectedPatient.phone,
      message: newMessage.trim(),
    });
  };

  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setShowDetails(false);
  };

  const patientsWithMessages = patientsList.filter((p: any) => p.whatsappNumber || p.phone);

  const chatColSpan = showDetails ? 'lg:col-span-2' : 'lg:col-span-3';

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">WhatsApp IA</h1>
          <p className="text-muted-foreground">Central de mensagens inteligente com agendamento automático</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">WhatsApp Business Conectado</span>
          </div>
          <Badge variant="secondary" className="ai-indicator text-white">
            <i className="fas fa-robot mr-1"></i>
            IA Ativa
          </Badge>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showDetails ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6 h-[700px]`}>
        {/* Patient List */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Conversas</span>
                <Badge variant="outline" data-testid="badge-conversation-count">
                  {patientsWithMessages.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {patientsWithMessages.length === 0 ? (
                  <div className="p-6 text-center">
                    <i className="fab fa-whatsapp text-4xl text-muted-foreground mb-3"></i>
                    <p className="text-sm text-muted-foreground">
                      Nenhum paciente com WhatsApp cadastrado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {patientsWithMessages.map((patient: any) => (
                      <div
                        key={patient.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${
                          selectedPatientId === patient.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => handleSelectPatient(patient.id)}
                        data-testid={`patient-conversation-${patient.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-primary text-sm"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" data-testid={`patient-name-${patient.id}`}>
                              {patient.name}
                            </p>
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <i className="fab fa-whatsapp text-green-600"></i>
                              <span data-testid={`patient-phone-${patient.id}`}>
                                {patient.whatsappNumber || patient.phone}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Message Area */}
        <div className={chatColSpan}>
          {!selectedPatient ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <div className="text-center">
                  <i className="fab fa-whatsapp text-6xl text-muted-foreground mb-4"></i>
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    Selecione uma conversa
                  </h3>
                  <p className="text-muted-foreground">
                    Escolha um paciente para iniciar ou continuar a conversa
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b border-border py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-primary"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid="selected-patient-name">
                        {selectedPatient.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <i className="fab fa-whatsapp text-green-600"></i>
                        <span data-testid="selected-patient-phone">
                          {selectedPatient.whatsappNumber || selectedPatient.phone}
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Online</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={showDetails ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    data-testid="button-patient-details"
                  >
                    <i className={`fas ${showDetails ? 'fa-times' : 'fa-info-circle'} mr-2`}></i>
                    {showDetails ? 'Fechar' : 'Detalhes'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-[450px]">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !Array.isArray(messages) || messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <i className="fas fa-comments text-4xl text-muted-foreground mb-3"></i>
                        <p className="text-muted-foreground">Ainda não há mensagens</p>
                        <p className="text-sm text-muted-foreground">Inicie uma conversa digitando abaixo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {messages.map((message: any) => {
                        const isDoctor = message.senderRole === 'doctor' || message.direction === 'doctor_to_patient';
                        const isAI = message.isFromAI || message.senderRole === 'ai';
                        const patientNumber = selectedPatient.whatsappNumber || selectedPatient.phone;
                        const isFromPatient = message.senderRole === 'patient' || message.direction === 'inbound' || message.fromNumber === patientNumber;
                        const isOutgoing = isDoctor || (!isAI && !isFromPatient);
                        
                        return (
                        <div
                          key={message.id}
                          className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                          data-testid={`message-${message.id}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isAI
                                ? 'message-bubble-ai border border-border'
                                : isFromPatient
                                ? 'bg-muted'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {isAI && (
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="ai-indicator w-4 h-4 rounded-full flex items-center justify-center">
                                  <i className="fas fa-robot text-white text-xs"></i>
                                </div>
                                <span className="text-xs font-medium text-secondary">IA MedPro</span>
                              </div>
                            )}
                            {isDoctor && !isAI && (
                              <div className="flex items-center space-x-1 mb-1">
                                <i className="fas fa-user-md text-xs text-blue-200"></i>
                                <span className="text-xs font-medium text-blue-200">Doutor(a)</span>
                              </div>
                            )}
                            {isFromPatient && (
                              <div className="flex items-center space-x-1 mb-1">
                                <i className="fas fa-user text-xs text-muted-foreground"></i>
                                <span className="text-xs font-medium text-muted-foreground">Paciente</span>
                              </div>
                            )}
                            <p className="text-sm" data-testid={`message-text-${message.id}`}>
                              {message.message}
                            </p>
                            <p className={`text-xs mt-1 ${
                              isOutgoing ? 'text-white/80' : 'text-muted-foreground'
                            }`}>
                              {format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })}
                              {isDoctor && (
                                <span className="ml-1">
                                  <i className="fas fa-check text-xs"></i>
                                </span>
                              )}
                            </p>
                            {message.appointmentScheduled && (
                              <div className="mt-2 pt-2 border-t border-muted">
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                  <i className="fas fa-check mr-1"></i>
                                  Consulta agendada automaticamente
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <div className="border-t border-border p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Escreva uma mensagem para o paciente..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                    data-testid="input-new-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-paper-plane mr-2"></i>
                    )}
                    Enviar
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <i className="fas fa-user-md text-blue-500"></i>
                    <span>Enviando como Doutor(a)</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <i className="fas fa-info-circle"></i>
                    <span>Mensagens do paciente são processadas pela IA automaticamente</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Details Panel */}
        {showDetails && selectedPatient && (
          <div className="lg:col-span-2">
            <Card className="h-full">
              <PatientDetailsPanel
                patient={selectedPatient}
                onClose={() => setShowDetails(false)}
              />
            </Card>
          </div>
        )}
      </div>
      </div>
    </PageWrapper>
  );
}
