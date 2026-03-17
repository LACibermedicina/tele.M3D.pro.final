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
  Scan, X, Upload, Zap, Loader2, Minimize2, Maximize2,
  AlertTriangle, Save, BookOpen, User, Stethoscope,
  ImageIcon, Trash2, ExternalLink, Download
} from 'lucide-react';

const SEVERITY_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-red-700',
};

const ANATOMICAL_REGIONS = [
  'Tórax (PA)', 'Tórax (Lateral)', 'Crânio', 'Coluna Cervical', 'Coluna Torácica',
  'Coluna Lombar', 'Abdome', 'Pelve', 'Ombro', 'Cotovelo', 'Punho/Mão',
  'Quadril', 'Joelho', 'Tornozelo/Pé', 'Seios da Face', 'Outro'
];

interface RadiologyResult {
  radiology_findings: {
    dominant_pathology: string;
    anatomical_region: string;
    clinical_impact_percentage: string;
    laterality: string;
    description: string;
  };
  anatomical_overlay: Array<{ structure: string; relevance_percentage: string; comment: string; status: string }>;
  normal_comparison: { description: string; key_differences: string[] };
  pathophysiology_model: string;
  probabilistic_diagnosis: {
    presumptive: { name: string; confidence: string; color: string; reasoning: string };
    differentials: Array<{ name: string; confidence: string; color: string; reasoning: string }>;
  };
  prognostic_estimation: { severity_score: string; functional_progression_risk: string; intervention_risk: string; prognosis_model: string };
  formal_report: { exam: string; technique: string; findings: string; diagnostic_impression: string; recommendations: string };
  lay_summary: string[];
  educational_note: { quality_score: number; quality_assessment: string; didactic_note: string; next_steps: string };
  severity_level: { level: number; label: string; description: string };
  recommended_conduct: string;
  multi_specialty_relevance: Array<{ specialty: string; relevance: string; urgency: string }>;
  technical_quality: { projection: string; rotation: string; centering: string; penetration: string; collimation: string; artifacts: string; score: number };
  color_coded_regions: Array<{ region: string; color_hex: string; color_name: string; finding: string; risk_level: string }>;
  clinical_comment: string;
  action_plan: { immediate_actions: string[]; follow_up: string[]; monitoring: string[] };
  disclaimer: string;
}

export default function FloatingRadiologyAnalyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [radImage, setRadImage] = useState<string | null>(null);
  const [radPreview, setRadPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RadiologyResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('');
  const [patientHistory, setPatientHistory] = useState('');
  const [anatomicalRegion, setAnatomicalRegion] = useState('');
  const [savedToStudy, setSavedToStudy] = useState(false);
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [immersiveImage, setImmersiveImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: patientsBundle } = useQuery<any>({
    queryKey: ['/api/fhir/patients'],
    enabled: showAssociateDialog,
  });
  const patients: any[] = patientsBundle?.entry || [];

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!radImage) throw new Error('No image');
      const patientContext: Record<string, string> = {};
      if (patientAge) patientContext.age = patientAge;
      if (patientSex) patientContext.sex = patientSex;
      if (patientHistory) patientContext.clinicalHistory = patientHistory;
      if (anatomicalRegion) patientContext.anatomicalRegion = anatomicalRegion;
      const res = await apiRequest('POST', '/api/radiology/analyze', {
        imageBase64: radImage,
        patientContext,
      });
      return res.json();
    },
    onSuccess: (data: RadiologyResult) => {
      setResult(data);
      setSavedToStudy(false);
      setImmersiveImage(null);
      setIsExpanded(true);
      toast({ title: 'Radiografia analisada com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro na análise radiológica', variant: 'destructive' });
    },
  });

  const saveToStudyMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('No result');
      const content = [
        `## Achado Principal`,
        `**${result.radiology_findings.dominant_pathology}** (${result.radiology_findings.anatomical_region})`,
        result.radiology_findings.description,
        ``,
        `## Diagnóstico Presuntivo`,
        `**${result.probabilistic_diagnosis.presumptive.name}** (${result.probabilistic_diagnosis.presumptive.confidence})`,
        result.probabilistic_diagnosis.presumptive.reasoning,
        ``,
        `## Diagnósticos Diferenciais`,
        ...result.probabilistic_diagnosis.differentials.map(d => `- ${d.name}: ${d.confidence} - ${d.reasoning}`),
        ``,
        `## Conduta Recomendada`,
        result.recommended_conduct,
        ``,
        `## Gravidade: ${result.severity_level.label} (${result.severity_level.level}/5)`,
        result.severity_level.description,
        ``,
        `## Laudo Formal`,
        `Exame: ${result.formal_report.exam}`,
        `Achados: ${result.formal_report.findings}`,
        `Impressão: ${result.formal_report.diagnostic_impression}`,
        `Recomendações: ${result.formal_report.recommendations}`,
        ``,
        `---`,
        `Contexto: ${patientAge ? `Idade: ${patientAge}` : ''} ${patientSex ? `Sexo: ${patientSex}` : ''} ${anatomicalRegion ? `Região: ${anatomicalRegion}` : ''}`.trim(),
        `Data: ${new Date().toLocaleString('pt-BR')}`,
      ].join('\n');

      return apiRequest('POST', '/api/doctor-notes', {
        title: `Radiologia - ${result.probabilistic_diagnosis.presumptive.name} (${new Date().toLocaleDateString('pt-BR')})`,
        content,
        folder: 'radiology_study',
        color: 'purple',
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
      return apiRequest('POST', '/api/radiology/associate', {
        patientId: selectedPatientId,
        analysisData: result,
        patientContext: { age: patientAge, sex: patientSex, clinicalHistory: patientHistory, anatomicalRegion },
      });
    },
    onSuccess: () => {
      setShowAssociateDialog(false);
      toast({ title: 'Radiografia associada ao paciente' });
    },
    onError: () => {
      toast({ title: 'Erro ao associar', variant: 'destructive' });
    },
  });

  const generateImmersiveImageMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('No analysis result');
      const res = await apiRequest('POST', '/api/radiology/generate-immersive-image', {
        analysisData: result,
      });
      return res.json();
    },
    onSuccess: (data: { immersive_image: string }) => {
      setImmersiveImage(data.immersive_image);
      toast({ title: 'Imagem descritiva avançada gerada com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao gerar imagem descritiva', variant: 'destructive' });
    },
  });

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      setRadImage(base64);
      setRadPreview(e.target?.result as string);
      setResult(null);
      setSavedToStudy(false);
      setImmersiveImage(null);
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
    setRadImage(null);
    setRadPreview(null);
    setResult(null);
    setPatientAge('');
    setPatientSex('');
    setPatientHistory('');
    setAnatomicalRegion('');
    setSavedToStudy(false);
    setImmersiveImage(null);
  };

  const saveImmersiveImage = () => {
    if (!immersiveImage) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${immersiveImage}`;
    link.download = `radiologia-pacs-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[10.5rem] right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110"
        title="Análise de Estudo Radiológico"
      >
        <Scan className="h-5 w-5" />
      </button>
    );
  }

  const panelWidth = isExpanded ? 'w-[560px]' : 'w-[380px]';
  const panelHeight = isExpanded ? 'max-h-[90vh]' : 'max-h-[65vh]';
  const severityLevel = result?.severity_level?.level ?? 1;
  const analysisLocked = !!result;

  return (
    <>
      <div className={`fixed bottom-4 right-4 md:right-20 z-50 ${panelWidth} ${panelHeight} flex flex-col`}>
        <Card className="flex flex-col h-full border-indigo-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scan className="h-4 w-4 text-indigo-500" />
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
              {!radPreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/5'
                  }`}
                >
                  <Upload className="h-8 w-8 mx-auto text-indigo-400 mb-2" />
                  <p className="text-sm font-medium">
                    {isDragOver ? 'Solte a imagem aqui' : 'Arraste ou clique para upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG - Imagem Radiográfica</p>
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
                    <img src={radPreview} alt="Radiografia" className="w-full h-auto max-h-32 object-contain bg-black" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={clearAll}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
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
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">Região Anatômica</label>
                    <Select value={anatomicalRegion} onValueChange={setAnatomicalRegion}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Selecionar região..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ANATOMICAL_REGIONS.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground">Histórico Clínico</label>
                    <Input
                      value={patientHistory}
                      onChange={(e) => setPatientHistory(e.target.value)}
                      placeholder="Queixa, antecedentes..."
                      className="h-7 text-xs"
                    />
                  </div>

                  <Button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending || analysisLocked}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    size="sm"
                  >
                    {analyzeMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analisando...</>
                    ) : analysisLocked ? (
                      <><Zap className="h-3 w-3 mr-1" /> Limpe para novo estudo</>
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" /> Analisar Radiografia</>
                    )}
                  </Button>

                  {result && (
                    <Button
                      onClick={() => generateImmersiveImageMutation.mutate()}
                      disabled={generateImmersiveImageMutation.isPending}
                      className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white"
                      size="sm"
                    >
                      {generateImmersiveImageMutation.isPending ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando Imagem PACS...</>
                      ) : (
                        <><ImageIcon className="h-3 w-3 mr-1" /> Gerar Imagem Descritiva Avançada</>
                      )}
                    </Button>
                  )}

                  {immersiveImage && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <ImageIcon className="h-3 w-3" /> Painel PACS Imersivo
                      </p>
                      <div className="rounded-lg overflow-hidden border border-rose-500/30">
                        <img
                          src={`data:image/png;base64,${immersiveImage}`}
                          alt="Painel PACS Imersivo"
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const w = window.open();
                            if (w) {
                              w.document.write(`<html><head><title>Painel PACS Imersivo</title><style>body{margin:0;background:#1a1a2e;display:flex;justify-content:center;align-items:center;min-height:100vh;}</style></head><body><img src="data:image/png;base64,${immersiveImage}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`);
                            }
                          }}
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6" onClick={saveImmersiveImage}>
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
                  <Card className="border-l-4" style={{ borderLeftColor: result.probabilistic_diagnosis.presumptive.color }}>
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
                      <p className="text-xs font-bold" style={{ color: result.probabilistic_diagnosis.presumptive.color }}>
                        {result.probabilistic_diagnosis.presumptive.name} ({result.probabilistic_diagnosis.presumptive.confidence})
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{result.probabilistic_diagnosis.presumptive.reasoning}</p>
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
              <User className="h-4 w-4" /> Associar Radiografia a Paciente
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
