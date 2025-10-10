import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
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
  Video
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageWrapper from "@/components/layout/page-wrapper";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import origamiHeroImage from "@assets/image_1759773239051.png";

interface ConsultationRequest {
  id: string;
  patientId: string;
  symptoms: string;
  urgencyLevel: 'urgent' | 'moderate' | 'routine';
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

interface MyConsultations {
  upcoming: ConsultationRequest[];
  past: ConsultationRequest[];
  total: number;
}

export default function MyConsultations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: consultations, isLoading } = useQuery<MyConsultations>({
    queryKey: ['/api/my-consultations'],
    enabled: !!user && user.role === 'patient',
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

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'destructive';
      case 'moderate': return 'default';
      case 'routine': return 'secondary';
      default: return 'secondary';
    }
  };

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
              <Badge variant={getUrgencyColor(consultation.urgencyLevel)} data-testid={`badge-urgency-${consultation.urgencyLevel}`}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {consultation.urgencyLevel === 'urgent' && 'Urgente'}
                {consultation.urgencyLevel === 'moderate' && 'Moderado'}
                {consultation.urgencyLevel === 'routine' && 'Rotina'}
              </Badge>
            </div>
          </div>
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

        {consultation.clinicalPresentation && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4" />
              Apresentação Clínica (IA)
            </h4>
            <p className="text-sm text-muted-foreground" data-testid="text-clinical-presentation">
              {consultation.clinicalPresentation}
            </p>
          </div>
        )}

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
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" />
              Notas do Médico
            </h4>
            <p className="text-sm text-muted-foreground" data-testid="text-clinical-notes">
              {consultation.session.clinicalNotes}
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

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Minhas Consultas</h1>
          <p className="text-muted-foreground">
            Acompanhe o status de suas solicitações de consulta
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !consultations || consultations.total === 0 ? (
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
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="upcoming" data-testid="tab-upcoming">
                Próximas ({consultations.upcoming.length})
              </TabsTrigger>
              <TabsTrigger value="past" data-testid="tab-past">
                Anteriores ({consultations.past.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {consultations.upcoming.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma consulta pendente ou aceita</p>
                  </CardContent>
                </Card>
              ) : (
                consultations.upcoming.map(renderConsultationCard)
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {consultations.past.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Nenhuma consulta concluída ou recusada</p>
                  </CardContent>
                </Card>
              ) : (
                consultations.past.map(renderConsultationCard)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PageWrapper>
  );
}
