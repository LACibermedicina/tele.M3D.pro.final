import { useState, useRef, useCallback, useEffect } from 'react';
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
  Scan, X, Upload, Zap, Loader2,
  Save, User, UserPlus, AlertTriangle, Stethoscope,
  ImageIcon, Trash2, ExternalLink, Download, GripVertical
} from 'lucide-react';

const SEVERITY_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-red-700',
};

const DEFAULT_POS = { x: -1, y: -1 };
const DEFAULT_SIZE = { w: 360, h: 500 };
const MIN_SIZE = { w: 300, h: 350 };
const MAX_SIZE = { w: 700, h: 900 };

export default function FloatingRadiologyAnalyzer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-radiology-widget', handler);
    return () => window.removeEventListener('open-radiology-widget', handler);
  }, []);
  const [radImage, setRadImage] = useState<string | null>(null);
  const [radPreview, setRadPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [savedToStudy, setSavedToStudy] = useState(false);
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
  const [showCreatePatientDialog, setShowCreatePatientDialog] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [immersiveImage, setImmersiveImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pos, setPos] = useState(DEFAULT_POS);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    return () => {
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (isOpen && pos.x === -1) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ecgWidget = document.querySelector('[data-widget-id="ecg"]');
      let x = vw - size.w - 80;
      let y = vh - size.h - 20;
      if (ecgWidget) {
        const rect = ecgWidget.getBoundingClientRect();
        if (Math.abs(rect.left - x) < size.w && Math.abs(rect.top - y) < size.h) {
          x = Math.max(0, rect.left - size.w - 20);
          if (x < 0) {
            y = Math.max(0, rect.top - size.h - 20);
            x = vw - size.w - 80;
          }
        }
      }
      setPos({ x, y });
    }
  }, [isOpen]);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, origX: pos.x, origY: pos.y };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - size.w, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
      });
    };
    const cleanup = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', cleanup);
      cleanupFnsRef.current = cleanupFnsRef.current.filter(fn => fn !== cleanup);
    };
    cleanupFnsRef.current.push(cleanup);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', cleanup);
  }, [pos, size.w]);

  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeRef.current = { startX: clientX, startY: clientY, origW: size.w, origH: size.h };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dw = cx - resizeRef.current.startX;
      const dh = cy - resizeRef.current.startY;
      setSize({
        w: Math.max(MIN_SIZE.w, Math.min(MAX_SIZE.w, resizeRef.current.origW + dw)),
        h: Math.max(MIN_SIZE.h, Math.min(MAX_SIZE.h, resizeRef.current.origH + dh)),
      });
    };
    const cleanup = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', cleanup);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', cleanup);
      cleanupFnsRef.current = cleanupFnsRef.current.filter(fn => fn !== cleanup);
    };
    cleanupFnsRef.current.push(cleanup);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', cleanup);
  }, [size]);

  const { data: patientsBundle } = useQuery<any>({
    queryKey: ['/api/fhir/patients'],
    enabled: showAssociateDialog,
  });
  const patients: any[] = patientsBundle?.entry || [];

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!radImage) throw new Error('No image');
      const res = await apiRequest('POST', '/api/radiology/analyze', { imageBase64: radImage, patientContext: {} });
      return res.json();
    },
    onSuccess: (data: any) => {
      setResult(data);
      setSavedToStudy(false);
      setImmersiveImage(null);
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
        `## Achado: ${result.radiology_findings?.dominant_pathology} (${result.radiology_findings?.anatomical_region})`,
        result.radiology_findings?.description || '',
        ``,
        `## Diagnóstico: ${result.probabilistic_diagnosis?.presumptive?.name} (${result.probabilistic_diagnosis?.presumptive?.confidence})`,
        result.probabilistic_diagnosis?.presumptive?.reasoning || '',
        ``,
        `## Conduta: ${result.recommended_conduct || ''}`,
        `## Gravidade: ${result.severity_level?.label} (${result.severity_level?.level}/5)`,
        ``,
        `Data: ${new Date().toLocaleString('pt-BR')}`,
      ].join('\n');

      return apiRequest('POST', '/api/doctor-notes', {
        title: `Radiologia - ${result.probabilistic_diagnosis?.presumptive?.name} (${new Date().toLocaleDateString('pt-BR')})`,
        content,
        folder: 'radiology_study',
        color: 'purple',
      });
    },
    onSuccess: () => {
      setSavedToStudy(true);
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-notes'] });
      toast({ title: 'Estudo salvo' });
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
        patientContext: {},
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
      if (!result) throw new Error('No result');
      const res = await apiRequest('POST', '/api/radiology/generate-immersive-image', { analysisData: result });
      return res.json();
    },
    onSuccess: (data: { immersive_image: string }) => {
      setImmersiveImage(data.immersive_image);
      toast({ title: 'Imagem descritiva avançada gerada' });
    },
    onError: () => {
      toast({ title: 'Erro ao gerar imagem', variant: 'destructive' });
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async () => {
      if (!newPatientName.trim()) throw new Error('Nome obrigatório');
      const res = await apiRequest('POST', '/api/fhir/patients', {
        resourceType: 'Patient',
        name: [{ text: newPatientName.trim() }],
        active: true,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowCreatePatientDialog(false);
      setNewPatientName('');
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/patients'] });
      toast({ title: 'Paciente criado com sucesso' });
      if (data?.id) {
        setSelectedPatientId(data.id);
        setShowAssociateDialog(true);
      }
    },
    onError: () => {
      toast({ title: 'Erro ao criar paciente', variant: 'destructive' });
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
    setSavedToStudy(false);
    setImmersiveImage(null);
  };

  if (!user || !['doctor', 'admin'].includes(user.role)) return null;

  if (!isOpen) {
    return null;
  }

  const severityLevel = result?.severity_level?.level ?? 1;
  const analysisLocked = !!result;

  return (
    <>
      <div
        data-widget-id="radiology"
        className="fixed z-50 flex flex-col"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        <Card className="flex flex-col h-full border-indigo-500/30 shadow-2xl bg-background/95 backdrop-blur-sm">
          <CardHeader
            className="p-3 pb-2 flex flex-row items-center justify-between border-b shrink-0 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <CardTitle className="text-sm flex items-center gap-2 pointer-events-none">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <Scan className="h-4 w-4 text-indigo-500" />
              Estudo de Imagem
            </CardTitle>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Vincular a paciente" onClick={(e) => { e.stopPropagation(); setShowAssociateDialog(true); }}>
                <User className="h-3 w-3 text-blue-500" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Criar novo paciente" onClick={(e) => { e.stopPropagation(); setShowCreatePatientDialog(true); }}>
                <UserPlus className="h-3 w-3 text-emerald-500" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
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
                    isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/5'
                  }`}
                >
                  <Upload className="h-8 w-8 mx-auto text-indigo-400 mb-2" />
                  <p className="text-sm font-medium">{isDragOver ? 'Solte a imagem aqui' : 'Arraste ou clique para upload'}</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG - Imagem Radiográfica</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={radPreview} alt="Radiografia" className="w-full h-auto max-h-28 object-contain bg-black" />
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
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  <Card className="border-l-4" style={{ borderLeftColor: result.probabilistic_diagnosis?.presumptive?.color || '#6366F1' }}>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold">Diagnóstico</p>
                        </div>
                        <Badge className={`text-[9px] text-white ${SEVERITY_COLORS[severityLevel] || 'bg-gray-500'}`}>
                          {result.severity_level?.label} ({severityLevel}/5)
                        </Badge>
                      </div>
                      <p className="text-xs font-bold" style={{ color: result.probabilistic_diagnosis?.presumptive?.color }}>
                        {result.probabilistic_diagnosis?.presumptive?.name} ({result.probabilistic_diagnosis?.presumptive?.confidence})
                      </p>
                    </CardContent>
                  </Card>

                  <p className="text-[10px] text-muted-foreground leading-relaxed">{result.recommended_conduct}</p>

                  <div className="flex flex-col gap-1.5">
                    <Button
                      onClick={() => generateImmersiveImageMutation.mutate()}
                      disabled={generateImmersiveImageMutation.isPending}
                      className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white"
                      size="sm"
                    >
                      {generateImmersiveImageMutation.isPending ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
                      ) : (
                        <><ImageIcon className="h-3 w-3 mr-1" /> Gerar Imagem Descritiva Avançada</>
                      )}
                    </Button>

                    <Button
                      onClick={() => saveToStudyMutation.mutate()}
                      disabled={saveToStudyMutation.isPending || savedToStudy}
                      className={`w-full ${!savedToStudy ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white' : ''}`}
                      variant={savedToStudy ? 'secondary' : 'default'}
                      size="sm"
                    >
                      {saveToStudyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : savedToStudy ? <><Save className="h-3 w-3 mr-1" /> Salvo</> : <><Save className="h-3 w-3 mr-1" /> Salvar Estudo</>}
                    </Button>

                    <Button size="sm" className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white" onClick={() => setShowAssociateDialog(true)}>
                      <User className="h-3 w-3 mr-1" /> Vincular a Paciente
                    </Button>

                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                      onClick={() => { setIsOpen(false); setLocation('/fhir-dashboard'); }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Aprofundamento
                    </Button>

                    <Button size="sm" variant="destructive" className="w-full" onClick={clearAll}>
                      <Trash2 className="h-3 w-3 mr-1" /> Limpar Tudo
                    </Button>
                  </div>

                  {immersiveImage && (
                    <div className="space-y-1">
                      <div className="rounded-lg overflow-hidden border border-rose-500/30">
                        <img
                          src={`data:image/png;base64,${immersiveImage}`}
                          alt="Painel PACS Imersivo"
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            const w = window.open();
                            if (w) w.document.write(`<html><head><title>PACS Imersivo</title><style>body{margin:0;background:#1a1a2e;display:flex;justify-content:center;align-items:center;min-height:100vh;}</style></head><body><img src="data:image/png;base64,${immersiveImage}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body></html>`);
                          }}
                        />
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-6" onClick={() => {
                        const link = document.createElement('a');
                        link.href = `data:image/png;base64,${immersiveImage}`;
                        link.download = `radiologia-pacs-${new Date().toISOString().slice(0, 10)}.png`;
                        link.click();
                      }}>
                        <Download className="h-3 w-3 mr-1" /> Salvar Imagem
                      </Button>
                    </div>
                  )}

                  <div className="flex items-start gap-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">{result.disclaimer}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </ScrollArea>

          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-80 transition-opacity"
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
              <path d="M14 14L8 14L14 8Z" fill="currentColor" />
              <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
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
              <SelectTrigger><SelectValue placeholder="Selecionar paciente..." /></SelectTrigger>
              <SelectContent>
                {patients.map((p: any) => {
                  const name = p.resource?.name?.[0]?.text || p.resource?.name?.[0]?.given?.join(' ') || p.resource?.id;
                  return <SelectItem key={p.resource?.id} value={p.resource?.id || ''}>{name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssociateDialog(false)}>Cancelar</Button>
            <Button onClick={() => associateMutation.mutate()} disabled={!selectedPatientId || associateMutation.isPending}>
              {associateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Associar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePatientDialog} onOpenChange={setShowCreatePatientDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Criar Novo Paciente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="text"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              placeholder="Nome do paciente..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePatientDialog(false)}>Cancelar</Button>
            <Button onClick={() => createPatientMutation.mutate()} disabled={!newPatientName.trim() || createPatientMutation.isPending}>
              {createPatientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
