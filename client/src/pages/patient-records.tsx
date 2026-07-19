import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-admin";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { TriageBadge } from "@/components/triage/triage-badge";
import PatientExportDialog from "@/components/patient-export-dialog";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { FormattedText } from "@/components/ui/formatted-text";
import {
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Video,
  User,
  Stethoscope,
  ClipboardList,
  Activity,
  Shield,
  Pill,
  Heart,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsultationRequest {
  id: string;
  patientId: string;
  symptoms: string;
  urgencyLevel: string;
  clinicalPresentation: string;
  status: string;
  selectedDoctorId?: string;
  createdAt: string;
  aiAnalysis?: any;
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

interface MyConsultations {
  upcoming: ConsultationRequest[];
  past: ConsultationRequest[];
  total: number;
}

export default function PatientRecords() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [, navigate] = useLocation();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const { data: patientProfile } = useQuery<any>({
    queryKey: ['/api/patients/me'],
    enabled: !!user && user.role === 'patient',
  });

  const { data: myRecords, isLoading: recordsLoading } = useQuery<any[]>({
    queryKey: ['/api/medical-records/my'],
    enabled: !!user && user.role === 'patient',
    select: (data) => data || [],
  });

  const { data: consultations, isLoading: consultationsLoading } = useQuery<MyConsultations>({
    queryKey: ['/api/my-consultations'],
    enabled: !!user && user.role === 'patient',
  });

  const { data: recentPrescriptions } = useQuery<any[]>({
    queryKey: ['/api/prescriptions/recent'],
    enabled: !!user && user.role === 'patient',
    select: (data) => data || [],
  });

  const hasRecords = myRecords && myRecords.length > 0;
  const isLoading = recordsLoading || consultationsLoading;

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

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case 'emergency': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Emergência</Badge>;
      case 'urgent': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Urgente</Badge>;
      case 'moderate': return <Badge variant="default"><Activity className="w-3 h-3 mr-1" />Moderado</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Rotina</Badge>;
    }
  };

  if (!user || user.role !== 'patient') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Acesso restrito a pacientes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const allRequests = [
    ...(consultations?.upcoming || []),
    ...(consultations?.past || []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary" />
            {hasRecords ? 'Meu Prontuário' : 'Minhas Solicitações'}
          </h1>
          {patientProfile && (
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}>
              <i className="fas fa-download mr-1"></i>
              Exportar Meus Dados
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          {hasRecords
            ? 'Acompanhe seu histórico médico, prontuários e solicitações de consulta'
            : 'Visualize todas as suas solicitações feitas ao sistema e acompanhe o andamento'}
        </p>
      </div>

      {hasRecords ? (
        <Tabs defaultValue="records" className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="records">
              <Shield className="w-4 h-4 mr-2" />
              Prontuário
            </TabsTrigger>
            <TabsTrigger value="requests">
              <ClipboardList className="w-4 h-4 mr-2" />
              Solicitações
            </TabsTrigger>
            <TabsTrigger value="prescriptions">
              <Pill className="w-4 h-4 mr-2" />
              Prescrições
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4">
            {myRecords!.map((record: any) => (
              <Card key={record.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {format(new Date(record.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        <User className="w-3 h-3 inline mr-1" />
                        Dr. {record.doctorName || 'Sistema'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-blue-600">
                        <Heart className="w-3 h-3 mr-1" />
                        Versão Acessível
                      </Badge>
                      {record.digitalSignature && (
                        <Badge variant="outline" className="text-green-600">
                          <Shield className="w-3 h-3 mr-1" />
                          Assinado
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {record.patientFriendlyVersion ? (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <FormattedText content={record.patientFriendlyVersion} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Seu médico ainda está preparando a versão acessível deste prontuário.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {renderRequestsList(allRequests, navigate, isAdmin)}
          </TabsContent>

          <TabsContent value="prescriptions" className="space-y-4">
            {(recentPrescriptions && recentPrescriptions.length > 0) ? (
              recentPrescriptions.map((rx: any) => (
                <Card key={rx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{rx.medication}</span>
                      <Badge variant={rx.status === 'active' ? 'default' : 'secondary'}>
                        {rx.status === 'active' ? 'Ativa' : 'Expirada'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rx.dosage} - {rx.frequency}</p>
                    {rx.instructions && <p className="text-xs text-muted-foreground mt-1">{rx.instructions}</p>}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Pill className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma prescrição encontrada</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{allRequests.length}</p>
                <p className="text-xs text-muted-foreground">Total de Solicitações</p>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                <p className="text-2xl font-bold">{consultations?.upcoming.length || 0}</p>
                <p className="text-xs text-muted-foreground">Pendentes / Em andamento</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">{consultations?.past.length || 0}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </CardContent>
            </Card>
          </div>

          {allRequests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma solicitação encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Você ainda não realizou nenhuma solicitação de consulta no sistema.
                </p>
                <Button onClick={() => navigate('/consultation-request')}>
                  <Stethoscope className="w-4 h-4 mr-2" />
                  Solicitar Consulta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Histórico de Solicitações</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/consultation-request')}>
                  <Stethoscope className="w-4 h-4 mr-2" />
                  Nova Solicitação
                </Button>
              </div>
              {renderRequestsList(allRequests, navigate, isAdmin)}
            </div>
          )}
        </div>
      )}
    </div>
      {patientProfile && (
        <PatientExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          patientId={patientProfile.id}
          patientName={patientProfile.name || user?.name || 'Paciente'}
        />
      )}
    </PageWrapper>
  );
}

function renderRequestsList(requests: any[], navigate: (path: string) => void, isAdmin: boolean) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma solicitação registrada</p>
        </CardContent>
      </Card>
    );
  }

  return requests.map((req: any) => (
    <Card key={req.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">
              Consulta - {format(new Date(req.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={
                req.status === 'accepted' ? 'default' :
                req.status === 'pending' ? 'secondary' :
                req.status === 'declined' ? 'destructive' : 'outline'
              }>
                {req.status === 'accepted' && <CheckCircle className="w-3 h-3 mr-1" />}
                {req.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                {req.status === 'declined' && <XCircle className="w-3 h-3 mr-1" />}
                {req.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                {req.status === 'accepted' ? 'Aceita' :
                 req.status === 'pending' ? 'Pendente' :
                 req.status === 'declined' ? 'Recusada' :
                 req.status === 'completed' ? 'Concluída' : req.status}
              </Badge>
              {req.urgencyLevel && (
                <TriageBadge level={req.urgencyLevel} size="sm" />
              )}
            </div>
          </div>
          {req.status === 'accepted' && req.session && (
            <Button size="sm" onClick={() => navigate(`/consultation-session/${req.session?.id}`)}>
              <Video className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
            <FileText className="w-3 h-3" />
            Sintomas
          </h4>
          <p className="text-sm text-muted-foreground">{req.symptoms}</p>
        </div>

        {req.clinicalPresentation && (
          <div className="bg-muted/40 rounded-lg p-3">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3" />
              Avaliação Clínica{isAdmin ? ' (IA)' : ''}
            </h4>
            <p className="text-sm text-muted-foreground">{req.clinicalPresentation}</p>
          </div>
        )}

        {req.doctor && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            <span data-no-translate className="font-medium">{req.doctor.name}</span>
            <span className="text-muted-foreground">- {req.doctor.specialty}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
          <Calendar className="w-3 h-3" />
          Solicitado em {format(new Date(req.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  ));
}
