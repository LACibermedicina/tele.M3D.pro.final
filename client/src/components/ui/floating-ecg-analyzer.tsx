import { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Heart, X, Upload, Zap, Loader2, Minimize2, Maximize2,
  Save, BookOpen, User, AlertTriangle, Stethoscope,
  ImageIcon, Trash2, ExternalLink, Download
} from 'lucide-react';

const SEVERITY_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-red-700',
};

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
  systematic_analysis: Record<string, any>;
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
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [ecgImage, setEcgImage] = useState<string | null>(null);
  const [ecgPreview, setEcgPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ECGResult | null>(null);
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [patientHistory, setPatientHistory] = useState('');
  const [savedToStudy, setSavedToStudy] = useState(false);
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
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
      setDetailImage(null);
      setIsExpanded(true);
      toast({ title: 'ECG analisado com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro na análise ECG', variant: 'destructive' });
    },
  });

  const generateDetailImageMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('No analysis result');
      const res = await apiRequest('POST', '/api/ecg/generate-detail-image', {
        analysisData: result,
      });
      return res.json();
    },
    onSuccess: (data: { detail_image: string }) => {
      setDetailImage(data.detail_image);
      toast({ title: 'Imagem descritiva avançada gerada com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao gerar imagem descritiva', variant: 'destructive' });
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

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setEcgImage(base64);
      setEcgPreview(e.target?.result as string);
      setResult(null);
      setSavedToStudy(false);
      setDetailImage(null);
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
    setDetailImage(null);
  };

  const saveDetailImage = () => {
    if (!detailImage) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${detailImage}`;
    link.download = `ecg-analise-detalhada-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[7.5rem] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
        title="Análise de Estudo ECG"
      >
        <Heart className="h-5 w-5" />
      </button>
    );
  }

  const panelWidth = isExpanded ? 'w-[560px]' : 'w-[380px]';
  const panelHeight = isExpanded ? 'max-h-[90vh]' : 'max-h-[65vh]';
  const severityLevel = result?.severity_level?.level ?? 1;
  const analysisLocked = !!result && !savedToStudy;

  return (
    <>
      <div className={`fixed bottom-4 right-4 md:right-20 z-50 ${panelWidth} ${panelHeight} flex flex-col`}>
        <Card className="flex flex-col h-full border-red-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Análise de Estudo
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
                    disabled={ecgMutation.isPending || analysisLocked}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700"
                    size="sm"
                  >
                    {ecgMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisando...</>
                    ) : analysisLocked ? (
                      <><Zap className="h-3 w-3 mr-1" /> Salve ou limpe para novo estudo</>
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" /> Analisar ECG</>
                    )}
                  </Button>

                  {result && (
                    <Button
                      onClick={() => generateDetailImageMutation.mutate()}
                      disabled={generateDetailImageMutation.isPending}
                      className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white"
                      size="sm"
                    >
                      {generateDetailImageMutation.isPending ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando Imagem...</>
                      ) : (
                        <><ImageIcon className="h-3 w-3 mr-1" /> Gerar Imagem Descritiva Avançada</>
                      )}
                    </Button>
                  )}

                  {detailImage && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <ImageIcon className="h-3 w-3" /> Análise Didática ECG
                      </p>
                      <div className="rounded-lg overflow-hidden border border-rose-500/30">
                        <img
                          src={`data:image/png;base64,${detailImage}`}
                          alt="Análise Didática ECG"
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const w = window.open();
                            if (w) {
                              w.document.write(`<html><head><title>Análise Didática ECG</title><style>body{margin:0;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh;}</style></head><body><img src="data:image/png;base64,${detailImage}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`);
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6" onClick={saveDetailImage}>
                          <Download className="h-3 w-3 mr-1" /> Salvar Imagem
                        </Button>
                      </div>
                      <p className="text-[9px] text-muted-foreground text-center">Clique na imagem para tela cheia</p>
                    </div>
                  )}
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <Card className="border-l-4" style={{ borderLeftColor: result.presumptive_diagnosis.color }}>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold">Diagnóstico Presuntivo</p>
                        </div>
                        <Badge className={`text-[9px] text-white ${SEVERITY_COLORS[severityLevel] || 'bg-gray-500'}`}>
                          {result.severity_level.label} ({severityLevel}/5)
                        </Badge>
                      </div>
                      <p className="text-xs font-bold" style={{ color: result.presumptive_diagnosis.color }}>
                        {result.presumptive_diagnosis.name} ({result.presumptive_diagnosis.confidence})
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{result.presumptive_diagnosis.reasoning}</p>
                    </CardContent>
                  </Card>

                  {result.clinical_comment && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="p-2">
                        <p className="text-[10px] text-foreground leading-relaxed font-medium">{result.clinical_comment}</p>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-green-500/20">
                    <CardContent className="p-2">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{result.recommended_conduct}</p>
                    </CardContent>
                  </Card>

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
                  </div>

                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsOpen(false);
                        setLocation('/fhir-dashboard');
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Aprofundamento
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={clearAll}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Limpar Tudo
                    </Button>
                  </div>

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
    </>
  );
}
