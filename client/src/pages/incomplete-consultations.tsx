import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, Video, VideoOff, FileText, Clock, User, Stethoscope,
  MessageSquare, RefreshCw, CheckCircle, PlusCircle, Users, Send,
  Bell, Phone, Activity, ClipboardList, BookOpen, ChevronRight,
  Brain, BarChart3, Loader2, Search, UserPlus, Wifi, WifiOff,
  ArrowRight, History, NotebookPen, Siren
} from "lucide-react";

type IncompleteConsultation = {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  duration: number;
  meetingNotes: string;
  agoraChannelName: string;
  createdAt: string;
  connectionLogs: any;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
};

type ConsultationNote = {
  id: string;
  consultationId: string;
  userId: string;
  type: string;
  content: string;
  metadata: any;
  timestamp: string;
};

type MedicalRecord = {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  type: string;
  diagnosis: string;
  symptoms: string;
  treatment: string;
  notes: string;
  createdAt: string;
};

type ExamResult = {
  id: string;
  patientId: string;
  examType: string;
  results: any;
  abnormalValues: any;
  rawData: string;
  analyzedByAI: boolean;
  createdAt: string;
};

type OnlineDoctor = {
  id: string;
  name: string;
  specialization: string;
  isOnline: boolean;
  availableForImmediate: boolean;
};

export default function IncompleteConsultations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedConsultation, setSelectedConsultation] = useState<IncompleteConsultation | null>(null);
  const [caseTab, setCaseTab] = useState("overview");
  const [newNote, setNewNote] = useState("");
  const [interConsultDialog, setInterConsultDialog] = useState(false);
  const [offlineNotifyDialog, setOfflineNotifyDialog] = useState(false);
  const [interConsultMessage, setInterConsultMessage] = useState("");
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [offlineMessage, setOfflineMessage] = useState("");

  const { data: incompleteConsultations = [], isLoading } = useQuery<IncompleteConsultation[]>({
    queryKey: ["/api/video-consultations/incomplete"],
    enabled: !!user,
  });

  const { data: consultationNotes = [] } = useQuery<ConsultationNote[]>({
    queryKey: ["/api/video-consultations", selectedConsultation?.id, "notes"],
    enabled: !!selectedConsultation,
  });

  const { data: patientRecords = [] } = useQuery<MedicalRecord[]>({
    queryKey: ["/api/medical-records", selectedConsultation?.patientId],
    enabled: !!selectedConsultation?.patientId,
  });

  const { data: patientExams = [] } = useQuery<ExamResult[]>({
    queryKey: ["/api/exam-results", selectedConsultation?.patientId],
    enabled: !!selectedConsultation?.patientId,
  });

  const { data: videoHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/video-consultations/patient-history", selectedConsultation?.patientId],
    enabled: !!selectedConsultation?.patientId,
  });

  const { data: onlineDoctors = [] } = useQuery<OnlineDoctor[]>({
    queryKey: ["/api/doctors/online"],
    enabled: interConsultDialog,
    refetchInterval: interConsultDialog ? 10000 : false,
  });

  const { data: allDoctors = [] } = useQuery<any[]>({
    queryKey: ["/api/medical-teams/available-doctors"],
    enabled: offlineNotifyDialog,
  });

  const reactivateMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const res = await apiRequest("POST", `/api/video-consultations/${consultationId}/reactivate`);
      return res.json();
    },
    onSuccess: (_, consultationId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-consultations/incomplete"] });
      toast({ title: "Consulta reativada", description: "O paciente foi notificado para retornar." });
      navigate(`/consultation/video/${selectedConsultation?.patientId}`);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível reativar a consulta.", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ consultationId, notes }: { consultationId: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/video-consultations/${consultationId}/complete`, {
        meetingNotes: notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-consultations/incomplete"] });
      setSelectedConsultation(null);
      toast({ title: "Consulta concluída", description: "Prontuário gerado automaticamente." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível concluir a consulta.", variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ consultationId, content }: { consultationId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/video-consultations/${consultationId}/notes`, {
        type: "doctor_note",
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-consultations", selectedConsultation?.id, "notes"] });
      setNewNote("");
      toast({ title: "Anotação salva" });
    },
  });

  const interConsultMutation = useMutation({
    mutationFn: async ({ consultationId, specialistId, message }: { consultationId: string; specialistId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/video-consultations/${consultationId}/request-interconsult`, {
        specialistId,
        message,
        patientId: selectedConsultation?.patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      setInterConsultDialog(false);
      setInterConsultMessage("");
      setSelectedSpecialistId(null);
      toast({ title: "Interconsulta solicitada", description: "O especialista foi notificado." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao solicitar interconsulta.", variant: "destructive" });
    },
  });

  const offlineNotifyMutation = useMutation({
    mutationFn: async ({ doctorIds, message, patientId, consultationId }: {
      doctorIds: string[];
      message: string;
      patientId: string;
      consultationId: string;
    }) => {
      const res = await apiRequest("POST", `/api/video-consultations/${consultationId}/notify-offline-doctors`, {
        doctorIds,
        message,
        patientId,
      });
      return res.json();
    },
    onSuccess: () => {
      setOfflineNotifyDialog(false);
      setOfflineMessage("");
      toast({ title: "Notificações enviadas", description: "Os médicos foram notificados via WhatsApp e sistema." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar notificações.", variant: "destructive" });
    },
  });

  const offlineDoctors = allDoctors.filter(
    (d: any) => !onlineDoctors.some((od) => od.id === d.id) && d.id !== user?.id
  );

  const chatNotes = consultationNotes.filter((n) => n.type === "chat");
  const doctorNotes = consultationNotes.filter((n) => n.type === "doctor_note" || n.type === "annotation");
  const aiNotes = consultationNotes.filter((n) => n.type === "ai_query" || n.type === "ai_response");
  const transcriptions = consultationNotes.filter((n) => n.type === "transcription");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            Consultas Não Concluídas
          </h1>
          <p className="text-muted-foreground mt-1">
            {incompleteConsultations.length} consulta{incompleteConsultations.length !== 1 ? "s" : ""} pendente{incompleteConsultations.length !== 1 ? "s" : ""} de resolução
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/schedule")}>
          <ArrowRight className="h-4 w-4 mr-2" />
          Ir para Agenda
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List of incomplete consultations */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Lista de Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incompleteConsultations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                  <p className="font-medium">Nenhuma consulta pendente</p>
                  <p className="text-sm mt-1">Todas as consultas estão em dia.</p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-3">
                    {incompleteConsultations.map((consultation) => (
                      <div
                        key={consultation.id}
                        onClick={() => setSelectedConsultation(consultation)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          selectedConsultation?.id === consultation.id
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                            : "border-border hover:border-orange-300"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{consultation.patientName}</span>
                          </div>
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inconcluída
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(consultation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          {consultation.duration > 0 && (
                            <div className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              Duração: {Math.ceil(consultation.duration / 60)} min
                            </div>
                          )}
                          {consultation.connectionLogs?.endReason && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {consultation.connectionLogs.endReason}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              reactivateMutation.mutate(consultation.id);
                            }}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retomar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConsultation(consultation);
                            }}
                          >
                            <ClipboardList className="h-3 w-3 mr-1" />
                            Avaliar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Case evaluation dashboard */}
        <div className="lg:col-span-2">
          {!selectedConsultation ? (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Selecione uma consulta</p>
                <p className="text-sm mt-1">Clique em uma consulta pendente para ver o painel de avaliação clínica</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Patient header */}
              <Card className="border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                        <User className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">{selectedConsultation.patientName}</h2>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(selectedConsultation.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {selectedConsultation.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              {Math.ceil(selectedConsultation.duration / 60)} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => reactivateMutation.mutate(selectedConsultation.id)}
                        disabled={reactivateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {reactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                        Retomar Consulta
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInterConsultDialog(true)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Interconsulta
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/consultation/video/${selectedConsultation.patientId}`)}
                      >
                        <PlusCircle className="h-4 w-4 mr-1" />
                        Nova Consulta
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          const allNotes = [
                            selectedConsultation.meetingNotes,
                            ...doctorNotes.map(n => n.content),
                            newNote
                          ].filter(Boolean).join("\n\n");
                          completeMutation.mutate({ consultationId: selectedConsultation.id, notes: allNotes });
                        }}
                        disabled={completeMutation.isPending}
                      >
                        {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                        Concluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Case evaluation tabs */}
              <Tabs value={caseTab} onValueChange={setCaseTab}>
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="overview" className="text-xs">
                    <ClipboardList className="h-3.5 w-3.5 mr-1" />
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">
                    <History className="h-3.5 w-3.5 mr-1" />
                    Histórico
                  </TabsTrigger>
                  <TabsTrigger value="records" className="text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Prontuário
                  </TabsTrigger>
                  <TabsTrigger value="exams" className="text-xs">
                    <Activity className="h-3.5 w-3.5 mr-1" />
                    Exames
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs">
                    <NotebookPen className="h-3.5 w-3.5 mr-1" />
                    Anotações
                  </TabsTrigger>
                  <TabsTrigger value="epidemiology" className="text-xs">
                    <BarChart3 className="h-3.5 w-3.5 mr-1" />
                    Epidemio
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Collected data overview */}
                <TabsContent value="overview">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Dados Coletados na Consulta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[50vh]">
                        {selectedConsultation.meetingNotes && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm flex items-center gap-1 mb-2">
                              <FileText className="h-4 w-4 text-blue-500" />
                              Notas da Consulta
                            </h4>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                              {selectedConsultation.meetingNotes}
                            </div>
                          </div>
                        )}

                        {chatNotes.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm flex items-center gap-1 mb-2">
                              <MessageSquare className="h-4 w-4 text-green-500" />
                              Chat da Consulta ({chatNotes.length} mensagens)
                            </h4>
                            <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                              {chatNotes.map((note) => (
                                <div key={note.id} className="text-sm">
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(note.timestamp), "HH:mm")}
                                  </span>
                                  <span className="ml-2">{note.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {transcriptions.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm flex items-center gap-1 mb-2">
                              <BookOpen className="h-4 w-4 text-purple-500" />
                              Transcrição
                            </h4>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                              {transcriptions.map((t) => t.content).join("\n")}
                            </div>
                          </div>
                        )}

                        {aiNotes.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-sm flex items-center gap-1 mb-2">
                              <Brain className="h-4 w-4 text-indigo-500" />
                              Análise da IA ({aiNotes.length})
                            </h4>
                            <div className="space-y-2">
                              {aiNotes.map((note) => (
                                <div key={note.id} className={`text-sm p-3 rounded-lg ${
                                  note.type === "ai_query" ? "bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500" : "bg-indigo-50 dark:bg-indigo-950/30 border-l-2 border-indigo-500"
                                }`}>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {note.type === "ai_query" ? "Pergunta:" : "Resposta IA:"}
                                  </span>
                                  <p className="mt-1 whitespace-pre-wrap">{note.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!selectedConsultation.meetingNotes && chatNotes.length === 0 && transcriptions.length === 0 && aiNotes.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>Nenhum dado coletado nesta consulta</p>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Video consultation history */}
                <TabsContent value="history">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Histórico de Vídeo-Consultas do Paciente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[50vh]">
                        {videoHistory.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>Nenhuma consulta anterior registrada</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {videoHistory.map((vc: any) => (
                              <div key={vc.id} className={`p-3 rounded-lg border ${
                                vc.id === selectedConsultation.id ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20" : ""
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Video className={`h-4 w-4 ${
                                      vc.status === "completed" ? "text-green-500" :
                                      vc.status === "incomplete" ? "text-orange-500" : "text-gray-400"
                                    }`} />
                                    <span className="text-sm font-medium">
                                      {format(new Date(vc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </span>
                                    {vc.id === selectedConsultation.id && (
                                      <Badge variant="outline" className="text-xs text-orange-600">Atual</Badge>
                                    )}
                                  </div>
                                  <Badge variant={
                                    vc.status === "completed" ? "default" :
                                    vc.status === "incomplete" ? "destructive" : "secondary"
                                  } className="text-xs">
                                    {vc.status === "completed" ? "Concluída" :
                                     vc.status === "incomplete" ? "Inconcluída" :
                                     vc.status === "ended" ? "Encerrada" : vc.status}
                                  </Badge>
                                </div>
                                {vc.duration > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Duração: {Math.ceil(vc.duration / 60)} minutos
                                  </p>
                                )}
                                {vc.meetingNotes && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {vc.meetingNotes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Medical records */}
                <TabsContent value="records">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Prontuário Clínico</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[50vh]">
                        {patientRecords.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>Nenhum prontuário encontrado para este paciente</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {patientRecords.map((record) => (
                              <div key={record.id} className="p-4 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {record.type === "consultation" ? "Consulta" :
                                     record.type === "followup" ? "Retorno" : record.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(record.createdAt || record.date), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                                {record.diagnosis && (
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground">Diagnóstico:</span>
                                    <p className="text-sm">{record.diagnosis}</p>
                                  </div>
                                )}
                                {record.symptoms && (
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground">Sintomas:</span>
                                    <p className="text-sm">{record.symptoms}</p>
                                  </div>
                                )}
                                {record.treatment && (
                                  <div className="mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground">Conduta:</span>
                                    <p className="text-sm">{record.treatment}</p>
                                  </div>
                                )}
                                {record.notes && (
                                  <div>
                                    <span className="text-xs font-semibold text-muted-foreground">Notas:</span>
                                    <p className="text-sm whitespace-pre-wrap line-clamp-4">{record.notes}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Exam results */}
                <TabsContent value="exams">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Exames e Estudos do Paciente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[50vh]">
                        {patientExams.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p>Nenhum exame registrado para este paciente</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {patientExams.map((exam) => (
                              <div key={exam.id} className="p-4 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{exam.examType}</span>
                                  <div className="flex items-center gap-2">
                                    {exam.analyzedByAI && (
                                      <Badge className="bg-purple-100 text-purple-700 text-xs">
                                        <Brain className="h-3 w-3 mr-1" />
                                        IA
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(exam.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                                {exam.results && typeof exam.results === "object" && (
                                  <div className="bg-muted/50 p-2 rounded text-xs font-mono">
                                    {Object.entries(exam.results).map(([key, val]) => (
                                      <div key={key} className="flex justify-between py-0.5">
                                        <span>{key}:</span>
                                        <span className="font-semibold">{String(val)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {exam.abnormalValues && Object.keys(exam.abnormalValues).length > 0 && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                                    <span className="text-xs font-semibold text-red-600">Valores alterados:</span>
                                    <div className="text-xs mt-1">
                                      {Object.entries(exam.abnormalValues).map(([key, val]) => (
                                        <span key={key} className="inline-block mr-2 text-red-700 dark:text-red-400">
                                          {key}: {String(val)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Doctor annotations */}
                <TabsContent value="notes">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Anotações Médicas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Textarea
                            placeholder="Escreva novas anotações sobre o caso clínico..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={4}
                            className="resize-none"
                          />
                          <div className="flex justify-end mt-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (newNote.trim() && selectedConsultation) {
                                  addNoteMutation.mutate({
                                    consultationId: selectedConsultation.id,
                                    content: newNote.trim(),
                                  });
                                }
                              }}
                              disabled={!newNote.trim() || addNoteMutation.isPending}
                            >
                              {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                              Salvar Anotação
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        <ScrollArea className="h-[35vh]">
                          {doctorNotes.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <NotebookPen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">Nenhuma anotação registrada</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {doctorNotes.map((note) => (
                                <div key={note.id} className="p-3 rounded-lg bg-muted/50 border-l-3 border-blue-400">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-blue-600">
                                      {note.type === "doctor_note" ? "Anotação Médica" : "Observação"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(note.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Epidemiological context */}
                <TabsContent value="epidemiology">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Contexto Epidemiológico
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6">
                        <Button
                          variant="outline"
                          onClick={() => navigate("/epidemiological-reports")}
                          className="mx-auto"
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Abrir Relatórios Epidemiológicos Completos
                        </Button>
                        <p className="text-xs text-muted-foreground mt-3">
                          Acesse análises detalhadas de sintomas, diagnósticos e tendências epidemiológicas
                        </p>
                      </div>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Resumo do Paciente</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-center">
                            <p className="text-2xl font-bold text-blue-600">{patientRecords.length}</p>
                            <p className="text-xs text-muted-foreground">Prontuários</p>
                          </div>
                          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
                            <p className="text-2xl font-bold text-green-600">{patientExams.length}</p>
                            <p className="text-xs text-muted-foreground">Exames</p>
                          </div>
                          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-center">
                            <p className="text-2xl font-bold text-purple-600">{videoHistory.length}</p>
                            <p className="text-xs text-muted-foreground">Consultas</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Inter-consultation dialog */}
      <Dialog open={interConsultDialog} onOpenChange={setInterConsultDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Solicitar Interconsulta
            </DialogTitle>
            <DialogDescription>
              Convide um especialista para avaliar o caso de {selectedConsultation?.patientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {onlineDoctors.filter(d => d.id !== user?.id).length > 0 ? (
              <>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  Médicos Online
                </h4>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {onlineDoctors.filter(d => d.id !== user?.id).map((doctor) => (
                      <div
                        key={doctor.id}
                        onClick={() => setSelectedSpecialistId(doctor.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedSpecialistId === doctor.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="font-medium text-sm">{doctor.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{doctor.specialization || "Clínico Geral"}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum médico online no momento</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setInterConsultDialog(false);
                    setOfflineNotifyDialog(true);
                  }}
                >
                  <Bell className="h-4 w-4 mr-1" />
                  Notificar Médicos Offline
                </Button>
              </div>
            )}

            <Textarea
              placeholder="Descreva o motivo da interconsulta e dados relevantes do caso..."
              value={interConsultMessage}
              onChange={(e) => setInterConsultMessage(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {onlineDoctors.filter(d => d.id !== user?.id).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInterConsultDialog(false);
                  setOfflineNotifyDialog(true);
                }}
              >
                <WifiOff className="h-4 w-4 mr-1" />
                Buscar Offline
              </Button>
            )}
            <Button
              onClick={() => {
                if (selectedSpecialistId && selectedConsultation && interConsultMessage.trim()) {
                  interConsultMutation.mutate({
                    consultationId: selectedConsultation.id,
                    specialistId: selectedSpecialistId,
                    message: interConsultMessage.trim(),
                  });
                }
              }}
              disabled={!selectedSpecialistId || !interConsultMessage.trim() || interConsultMutation.isPending}
            >
              {interConsultMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offline doctor notification dialog */}
      <Dialog open={offlineNotifyDialog} onOpenChange={setOfflineNotifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Notificar Médicos Offline
            </DialogTitle>
            <DialogDescription>
              Envie notificação via WhatsApp, sistema e SMS para médicos disponíveis sobre a necessidade de interconsulta
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Siren className="h-4 w-4" />
                Paciente: <strong>{selectedConsultation?.patientName}</strong>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Os médicos serão notificados via WhatsApp, notificações do sistema e SMS
              </p>
            </div>

            {offlineDoctors.length > 0 ? (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {offlineDoctors.map((doctor: any) => (
                    <label
                      key={doctor.id}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="rounded"
                        defaultChecked
                        data-doctor-id={doctor.id}
                      />
                      <div className="flex items-center justify-between flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400" />
                          <span className="text-sm font-medium">{doctor.name || doctor.username}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{doctor.specialization || "Clínico Geral"}</Badge>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum médico adicional disponível</p>
              </div>
            )}

            <Textarea
              placeholder="Descreva o caso clínico e a urgência da interconsulta..."
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              rows={3}
            />

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</span>
              <span className="flex items-center gap-1"><Bell className="h-3 w-3" /> Sistema</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> SMS</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfflineNotifyDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedConsultation && offlineMessage.trim()) {
                  const checkboxes = document.querySelectorAll('[data-doctor-id]:checked') as NodeListOf<HTMLInputElement>;
                  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute("data-doctor-id")!);
                  if (selectedIds.length > 0) {
                    offlineNotifyMutation.mutate({
                      doctorIds: selectedIds,
                      message: offlineMessage.trim(),
                      patientId: selectedConsultation.patientId,
                      consultationId: selectedConsultation.id,
                    });
                  } else {
                    toast({ title: "Selecione pelo menos um médico", variant: "destructive" });
                  }
                }
              }}
              disabled={!offlineMessage.trim() || offlineNotifyMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {offlineNotifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar Notificações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
