import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Heart, X, Upload, Zap, Loader2, Minimize2, Maximize2,
  Activity, AlertTriangle, ChevronDown, ChevronUp, Save, BookOpen,
  User, Mail, Send, FileText, Shield, Stethoscope, ClipboardList,
  CheckCircle, XCircle, Target, Palette, BarChart3, Siren, Eye, TrendingUp,
  ImageIcon, Layers
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const DX_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B'];

const SEVERITY_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-red-700',
};

interface SystematicItem {
  finding: string;
  normal_range: string;
  is_normal: boolean;
  clinical_significance: string;
  percentage_descriptor: string;
}

interface ECGResult {
  ecg_metrics: {
    heart_rate: string;
    rhythm: string;
    qrs_width: string;
    atrial_activity: string;
    signal_quality: string;
  };
  lead_by_lead_analysis?: Record<string, string>;
  waveform_segmentation?: {
    p_wave: string;
    pr_interval: string;
    qrs_complex: string;
    st_segment: string;
    t_wave: string;
    qt_interval: string;
    u_wave: string;
  };
  rhythm_strip_interpretation?: string;
  immersive_image?: string | null;
  cardiac_interpretation: string;
  key_findings: string[];
  systematic_analysis: {
    ritmo: SystematicItem;
    frequencia_cardiaca: SystematicItem;
    eixo_qrs: SystematicItem;
    onda_p: SystematicItem;
    intervalo_pr: SystematicItem;
    complexo_qrs: SystematicItem;
    segmento_st: SystematicItem;
    onda_t: SystematicItem;
    intervalo_qt: SystematicItem;
  };
  epidemiological_data: Array<{ finding: string; prevalence: string; source: string }>;
  color_coded_annotations: Array<{ region: string; color_hex: string; color_name: string; hypothesis: string; probability: string; description: string }>;
  presumptive_diagnosis: {
    name: string;
    confidence: string;
    color: string;
    reasoning: string;
  };
  differential_diagnoses: Array<{
    name: string;
    confidence: string;
    color: string;
    reasoning: string;
  }>;
  action_plan: { immediate_actions: string[]; follow_up: string[]; monitoring: string[] };
  clinical_comment: string;
  recommended_conduct: string;
  severity_level: {
    level: number;
    label: string;
    description: string;
  };
  technical_report: string;
  diagnosis_probabilities: Record<string, string>;
  visual_annotation_instructions: Record<string, string>;
  technical_summary: string;
  simple_summary: string;
  disclaimer: string;
}

export default function FloatingECGAnalyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ecgImage, setEcgImage] = useState<string | null>(null);
  const [ecgPreview, setEcgPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ECGResult | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showSystematic, setShowSystematic] = useState(false);
  const [showEpidemiological, setShowEpidemiological] = useState(false);
  const [showActionPlan, setShowActionPlan] = useState(false);
  const [showLeadByLead, setShowLeadByLead] = useState(false);
  const [showWaveform, setShowWaveform] = useState(false);
  const [showImmersiveImage, setShowImmersiveImage] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [patientHistory, setPatientHistory] = useState('');
  const [savedToStudy, setSavedToStudy] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareScope, setShareScope] = useState('full_summary');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: patientsBundle } = useQuery<any>({
    queryKey: ['/api/fhir/patients'],
    enabled: showAssociateDialog,
  });
  const patients: any[] = patientsBundle?.entry || [];

  const ecgMutation = useMutation({
    mutationFn: async () => {
      if (!ecgImage) throw new Error('No image');
      const patientContext: Record<string, string> = {};
      if (patientAge) patientContext.age = patientAge;
      if (patientSex) patientContext.sex = patientSex;
      if (patientHistory) patientContext.clinicalHistory = patientHistory;
      const res = await apiRequest('POST', '/api/ecg/analyze', {
        imageBase64: ecgImage,
        patientContext,
      });
      return res.json();
    },
    onSuccess: (data: ECGResult) => {
      setResult(data);
      setSavedToStudy(false);
      setIsExpanded(true);
      toast({ title: 'ECG analisado com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro na análise ECG', variant: 'destructive' });
    },
  });

  const saveToStudyMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('No result');
      const content = [
        `## Interpretação Cardíaca`,
        result.cardiac_interpretation,
        ``,
        `## Achados Principais`,
        ...result.key_findings.map(f => `- ${f}`),
        ``,
        `## Diagnóstico Presuntivo`,
        `**${result.presumptive_diagnosis.name}** (${result.presumptive_diagnosis.confidence})`,
        result.presumptive_diagnosis.reasoning,
        ``,
        `## Diagnósticos Diferenciais`,
        ...result.differential_diagnoses.map(d => `- ${d.name}: ${d.confidence} - ${d.reasoning}`),
        ``,
        `## Conduta Recomendada`,
        result.recommended_conduct,
        ``,
        `## Gravidade: ${result.severity_level.label} (${result.severity_level.level}/5)`,
        result.severity_level.description,
        ``,
        `## Laudo Técnico`,
        result.technical_report,
        ``,
        `## Métricas ECG`,
        ...Object.entries(result.ecg_metrics).map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v}`),
        ``,
        `---`,
        `Contexto: ${patientAge ? `Idade: ${patientAge}` : ''} ${patientSex ? `Sexo: ${patientSex}` : ''} ${patientHistory ? `Histórico: ${patientHistory}` : ''}`.trim(),
        `Data: ${new Date().toLocaleString('pt-BR')}`,
      ].join('\n');

      return apiRequest('POST', '/api/doctor-notes', {
        title: `ECG - ${result.presumptive_diagnosis.name} (${new Date().toLocaleDateString('pt-BR')})`,
        content,
        folder: 'ecg_study',
        color: 'blue',
      });
    },
    onSuccess: () => {
      setSavedToStudy(true);
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-notes'] });
      toast({ title: 'Análise salva para estudo', description: 'Acesse pelo painel Study Notes' });
    },
    onError: () => {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    },
  });

  const associateMutation = useMutation({
    mutationFn: async () => {
      if (!result || !selectedPatientId) throw new Error('Missing data');
      return apiRequest('POST', '/api/ecg/associate', {
        patientId: selectedPatientId,
        analysisData: result,
        patientContext: { age: patientAge, sex: patientSex, clinicalHistory: patientHistory },
      });
    },
    onSuccess: () => {
      setShowAssociateDialog(false);
      toast({ title: 'ECG associado ao paciente' });
    },
    onError: () => {
      toast({ title: 'Erro ao associar', variant: 'destructive' });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!result || !shareEmail) throw new Error('Missing data');
      return apiRequest('POST', '/api/ecg/share', {
        recipientEmail: shareEmail,
        contentScope: shareScope,
        analysisData: result,
        patientContext: { age: patientAge, sex: patientSex, clinicalHistory: patientHistory },
      });
    },
    onSuccess: () => {
      setShowShareDialog(false);
      setShareEmail('');
      toast({ title: 'Análise ECG enviada', description: `Preparada para ${shareEmail}` });
    },
    onError: () => {
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    },
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setEcgImage(base64);
      setEcgPreview(e.target?.result as string);
      setResult(null);
      setSavedToStudy(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const clearAll = () => {
    setEcgImage(null);
    setEcgPreview(null);
    setResult(null);
    setPatientAge('');
    setPatientSex('');
    setPatientHistory('');
    setSavedToStudy(false);
  };

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[7.5rem] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
        title="Quick ECG Analyzer"
      >
        <Heart className="h-5 w-5" />
      </button>
    );
  }

  const panelWidth = isExpanded ? 'w-[560px]' : 'w-[380px]';
  const panelHeight = isExpanded ? 'max-h-[90vh]' : 'max-h-[65vh]';

  const severityLevel = result?.severity_level?.level ?? 1;

  return (
    <>
      <div className={`fixed bottom-4 right-4 md:right-20 z-50 ${panelWidth} ${panelHeight} flex flex-col`}>
        <Card className="flex flex-col h-full border-red-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Quick ECG Analyzer
              <Badge variant="outline" className="text-[9px] ml-1">Gemini AI</Badge>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 overflow-auto">
            <CardContent className="p-3 space-y-3">
              {!ecgPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-red-500/30 hover:border-red-500/50 hover:bg-red-500/5'
                  }`}
                >
                  <Upload className="h-8 w-8 mx-auto text-red-400 mb-2" />
                  <p className="text-sm font-medium">
                    {isDragOver ? 'Solte a imagem aqui' : 'Arraste ou clique para upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG - Imagem ECG</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={ecgPreview} alt="ECG" className="w-full h-auto max-h-32 object-contain bg-white" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={clearAll}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Idade</label>
                      <Input
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="Ex: 65"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Sexo</label>
                      <Select value={patientSex} onValueChange={setPatientSex}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Sexo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] text-muted-foreground">Histórico</label>
                      <Input
                        value={patientHistory}
                        onChange={(e) => setPatientHistory(e.target.value)}
                        placeholder="HAS, DM..."
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => ecgMutation.mutate()}
                    disabled={ecgMutation.isPending}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                    size="sm"
                  >
                    {ecgMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisando...</>
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" /> Analisar ECG</>
                    )}
                  </Button>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <Button
                      onClick={() => saveToStudyMutation.mutate()}
                      disabled={saveToStudyMutation.isPending || savedToStudy}
                      variant={savedToStudy ? 'secondary' : 'default'}
                      className={`flex-1 min-w-0 ${!savedToStudy ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' : ''}`}
                      size="sm"
                    >
                      {saveToStudyMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : savedToStudy ? (
                        <><BookOpen className="h-3 w-3 mr-1" /> Salvo</>
                      ) : (
                        <><Save className="h-3 w-3 mr-1" /> Salvar</>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAssociateDialog(true)} className="flex-1 min-w-0">
                      <User className="h-3 w-3 mr-1" /> Paciente
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowShareDialog(true)} className="flex-1 min-w-0">
                      <Mail className="h-3 w-3 mr-1" /> Email
                    </Button>
                  </div>

                  <Card className="border-l-4" style={{ borderLeftColor: result.presumptive_diagnosis.color }}>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold">Diagnóstico Presuntivo</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className={`text-[9px] text-white ${SEVERITY_COLORS[severityLevel] || 'bg-gray-500'}`}>
                            {result.severity_level.label} ({severityLevel}/5)
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs font-bold" style={{ color: result.presumptive_diagnosis.color }}>
                        {result.presumptive_diagnosis.name} ({result.presumptive_diagnosis.confidence})
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{result.presumptive_diagnosis.reasoning}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-500/20">
                    <CardContent className="p-2">
                      <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                        <Heart className="h-3 w-3" /> Interpretação Cardíaca
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{result.cardiac_interpretation}</p>
                    </CardContent>
                  </Card>

                  {result.key_findings.length > 0 && (
                    <Card className="border-amber-500/20">
                      <CardContent className="p-2">
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Achados Principais
                        </p>
                        <ul className="space-y-0.5">
                          {result.key_findings.map((f, i) => (
                            <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                              <span className="text-amber-500 mt-0.5">•</span> {f}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {result.clinical_comment && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-2">
                        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                          <Siren className="h-3 w-3" /> Comentário Clínico Importante
                        </p>
                        <p className="text-[10px] text-foreground leading-relaxed font-medium">{result.clinical_comment}</p>
                      </CardContent>
                    </Card>
                  )}

                  {result.immersive_image && (
                    <>
                      <button
                        onClick={() => setShowImmersiveImage(!showImmersiveImage)}
                        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3 text-indigo-500" /> Visualização Imersiva AI
                        </span>
                        {showImmersiveImage ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showImmersiveImage && (
                        <Card className="border-indigo-500/30 overflow-hidden">
                          <CardContent className="p-0">
                            <img
                              src={`data:image/png;base64,${result.immersive_image}`}
                              alt="ECG Immersive AI Visualization"
                              className="w-full h-auto rounded-lg"
                            />
                            <p className="text-[9px] text-muted-foreground text-center py-1 bg-muted/30">
                              Imagem gerada por IA (gpt-image-1) — Ilustrativa, não substitui laudo médico
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}

                  {result.lead_by_lead_analysis && Object.keys(result.lead_by_lead_analysis).length > 0 && (
                    <>
                      <button
                        onClick={() => setShowLeadByLead(!showLeadByLead)}
                        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" /> Análise Derivação por Derivação
                        </span>
                        {showLeadByLead ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showLeadByLead && (
                        <div className="space-y-1">
                          {Object.entries(result.lead_by_lead_analysis).map(([lead, finding]) => (
                            <div key={lead} className="p-1.5 rounded border bg-muted/30 text-[10px]">
                              <span className="font-semibold text-blue-500">{lead}:</span>{' '}
                              <span className="text-muted-foreground">{finding}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {result.waveform_segmentation && (
                    <>
                      <button
                        onClick={() => setShowWaveform(!showWaveform)}
                        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Segmentação de Formas de Onda
                        </span>
                        {showWaveform ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showWaveform && (
                        <div className="space-y-1">
                          {Object.entries(result.waveform_segmentation).map(([key, val]) => (
                            <div key={key} className="p-1.5 rounded border bg-muted/30 text-[10px]">
                              <span className="font-semibold uppercase">{key.replace(/_/g, ' ')}:</span>{' '}
                              <span className="text-muted-foreground">{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {result.rhythm_strip_interpretation && (
                    <Card className="border-purple-500/20">
                      <CardContent className="p-2">
                        <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Interpretação da Faixa de Ritmo
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{result.rhythm_strip_interpretation}</p>
                      </CardContent>
                    </Card>
                  )}

                  <button
                    onClick={() => setShowSystematic(!showSystematic)}
                    className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> Análise Sistemática (9 Critérios)
                    </span>
                    {showSystematic ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showSystematic && result.systematic_analysis && (
                    <div className="space-y-1">
                      {Object.entries(result.systematic_analysis).map(([key, item]) => (
                        <div key={key} className={`p-2 rounded-lg border text-[10px] ${item.is_normal ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold uppercase flex items-center gap-1">
                              {item.is_normal ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                              {key.replace(/_/g, ' ')}
                            </span>
                            <Badge variant="outline" className="text-[8px]">{item.percentage_descriptor}</Badge>
                          </div>
                          <p className="font-medium">{item.finding}</p>
                          <p className="text-muted-foreground">Ref: {item.normal_range}</p>
                          {item.clinical_significance && <p className="text-muted-foreground italic mt-0.5">{item.clinical_significance}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {result.color_coded_annotations && result.color_coded_annotations.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold flex items-center gap-1">
                        <Palette className="h-3 w-3" /> Anotações Coloridas
                      </p>
                      <div className="space-y-1">
                        {result.color_coded_annotations.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 p-1.5 rounded border bg-muted/30">
                            <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: a.color_hex }} />
                            <div className="flex-1 min-w-0 text-[10px]">
                              <p className="font-medium">{a.region} — {a.hypothesis}</p>
                              <p className="text-muted-foreground">{a.description}</p>
                            </div>
                            <Badge variant="outline" className="text-[8px] shrink-0">{a.probability}</Badge>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div>
                    <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" /> Diagnósticos Diferenciais
                    </p>
                    <div className="space-y-1">
                      {result.differential_diagnoses.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded border bg-muted/30">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color || DX_COLORS[i % DX_COLORS.length] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium truncate">{d.name}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{d.reasoning}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{d.confidence}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(result.diagnosis_probabilities).map(([name, prob]) => ({
                          name: name.replace(/_/g, ' '),
                          probability: parseFloat(prob) || 0,
                        }))}
                        layout="vertical"
                        margin={{ left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 9 }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(val: number) => `${val}%`} />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {Object.entries(result.diagnosis_probabilities).map((_, idx) => (
                            <Cell key={idx} fill={DX_COLORS[idx % DX_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <Card className="border-green-500/20">
                    <CardContent className="p-2">
                      <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Conduta Recomendada
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{result.recommended_conduct}</p>
                    </CardContent>
                  </Card>

                  {result.action_plan && (result.action_plan.immediate_actions.length > 0 || result.action_plan.follow_up.length > 0 || result.action_plan.monitoring.length > 0) && (
                    <>
                      <button
                        onClick={() => setShowActionPlan(!showActionPlan)}
                        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <Siren className="h-3 w-3" /> Plano de Ação
                        </span>
                        {showActionPlan ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showActionPlan && (
                        <Card className="border-orange-500/20">
                          <CardContent className="p-2 space-y-2">
                            {result.action_plan.immediate_actions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-0.5">Ações Imediatas</p>
                                {result.action_plan.immediate_actions.map((a, i) => (
                                  <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><span className="text-red-500">•</span> {a}</p>
                                ))}
                              </div>
                            )}
                            {result.action_plan.follow_up.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-0.5">Acompanhamento</p>
                                {result.action_plan.follow_up.map((a, i) => (
                                  <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><span className="text-amber-500">•</span> {a}</p>
                                ))}
                              </div>
                            )}
                            {result.action_plan.monitoring.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-0.5">Monitoramento</p>
                                {result.action_plan.monitoring.map((a, i) => (
                                  <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><span className="text-blue-500">•</span> {a}</p>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}

                  {result.epidemiological_data && result.epidemiological_data.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowEpidemiological(!showEpidemiological)}
                        className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Dados Epidemiológicos
                        </span>
                        {showEpidemiological ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showEpidemiological && (
                        <div className="space-y-1">
                          {result.epidemiological_data.map((e, i) => (
                            <div key={i} className="p-1.5 rounded border bg-muted/30 text-[10px]">
                              <p className="font-medium">{e.finding}</p>
                              <p className="text-muted-foreground">Prevalência: {e.prevalence}</p>
                              <p className="text-muted-foreground italic">Fonte: {e.source}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Métricas ECG
                    </span>
                    {showMetrics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showMetrics && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(result.ecg_metrics).map(([key, val]) => (
                        <div key={key} className="p-2 rounded-lg bg-muted/50 border">
                          <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</p>
                          <p className="text-xs font-medium">{val}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowReport(!showReport)}
                    className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Laudo Técnico
                    </span>
                    {showReport ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showReport && (
                    <Card className="border-blue-500/20">
                      <CardContent className="p-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line">{result.technical_report}</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-blue-500/20">
                    <CardContent className="p-2">
                      <p className="text-xs font-medium mb-1">Resumo</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{result.simple_summary}</p>
                    </CardContent>
                  </Card>

                  <div className="flex items-start gap-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">{result.disclaimer}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>

      <Dialog open={showAssociateDialog} onOpenChange={setShowAssociateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4" /> Associar ECG a Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar paciente..." />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p: any) => {
                  const name = p.resource?.name?.[0]?.text || p.resource?.name?.[0]?.given?.join(' ') || p.resource?.id;
                  return (
                    <SelectItem key={p.resource?.id} value={p.resource?.id || ''}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssociateDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => associateMutation.mutate()}
              disabled={!selectedPatientId || associateMutation.isPending}
            >
              {associateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Associar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Enviar Análise por Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Email do Destinatário</Label>
              <Input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="medico@hospital.com"
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Conteúdo a Enviar</Label>
              <RadioGroup value={shareScope} onValueChange={setShareScope} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="study_analysis" id="sa" />
                  <Label htmlFor="sa" className="text-xs">Estudo + Análise</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="analysis_only" id="ao" />
                  <Label htmlFor="ao" className="text-xs">Somente Análise</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="report_only" id="ro" />
                  <Label htmlFor="ro" className="text-xs">Somente Laudo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full_summary" id="fs" />
                  <Label htmlFor="fs" className="text-xs">Resumo Completo</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => shareMutation.mutate()}
              disabled={!shareEmail || shareMutation.isPending}
            >
              {shareMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
