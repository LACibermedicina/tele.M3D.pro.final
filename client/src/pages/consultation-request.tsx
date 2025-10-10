import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  AlertCircle, 
  CheckCircle, 
  Stethoscope, 
  Clock, 
  MessageSquare,
  Loader2,
  ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience?: string;
}

interface TriageAnalysis {
  urgencyLevel: 'urgent' | 'moderate' | 'routine';
  urgencyScore: number;
  clinicalPresentation: string;
  recommendedDoctors: Doctor[];
  suggestedTimeframe: string;
  additionalNotes?: string;
}

export default function ConsultationRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [symptoms, setSymptoms] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [triageResult, setTriageResult] = useState<TriageAnalysis | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Fetch patient data
  const { data: patientData } = useQuery<any>({
    queryKey: ['/api/patients/me'],
    enabled: !!user && user.role === 'patient',
  });

  // Request consultation mutation
  const requestMutation = useMutation({
    mutationFn: async (data: { symptoms: string; whatsappOptIn: boolean }) => {
      return await apiRequest('/api/consultation-requests', 'POST', data);
    },
    onSuccess: (data: any) => {
      // Store request ID and triage result
      setRequestId(data.consultationRequest?.id || null);
      
      // Build triage analysis from response
      const triage: TriageAnalysis = {
        urgencyLevel: data.consultationRequest?.urgencyLevel || 'routine',
        urgencyScore: data.triage?.urgencyScore || 5,
        clinicalPresentation: data.consultationRequest?.clinicalPresentation || data.triage?.triageReasoning || '',
        recommendedDoctors: data.availableDoctors || [],
        suggestedTimeframe: data.consultationRequest?.urgencyLevel === 'urgent' ? 'Atendimento urgente (até 24h)' : 'Atendimento em até 7 dias',
        additionalNotes: data.triage?.keyFindings?.join('. ') || ''
      };
      
      setTriageResult(triage);
      
      if (!data.availableDoctors || data.availableDoctors.length === 0) {
        toast({ 
          title: "Solicitação criada!",
          description: "Aguarde a atribuição de um médico."
        });
        setTimeout(() => navigate('/my-consultations'), 2000);
      } else {
        toast({ 
          title: "Análise concluída!",
          description: "Selecione um médico disponível."
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar solicitação", 
        variant: "destructive" 
      });
    },
  });

  // Confirm doctor selection mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctorId || !requestId) throw new Error('No doctor or request selected');
      return await apiRequest(`/api/consultation-requests/${requestId}/select-doctor`, 'PATCH', {
        selectedDoctorId
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Consulta solicitada!",
        description: "Você receberá uma notificação quando o médico responder."
      });
      setTimeout(() => navigate('/my-consultations'), 2000);
    },
    onError: () => {
      toast({ 
        title: "Erro ao confirmar consulta", 
        variant: "destructive" 
      });
    },
  });

  const handleAnalyze = () => {
    if (!symptoms.trim()) {
      toast({ 
        title: "Descreva seus sintomas", 
        variant: "destructive" 
      });
      return;
    }

    requestMutation.mutate({ symptoms, whatsappOptIn });
  };

  const handleConfirmDoctor = () => {
    confirmMutation.mutate();
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'destructive';
      case 'moderate': return 'default';
      case 'routine': return 'secondary';
      default: return 'secondary';
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'urgent': return <AlertCircle className="w-4 h-4" />;
      case 'moderate': return <Clock className="w-4 h-4" />;
      case 'routine': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (!user || user.role !== 'patient') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p>Apenas pacientes podem solicitar consultas.</p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Solicitar Consulta</h1>
          <p className="text-muted-foreground">
            Descreva seus sintomas e nossa IA analisará a urgência e recomendará médicos disponíveis
          </p>
        </div>

        {!triageResult ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Descreva seus sintomas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Textarea
                  data-testid="input-symptoms"
                  placeholder="Descreva em detalhes o que você está sentindo, quando começou, intensidade dos sintomas..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  data-testid="switch-whatsapp"
                  id="whatsapp-opt-in"
                  checked={whatsappOptIn}
                  onCheckedChange={setWhatsappOptIn}
                />
                <Label htmlFor="whatsapp-opt-in" className="cursor-pointer">
                  Receber notificações via WhatsApp
                </Label>
              </div>

              <Button
                data-testid="button-analyze"
                onClick={handleAnalyze}
                disabled={requestMutation.isPending || !symptoms.trim()}
                className="w-full"
                size="lg"
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analisando sintomas...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analisar com IA
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Análise da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Nível de Urgência</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant={getUrgencyColor(triageResult.urgencyLevel)}
                      className="text-sm"
                      data-testid={`badge-urgency-${triageResult.urgencyLevel}`}
                    >
                      {getUrgencyIcon(triageResult.urgencyLevel)}
                      <span className="ml-2">
                        {triageResult.urgencyLevel === 'urgent' && 'Urgente'}
                        {triageResult.urgencyLevel === 'moderate' && 'Moderado'}
                        {triageResult.urgencyLevel === 'routine' && 'Rotina'}
                      </span>
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Score: {triageResult.urgencyScore}/10
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Apresentação Clínica</Label>
                  <p className="mt-2 text-sm" data-testid="text-clinical-presentation">
                    {triageResult.clinicalPresentation}
                  </p>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Prazo Sugerido</Label>
                  <p className="mt-2 text-sm font-medium" data-testid="text-suggested-timeframe">
                    {triageResult.suggestedTimeframe}
                  </p>
                </div>

                {triageResult.additionalNotes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Observações</Label>
                    <p className="mt-2 text-sm" data-testid="text-additional-notes">
                      {triageResult.additionalNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {triageResult.recommendedDoctors && triageResult.recommendedDoctors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5" />
                    Médicos Recomendados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {triageResult.recommendedDoctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      data-testid={`card-doctor-${doctor.id}`}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDoctorId === doctor.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedDoctorId(doctor.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{doctor.name}</h3>
                          <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                          {doctor.experience && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {doctor.experience}
                            </p>
                          )}
                        </div>
                        {selectedDoctorId === doctor.id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}

                  <Button
                    data-testid="button-confirm-doctor"
                    onClick={handleConfirmDoctor}
                    disabled={!selectedDoctorId || confirmMutation.isPending}
                    className="w-full mt-4"
                    size="lg"
                  >
                    {confirmMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        Confirmar Médico
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
