import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  AlertCircle, 
  CheckCircle, 
  Stethoscope, 
  Clock, 
  MessageSquare,
  Loader2,
  ArrowRight,
  Shield,
  Activity,
  UserCheck,
  FileText,
  AlertTriangle,
  HeartPulse,
  CalendarCheck,
  ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { getTriageConfig } from "@/lib/triage";
import { TriageBadge } from "@/components/triage/triage-badge";
import { TriageHelpDialog } from "@/components/triage/triage-help-dialog";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience?: string;
  availability?: string;
}

interface TriageAnalysis {
  urgencyLevel: string;
  urgencyScore: number;
  clinicalPresentation: string;
  recommendedDoctors: Doctor[];
  suggestedTimeframe: string;
  additionalNotes?: string;
  keyFindings?: string[];
  recommendedSpecialties?: string[];
  protocolsApplied?: string[];
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
  const [step, setStep] = useState<'input' | 'analysis' | 'select' | 'confirmed'>('input');

  const requestMutation = useMutation({
    mutationFn: async (data: { symptoms: string; whatsappOptIn: boolean }) => {
      const res = await apiRequest('POST', '/api/consultation-requests', data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      setRequestId(data.consultationRequest?.id || null);
      
      const urgLevel = data.triage?.aiTriageLevel || data.consultationRequest?.urgencyLevel || 'standard';
      
      const triage: TriageAnalysis = {
        urgencyLevel: urgLevel,
        urgencyScore: data.triage?.urgencyScore || 4,
        clinicalPresentation: data.consultationRequest?.clinicalPresentation || data.triage?.triageReasoning || 'Análise clínica dos sintomas reportados.',
        recommendedDoctors: data.availableDoctors || [],
        suggestedTimeframe: getTriageConfig(urgLevel).maxWaitTime,
        additionalNotes: Array.isArray(data.triage?.keyFindings) 
          ? data.triage.keyFindings.join('. ') 
          : '',
        keyFindings: data.triage?.keyFindings || [],
        recommendedSpecialties: data.triage?.recommendedSpecialties || ['Clínico Geral'],
        protocolsApplied: data.triage?.protocolsApplied || []
      };
      
      setTriageResult(triage);
      
      const hasDoctors = data.availableDoctors && data.availableDoctors.length > 0;
      setStep('analysis');
      
      if (!hasDoctors) {
        toast({ 
          title: "Solicitação criada!",
          description: "Aguarde a atribuição de um médico."
        });
      } else {
        toast({ 
          title: "Análise concluída!",
          description: "Confira o resultado e escolha um médico."
        });
      }
    },
    onError: (error: any) => {
      const message = error?.message?.includes(':') 
        ? error.message.split(': ').slice(1).join(': ')
        : 'Tente novamente em alguns instantes.';
      toast({ 
        title: "Erro ao enviar solicitação",
        description: message,
        variant: "destructive" 
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctorId || !requestId) throw new Error('No doctor or request selected');
      return await apiRequest('PATCH', `/api/consultation-requests/${requestId}/select-doctor`, {
        selectedDoctorId
      });
    },
    onSuccess: () => {
      setStep('confirmed');
      toast({ 
        title: "Consulta solicitada com sucesso!",
        description: "Você receberá uma notificação quando o médico responder."
      });
      setTimeout(() => navigate('/my-consultations'), 3000);
    },
    onError: () => {
      toast({ 
        title: "Erro ao confirmar consulta", 
        description: "Tente novamente em alguns instantes.",
        variant: "destructive" 
      });
    },
  });

  const handleAnalyze = () => {
    if (!symptoms.trim()) {
      toast({ title: "Descreva seus sintomas", variant: "destructive" });
      return;
    }
    requestMutation.mutate({ symptoms, whatsappOptIn });
  };

  const handleSelectDoctor = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
  };

  const handleConfirmDoctor = () => {
    confirmMutation.mutate();
  };

  const getUrgencyConfig = (level: string) => {
    const tc = getTriageConfig(level);
    const iconMap: Record<string, any> = {
      'emergency': AlertTriangle,
      'very_urgent': AlertCircle,
      'urgent': Clock,
      'standard': CheckCircle,
      'non_urgent': CheckCircle,
    };
    return {
      color: tc.bgColor,
      textColor: tc.textColor,
      bgLight: `${tc.bgColorLight} ${tc.borderColor}`,
      badgeVariant: (tc.priority <= 2 ? 'destructive' : tc.priority <= 3 ? 'default' : 'secondary') as any,
      label: tc.label,
      icon: iconMap[tc.level] || CheckCircle,
      triageConfig: tc,
    };
  };

  if (!user || user.role !== 'patient') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Apenas pacientes podem solicitar consultas.</p>
              <p className="text-sm text-muted-foreground mt-2">Faça login com sua conta de paciente para continuar.</p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  const currentStep = step === 'input' ? 1 : step === 'analysis' ? 2 : step === 'select' ? 3 : 4;

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
            <HeartPulse className="w-7 h-7 text-primary" />
            Solicitar Consulta
          </h1>
          <p className="text-sm text-muted-foreground">
            Descreva seus sintomas para uma triagem inteligente com recomendação de especialistas
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-8 px-2">
          {[
            { num: 1, label: 'Sintomas', icon: MessageSquare },
            { num: 2, label: 'Triagem IA', icon: Brain },
            { num: 3, label: 'Médico', icon: Stethoscope },
            { num: 4, label: 'Confirmado', icon: CalendarCheck },
          ].map((s, i) => {
            const Icon = s.icon;
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num;
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-primary text-white' : isActive ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-12px] ${currentStep > s.num ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Symptoms Input */}
        {step === 'input' && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
                Descreva seus sintomas
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Quanto mais detalhes, melhor será a análise da IA
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <Textarea
                data-testid="input-symptoms"
                placeholder="Ex: Estou com dor de cabeça intensa há 4 horas, não melhorou com paracetamol. Também sinto um pouco de tontura..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={5}
                className="resize-none text-base"
              />

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <Label htmlFor="whatsapp-opt-in" className="cursor-pointer text-sm">
                    Receber notificações via WhatsApp
                  </Label>
                </div>
                <Switch
                  data-testid="switch-whatsapp"
                  id="whatsapp-opt-in"
                  checked={whatsappOptIn}
                  onCheckedChange={setWhatsappOptIn}
                />
              </div>

              <Button
                data-testid="button-analyze"
                onClick={handleAnalyze}
                disabled={requestMutation.isPending || !symptoms.trim()}
                className="w-full h-12 text-base"
                size="lg"
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analisando com IA...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Analisar Sintomas
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: AI Analysis Results */}
        {step === 'analysis' && triageResult && (
          <div className="space-y-4">
            {/* Urgency Card */}
            {(() => {
              const config = getUrgencyConfig(triageResult.urgencyLevel);
              const UrgencyIcon = config.icon;
              return (
                <Card className={`border-2 ${config.bgLight}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: config.triageConfig.color }}
                      >
                        <UrgencyIcon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">Classificação de Risco</h3>
                          <TriageBadge level={triageResult.urgencyLevel} size="lg" />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-2.5 bg-white/60 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${triageResult.urgencyScore * 10}%`, backgroundColor: config.triageConfig.color }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${config.textColor}`}>
                            {triageResult.urgencyScore}/10
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{triageResult.suggestedTimeframe}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{config.triageConfig.protocol}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Clinical Analysis */}
            <Card className="border">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <h3 className="font-semibold text-base">Análise Clínica</h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 pl-8" data-testid="text-clinical-presentation">
                  {triageResult.clinicalPresentation}
                </p>
              </CardContent>
            </Card>

            {/* Key Findings */}
            {triageResult.keyFindings && triageResult.keyFindings.length > 0 && (
              <Card className="border">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Activity className="w-5 h-5 text-primary mt-0.5" />
                    <h3 className="font-semibold text-base">Achados Importantes</h3>
                  </div>
                  <div className="space-y-2 pl-8">
                    {triageResult.keyFindings.map((finding, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{finding}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommended Specialties */}
            {triageResult.recommendedSpecialties && triageResult.recommendedSpecialties.length > 0 && (
              <Card className="border">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Stethoscope className="w-5 h-5 text-primary mt-0.5" />
                    <h3 className="font-semibold text-base">Especialidades Recomendadas</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-8">
                    {triageResult.recommendedSpecialties.map((spec, i) => (
                      <Badge key={i} variant="outline" className="text-sm px-3 py-1">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Applied Protocols */}
            {triageResult.protocolsApplied && triageResult.protocolsApplied.length > 0 && (
              <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                    <h3 className="font-semibold text-base">Protocolos e Diretrizes Aplicadas</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-8">
                    {triageResult.protocolsApplied.map((protocol, i) => (
                      <Badge key={i} variant="outline" className="text-xs px-2 py-1 border-blue-300 text-blue-700 dark:text-blue-300">
                        {protocol}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <TriageHelpDialog trigger={
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  <i className="fas fa-info-circle mr-1"></i>
                  Entenda a classificação de risco
                </Button>
              } />
            </div>

            {/* Action Button */}
            <Button 
              onClick={() => {
                if (triageResult.recommendedDoctors.length > 0) {
                  setStep('select');
                } else {
                  navigate('/my-consultations');
                }
              }}
              className="w-full h-12 text-base"
              size="lg"
            >
              {triageResult.recommendedDoctors.length > 0 ? (
                <>
                  <UserCheck className="w-5 h-5 mr-2" />
                  Escolher Médico
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <CalendarCheck className="w-5 h-5 mr-2" />
                  Ver Minhas Consultas
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Select Doctor */}
        {step === 'select' && triageResult && (
          <div className="space-y-4">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCheck className="w-5 h-5 text-primary" />
                  Escolha seu Médico
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Selecione o profissional que deseja para sua consulta
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {triageResult.recommendedDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    data-testid={`card-doctor-${doctor.id}`}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedDoctorId === doctor.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-muted hover:border-primary/40 hover:shadow-sm'
                    }`}
                    onClick={() => handleSelectDoctor(doctor.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedDoctorId === doctor.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{doctor.name}</h3>
                        <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                        {doctor.availability && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs text-green-600">Disponível</span>
                          </div>
                        )}
                      </div>
                      {selectedDoctorId === doctor.id && (
                        <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('analysis')}
                className="flex-1 h-12"
              >
                Voltar
              </Button>
              <Button
                data-testid="button-confirm-doctor"
                onClick={handleConfirmDoctor}
                disabled={!selectedDoctorId || confirmMutation.isPending}
                className="flex-[2] h-12 text-base"
                size="lg"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-5 h-5 mr-2" />
                    Confirmar Consulta
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmed */}
        {step === 'confirmed' && (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-green-800 mb-2">Consulta Solicitada!</h2>
              <p className="text-sm text-green-700 mb-4">
                Sua solicitação foi enviada com sucesso. Você receberá uma notificação quando o médico responder.
              </p>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Redirecionando para suas consultas...</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
