import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Video,
  Trash2,
  Archive,
  Ban,
  Pill,
  TestTube,
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Shield,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageWrapper from "@/components/layout/page-wrapper";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { TriageBadge } from "@/components/triage/triage-badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormattedText } from "@/components/ui/formatted-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ConsultationRequest {
  id: string;
  patientId: string;
  symptoms: string;
  urgencyLevel: string;
  clinicalPresentation: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  selectedDoctorId?: string;
  createdAt: string;
  doctor?: {
    id: string;
    name: string;
    specialty: string;
  };
  session?: {
    id: string;
    clinicalNotes?: string;
  };
}

interface VideoHistoryItem {
  id: string;
  doctorId: string;
  appointmentId: string | null;
  status: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  meetingNotes?: string;
  createdAt: string;
  rating: number | null;
  feedback: string | null;
  doctor: {
    name: string;
    specialty?: string;
  };
}

interface ActiveVideoConsultation {
  id: string;
  doctorId: string;
  status: string;
  createdAt: string;
  doctor: {
    name: string;
    specialty?: string;
  };
}

interface MyConsultations {
  upcoming: ConsultationRequest[];
  past: ConsultationRequest[];
  videoHistory?: VideoHistoryItem[];
  activeVideoConsultations?: ActiveVideoConsultation[];
  total: number;
}

interface PostConsultationItem {
  id: string;
  consultationId: string;
  type: string;
  title: string;
  description: string | null;
  details: any;
  status: string;
  patientSummary: string | null;
  createdAt: string;
}

const itemTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  prescription: { icon: Pill, label: "Prescrição", color: "bg-blue-100 text-blue-800" },
  exam: { icon: TestTube, label: "Exame", color: "bg-purple-100 text-purple-800" },
  referral: { icon: ArrowUpRight, label: "Encaminhamento", color: "bg-orange-100 text-orange-800" },
  followup: { icon: CalendarCheck, label: "Retorno", color: "bg-green-100 text-green-800" },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending_review: { label: "Em Revisão", color: "bg-yellow-100 text-yellow-800", icon: Clock3 },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800", icon: CheckCircle },
  signed: { label: "Assinado", color: "bg-blue-100 text-blue-800", icon: Shield },
  rejected: { label: "Não Aprovado", color: "bg-red-100 text-red-800", icon: XCircle },
};

function PostConsultationItemsPanel({ consultationId }: { consultationId: string }) {
  const [expanded, setExpanded] = useState(false);

  const { data: items, isLoading } = useQuery<PostConsultationItem[]>({
    queryKey: ["/api/post-consultation", consultationId, "items"],
    enabled: expanded,
  });

  const approvedItems = items?.filter(i => i.status === 'approved' || i.status === 'signed') || [];

  if (!expanded) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="mt-2">
        <ChevronDown className="w-4 h-4 mr-1" />
        Ver Prescrições e Exames
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
        <ChevronUp className="w-4 h-4 mr-1" />
        Recolher
      </Button>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !approvedItems.length ? (
        <p className="text-sm text-muted-foreground pl-2">
          {items?.length ? "Itens ainda em revisão pelo médico." : "Nenhum item pós-consulta disponível."}
        </p>
      ) : (
        <div className="space-y-2">
          {approvedItems.map((item) => {
            const config = itemTypeConfig[item.type] || itemTypeConfig.prescription;
            const sConfig = statusConfig[item.status] || statusConfig.pending_review;
            const Icon = config.icon;
            const StatusIcon = sConfig.icon;

            return (
              <div key={item.id} className="bg-white rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={config.color}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <Badge variant="outline" className={sConfig.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {sConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>

                    {item.patientSummary && (
                      <p className="text-sm text-muted-foreground mt-1">{item.patientSummary}</p>
                    )}

                    {item.type === "prescription" && item.details?.medications && (
                      <div className="mt-2 space-y-1">
                        {(item.details.medications as any[]).map((med: any, idx: number) => (
                          <div key={idx} className="text-xs bg-blue-50 rounded px-2 py-1">
                            <span className="font-medium">{med.name}</span> {med.dosage} — {med.frequency}, {med.duration}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.type === "exam" && item.details?.exams && (
                      <div className="mt-2 space-y-1">
                        {(item.details.exams as any[]).map((exam: any, idx: number) => (
                          <div key={idx} className="text-xs bg-purple-50 rounded px-2 py-1">
                            <span className="font-medium">{exam.name}</span> — {exam.type}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.type === "referral" && item.details && (
                      <div className="mt-2 text-xs bg-orange-50 rounded px-2 py-1">
                        <span className="font-medium">{item.details.specialty}</span> — {item.details.reason}
                      </div>
                    )}

                    {item.type === "followup" && item.details && (
                      <div className="mt-2 text-xs bg-green-50 rounded px-2 py-1">
                        {item.details.suggestedDate && <span className="font-medium">Data: {item.details.suggestedDate}</span>}
                        {item.details.reason && <span> — {item.details.reason}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StarRating({ rating, onRate, size = 5 }: { rating: number; onRate?: (r: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: size }, (_, i) => i + 1).map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 cursor-${onRate ? 'pointer' : 'default'} transition-colors ${
            star <= (hover || rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300'
          }`}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => onRate && setHover(star)}
          onMouseLeave={() => onRate && setHover(0)}
        />
      ))}
    </div>
  );
}

export default function MyConsultations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ratingDialog, setRatingDialog] = useState<{ appointmentId: string; doctorName: string } | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState("");

  const { data: consultations, isLoading } = useQuery<MyConsultations>({
    queryKey: ['/api/my-consultations'],
    enabled: !!user && user.role === 'patient',
  });

  const rateMutation = useMutation({
    mutationFn: async ({ appointmentId, rating, feedback }: { appointmentId: string; rating: number; feedback: string }) => {
      const res = await apiRequest('POST', `/api/appointments/${appointmentId}/rate`, { rating, feedback });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Avaliação enviada", description: "Obrigado por avaliar sua consulta!" });
      queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
      setRatingDialog(null);
      setRatingValue(0);
      setRatingFeedback("");
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar a avaliação.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest('PATCH', `/api/consultation-requests/${requestId}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Consulta cancelada", description: "A solicitação foi cancelada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível cancelar a consulta.", variant: "destructive" });
    },
  });

  const cancelAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/consultation-requests/cancel-all', {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Consultas canceladas", description: `${data.cancelled} consulta(s) cancelada(s) com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível cancelar as consultas.", variant: "destructive" });
    },
  });

  const archiveAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/consultation-requests/archive-all', {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Consultas arquivadas", description: `${data.archived} consulta(s) enviada(s) para o histórico.` });
      queryClient.invalidateQueries({ queryKey: ['/api/my-consultations'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível arquivar as consultas.", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending': return 'secondary';
      case 'declined': return 'destructive';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'declined': return <XCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted': return 'Aceita';
      case 'pending': return 'Pendente';
      case 'declined': return 'Recusada';
      case 'completed': return 'Concluída';
      default: return status;
    }
  };

  const upcomingOnly = (consultations?.upcoming || []).filter(c => c.status !== 'completed' && c.status !== 'declined');
  const hasOpenConsultations = upcomingOnly.length > 0;

  const renderConsultationCard = (consultation: ConsultationRequest) => (
    <Card key={consultation.id} className="mb-4" data-testid={`card-consultation-${consultation.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              Consulta - {format(new Date(consultation.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getStatusColor(consultation.status)} data-testid={`badge-status-${consultation.status}`}>
                {getStatusIcon(consultation.status)}
                <span className="ml-2">{getStatusLabel(consultation.status)}</span>
              </Badge>
              <TriageBadge level={consultation.urgencyLevel} size="sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {consultation.status === 'accepted' && consultation.session && (
              <Button 
                size="sm" 
                onClick={() => navigate(`/consultation-session/${consultation.session?.id}`)}
                data-testid="button-join-session"
              >
                <Video className="w-4 h-4 mr-2" />
                Entrar na Sala
              </Button>
            )}
            {(consultation.status === 'pending' || consultation.status === 'accepted') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar Consulta</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar esta solicitação de consulta? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => cancelMutation.mutate(consultation.id)}
                    >
                      Confirmar Cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4" />
            Sintomas
          </h4>
          <p className="text-sm text-muted-foreground" data-testid="text-symptoms">
            {consultation.symptoms}
          </p>
        </div>

        

        {consultation.doctor && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <User className="w-4 h-4" />
              Médico
            </h4>
            <div className="text-sm" data-testid="text-doctor-info">
              <p className="font-medium">{consultation.doctor.name}</p>
              <p className="text-muted-foreground">{consultation.doctor.specialty}</p>
            </div>
          </div>
        )}

        {consultation.session?.clinicalNotes && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Consulta Registrada
            </h4>
            <p className="text-sm text-muted-foreground" data-testid="text-clinical-notes">
              Seu médico registrou observações clínicas sobre esta consulta. Para detalhes acessíveis, acesse seu prontuário na área "Meu Prontuário".
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          Solicitado em {format(new Date(consultation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  );

  const renderActiveVideoCard = (vc: ActiveVideoConsultation) => (
    <Card key={vc.id} className="mb-4 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              Teleconsulta em Andamento
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-600">
                <Video className="w-3 h-3 mr-1" />
                {vc.status === 'waiting' ? 'Aguardando' : 'Em Andamento'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(`/patient/video/${vc.id}`)}
            >
              <Video className="w-4 h-4 mr-2" />
              Entrar na Consulta
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
            <User className="w-4 h-4" />
            Médico
          </h4>
          <p className="text-sm font-medium">{vc.doctor.name}</p>
          {vc.doctor.specialty && (
            <p className="text-sm text-muted-foreground">{vc.doctor.specialty}</p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          Criada em {format(new Date(vc.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  );

  if (!user || user.role !== 'patient') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p>Apenas pacientes podem ver suas consultas.</p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  const completedVideoHistory = (consultations?.videoHistory || []).filter(v => 
    v.status === 'completed' || v.status === 'ended'
  );

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Minhas Consultas</h1>
            <p className="text-muted-foreground">
              Acompanhe o status de suas solicitações de consulta
            </p>
          </div>
          {hasOpenConsultations && (
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50"
                    disabled={archiveAllMutation.isPending}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    Enviar para Histórico
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Enviar para Histórico</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as consultas em aberto serão movidas para o histórico. Isso não cancela as consultas, apenas as marca como concluídas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => archiveAllMutation.mutate()}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                    disabled={cancelAllMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Cancelar Todas
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar Todas as Consultas</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar todas as consultas em aberto? Esta ação cancelará todas as solicitações pendentes e aceitas, incluindo videochamadas ativas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => cancelAllMutation.mutate()}
                    >
                      Cancelar Todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !consultations || (consultations.total === 0 && (!consultations.activeVideoConsultations || consultations.activeVideoConsultations.length === 0)) ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma consulta solicitada</h3>
              <p className="text-muted-foreground mb-4">
                Você ainda não solicitou nenhuma consulta
              </p>
              <Button onClick={() => navigate('/consultation-request')} data-testid="button-request-consultation">
                Solicitar Consulta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="upcoming" className="space-y-4">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="upcoming" data-testid="tab-upcoming">
                Próximas ({upcomingOnly.length + (consultations.activeVideoConsultations?.length || 0)})
              </TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">
                Solicitações ({consultations.past?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="videoHistory" data-testid="tab-video-history">
                <Video className="w-3.5 h-3.5 mr-1.5" />
                Histórico ({completedVideoHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {(upcomingOnly.length === 0 && (!consultations.activeVideoConsultations || consultations.activeVideoConsultations.length === 0)) ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma consulta pendente ou aceita</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {consultations.activeVideoConsultations?.map(renderActiveVideoCard)}
                  {upcomingOnly.map(renderConsultationCard)}
                </>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {consultations.past?.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma consulta concluída ou recusada</p>
                  </CardContent>
                </Card>
              ) : (
                consultations.past?.map(renderConsultationCard)
              )}
            </TabsContent>

            <TabsContent value="videoHistory" className="space-y-4">
              {!completedVideoHistory.length ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhuma teleconsulta realizada</p>
                  </CardContent>
                </Card>
              ) : (
                completedVideoHistory.map((vc) => (
                  <Card key={vc.id} className="mb-4">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Video className="w-5 h-5 text-blue-600" />
                            Teleconsulta - {vc.startedAt 
                              ? format(new Date(vc.startedAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                              : format(new Date(vc.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Concluída
                            </Badge>
                            {vc.duration && (
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />
                                {Math.round(vc.duration / 60)} min
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
                          <User className="w-4 h-4" />
                          Médico
                        </h4>
                        <p className="text-sm font-medium">{vc.doctor.name}</p>
                        {vc.doctor.specialty && (
                          <p className="text-sm text-muted-foreground">{vc.doctor.specialty}</p>
                        )}
                      </div>

                      {vc.meetingNotes && (
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4" />
                            Notas da Consulta
                          </h4>
                          <p className="text-sm text-muted-foreground">{vc.meetingNotes}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {vc.startedAt 
                          ? `Realizada em ${format(new Date(vc.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                          : `Criada em ${format(new Date(vc.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                        }
                        {vc.endedAt && vc.startedAt && (
                          <span>• Duração: {Math.round((new Date(vc.endedAt).getTime() - new Date(vc.startedAt).getTime()) / 60000)} min</span>
                        )}
                      </div>

                      {vc.rating ? (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm font-medium">Sua avaliação:</span>
                          <StarRating rating={vc.rating} />
                          {vc.feedback && (
                            <span className="text-sm text-muted-foreground ml-2">"{vc.feedback}"</span>
                          )}
                        </div>
                      ) : vc.appointmentId ? (
                        <div className="pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                            onClick={() => setRatingDialog({ appointmentId: vc.appointmentId!, doctorName: vc.doctor.name })}
                          >
                            <Star className="w-4 h-4 mr-1.5" />
                            Avaliar Consulta
                          </Button>
                        </div>
                      ) : null}

                      <PostConsultationItemsPanel consultationId={vc.id} />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!ratingDialog} onOpenChange={(open) => { if (!open) { setRatingDialog(null); setRatingValue(0); setRatingFeedback(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Avaliar Consulta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Como foi sua consulta com <span className="font-medium text-foreground">{ratingDialog?.doctorName}</span>?
            </p>
            <div className="flex justify-center">
              <StarRating rating={ratingValue} onRate={setRatingValue} />
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {ratingValue === 1 && "Ruim"}
              {ratingValue === 2 && "Regular"}
              {ratingValue === 3 && "Bom"}
              {ratingValue === 4 && "Muito bom"}
              {ratingValue === 5 && "Excelente"}
            </div>
            <Textarea
              placeholder="Deixe um comentário (opcional)"
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRatingDialog(null); setRatingValue(0); setRatingFeedback(""); }}>
              Cancelar
            </Button>
            <Button
              disabled={ratingValue === 0 || rateMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={() => {
                if (ratingDialog && ratingValue > 0) {
                  rateMutation.mutate({
                    appointmentId: ratingDialog.appointmentId,
                    rating: ratingValue,
                    feedback: ratingFeedback,
                  });
                }
              }}
            >
              {rateMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
