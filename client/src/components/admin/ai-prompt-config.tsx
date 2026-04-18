import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, ChevronDown, ChevronUp, Palette, AlertTriangle, Settings, Code, Image } from 'lucide-react';
import { useAccessModality } from '@/contexts/AccessModalityContext';

interface SeverityLevel {
  level: number;
  label: string;
  description: string;
}

interface ColorSemantic {
  color: string;
  hex: string;
  meaning: string;
}

interface AIModelParams {
  temperature: number;
  maxTokens: number;
  model: string;
}

interface ECGConfig {
  analysisPrompts: {
    pass1_ecgReader: string;
    pass2_ekgAnalyst: string;
    pass3_cardiologistSenior: string;
  };
  severityScale: SeverityLevel[];
  colorSemantics: ColorSemantic[];
  imageGenerationPrompt: string;
  detailImageGenerationPrompt: string;
  modelParams: AIModelParams;
  jsonSchemaTemplate: string;
}

interface RadiologyConfig {
  analysisPrompt: string;
  severityScale: SeverityLevel[];
  colorSemantics: ColorSemantic[];
  imageGenerationPrompt: string;
  modelParams: AIModelParams;
  jsonSchemaTemplate: string;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: { title: string; icon: any; children: any; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const Icon = icon;
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-indigo-400" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      {isOpen && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

function SeverityEditor({ severityScale, onChange }: { severityScale: SeverityLevel[]; onChange: (s: SeverityLevel[]) => void }) {
  const updateLevel = (index: number, field: keyof SeverityLevel, value: any) => {
    const updated = [...severityScale];
    updated[index] = { ...updated[index], [field]: field === 'level' ? Number(value) : value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {severityScale.map((s, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-1">
            <Input type="number" min={1} max={5} value={s.level} onChange={e => updateLevel(i, 'level', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Input value={s.label} onChange={e => updateLevel(i, 'label', e.target.value)} placeholder="Label" />
          </div>
          <div className="col-span-9">
            <Input value={s.description} onChange={e => updateLevel(i, 'description', e.target.value)} placeholder="Descrição" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorEditor({ colorSemantics, onChange }: { colorSemantics: ColorSemantic[]; onChange: (c: ColorSemantic[]) => void }) {
  const updateColor = (index: number, field: keyof ColorSemantic, value: string) => {
    const updated = [...colorSemantics];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addColor = () => {
    onChange([...colorSemantics, { color: '', hex: '#000000', meaning: '' }]);
  };

  const removeColor = (index: number) => {
    onChange(colorSemantics.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {colorSemantics.map((c, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-2">
            <Input value={c.color} onChange={e => updateColor(i, 'color', e.target.value)} placeholder="Nome da cor" />
          </div>
          <div className="col-span-1">
            <input type="color" value={c.hex} onChange={e => updateColor(i, 'hex', e.target.value)} className="w-full h-9 rounded border cursor-pointer" />
          </div>
          <div className="col-span-2">
            <Input value={c.hex} onChange={e => updateColor(i, 'hex', e.target.value)} placeholder="#hex" />
          </div>
          <div className="col-span-6">
            <Input value={c.meaning} onChange={e => updateColor(i, 'meaning', e.target.value)} placeholder="Significado semântico" />
          </div>
          <div className="col-span-1">
            <Button variant="ghost" size="sm" onClick={() => removeColor(i)} className="text-red-400 hover:text-red-300">×</Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addColor}>+ Adicionar Cor</Button>
    </div>
  );
}

function ModelParamsEditor({ modelParams, onChange }: { modelParams: AIModelParams; onChange: (p: AIModelParams) => void }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label>Modelo</Label>
        <Input value={modelParams.model} onChange={e => onChange({ ...modelParams, model: e.target.value })} />
      </div>
      <div>
        <Label>Temperature (0-1)</Label>
        <Input type="number" step="0.1" min={0} max={1} value={modelParams.temperature} onChange={e => onChange({ ...modelParams, temperature: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <Label>Max Tokens</Label>
        <Input type="number" min={256} max={32768} value={modelParams.maxTokens} onChange={e => onChange({ ...modelParams, maxTokens: parseInt(e.target.value) || 4096 })} />
      </div>
    </div>
  );
}

export function ECGConfigTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ECGConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<ECGConfig>({
    queryKey: ['/api/admin/ai-config', 'ecg'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-config/ecg', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (c: ECGConfig) => apiRequest('PUT', '/api/admin/ai-config/ecg', c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config', 'ecg'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração ECG salva com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar configuração', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/ai-config/ecg/reset'),
    onSuccess: async (res) => {
      const defaults = await res.json();
      setConfig(defaults);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config', 'ecg'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração ECG restaurada para os padrões' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao restaurar padrões', variant: 'destructive' });
    },
  });

  const updateConfig = (updates: Partial<ECGConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
      setHasChanges(true);
    }
  };

  if (isLoading || !config) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Configuração ECG - Prompts IA</h2>
          <p className="text-sm text-gray-400">Configure os prompts de análise ECG por tripla verificação e geração de imagens</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && <Badge variant="outline" className="text-yellow-400 border-yellow-400">Alterações não salvas</Badge>}
          <Button variant="outline" size="sm" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar Padrões
          </Button>
          <Button size="sm" onClick={() => config && saveMutation.mutate(config)} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <CollapsibleSection title="Prompt Passe 1 — ECG Reader" icon={Settings} defaultOpen>
        <CardDescription>Pipeline de 7 fases do ECG Reader. Use {'{{patientInfo}}'}, {'{{colorSemantics}}'}, {'{{jsonSchema}}'}, {'{{severityScale}}'} como variáveis.</CardDescription>
        <Textarea
          rows={16}
          value={config.analysisPrompts.pass1_ecgReader}
          onChange={e => updateConfig({ analysisPrompts: { ...config.analysisPrompts, pass1_ecgReader: e.target.value } })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Prompt Passe 2 — EKG Analyst" icon={Settings}>
        <CardDescription>Metodologia do EKG Analyst. Mesmas variáveis disponíveis.</CardDescription>
        <Textarea
          rows={16}
          value={config.analysisPrompts.pass2_ekgAnalyst}
          onChange={e => updateConfig({ analysisPrompts: { ...config.analysisPrompts, pass2_ekgAnalyst: e.target.value } })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Prompt Passe 3 — Cardiologista Sênior" icon={Settings}>
        <CardDescription>Validação final pelo cardiologista sênior. Mesmas variáveis disponíveis.</CardDescription>
        <Textarea
          rows={16}
          value={config.analysisPrompts.pass3_cardiologistSenior}
          onChange={e => updateConfig({ analysisPrompts: { ...config.analysisPrompts, pass3_cardiologistSenior: e.target.value } })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Escala de Severidade" icon={AlertTriangle}>
        <CardDescription>Definições dos níveis de gravidade 1-5</CardDescription>
        <SeverityEditor severityScale={config.severityScale} onChange={s => updateConfig({ severityScale: s })} />
      </CollapsibleSection>

      <CollapsibleSection title="Semântica de Cores" icon={Palette}>
        <CardDescription>Mapeamento de cores para significados clínicos</CardDescription>
        <ColorEditor colorSemantics={config.colorSemantics} onChange={c => updateConfig({ colorSemantics: c })} />
      </CollapsibleSection>

      <CollapsibleSection title="Prompt de Geração de Imagem (Resumo)" icon={Image}>
        <CardDescription>Template do prompt para geração da imagem imersiva ECG. Variáveis: {'{{langName}}'}, {'{{diagnosis}}'}, {'{{severity}}'}, {'{{annotations}}'}, {'{{findings}}'}</CardDescription>
        <Textarea
          rows={16}
          value={config.imageGenerationPrompt}
          onChange={e => updateConfig({ imageGenerationPrompt: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Prompt de Geração de Imagem (Detalhado)" icon={Image}>
        <CardDescription>Template do prompt para imagem didática detalhada. Variáveis: {'{{langName}}'}, {'{{diagnosis}}'}, {'{{confidence}}'}, {'{{severity}}'}, {'{{severityLevel}}'}, {'{{keyFindings}}'}, {'{{differentials}}'}, {'{{interpretation}}'}, {'{{clinicalComment}}'}, {'{{colorAnnotations}}'}, {'{{metricsStr}}'}, {'{{conduct}}'}, {'{{immediateActions}}'}, {'{{techReport}}'}</CardDescription>
        <Textarea
          rows={16}
          value={config.detailImageGenerationPrompt}
          onChange={e => updateConfig({ detailImageGenerationPrompt: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Parâmetros do Modelo IA" icon={Settings}>
        <CardDescription>Configuração do modelo de IA utilizado nas análises</CardDescription>
        <ModelParamsEditor modelParams={config.modelParams} onChange={p => updateConfig({ modelParams: p })} />
      </CollapsibleSection>

      <CollapsibleSection title="Template do Schema JSON" icon={Code}>
        <CardDescription>Estrutura JSON esperada na resposta da IA</CardDescription>
        <Textarea
          rows={20}
          value={config.jsonSchemaTemplate}
          onChange={e => updateConfig({ jsonSchemaTemplate: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>
    </div>
  );
}

export function RadiologyConfigTab() {
  const { isClassic } = useAccessModality();
  if (isClassic) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Radiologia indisponível</CardTitle>
          <CardDescription>
            A modalidade Clássica está ativa. Mude para Profissional ou Assistida em "Modalidades de Acesso" para configurar a radiologia.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <RadiologyConfigTabInner />;
}

function RadiologyConfigTabInner() {
  const { toast } = useToast();
  const [config, setConfig] = useState<RadiologyConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<RadiologyConfig>({
    queryKey: ['/api/admin/ai-config', 'radiology'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-config/radiology', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (c: RadiologyConfig) => apiRequest('PUT', '/api/admin/ai-config/radiology', c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config', 'radiology'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração Radiologia salva com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar configuração', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/ai-config/radiology/reset'),
    onSuccess: async (res) => {
      const defaults = await res.json();
      setConfig(defaults);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config', 'radiology'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração Radiologia restaurada para os padrões' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao restaurar padrões', variant: 'destructive' });
    },
  });

  const updateConfig = (updates: Partial<RadiologyConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
      setHasChanges(true);
    }
  };

  if (isLoading || !config) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Configuração Radiologia - Prompts IA</h2>
          <p className="text-sm text-gray-400">Configure os prompts de análise radiológica e geração de imagens PACS</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && <Badge variant="outline" className="text-yellow-400 border-yellow-400">Alterações não salvas</Badge>}
          <Button variant="outline" size="sm" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar Padrões
          </Button>
          <Button size="sm" onClick={() => config && saveMutation.mutate(config)} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <CollapsibleSection title="Prompt de Análise Radiológica" icon={Settings} defaultOpen>
        <CardDescription>Prompt principal para análise radiológica. Variáveis: {'{{patientInfo}}'}, {'{{colorSemantics}}'}, {'{{jsonSchema}}'}, {'{{severityScale}}'}</CardDescription>
        <Textarea
          rows={20}
          value={config.analysisPrompt}
          onChange={e => updateConfig({ analysisPrompt: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Escala de Severidade" icon={AlertTriangle}>
        <CardDescription>Definições dos níveis de gravidade 1-5</CardDescription>
        <SeverityEditor severityScale={config.severityScale} onChange={s => updateConfig({ severityScale: s })} />
      </CollapsibleSection>

      <CollapsibleSection title="Semântica de Cores" icon={Palette}>
        <CardDescription>Mapeamento de cores para significados clínicos radiológicos</CardDescription>
        <ColorEditor colorSemantics={config.colorSemantics} onChange={c => updateConfig({ colorSemantics: c })} />
      </CollapsibleSection>

      <CollapsibleSection title="Prompt de Geração de Imagem PACS" icon={Image}>
        <CardDescription>
          Template do prompt para geração da imagem imersiva PACS. Variáveis disponíveis: {'{{langName}}'}, {'{{region}}'}, {'{{dominantPathology}}'}, {'{{severity}}'}, {'{{severityLevel}}'}, {'{{laterality}}'}, {'{{impactPct}}'}, {'{{description}}'}, {'{{anatomicalOverlay}}'}, {'{{differentials}}'}, {'{{laySummary}}'}, {'{{colorRegions}}'}, {'{{multiSpecialty}}'}, {'{{immediateActions}}'}, {'{{followUp}}'}, e muitas outras.
        </CardDescription>
        <Textarea
          rows={20}
          value={config.imageGenerationPrompt}
          onChange={e => updateConfig({ imageGenerationPrompt: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Parâmetros do Modelo IA" icon={Settings}>
        <CardDescription>Configuração do modelo de IA utilizado nas análises radiológicas</CardDescription>
        <ModelParamsEditor modelParams={config.modelParams} onChange={p => updateConfig({ modelParams: p })} />
      </CollapsibleSection>

      <CollapsibleSection title="Template do Schema JSON" icon={Code}>
        <CardDescription>Estrutura JSON esperada na resposta da IA para radiologia</CardDescription>
        <Textarea
          rows={20}
          value={config.jsonSchemaTemplate}
          onChange={e => updateConfig({ jsonSchemaTemplate: e.target.value })}
          className="font-mono text-xs"
        />
      </CollapsibleSection>
    </div>
  );
}
