import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/use-admin";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { DEFAULT_DOCTOR_ID } from "@shared/schema";
import PageWrapper from "@/components/layout/page-wrapper";
import PatientExportDialog from "@/components/patient-export-dialog";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { FileText, Shield, Download, Plus, Search, Pencil, History, Globe, FileJson, FileSpreadsheet, FileCode, ClipboardList, User, Stethoscope, Activity, Lock, CheckCircle2 } from "lucide-react";

const medicalRecordSchema = z.object({
  patientId: z.string().min(1, "Paciente é obrigatório"),
  diagnosis: z.string().optional(),
  symptoms: z.string().min(1, "Sintomas são obrigatórios"),
  treatment: z.string().optional(),
  prescription: z.string().optional(),
});

const pmdCreateSchema = z.object({
  anamnese: z.string().min(1, "Anamnese é obrigatória"),
  historico: z.string().optional(),
  exames: z.string().optional(),
  diagnostico: z.string().optional(),
  tratamento: z.string().optional(),
  nome_mae: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  sus_card: z.string().optional(),
  endereco: z.string().optional(),
});

type MedicalRecordFormData = z.infer<typeof medicalRecordSchema>;
type PMDCreateFormData = z.infer<typeof pmdCreateSchema>;

export default function MedicalRecords() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialPatientId = urlParams.get('patientId');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialPatientId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPmdDialogOpen, setIsPmdDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isPmdExportOpen, setIsPmdExportOpen] = useState(false);
  const [selectedPmdId, setSelectedPmdId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [exportLocale, setExportLocale] = useState<string>("BR");
  const [exportFormat, setExportFormat] = useState<string>("PDF");
  const [evolucaoText, setEvolucaoText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isDoctor) {
      setLocation('/patient-records');
    }
  }, [user, isDoctor, setLocation]);

  const { data: patients } = useQuery({
    queryKey: ['/api/patients'],
    enabled: isDoctor,
  });

  const { data: medicalRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ['/api/medical-records', selectedPatientId],
    enabled: !!selectedPatientId && isDoctor,
  });

  const { data: examResults } = useQuery({
    queryKey: ['/api/exam-results', selectedPatientId],
    enabled: !!selectedPatientId && isDoctor,
  });

  const { data: unifiedData, isLoading: unifiedLoading } = useQuery<any>({
    queryKey: ['/api/medical-records', selectedPatientId, 'unified'],
    enabled: !!selectedPatientId && isDoctor,
  });

  const { data: pmdDetail, isLoading: pmdLoading } = useQuery({
    queryKey: ['/api/pmd', selectedPmdId],
    enabled: !!selectedPmdId,
  });

  const form = useForm<MedicalRecordFormData>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      patientId: selectedPatientId || "",
      diagnosis: "",
      symptoms: "",
      treatment: "",
      prescription: "",
    },
  });

  const pmdForm = useForm<PMDCreateFormData>({
    resolver: zodResolver(pmdCreateSchema),
    defaultValues: {
      anamnese: "",
      historico: "",
      exames: "",
      diagnostico: "",
      tratamento: "",
      nome_mae: "",
      cpf: "",
      rg: "",
      sus_card: "",
      endereco: "",
    },
  });

  const analyzeSymptomsMutation = useMutation({
    mutationFn: (data: { symptoms: string; history: string }) =>
      apiRequest('POST', `/api/medical-records/${selectedPatientId}/analyze`, data),
    onSuccess: (response: any) => {
      if (response.analysis) {
        form.setValue('diagnosis', response.analysis.diagnosis || '');
        form.setValue('treatment', response.analysis.treatment || '');
        form.setValue('prescription', response.analysis.prescription || '');
        toast({
          title: "Análise Concluída",
          description: "Os campos foram preenchidos com as sugestões.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro na Análise",
        description: "Erro ao gerar análise. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const signPrescriptionMutation = useMutation({
    mutationFn: (medicalRecordId: string) =>
      apiRequest('POST', `/api/medical-records/${medicalRecordId}/sign-prescription`, {
        doctorId: DEFAULT_DOCTOR_ID
      }),
    onSuccess: (response: any) => {
      toast({
        title: "Prescrição Assinada Digitalmente",
        description: `Assinatura digital criada. Audit Hash: ${response.auditHash?.substring(0, 8)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-records'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na Assinatura Digital",
        description: error.message || "Erro ao assinar prescrição.",
        variant: "destructive",
      });
    },
  });

  const createPmdMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/pmd/create', data),
    onSuccess: (response: any) => {
      toast({ title: "PMD Criado", description: "Prontuário PMD v1.0 criado com sucesso." });
      setIsPmdDialogOpen(false);
      pmdForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/medical-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pmd'] });
      if (response.id) setSelectedPmdId(response.id);
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao criar prontuário PMD.", variant: "destructive" });
    },
  });

  const editPmdMutation = useMutation({
    mutationFn: (data: { id: string; campo: string; valor: string }) =>
      apiRequest('PATCH', `/api/pmd/${data.id}`, { campo: data.campo, valor: data.valor }),
    onSuccess: () => {
      toast({ title: "Atualizado", description: "Campo atualizado com log de auditoria." });
      setEditingField(null);
      setEditValue("");
      queryClient.invalidateQueries({ queryKey: ['/api/pmd', selectedPmdId] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao atualizar campo.", variant: "destructive" });
    },
  });

  const addEvolucaoMutation = useMutation({
    mutationFn: (data: { id: string; descricao: string }) =>
      apiRequest('PATCH', `/api/pmd/${data.id}`, { evolucao: { descricao: data.descricao } }),
    onSuccess: () => {
      toast({ title: "Evolução Adicionada", description: "Nova evolução registrada no prontuário." });
      setEvolucaoText("");
      queryClient.invalidateQueries({ queryKey: ['/api/pmd', selectedPmdId] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao adicionar evolução.", variant: "destructive" });
    },
  });

  const convertPmdMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/pmd/${id}/convert`, {}),
    onSuccess: (response: any) => {
      toast({ title: "Convertido", description: "Prontuário convertido para PMD v1.0." });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-records'] });
      if (response.id) setSelectedPmdId(response.id);
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao converter prontuário.", variant: "destructive" });
    },
  });

  const generateFriendlyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/medical-records/${id}/patient-friendly`, {});
      return res.json() as Promise<{ success: boolean; patientFriendlyVersion: string }>;
    },
    onSuccess: () => {
      toast({ title: "Versão acessível criada", description: "A versão para o paciente foi gerada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-records'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível gerar a versão acessível.", variant: "destructive" });
    },
  });

  const toggleFriendlyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('PATCH', `/api/medical-records/${id}/patient-friendly/toggle`, {});
      return res.json() as Promise<{ success: boolean; patientFriendlyActive: boolean }>;
    },
    onSuccess: (data) => {
      toast({
        title: data.patientFriendlyActive ? "Visibilidade ativada" : "Visibilidade desativada",
        description: data.patientFriendlyActive ? "O paciente agora pode ver este prontuário." : "O prontuário foi ocultado do paciente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-records'] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível alterar a visibilidade.", variant: "destructive" });
    },
  });

  const selectedPatient = (patients as any[] || []).find((p: any) => p.id === selectedPatientId);
  const filteredPatients = (patients as any[] || []).filter((patient: any) =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAnalyzeSymptoms = () => {
    const symptoms = form.getValues('symptoms');
    if (!symptoms || !selectedPatient) return;
    const history = selectedPatient.medicalHistory ?
      JSON.stringify(selectedPatient.medicalHistory) :
      `Paciente: ${selectedPatient.name}, Alergias: ${selectedPatient.allergies || 'Nenhuma'}`;
    analyzeSymptomsMutation.mutate({ symptoms, history });
  };

  const handlePmdCreate = (data: PMDCreateFormData) => {
    if (!selectedPatientId) return;
    createPmdMutation.mutate({
      patientId: selectedPatientId,
      pmdData: {
        paciente: {
          nome_mae: data.nome_mae,
          cpf: data.cpf,
          rg: data.rg,
          sus_card: data.sus_card,
          endereco: data.endereco,
        },
        clinico: {
          anamnese: data.anamnese,
          historico: data.historico || '',
          exames: data.exames || '',
          diagnostico: data.diagnostico || '',
          tratamento: data.tratamento || '',
          evolucoes: [],
        },
      },
    });
  };

  const handlePmdExport = () => {
    if (!selectedPmdId) return;
    const url = `/api/pmd/${selectedPmdId}/export?locale=${exportLocale}&format=${exportFormat}`;
    window.open(url, '_blank');
    setIsPmdExportOpen(false);
  };

  const startEdit = (campo: string, currentValue: string) => {
    setEditingField(campo);
    setEditValue(currentValue || '');
  };

  const saveEdit = () => {
    if (!selectedPmdId || !editingField) return;
    editPmdMutation.mutate({ id: selectedPmdId, campo: editingField, valor: editValue });
  };

  const pmd = (pmdDetail as any)?.pmd;
  const accessLevel = (pmdDetail as any)?.accessLevel;
  const logsVisible = (pmdDetail as any)?.logsVisible;
  const canEdit = accessLevel === 'criador' || accessLevel === 'total';

  const renderPmdField = (label: string, campo: string, value: string, icon: any) => {
    const Icon = icon;
    const isEditing = editingField === campo;

    return (
      <div className="border border-border rounded-lg p-3 mb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon className="w-4 h-4" />
            {label}
          </div>
          {canEdit && !isEditing && (
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => startEdit(campo, value)}>
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={editPmdMutation.isPending}>
                {editPmdMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap" data-no-translate>{value || '—'}</p>
        )}
      </div>
    );
  };

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            Prontuário Médico Digital
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            PMD v1.0 — Conforme CFM/LGPD/RGPD
          </p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          {selectedPatient && (
            <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)}>
              <Download className="w-4 h-4 mr-1" />
              FHIR Export
            </Button>
          )}
          <Badge variant="secondary" className="px-3 py-1">
            <Shield className="w-3 h-3 mr-1" />
            Dados Criptografados
          </Badge>
          {isDoctor && selectedPatient && (
            <>
              <Dialog open={isPmdDialogOpen} onOpenChange={setIsPmdDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Novo PMD
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle data-no-translate className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Criar Prontuário PMD v1.0 — {selectedPatient?.name}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...pmdForm}>
                    <form onSubmit={pmdForm.handleSubmit(handlePmdCreate)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={pmdForm.control} name="nome_mae" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Mãe</FormLabel>
                            <FormControl><Input placeholder="Nome completo da mãe" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={pmdForm.control} name="cpf" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={pmdForm.control} name="rg" render={({ field }) => (
                          <FormItem>
                            <FormLabel>RG</FormLabel>
                            <FormControl><Input placeholder="Documento de identidade" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={pmdForm.control} name="sus_card" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cartão SUS</FormLabel>
                            <FormControl><Input placeholder="Número do cartão SUS" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <FormField control={pmdForm.control} name="endereco" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Endereço</FormLabel>
                          <FormControl><Input placeholder="Endereço completo" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={pmdForm.control} name="anamnese" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anamnese *</FormLabel>
                          <FormControl><Textarea placeholder="Queixa principal, história da doença atual..." rows={3} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={pmdForm.control} name="historico" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Histórico</FormLabel>
                          <FormControl><Textarea placeholder="Antecedentes pessoais, familiares, cirúrgicos..." rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={pmdForm.control} name="exames" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exames</FormLabel>
                          <FormControl><Textarea placeholder="Exames solicitados ou resultados..." rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={pmdForm.control} name="diagnostico" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diagnóstico</FormLabel>
                          <FormControl><Textarea placeholder="Diagnóstico clínico..." rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={pmdForm.control} name="tratamento" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tratamento</FormLabel>
                          <FormControl><Textarea placeholder="Plano terapêutico..." rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <div className="flex justify-end space-x-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsPmdDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createPmdMutation.isPending}>
                          {createPmdMutation.isPending ? 'Criando...' : 'Criar PMD v1.0'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Legado
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle data-no-translate>Novo Prontuário (Legado) - {selectedPatient?.name}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form className="space-y-4">
                      <FormField control={form.control} name="symptoms" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sintomas</FormLabel>
                          <FormControl><Textarea placeholder="Descreva os sintomas..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex items-center space-x-2">
                        <Button type="button" variant="outline" onClick={handleAnalyzeSymptoms} disabled={analyzeSymptomsMutation.isPending}>
                          {analyzeSymptomsMutation.isPending ? "Analisando..." : "Analisar Sintomas"}
                        </Button>
                      </div>
                      <FormField control={form.control} name="diagnosis" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diagnóstico</FormLabel>
                          <FormControl><Textarea placeholder="Diagnóstico médico..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="treatment" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tratamento</FormLabel>
                          <FormControl><Textarea placeholder="Plano de tratamento..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="prescription" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prescrição</FormLabel>
                          <FormControl><Textarea placeholder="Prescrição médica..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Prontuário</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card className="h-[700px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Pacientes
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1 max-h-[580px] overflow-y-auto">
                {filteredPatients.map((patient: any) => (
                  <div
                    key={patient.id}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border ${
                      selectedPatientId === patient.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                    onClick={() => { setSelectedPatientId(patient.id); setSelectedPmdId(null); }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p data-no-translate className="font-medium truncate text-sm">{patient.name}</p>
                        <p data-no-translate className="text-xs text-muted-foreground">{patient.phone}</p>
                        {patient.allergies && (
                          <p className="text-xs text-destructive truncate">{patient.allergies}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {!selectedPatient ? (
            <Card className="h-[700px] flex items-center justify-center">
              <CardContent>
                <div className="text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">Selecione um Paciente</h3>
                  <p className="text-muted-foreground">Escolha um paciente para visualizar ou criar prontuários PMD</p>
                </div>
              </CardContent>
            </Card>
          ) : selectedPmdId && pmd ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle data-no-translate className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-primary" />
                        PMD v1.0 — {pmd.paciente?.nome}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        CRM: {pmd.medico_crm} | ID: {selectedPmdId?.substring(0, 8)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={accessLevel === 'total' ? 'default' : accessLevel === 'criador' ? 'secondary' : 'outline'}>
                        {accessLevel === 'total' ? 'Acesso Total' : accessLevel === 'criador' ? 'Médico Criador' : 'Leitura'}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setIsPmdExportOpen(true)}>
                        <Download className="w-4 h-4 mr-1" />
                        Exportar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPmdId(null)}>Voltar</Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Dados do Paciente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-muted-foreground">Nome:</span><span data-no-translate>{pmd.paciente?.nome}</span>
                      <span className="text-muted-foreground">Data Nasc.:</span><span>{pmd.paciente?.dt_nasc || '—'}</span>
                      <span className="text-muted-foreground">Sexo:</span><span>{pmd.paciente?.sexo || '—'}</span>
                      <span className="text-muted-foreground">Contato:</span><span data-no-translate>{pmd.paciente?.contato || '—'}</span>
                      <span className="text-muted-foreground">Endereço:</span><span data-no-translate>{pmd.paciente?.endereco || '—'}</span>
                      {pmd.paciente?.nome_mae && (<><span className="text-muted-foreground">Nome da Mãe:</span><span data-no-translate>{pmd.paciente.nome_mae}</span></>)}
                      {pmd.paciente?.cpf && (<><span className="text-muted-foreground">CPF:</span><span data-no-translate>{pmd.paciente.cpf}</span></>)}
                      {pmd.paciente?.sus_card && (<><span className="text-muted-foreground">Cartão SUS:</span><span data-no-translate>{pmd.paciente.sus_card}</span></>)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Conformidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>CFM (Conselho Federal de Medicina)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>LGPD (Lei 13.709/2018)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>RGPD (UE 2016/679)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span>Dados Criptografados</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Dados Clínicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderPmdField('Anamnese', 'clinico.anamnese', pmd.clinico?.anamnese, ClipboardList)}
                  {renderPmdField('Histórico', 'clinico.historico', pmd.clinico?.historico, History)}
                  {renderPmdField('Exames', 'clinico.exames', pmd.clinico?.exames, Activity)}
                  {renderPmdField('Diagnóstico', 'clinico.diagnostico', pmd.clinico?.diagnostico, Stethoscope)}
                  {renderPmdField('Tratamento', 'clinico.tratamento', pmd.clinico?.tratamento, FileText)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Evoluções ({pmd.clinico?.evolucoes?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(pmd.clinico?.evolucoes || []).length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {pmd.clinico.evolucoes.map((ev: any, idx: number) => (
                        <div key={idx} className="border border-border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">{ev.data}</span>
                            <Badge variant="outline" className="text-xs">{ev.medico}</Badge>
                          </div>
                          <p className="text-sm">{ev.descricao}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">Nenhuma evolução registrada.</p>
                  )}
                  {canEdit && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Textarea
                        placeholder="Nova evolução clínica..."
                        value={evolucaoText}
                        onChange={e => setEvolucaoText(e.target.value)}
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={() => selectedPmdId && addEvolucaoMutation.mutate({ id: selectedPmdId, descricao: evolucaoText })}
                        disabled={!evolucaoText.trim() || addEvolucaoMutation.isPending}
                      >
                        {addEvolucaoMutation.isPending ? 'Salvando...' : 'Adicionar Evolução'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {logsVisible && pmd.logs && pmd.logs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Log de Auditoria ({pmd.logs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Timestamp</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Usuário</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Ação</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Anterior</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Novo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pmd.logs.map((log: any, idx: number) => (
                            <tr key={idx} className="border-b border-border/50">
                              <td className="py-2 px-2 text-xs whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                              </td>
                              <td className="py-2 px-2 text-xs">{log.user}</td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{log.acao}</Badge>
                              </td>
                              <td className="py-2 px-2 text-xs max-w-[150px] truncate">{log.antigo || '—'}</td>
                              <td className="py-2 px-2 text-xs max-w-[150px] truncate">{log.novo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Dialog open={isPmdExportOpen} onOpenChange={setIsPmdExportOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Exportar PMD
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Locale / Regulamentação</label>
                      <Select value={exportLocale} onValueChange={setExportLocale}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BR">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> BR — CFM/LGPD</span>
                          </SelectItem>
                          <SelectItem value="ES">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> ES — RGPD</span>
                          </SelectItem>
                          <SelectItem value="USA">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> USA — HIPAA</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Formato</label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PDF">
                            <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> PDF (HTML)</span>
                          </SelectItem>
                          <SelectItem value="JSON">
                            <span className="flex items-center gap-2"><FileJson className="w-4 h-4" /> JSON</span>
                          </SelectItem>
                          <SelectItem value="XML">
                            <span className="flex items-center gap-2"><FileCode className="w-4 h-4" /> XML</span>
                          </SelectItem>
                          <SelectItem value="CSV">
                            <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                      {exportLocale === 'BR' && 'Inclui: CFM, Nome da Mãe, CRM, CPF, Cartão SUS — Conforme LGPD'}
                      {exportLocale === 'ES' && 'Incluye: RGPD, DNI, Vacunas, Colegiado — Conforme RGPD'}
                      {exportLocale === 'USA' && 'Includes: HIPAA, Provider NPI — HIPAA Compliant'}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsPmdExportOpen(false)}>Cancelar</Button>
                      <Button onClick={handlePmdExport}>
                        <Download className="w-4 h-4 mr-1" />
                        Exportar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 data-no-translate className="text-xl font-bold">{selectedPatient.name}</h2>
                        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                          <span data-no-translate>{selectedPatient.phone}</span>
                          {selectedPatient.bloodType && (<><span>•</span><span>{selectedPatient.bloodType}</span></>)}
                          {selectedPatient.gender && (<><span>•</span><span>{selectedPatient.gender}</span></>)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <Shield className="w-3 h-3 mr-1" />
                      Seguro
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              <Tabs defaultValue="unified" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="unified">
                    <History className="w-4 h-4 mr-1" />
                    Unificado
                  </TabsTrigger>
                  <TabsTrigger value="records">
                    <FileText className="w-4 h-4 mr-1" />
                    Prontuários
                  </TabsTrigger>
                  <TabsTrigger value="exams">
                    <Activity className="w-4 h-4 mr-1" />
                    Exames
                  </TabsTrigger>
                  <TabsTrigger value="pmd">
                    <Shield className="w-4 h-4 mr-1" />
                    PMD v1.0
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="unified" className="space-y-4">
                  {unifiedLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !unifiedData?.timeline?.length ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhum Registro</h3>
                          <p className="text-muted-foreground">Este paciente ainda não possui registros médicos</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1.5">
                                <Stethoscope className="w-4 h-4 text-blue-600" />
                                <strong>{unifiedData.summary.totalConsultations}</strong> consultas
                              </span>
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <strong>{unifiedData.summary.totalRecords}</strong> prontuários
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-purple-600" />
                                <strong>{unifiedData.summary.totalExams}</strong> exames
                              </span>
                              <span className="flex items-center gap-1.5">
                                <ClipboardList className="w-4 h-4 text-amber-600" />
                                <strong>{unifiedData.summary.totalPrescriptions}</strong> prescrições
                              </span>
                            </div>
                            <Badge variant="secondary">{unifiedData.summary.totalDays} dias com registros</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="relative">
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                        {unifiedData.timeline.map((day: any) => {
                          const dayDate = new Date(day.date + 'T12:00:00');
                          return (
                            <div key={day.date} className="relative pl-14 pb-6">
                              <div className="absolute left-4 w-5 h-5 rounded-full bg-primary border-2 border-background flex items-center justify-center z-10">
                                <div className="w-2 h-2 rounded-full bg-background" />
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-3 pt-0.5">
                                  <h3 className="font-bold text-base">
                                    {format(dayDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </h3>
                                  <span className="text-xs text-muted-foreground">
                                    {format(dayDate, "EEEE", { locale: ptBR })}
                                  </span>
                                  <div className="flex gap-1.5">
                                    {day.consultations.length > 0 && (
                                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                                        {day.consultations.length} consulta{day.consultations.length > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                    {day.records.length > 0 && (
                                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
                                        {day.records.length} registro{day.records.length > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {day.consultations.map((consult: any) => (
                                  <Card key={consult.id} className="border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10">
                                    <CardContent className="py-3 px-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Stethoscope className="w-4 h-4 text-blue-600" />
                                          <span className="font-medium text-sm">Consulta</span>
                                          <Badge variant="secondary" className="text-xs">
                                            {consult.type === 'consultation' ? 'Consulta' :
                                             consult.type === 'followup' ? 'Retorno' :
                                             consult.type === 'emergency' ? 'Emergência' : consult.type}
                                          </Badge>
                                          <Badge className={`text-xs ${
                                            consult.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            consult.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {consult.status === 'completed' ? 'Concluída' :
                                             consult.status === 'cancelled' ? 'Cancelada' :
                                             consult.status === 'scheduled' ? 'Agendada' :
                                             consult.status === 'in-progress' ? 'Em andamento' : consult.status}
                                          </Badge>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(consult.scheduledAt), "HH:mm")}
                                        </span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        <span data-no-translate>Dr. {consult.doctorName}</span>
                                        {consult.doctorCRM && <span className="ml-1">(CRM: {consult.doctorCRM})</span>}
                                      </div>
                                      {consult.notes && <p className="text-sm mt-1">{consult.notes}</p>}
                                    </CardContent>
                                  </Card>
                                ))}

                                {day.records.map((rec: any) => (
                                  <Card key={rec.id} className="border-l-4 border-l-emerald-500">
                                    <CardContent className="py-3 px-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-emerald-600" />
                                          <span className="font-medium text-sm">Prontuário</span>
                                          {rec.hasPmd && (
                                            <Badge className="bg-emerald-600 text-xs cursor-pointer" onClick={() => setSelectedPmdId(rec.id)}>
                                              PMD v1.0
                                            </Badge>
                                          )}
                                          {rec.digitalSignature && (
                                            <Badge variant="outline" className="text-green-600 text-xs">Assinado</Badge>
                                          )}
                                          {rec.isEncrypted && (
                                            <Badge variant="outline" className="text-blue-600 text-xs">
                                              <Lock className="w-3 h-3 mr-0.5" />
                                              Cripto
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          Dr. {rec.doctorName}
                                          {rec.doctorCRM && ` (CRM: ${rec.doctorCRM})`}
                                        </span>
                                      </div>
                                      <div className="space-y-2 text-sm">
                                        {rec.symptoms && (
                                          <div>
                                            <span className="font-medium text-xs text-muted-foreground">Anamnese / Sintomas:</span>
                                            <p className="mt-0.5">{rec.symptoms}</p>
                                          </div>
                                        )}
                                        {rec.diagnosis && (
                                          <div>
                                            <span className="font-medium text-xs text-muted-foreground">Diagnóstico:</span>
                                            <p className="mt-0.5">{rec.diagnosis}</p>
                                          </div>
                                        )}
                                        {rec.treatment && (
                                          <div>
                                            <span className="font-medium text-xs text-muted-foreground">Tratamento:</span>
                                            <p className="mt-0.5">{rec.treatment}</p>
                                          </div>
                                        )}
                                        {rec.historico && (
                                          <div>
                                            <span className="font-medium text-xs text-muted-foreground">Histórico:</span>
                                            <p className="mt-0.5">{rec.historico}</p>
                                          </div>
                                        )}
                                        {rec.prescription && (
                                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mt-1">
                                            <span className="font-medium text-xs text-muted-foreground">Prescrição:</span>
                                            <p className="mt-0.5">{rec.prescription}</p>
                                          </div>
                                        )}
                                        {rec.evolucoes && rec.evolucoes.length > 0 && (
                                          <div className="mt-2 border-t border-border pt-2">
                                            <span className="font-medium text-xs text-muted-foreground flex items-center gap-1">
                                              <Activity className="w-3 h-3" />
                                              Evoluções ({rec.evolucoes.length}):
                                            </span>
                                            <div className="space-y-1.5 mt-1.5">
                                              {rec.evolucoes.map((ev: any, idx: number) => (
                                                <div key={idx} className="bg-muted/30 rounded p-2 text-xs">
                                                  <div className="flex justify-between mb-0.5">
                                                    <span className="text-muted-foreground">{ev.data}</span>
                                                    <Badge variant="outline" className="text-[10px] h-4">{ev.medico}</Badge>
                                                  </div>
                                                  <p>{ev.descricao}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {rec.diagnosticHypotheses && rec.diagnosticHypotheses.length > 0 && (
                                          <div className="mt-2">
                                            <span className="font-medium text-xs text-muted-foreground">Hipóteses Diagnósticas{isAdmin ? ' (IA)' : ''}:</span>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                              {rec.diagnosticHypotheses.map((h: any, i: number) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                  {h.condition}{isAdmin ? ` (${h.probability}%)` : ''}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}

                                {day.prescriptions.map((rx: any) => (
                                  <Card key={rx.id} className="border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10">
                                    <CardContent className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-amber-600" />
                                        <span className="font-medium text-sm">Prescrição</span>
                                        <Badge className={`text-xs ${
                                          rx.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {rx.status === 'active' ? 'Ativa' : rx.status}
                                        </Badge>
                                      </div>
                                      {rx.diagnosis && <p className="text-sm mt-1 text-muted-foreground">{rx.diagnosis}</p>}
                                    </CardContent>
                                  </Card>
                                ))}

                                {day.exams.map((exam: any) => (
                                  <Card key={exam.id} className="border-l-4 border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/10">
                                    <CardContent className="py-3 px-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Activity className="w-4 h-4 text-purple-600" />
                                          <span className="font-medium text-sm">{exam.examType}</span>
                                          {exam.analyzedByAI && isAdmin && (
                                            <Badge variant="outline" className="text-purple-600 text-xs">IA</Badge>
                                          )}
                                        </div>
                                      </div>
                                      {exam.abnormalValues && exam.abnormalValues.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {exam.abnormalValues.map((av: any, i: number) => (
                                            <Badge key={i} variant="destructive" className="text-xs">
                                              {av.parameter}: {av.value} {av.status === 'high' ? '↑' : '↓'}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="records" className="space-y-4">
                  {recordsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !(medicalRecords as any[] || []).length ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhum Prontuário</h3>
                          <p className="text-muted-foreground mb-4">Este paciente ainda não possui prontuários</p>
                          {isDoctor && (
                            <Button onClick={() => setIsPmdDialogOpen(true)}>
                              <Plus className="w-4 h-4 mr-1" />
                              Criar PMD v1.0
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(medicalRecords as any[] || []).map((record: any) => (
                        <Card key={record.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">
                                  {format(new Date(record.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </h3>
                                <p data-no-translate className="text-sm text-muted-foreground">Dr. {record.doctorName || "Sistema"}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                {record.pmdData && (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer text-xs" onClick={() => setSelectedPmdId(record.id)}>
                                    PMD v1.0
                                  </Badge>
                                )}
                                {!record.pmdData && isDoctor && (
                                  <Button size="sm" variant="outline" className="text-xs" onClick={() => convertPmdMutation.mutate(record.id)} disabled={convertPmdMutation.isPending}>
                                    Converter PMD
                                  </Button>
                                )}
                                {record.digitalSignature && (
                                  <Badge variant="outline" className="text-green-600 text-xs">Assinado</Badge>
                                )}
                                {record.isEncrypted && (
                                  <Badge variant="outline" className="text-blue-600 text-xs">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Cripto
                                  </Badge>
                                )}
                                {record.patientFriendlyActive && (
                                  <Badge variant="outline" className="text-emerald-600 text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Visível ao Paciente
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {record.symptoms && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Sintomas / Anamnese</h4>
                                  <p className="text-sm">{record.symptoms}</p>
                                </div>
                              )}
                              {record.diagnosis && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Diagnóstico</h4>
                                  <p className="text-sm">{record.diagnosis}</p>
                                </div>
                              )}
                              {record.treatment && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Tratamento</h4>
                                  <p className="text-sm">{record.treatment}</p>
                                </div>
                              )}
                              {record.prescription && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-sm text-muted-foreground">Prescrição</h4>
                                    {!record.digitalSignature ? (
                                      <Button size="sm" variant="outline" onClick={() => signPrescriptionMutation.mutate(record.id)} disabled={signPrescriptionMutation.isPending} className="text-xs">
                                        {signPrescriptionMutation.isPending ? "Assinando..." : "Assinar FIPS 140-2"}
                                      </Button>
                                    ) : (
                                      <Badge variant="outline" className="text-green-600 text-xs">Assinado FIPS 140-2</Badge>
                                    )}
                                  </div>
                                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                    <p className="text-sm">{record.prescription}</p>
                                  </div>
                                </div>
                              )}
                              {record.diagnosticHypotheses && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Hipóteses Diagnósticas{isAdmin ? ' (IA)' : ''}</h4>
                                  <div className="space-y-2">
                                    {record.diagnosticHypotheses.map((h: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                                        <span>{h.condition}</span>
                                        {isAdmin && <Badge variant="outline">{h.probability}%</Badge>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="border-t pt-3 mt-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Acesso do Paciente:</span>
                                    {record.patientFriendlyVersion ? (
                                      <Badge variant={record.patientFriendlyActive ? "default" : "secondary"} className="text-xs">
                                        {record.patientFriendlyActive ? "Ativo" : "Inativo"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs text-muted-foreground">Não gerada</Badge>
                                    )}
                                  </div>
                                  {(isAdmin || record.doctorId === user?.id) && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs"
                                        onClick={() => generateFriendlyMutation.mutate(record.id)}
                                        disabled={generateFriendlyMutation.isPending}
                                      >
                                        {generateFriendlyMutation.isPending ? 'Gerando...' : record.patientFriendlyVersion ? 'Regerar Versão Acessível' : 'Criar Versão Acessível'}
                                      </Button>
                                      {record.patientFriendlyVersion && (
                                        <Button
                                          size="sm"
                                          variant={record.patientFriendlyActive ? "destructive" : "default"}
                                          className="text-xs"
                                          onClick={() => toggleFriendlyMutation.mutate(record.id)}
                                          disabled={toggleFriendlyMutation.isPending}
                                        >
                                          {record.patientFriendlyActive ? 'Desativar' : 'Ativar'} Visibilidade
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="exams" className="space-y-4">
                  {!(examResults as any[] || []).length ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhum Exame</h3>
                          <p className="text-muted-foreground">Este paciente ainda não possui resultados de exames</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {(examResults as any[] || []).map((exam: any) => (
                        <Card key={exam.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{exam.examType}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(exam.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              {exam.analyzedByAI && isAdmin && (
                                <Badge variant="outline" className="text-purple-600">Analisado por IA</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {exam.results && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Resultados</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    {Object.entries(exam.results).map(([key, value]: [string, any]) => (
                                      <div key={key} className="flex justify-between">
                                        <span className="text-muted-foreground">{key}:</span>
                                        <span className="font-medium">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {exam.abnormalValues && exam.abnormalValues.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-2 text-destructive">Valores Alterados</h4>
                                  <div className="space-y-2">
                                    {exam.abnormalValues.map((abnormal: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between text-sm bg-destructive/10 p-2 rounded">
                                        <span>{abnormal.parameter}</span>
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium">{abnormal.value}</span>
                                          <Badge variant="destructive" className="text-xs">
                                            {abnormal.status === 'high' ? '↑' : '↓'}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pmd" className="space-y-4">
                  {recordsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      {(medicalRecords as any[] || []).filter((r: any) => r.pmdData).length === 0 ? (
                        <Card>
                          <CardContent className="py-12">
                            <div className="text-center">
                              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                              <h3 className="text-lg font-semibold text-muted-foreground mb-2">Nenhum PMD v1.0</h3>
                              <p className="text-muted-foreground mb-4">Crie um novo prontuário no formato PMD v1.0 ou converta um existente</p>
                              {isDoctor && (
                                <div className="flex justify-center gap-2">
                                  <Button onClick={() => setIsPmdDialogOpen(true)}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Criar PMD
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {(medicalRecords as any[] || []).filter((r: any) => r.pmdData).map((record: any) => {
                            const rPmd = record.pmdData as any;
                            return (
                              <Card key={record.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedPmdId(record.id)}>
                                <CardContent className="py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                      </div>
                                      <div>
                                        <p data-no-translate className="font-medium text-sm">{rPmd?.paciente?.nome || selectedPatient.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          CRM: {rPmd?.medico_crm || 'N/A'} |{' '}
                                          {format(new Date(record.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {rPmd?.clinico?.diagnostico && (
                                        <Badge variant="outline" className="text-xs">{rPmd.clinico.diagnostico.substring(0, 30)}{rPmd.clinico.diagnostico.length > 30 ? '...' : ''}</Badge>
                                      )}
                                      <Badge className="bg-emerald-600 text-xs">PMD v1.0</Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
      {selectedPatient && (
        <PatientExportDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
        />
      )}
    </PageWrapper>
  );
}
