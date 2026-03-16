import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import PageWrapper from '@/components/layout/page-wrapper';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Users, FileText, Heart, Download, Search, Plus, Trash2,
  Upload, Activity, Loader2, AlertTriangle, Stethoscope, Zap, Edit,
  ClipboardList, Calendar
} from 'lucide-react';

const ECG_COLORS: Record<string, string> = {
  flutter: '#EF4444',
  svt: '#3B82F6',
  at: '#22C55E',
  artifact: '#F97316',
  normal: '#6B7280',
};

const DX_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899'];

interface FHIRPatient {
  resource: {
    id: string;
    resourceType: string;
    name?: Array<{ given?: string[]; family?: string; text?: string }>;
    gender?: string;
    birthDate?: string;
    telecom?: Array<{ system: string; value: string }>;
    active?: boolean;
  };
}

interface FHIRBundle {
  resourceType: string;
  type: string;
  total?: number;
  entry?: FHIRPatient[];
}

interface FHIRObservationResource {
  resourceType: string;
  id: string;
  status: string;
  category?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  code: { coding?: Array<{ system: string; code: string; display: string }>; text?: string };
  effectiveDateTime?: string;
  valueString?: string;
  valueQuantity?: { value: number; unit?: string; system?: string; code?: string };
  component?: Array<{ code: { text: string }; valueString: string }>;
  note?: Array<{ text: string }>;
  subject?: { reference: string };
}

interface ECGAnalysisResult {
  ecg_metrics: {
    heart_rate: string;
    rhythm: string;
    qrs_width: string;
    atrial_activity: string;
    signal_quality: string;
  };
  diagnosis_probabilities: Record<string, string>;
  visual_annotation_instructions: Record<string, string>;
  technical_summary: string;
  simple_summary: string;
  disclaimer: string;
}

function getPatientName(patient: FHIRPatient['resource']): string {
  if (!patient.name || patient.name.length === 0) return 'Sem nome';
  const name = patient.name[0];
  if (name.text) return name.text;
  const given = name.given?.join(' ') || '';
  return `${given} ${name.family || ''}`.trim() || 'Sem nome';
}

function getPatientPhone(patient: FHIRPatient['resource']): string {
  const phone = patient.telecom?.find(t => t.system === 'phone');
  return phone?.value || '-';
}

function getPatientEmail(patient: FHIRPatient['resource']): string {
  const email = patient.telecom?.find(t => t.system === 'email');
  return email?.value || '-';
}

export default function FHIRDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPatient, setEditingPatient] = useState<{ id: string; given: string; family: string; gender: string; birthDate: string; phone: string; email: string } | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [ecgImage, setEcgImage] = useState<string | null>(null);
  const [ecgImagePreview, setEcgImagePreview] = useState<string | null>(null);
  const [ecgResult, setEcgResult] = useState<ECGAnalysisResult | null>(null);
  const [ecgPatientAge, setEcgPatientAge] = useState('');
  const [ecgPatientSex, setEcgPatientSex] = useState('');
  const [ecgPatientHistory, setEcgPatientHistory] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [newPatient, setNewPatient] = useState({
    given: '', family: '', gender: 'unknown', birthDate: '', phone: '', email: ''
  });

  const { data: fhirPatients, isLoading: patientsLoading } = useQuery<FHIRBundle>({
    queryKey: ['/api/fhir/patients', searchTerm],
    queryFn: () => {
      const params = new URLSearchParams({ _count: '50' });
      if (searchTerm) params.set('name', searchTerm);
      return fetch(`/api/fhir/patients?${params}`).then(r => r.json());
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: typeof newPatient) => {
      const fhirPatient = {
        resourceType: 'Patient',
        name: [{ given: [patientData.given], family: patientData.family }],
        gender: patientData.gender,
        birthDate: patientData.birthDate || undefined,
        telecom: [
          ...(patientData.phone ? [{ system: 'phone', value: patientData.phone }] : []),
          ...(patientData.email ? [{ system: 'email', value: patientData.email }] : []),
        ],
        active: true,
      };
      return apiRequest('POST', '/api/fhir/patients', fhirPatient);
    },
    onSuccess: () => {
      toast({ title: 'Paciente FHIR criado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/patients'] });
      setShowCreateDialog(false);
      setNewPatient({ given: '', family: '', gender: 'unknown', birthDate: '', phone: '', email: '' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar paciente', variant: 'destructive' });
    },
  });

  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return apiRequest('DELETE', `/api/fhir/patients/${patientId}`);
    },
    onSuccess: () => {
      toast({ title: 'Paciente removido' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/patients'] });
    },
    onError: () => {
      toast({ title: 'Erro ao remover paciente', variant: 'destructive' });
    },
  });

  const updatePatientMutation = useMutation({
    mutationFn: async (patientData: NonNullable<typeof editingPatient>) => {
      const fhirPatient = {
        resourceType: 'Patient',
        id: patientData.id,
        name: [{ given: [patientData.given], family: patientData.family }],
        gender: patientData.gender,
        birthDate: patientData.birthDate || undefined,
        telecom: [
          ...(patientData.phone ? [{ system: 'phone' as const, value: patientData.phone }] : []),
          ...(patientData.email ? [{ system: 'email' as const, value: patientData.email }] : []),
        ],
        active: true,
      };
      return apiRequest('PUT', `/api/fhir/patients/${patientData.id}`, fhirPatient);
    },
    onSuccess: () => {
      toast({ title: 'Paciente atualizado' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/patients'] });
      setEditingPatient(null);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar paciente', variant: 'destructive' });
    },
  });

  const openEditPatient = (entry: FHIRPatient) => {
    const r = entry.resource;
    setEditingPatient({
      id: r.id,
      given: r.name?.[0]?.given?.join(' ') || '',
      family: r.name?.[0]?.family || '',
      gender: r.gender || 'unknown',
      birthDate: r.birthDate || '',
      phone: r.telecom?.find(t => t.system === 'phone')?.value || '',
      email: r.telecom?.find(t => t.system === 'email')?.value || '',
    });
  };

  const ecgAnalysisMutation = useMutation({
    mutationFn: async (data: { imageBase64: string; patientContext: any }) => {
      const res = await apiRequest('POST', '/api/ecg/analyze', data);
      return res.json();
    },
    onSuccess: (data: ECGAnalysisResult) => {
      setEcgResult(data);
      toast({ title: 'Análise ECG concluída' });
    },
    onError: () => {
      toast({ title: 'Erro ao analisar ECG', variant: 'destructive' });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens são aceitas', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setEcgImagePreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setEcgImage(base64);
      setEcgResult(null);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const runECGAnalysis = () => {
    if (!ecgImage) return;
    ecgAnalysisMutation.mutate({
      imageBase64: ecgImage,
      patientContext: {
        age: ecgPatientAge ? parseInt(ecgPatientAge) : undefined,
        sex: ecgPatientSex || undefined,
        clinicalHistory: ecgPatientHistory || undefined,
      },
    });
  };

  const exportFHIRBundle = () => {
    const entries = fhirPatients?.entry || [];
    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries.map(e => ({
        resource: e.resource,
        fullUrl: `urn:uuid:${e.resource.id}`,
      })),
    };

    if (ecgResult) {
      const ecgObservation: FHIRObservationResource = {
        resourceType: 'Observation',
        id: `ecg-${Date.now()}`,
        status: 'final',
        ...(selectedPatientId ? { subject: { reference: `Patient/${selectedPatientId}` } } : {}),
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '100974-8', display: 'ECG study' }], text: 'ECG Analysis' },
        effectiveDateTime: new Date().toISOString(),
        valueString: ecgResult.technical_summary,
        component: Object.entries(ecgResult.ecg_metrics).map(([key, value]) => ({
          code: { text: key.replace(/_/g, ' ') },
          valueString: value,
        })),
        note: [
          { text: ecgResult.simple_summary },
          { text: ecgResult.disclaimer },
        ],
      };
      bundle.entry.push({
        resource: ecgObservation,
        fullUrl: `urn:uuid:ecg-${Date.now()}`,
      });
    }

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-bundle-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Bundle FHIR exportado com sucesso' });
  };

  const dxChartData = ecgResult
    ? Object.entries(ecgResult.diagnosis_probabilities).map(([name, prob]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: parseFloat(prob) || 0,
      }))
    : [];

  const patients = fhirPatients?.entry || [];

  return (
    <PageWrapper variant="medical">
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Heart className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Dashboard FHIR R4 + ECG Engine
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de pacientes FHIR R4 e análise de ECG com IA
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-3">
                <nav className="space-y-1">
                  {[
                    { key: 'patients', icon: Users, label: 'Pacientes' },
                    { key: 'observations', icon: FileText, label: 'Exames' },
                    { key: 'history', icon: ClipboardList, label: 'Histórico Clínico' },
                    { key: 'ecg', icon: Heart, label: 'ECG Engine' },
                    { key: 'export', icon: Download, label: 'Exportar' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === item.key
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pacientes</span>
                  <Badge variant="secondary" className="text-xs">{fhirPatients?.total || patients.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Armazenamento</span>
                  <Badge variant="outline" className="text-xs text-green-600">PostgreSQL Local</Badge>
                </div>
                {ecgResult && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">ECG</span>
                    <Badge className="text-xs bg-blue-500">Analisado</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Content */}
          <div className="lg:col-span-7">
            {activeTab === 'patients' && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Pacientes FHIR R4
                    </CardTitle>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" /> Novo
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Paciente FHIR</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Nome</Label>
                              <Input
                                value={newPatient.given}
                                onChange={e => setNewPatient(p => ({ ...p, given: e.target.value }))}
                                placeholder="Nome"
                              />
                            </div>
                            <div>
                              <Label>Sobrenome</Label>
                              <Input
                                value={newPatient.family}
                                onChange={e => setNewPatient(p => ({ ...p, family: e.target.value }))}
                                placeholder="Sobrenome"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Gênero</Label>
                              <Select value={newPatient.gender} onValueChange={v => setNewPatient(p => ({ ...p, gender: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Masculino</SelectItem>
                                  <SelectItem value="female">Feminino</SelectItem>
                                  <SelectItem value="other">Outro</SelectItem>
                                  <SelectItem value="unknown">Não informado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Data de Nascimento</Label>
                              <Input
                                type="date"
                                value={newPatient.birthDate}
                                onChange={e => setNewPatient(p => ({ ...p, birthDate: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Telefone</Label>
                              <Input
                                value={newPatient.phone}
                                onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))}
                                placeholder="(11) 99999-9999"
                              />
                            </div>
                            <div>
                              <Label>Email</Label>
                              <Input
                                value={newPatient.email}
                                onChange={e => setNewPatient(p => ({ ...p, email: e.target.value }))}
                                placeholder="email@exemplo.com"
                              />
                            </div>
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => createPatientMutation.mutate(newPatient)}
                            disabled={createPatientMutation.isPending || !newPatient.given}
                          >
                            {createPatientMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
                            ) : 'Criar Paciente'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar pacientes FHIR..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span className="ml-2 text-muted-foreground">Carregando pacientes FHIR...</span>
                    </div>
                  ) : patients.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhum paciente encontrado no servidor FHIR</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Gênero</TableHead>
                            <TableHead>Nascimento</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="w-[60px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {patients.map((entry) => (
                            <TableRow key={entry.resource.id} className={`cursor-pointer ${selectedPatientId === entry.resource.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`} onClick={() => setSelectedPatientId(prev => prev === entry.resource.id ? null : entry.resource.id)}>
                              <TableCell className="font-medium">
                                {getPatientName(entry.resource)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {entry.resource.gender === 'male' ? 'M' : entry.resource.gender === 'female' ? 'F' : entry.resource.gender || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell>{entry.resource.birthDate || '-'}</TableCell>
                              <TableCell className="text-xs">{getPatientPhone(entry.resource)}</TableCell>
                              <TableCell className="text-xs">{getPatientEmail(entry.resource)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-blue-500 hover:text-blue-700"
                                    onClick={() => openEditPatient(entry)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-700"
                                    onClick={() => deletePatientMutation.mutate(entry.resource.id)}
                                    disabled={deletePatientMutation.isPending}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {editingPatient && (
              <Dialog open={!!editingPatient} onOpenChange={() => setEditingPatient(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Paciente FHIR</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nome</Label>
                        <Input value={editingPatient.given} onChange={e => setEditingPatient(p => p ? { ...p, given: e.target.value } : null)} />
                      </div>
                      <div>
                        <Label>Sobrenome</Label>
                        <Input value={editingPatient.family} onChange={e => setEditingPatient(p => p ? { ...p, family: e.target.value } : null)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Gênero</Label>
                        <Select value={editingPatient.gender} onValueChange={v => setEditingPatient(p => p ? { ...p, gender: v } : null)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Masculino</SelectItem>
                            <SelectItem value="female">Feminino</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                            <SelectItem value="unknown">Não informado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Data de Nascimento</Label>
                        <Input type="date" value={editingPatient.birthDate} onChange={e => setEditingPatient(p => p ? { ...p, birthDate: e.target.value } : null)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Telefone</Label>
                        <Input value={editingPatient.phone} onChange={e => setEditingPatient(p => p ? { ...p, phone: e.target.value } : null)} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input value={editingPatient.email} onChange={e => setEditingPatient(p => p ? { ...p, email: e.target.value } : null)} />
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => editingPatient && updatePatientMutation.mutate(editingPatient)} disabled={updatePatientMutation.isPending || !editingPatient.given}>
                      {updatePatientMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Atualizando...</> : 'Atualizar Paciente'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {activeTab === 'observations' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-500" />
                    Observações / Exames FHIR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ObservationsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === 'history' && (
              <ClinicalHistoryTab />
            )}

            {(activeTab === 'ecg' || activeTab === 'export') && selectedPatientId && (
              <div className="mb-3 flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Paciente selecionado:</span>
                <span className="font-medium">{patients.find(p => p.resource.id === selectedPatientId)?.resource.name?.[0]?.given?.join(' ')} {patients.find(p => p.resource.id === selectedPatientId)?.resource.name?.[0]?.family}</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setSelectedPatientId(null)}>Remover</Button>
              </div>
            )}

            {activeTab === 'ecg' && (
              <ECGEngineTab
                ecgImage={ecgImage}
                ecgImagePreview={ecgImagePreview}
                ecgResult={ecgResult}
                ecgPatientAge={ecgPatientAge}
                setEcgPatientAge={setEcgPatientAge}
                ecgPatientSex={ecgPatientSex}
                setEcgPatientSex={setEcgPatientSex}
                ecgPatientHistory={ecgPatientHistory}
                setEcgPatientHistory={setEcgPatientHistory}
                isDragOver={isDragOver}
                handleDrop={handleDrop}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                runECGAnalysis={runECGAnalysis}
                isAnalyzing={ecgAnalysisMutation.isPending}
                canvasRef={canvasRef}
              />
            )}

            {activeTab === 'export' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-purple-500" />
                    Exportar Bundle FHIR R4
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Exporte os dados dos pacientes FHIR e análises ECG como um Bundle JSON 
                    conforme o padrão HL7 FHIR R4. Inclui recursos Patient, Observation 
                    (LOINC 100974-8 para ECG), e metadados completos.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        <div className="text-2xl font-bold">{patients.length}</div>
                        <p className="text-xs text-muted-foreground">Pacientes para exportar</p>
                      </CardContent>
                    </Card>
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <Heart className="h-8 w-8 mx-auto mb-2 text-red-500" />
                        <div className="text-2xl font-bold">{ecgResult ? 1 : 0}</div>
                        <p className="text-xs text-muted-foreground">ECG Observations</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Button onClick={exportFHIRBundle} className="w-full" size="lg">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Bundle JSON (FHIR R4)
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            {/* ECG Metrics Cards */}
            {ecgResult && (
              <>
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-500" />
                      Métricas ECG
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 grid grid-cols-2 gap-2">
                    {Object.entries(ecgResult.ecg_metrics).map(([key, value]) => (
                      <div key={key} className="bg-background/60 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-red-500/20">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-red-500" />
                      Diagnóstico %
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dxChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${value}%`}
                          >
                            {dxChartData.map((_, idx) => (
                              <Cell key={idx} fill={DX_COLORS[idx % DX_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: number) => `${val}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1 mt-2">
                      {dxChartData.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DX_COLORS[idx % DX_COLORS.length] }} />
                            <span className="truncate max-w-[120px]">{item.name}</span>
                          </div>
                          <span className="font-semibold">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm">Resumo Técnico</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ecgResult.technical_summary}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm">Resumo Simplificado</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-foreground leading-relaxed">
                      {ecgResult.simple_summary}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Quick ECG Dropzone (always visible on right) */}
            {!ecgResult && (
              <Card className="border-dashed border-2 border-muted-foreground/20">
                <CardContent className="p-6 text-center">
                  <Heart className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">ECG Engine</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Use a aba "ECG Engine" para arrastar uma imagem de ECG e obter análise automática com IA
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Disclaimer */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Análise automatizada. Requer revisão médica. Os resultados não substituem avaliação clínica profissional.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

interface ClinicalHistoryEntry {
  id: number;
  type: 'medical_record' | 'appointment';
  date: string;
  patientName: string;
  doctorName: string;
  diagnosis: string | null;
  symptoms: string | null;
  treatment: string | null;
  prescription: string | null;
  observations: string | null;
  consultationType: string;
}

function ClinicalHistoryTab() {
  const [filterType, setFilterType] = useState<'all' | 'medical_record' | 'appointment'>('all');

  const { data, isLoading } = useQuery<{ timeline: ClinicalHistoryEntry[]; total: number }>({
    queryKey: ['/api/fhir/clinical-history'],
  });

  const timeline = data?.timeline || [];
  const filtered = filterType === 'all' ? timeline : timeline.filter(e => e.type === filterType);

  const typeColor = (type: string) => {
    switch (type) {
      case 'medical_record': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'appointment': return 'bg-green-500/10 text-green-600 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const consultationBadge = (ct: string) => {
    switch (ct) {
      case 'urgent': return <Badge variant="destructive" className="text-[10px]">Urgente</Badge>;
      case 'followup': return <Badge className="text-[10px] bg-amber-500">Retorno</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">Agendada</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-500" />
            Histórico Clínico
          </CardTitle>
          <div className="flex items-center gap-1">
            {(['all', 'medical_record', 'appointment'] as const).map(f => (
              <Button
                key={f}
                variant={filterType === f ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterType(f)}
              >
                {f === 'all' ? 'Todos' : f === 'medical_record' ? 'Registros' : 'Consultas'}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Total: {data?.total || 0} registros
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {filtered.map((entry) => (
                <div key={`${entry.type}-${entry.id}`} className="relative pl-10">
                  <div className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 ${
                    entry.type === 'medical_record' ? 'bg-blue-500 border-blue-600' : 'bg-green-500 border-green-600'
                  }`} />
                  <Card className={`border ${typeColor(entry.type)}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {entry.type === 'medical_record' ? 'Prontuário' : 'Consulta'}
                          </Badge>
                          {consultationBadge(entry.consultationType)}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2 text-xs">
                        <span className="text-muted-foreground">Paciente:</span>
                        <span className="font-medium">{entry.patientName}</span>
                        <span className="text-muted-foreground ml-2">Médico:</span>
                        <span className="font-medium">{entry.doctorName}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {entry.diagnosis && (
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Diagnóstico</p>
                            <p className="text-xs mt-0.5">{entry.diagnosis}</p>
                          </div>
                        )}
                        {entry.symptoms && (
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Sintomas</p>
                            <p className="text-xs mt-0.5">{entry.symptoms}</p>
                          </div>
                        )}
                        {entry.treatment && (
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Tratamento</p>
                            <p className="text-xs mt-0.5">{entry.treatment}</p>
                          </div>
                        )}
                        {entry.prescription && (
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Prescrição</p>
                            <p className="text-xs mt-0.5">{entry.prescription}</p>
                          </div>
                        )}
                        {entry.observations && (
                          <div className="p-2 rounded bg-background/50 md:col-span-2">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Observações</p>
                            <p className="text-xs mt-0.5">{entry.observations}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ObservationsTab() {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [showCreateObs, setShowCreateObs] = useState(false);
  const [newObs, setNewObs] = useState({ code: '', display: '', value: '', unit: '' });
  const [editingObs, setEditingObs] = useState<{ id: string; code: string; display: string; value: string; unit: string } | null>(null);

  const { data: observations, isLoading } = useQuery({
    queryKey: ['/api/fhir/observations', patientId],
    queryFn: () => {
      const params = new URLSearchParams({ _count: '50' });
      if (patientId) params.set('patient', patientId);
      return fetch(`/api/fhir/observations?${params}`).then(r => r.json());
    },
    enabled: !!patientId,
  });

  const createObsMutation = useMutation({
    mutationFn: async () => {
      const observation: FHIRObservationResource = {
        resourceType: 'Observation',
        id: '',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: newObs.code, display: newObs.display }],
          text: newObs.display,
        },
        effectiveDateTime: new Date().toISOString(),
        ...(newObs.unit
          ? { valueQuantity: { value: parseFloat(newObs.value), unit: newObs.unit } }
          : { valueString: newObs.value }),
        ...(patientId ? { subject: { reference: `Patient/${patientId}` } } : {}),
      };
      return apiRequest('POST', '/api/fhir/observations', observation);
    },
    onSuccess: () => {
      toast({ title: 'Observação criada' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/observations'] });
      setShowCreateObs(false);
      setNewObs({ code: '', display: '', value: '', unit: '' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar observação', variant: 'destructive' });
    },
  });

  const deleteObsMutation = useMutation({
    mutationFn: async (obsId: string) => apiRequest('DELETE', `/api/fhir/observations/${obsId}`),
    onSuccess: () => {
      toast({ title: 'Observação removida' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/observations'] });
    },
    onError: () => {
      toast({ title: 'Erro ao remover observação', variant: 'destructive' });
    },
  });

  const updateObsMutation = useMutation({
    mutationFn: async (obs: NonNullable<typeof editingObs>) => {
      const observation: FHIRObservationResource = {
        resourceType: 'Observation',
        id: obs.id,
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: obs.code, display: obs.display }],
          text: obs.display,
        },
        effectiveDateTime: new Date().toISOString(),
        ...(obs.unit
          ? { valueQuantity: { value: parseFloat(obs.value), unit: obs.unit } }
          : { valueString: obs.value }),
        ...(patientId ? { subject: { reference: `Patient/${patientId}` } } : {}),
      };
      return apiRequest('PUT', `/api/fhir/observations/${obs.id}`, observation);
    },
    onSuccess: () => {
      toast({ title: 'Observação atualizada' });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/observations'] });
      setEditingObs(null);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar observação', variant: 'destructive' });
    },
  });

  const openEditObs = (entry: { resource: FHIRObservationResource }) => {
    const r = entry.resource;
    setEditingObs({
      id: r.id,
      code: r.code?.coding?.[0]?.code || '',
      display: r.code?.text || r.code?.coding?.[0]?.display || '',
      value: r.valueString || String(r.valueQuantity?.value || ''),
      unit: r.valueQuantity?.unit || '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="ID do paciente FHIR..."
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
        />
        <Button variant="outline" disabled={!patientId || isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Dialog open={showCreateObs} onOpenChange={setShowCreateObs}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Observação FHIR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código LOINC</Label>
                  <Input placeholder="Ex: 8867-4" value={newObs.code} onChange={e => setNewObs(p => ({ ...p, code: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input placeholder="Ex: Heart rate" value={newObs.display} onChange={e => setNewObs(p => ({ ...p, display: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input placeholder="Ex: 72" value={newObs.value} onChange={e => setNewObs(p => ({ ...p, value: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Unidade (opcional)</Label>
                  <Input placeholder="Ex: bpm" value={newObs.unit} onChange={e => setNewObs(p => ({ ...p, unit: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={() => createObsMutation.mutate()} disabled={createObsMutation.isPending || !newObs.display || !newObs.value}>
                {createObsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : 'Criar Observação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {!patientId && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Insira o ID de um paciente FHIR para ver suas observações
        </p>
      )}
      {observations?.entry?.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {observations.entry.map((entry: { resource: FHIRObservationResource }) => (
              <TableRow key={entry.resource?.id}>
                <TableCell className="text-xs">
                  {entry.resource?.code?.text || entry.resource?.code?.coding?.[0]?.display || '-'}
                </TableCell>
                <TableCell className="text-xs">
                  {entry.resource?.valueString || entry.resource?.valueQuantity?.value || '-'}
                </TableCell>
                <TableCell className="text-xs">
                  {entry.resource?.effectiveDateTime?.split('T')[0] || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{entry.resource?.status || '-'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700" onClick={() => openEditObs(entry)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteObsMutation.mutate(entry.resource.id)} disabled={deleteObsMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : patientId && !isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma observação encontrada para este paciente
        </p>
      ) : null}

      {editingObs && (
        <Dialog open={!!editingObs} onOpenChange={() => setEditingObs(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Observação FHIR</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código LOINC</Label>
                  <Input value={editingObs.code} onChange={e => setEditingObs(p => p ? { ...p, code: e.target.value } : null)} />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={editingObs.display} onChange={e => setEditingObs(p => p ? { ...p, display: e.target.value } : null)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input value={editingObs.value} onChange={e => setEditingObs(p => p ? { ...p, value: e.target.value } : null)} />
                </div>
                <div>
                  <Label className="text-xs">Unidade (opcional)</Label>
                  <Input value={editingObs.unit} onChange={e => setEditingObs(p => p ? { ...p, unit: e.target.value } : null)} />
                </div>
              </div>
              <Button className="w-full" onClick={() => editingObs && updateObsMutation.mutate(editingObs)} disabled={updateObsMutation.isPending || !editingObs.display || !editingObs.value}>
                {updateObsMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Atualizando...</> : 'Atualizar Observação'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface ECGEngineTabProps {
  ecgImage: string | null;
  ecgImagePreview: string | null;
  ecgResult: ECGAnalysisResult | null;
  ecgPatientAge: string;
  setEcgPatientAge: (v: string) => void;
  ecgPatientSex: string;
  setEcgPatientSex: (v: string) => void;
  ecgPatientHistory: string;
  setEcgPatientHistory: (v: string) => void;
  isDragOver: boolean;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (file: File) => void;
  runECGAnalysis: () => void;
  isAnalyzing: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const ANNOTATION_COLOR_MAP: Record<string, string> = {
  red: '#EF4444', blue: '#3B82F6', green: '#22C55E', orange: '#F97316',
  yellow: '#EAB308', purple: '#8B5CF6', flutter: '#EF4444', svt: '#3B82F6',
  at: '#22C55E', artifact: '#F97316', st: '#EAB308', block: '#8B5CF6',
};

function resolveAnnotationColor(value: string): string {
  const lower = value.toLowerCase();
  for (const [key, color] of Object.entries(ANNOTATION_COLOR_MAP)) {
    if (lower.includes(key)) return color;
  }
  return '#6B7280';
}

function ECGEngineTab({
  ecgImage, ecgImagePreview, ecgResult,
  ecgPatientAge, setEcgPatientAge,
  ecgPatientSex, setEcgPatientSex,
  ecgPatientHistory, setEcgPatientHistory,
  isDragOver, handleDrop, handleDragOver, handleDragLeave,
  fileInputRef, handleFileSelect,
  runECGAnalysis, isAnalyzing, canvasRef
}: ECGEngineTabProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!ecgResult?.visual_annotation_instructions || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth || img.clientWidth;
    canvas.height = img.naturalHeight || img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const annotations = Object.entries(ecgResult.visual_annotation_instructions);
    const regionCount = annotations.length;
    if (regionCount === 0) return;

    const regionWidth = canvas.width / regionCount;
    const regionHeight = canvas.height;

    annotations.forEach(([label, colorDesc], idx) => {
      const color = resolveAnnotationColor(colorDesc);
      const x = idx * regionWidth;
      ctx.fillStyle = color + '25';
      ctx.fillRect(x, 0, regionWidth, regionHeight);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 2, 2, regionWidth - 4, regionHeight - 4);
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(12, canvas.width / 60)}px sans-serif`;
      const text = label.replace(/highlight_|_/g, ' ').trim();
      const maxTextWidth = regionWidth - 12;
      const displayText = ctx.measureText(text).width > maxTextWidth ? text.substring(0, 15) + '...' : text;
      ctx.fillText(displayText, x + 6, 20);

      ctx.beginPath();
      ctx.moveTo(x + regionWidth / 2, regionHeight * 0.25);
      ctx.lineTo(x + regionWidth / 2, regionHeight * 0.75);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(x + regionWidth / 2, regionHeight * 0.75);
      ctx.lineTo(x + regionWidth / 2 - arrowSize, regionHeight * 0.75 - arrowSize);
      ctx.moveTo(x + regionWidth / 2, regionHeight * 0.75);
      ctx.lineTo(x + regionWidth / 2 + arrowSize, regionHeight * 0.75 - arrowSize);
      ctx.stroke();
    });
  }, [ecgResult, canvasRef]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            ECG Analysis Engine
            <Badge className="ml-2 bg-blue-500 text-white text-[10px]">GPT-4o Vision</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Patient Context */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Idade</Label>
              <Input
                type="number"
                placeholder="Ex: 65"
                value={ecgPatientAge}
                onChange={e => setEcgPatientAge(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Sexo</Label>
              <Select value={ecgPatientSex} onValueChange={setEcgPatientSex}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">História Clínica</Label>
              <Input
                placeholder="Ex: HAS, DM2..."
                value={ecgPatientHistory}
                onChange={e => setEcgPatientHistory(e.target.value)}
              />
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                : ecgImagePreview
                ? 'border-green-500/40 bg-green-500/5'
                : 'border-muted-foreground/30 hover:border-blue-400 hover:bg-blue-500/5'
            }`}
            style={{ minHeight: '300px' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            {ecgImagePreview ? (
              <div className="relative">
                <img
                  ref={imgRef}
                  src={ecgImagePreview}
                  alt="ECG"
                  className="w-full rounded-lg"
                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ mixBlendMode: 'multiply' }}
                />
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-500 text-white text-xs">
                    <Zap className="h-3 w-3 mr-1" /> Imagem carregada
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Arraste uma imagem de ECG aqui
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  ou clique para selecionar • PNG, JPG, WEBP
                </p>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <Button
            onClick={runECGAnalysis}
            disabled={!ecgImage || isAnalyzing}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando ECG (10 passos)...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Analisar ECG com IA
              </>
            )}
          </Button>

          {/* Results */}
          {ecgResult && (
            <div className="space-y-4 mt-4">
              {/* Diagnosis Bar Chart */}
              <Card className="border-blue-500/20">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-sm">Probabilidades Diagnósticas</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(ecgResult.diagnosis_probabilities).map(([name, prob]) => ({
                          name: name.replace(/_/g, ' '),
                          probability: parseFloat(prob) || 0,
                        }))}
                        layout="vertical"
                        margin={{ left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} unit="%" />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(val: number) => `${val}%`} />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {Object.entries(ecgResult.diagnosis_probabilities).map((_, idx) => (
                            <Cell key={idx} fill={DX_COLORS[idx % DX_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Annotation Legend */}
              {ecgResult.visual_annotation_instructions && (
                <Card>
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-sm">Legenda de Anotações</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ecgResult.visual_annotation_instructions).map(([key, color]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <div
                            className="w-3 h-3 rounded-sm border"
                            style={{ backgroundColor: ECG_COLORS[color as string] || color }}
                          />
                          <span className="truncate">{key.replace(/highlight_|_/g, ' ').trim()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
