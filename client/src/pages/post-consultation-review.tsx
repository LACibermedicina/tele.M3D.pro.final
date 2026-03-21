import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Pill,
  TestTube,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Pencil,
  History,
  Save,
  X,
  PenLine,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FormattedText } from "@/components/ui/formatted-text";

interface PostConsultationItem {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  type: string;
  title: string;
  description: string | null;
  details: any;
  status: string;
  patientSummary: string | null;
  reviewNotes: string | null;
  aiAnalysis: any;
  reviewedAt: string | null;
  editHistory: any[];
  editedAt: string | null;
  editedBy: string | null;
  createdAt: string;
}

interface DrugInteraction {
  drugs: string[];
  severity: string;
  description: string;
}

interface AnalysisResult {
  drugInteractions?: DrugInteraction[];
  contraindications?: any[];
  adverseEffects?: any[];
  efficacy?: { percentage: number; evidence: string };
  alternatives?: any[];
  recommendations?: string;
  examAnalysis?: any[];
  urgencyAssessment?: string;
  assessment?: string;
  priority?: string;
}

interface EditState {
  title: string;
  description: string;
  details: any;
  patientSummary: string;
  editReason: string;
}

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  prescription: { icon: Pill, label: "Prescrição", color: "bg-blue-100 text-blue-800 border-blue-200" },
  exam: { icon: TestTube, label: "Exame", color: "bg-purple-100 text-purple-800 border-purple-200" },
  referral: { icon: ArrowUpRight, label: "Encaminhamento", color: "bg-orange-100 text-orange-800 border-orange-200" },
  followup: { icon: CalendarCheck, label: "Retorno", color: "bg-green-100 text-green-800 border-green-200" },
};

function MedicationEditor({ medications, onChange }: { medications: any[]; onChange: (meds: any[]) => void }) {
  const updateMed = (idx: number, field: string, value: string) => {
    const updated = [...medications];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const removeMed = (idx: number) => {
    onChange(medications.filter((_, i) => i !== idx));
  };

  const addMed = () => {
    onChange([...medications, { name: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "" }]);
  };

  return (
    <div className="space-y-3">
      {medications.map((med, idx) => (
        <div key={idx} className="bg-white rounded-lg p-3 border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Medicamento {idx + 1}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => removeMed(idx)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={med.name || ""} onChange={(e) => updateMed(idx, "name", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Dosagem</Label>
              <Input value={med.dosage || ""} onChange={(e) => updateMed(idx, "dosage", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Frequência</Label>
              <Input value={med.frequency || ""} onChange={(e) => updateMed(idx, "frequency", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Duração</Label>
              <Input value={med.duration || ""} onChange={(e) => updateMed(idx, "duration", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Via</Label>
              <Input value={med.route || ""} onChange={(e) => updateMed(idx, "route", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Instruções</Label>
              <Input value={med.instructions || ""} onChange={(e) => updateMed(idx, "instructions", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addMed} className="w-full">
        + Adicionar Medicamento
      </Button>
    </div>
  );
}

function ExamEditor({ exams, onChange }: { exams: any[]; onChange: (exams: any[]) => void }) {
  const updateExam = (idx: number, field: string, value: string) => {
    const updated = [...exams];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const removeExam = (idx: number) => {
    onChange(exams.filter((_, i) => i !== idx));
  };

  const addExam = () => {
    onChange([...exams, { name: "", type: "", urgency: "rotina", justification: "" }]);
  };

  return (
    <div className="space-y-3">
      {exams.map((exam, idx) => (
        <div key={idx} className="bg-white rounded-lg p-3 border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Exame {idx + 1}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => removeExam(idx)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={exam.name || ""} onChange={(e) => updateExam(idx, "name", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Input value={exam.type || ""} onChange={(e) => updateExam(idx, "type", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Urgência</Label>
              <Input value={exam.urgency || ""} onChange={(e) => updateExam(idx, "urgency", e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Justificativa</Label>
              <Input value={exam.justification || ""} onChange={(e) => updateExam(idx, "justification", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addExam} className="w-full">
        + Adicionar Exame
      </Button>
    </div>
  );
}

function EditHistoryDialog({ history, open, onOpenChange }: { history: any[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            Histórico de Edições
          </DialogTitle>
          <DialogDescription>
            Registro completo de todas as alterações realizadas neste item
          </DialogDescription>
        </DialogHeader>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma edição registrada.</p>
        ) : (
          <div className="space-y-3">
            {history.map((entry: any, idx: number) => (
              <div key={idx} className={`rounded-lg p-3 border ${entry.wasApproved ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {entry.wasApproved && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                      Pós-aprovação
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {entry.editedByName} • {format(new Date(entry.editedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-sm mt-1"><span className="font-medium">Motivo:</span> {entry.reason}</p>
                )}
                {entry.previousValues && Object.keys(entry.previousValues).length > 0 && (
                  <div className="mt-2 text-xs space-y-1">
                    <p className="font-medium text-muted-foreground">Valores anteriores:</p>
                    {entry.previousValues.title && (
                      <p><span className="text-muted-foreground">Título:</span> {entry.previousValues.title}</p>
                    )}
                    {entry.previousValues.description && (
                      <p><span className="text-muted-foreground">Descrição:</span> {entry.previousValues.description}</p>
                    )}
                    {entry.previousValues.patientSummary && (
                      <p><span className="text-muted-foreground">Resumo paciente:</span> {entry.previousValues.patientSummary}</p>
                    )}
                    {entry.previousValues.details && (
                      <p className="text-muted-foreground italic">Detalhes clínicos foram alterados</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PostConsultationReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [analysisDialog, setAnalysisDialog] = useState<{ open: boolean; itemId: string; analysis: AnalysisResult | null }>({ open: false, itemId: "", analysis: null });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItems, setEditingItems] = useState<Record<string, EditState>>({});
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; history: any[] }>({ open: false, history: [] });

  const { data: pendingItems, isLoading } = useQuery<PostConsultationItem[]>({
    queryKey: ["/api/post-consultation/pending"],
    enabled: !!user && user.role === "doctor",
  });

  const { data: approvedItems, isLoading: isLoadingApproved } = useQuery<PostConsultationItem[]>({
    queryKey: ["/api/post-consultation/approved"],
    enabled: !!user && user.role === "doctor" && activeTab === "approved",
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string; action: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/post-consultation/items/${id}/review`, { action, reviewNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item revisado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/post-consultation/pending"] });
    },
    onError: () => {
      toast({ title: "Erro ao revisar item", variant: "destructive" });
    },
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async ({ itemIds, action }: { itemIds: string[]; action: string }) => {
      const res = await apiRequest("POST", "/api/post-consultation/bulk-review", { itemIds, action });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.updated} itens aprovados com sucesso` });
      setSelectedItems(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/post-consultation/pending"] });
    },
    onError: () => {
      toast({ title: "Erro na aprovação em lote", variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async ({ id, consultationId }: { id: string; consultationId: string }) => {
      const res = await apiRequest("POST", `/api/post-consultation/items/${id}/analyze`, { consultationId });
      return res.json();
    },
    onSuccess: (data, variables) => {
      setAnalysisDialog({ open: true, itemId: variables.id, analysis: data });
    },
    onError: () => {
      toast({ title: "Erro na análise", description: "Tente novamente.", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EditState> }) => {
      const res = await apiRequest("PATCH", `/api/post-consultation/items/${id}/edit`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Item editado com sucesso" });
      setEditingItems((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/post-consultation/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/post-consultation/approved"] });
    },
    onError: () => {
      toast({ title: "Erro ao editar item", variant: "destructive" });
    },
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedItems(next);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  const startEditing = (item: PostConsultationItem) => {
    setEditingItems((prev) => ({
      ...prev,
      [item.id]: {
        title: item.title,
        description: item.description || "",
        details: item.details ? JSON.parse(JSON.stringify(item.details)) : {},
        patientSummary: item.patientSummary || "",
        editReason: "",
      },
    }));
    if (!expandedItems.has(item.id)) {
      toggleExpand(item.id);
    }
  };

  const cancelEditing = (id: string) => {
    setEditingItems((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEdit = (id: string) => {
    const editState = editingItems[id];
    if (!editState) return;
    editMutation.mutate({
      id,
      data: {
        title: editState.title,
        description: editState.description,
        details: editState.details,
        patientSummary: editState.patientSummary,
        editReason: editState.editReason,
      },
    });
  };

  const updateEditField = (id: string, field: keyof EditState, value: any) => {
    setEditingItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const groupedByConsultation = (pendingItems || []).reduce<Record<string, PostConsultationItem[]>>((acc, item) => {
    if (!acc[item.consultationId]) acc[item.consultationId] = [];
    acc[item.consultationId].push(item);
    return acc;
  }, {});

  if (!user || user.role !== "doctor") {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p>Acesso restrito a médicos.</p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-5xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Revisão Pós-Consulta</h1>
            <p className="text-muted-foreground">
              Revise, edite e aprove prescrições, exames e encaminhamentos gerados automaticamente
            </p>
          </div>
          {activeTab === "pending" && selectedItems.size > 0 && (
            <Button
              onClick={() => bulkReviewMutation.mutate({ itemIds: Array.from(selectedItems), action: "approve" })}
              disabled={bulkReviewMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Aprovar Selecionados ({selectedItems.size})
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="pending">
              Pendentes {pendingItems?.length ? `(${pendingItems.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Aprovados {approvedItems?.length ? `(${approvedItems.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !pendingItems?.length ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">Tudo revisado!</h3>
              <p className="text-muted-foreground">
                Não há itens pós-consulta pendentes de revisão.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByConsultation).map(([consultationId, items]) => (
              <Card key={consultationId} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Consulta - {format(new Date(items[0].createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </CardTitle>
                    <Badge variant="secondary">{items.length} {items.length === 1 ? "item" : "itens"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {items.map((item) => {
                    const config = typeConfig[item.type] || typeConfig.prescription;
                    const Icon = config.icon;
                    const isExpanded = expandedItems.has(item.id);
                    const isSelected = selectedItems.has(item.id);
                    const isEditing = !!editingItems[item.id];
                    const editState = editingItems[item.id];
                    const hasEditHistory = Array.isArray(item.editHistory) && item.editHistory.length > 0;
                    const wasEditedAfterApproval = hasEditHistory && item.editHistory.some((e: any) => e.wasApproved);

                    return (
                      <div key={item.id} className={`p-4 transition-colors ${isSelected ? "bg-blue-50/50" : ""} ${isEditing ? "bg-amber-50/30 ring-1 ring-amber-200" : ""}`}>
                        <div className="flex items-start gap-3">
                          {!isEditing && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-300"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              {isEditing ? (
                                <Input
                                  value={editState.title}
                                  onChange={(e) => updateEditField(item.id, "title", e.target.value)}
                                  className="h-7 text-sm font-medium flex-1 min-w-[200px]"
                                />
                              ) : (
                                <span className="font-medium text-sm">{item.title}</span>
                              )}
                              {wasEditedAfterApproval && !isEditing && (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                                  <PenLine className="w-3 h-3 mr-1" />
                                  Editado após aprovação
                                </Badge>
                              )}
                              {hasEditHistory && !wasEditedAfterApproval && !isEditing && (
                                <Badge variant="outline" className="text-gray-600 border-gray-300 text-xs">
                                  <Pencil className="w-3 h-3 mr-1" />
                                  Editado
                                </Badge>
                              )}
                            </div>

                            {isEditing ? (
                              <Textarea
                                value={editState.description}
                                onChange={(e) => updateEditField(item.id, "description", e.target.value)}
                                placeholder="Descrição..."
                                className="mt-1 text-sm h-16"
                              />
                            ) : (
                              item.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              )
                            )}

                            {isExpanded && (
                              <div className="mt-3 space-y-3">
                                {item.type === "prescription" && (
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <Pill className="w-3.5 h-3.5" /> Medicamentos
                                    </h5>
                                    {isEditing ? (
                                      <MedicationEditor
                                        medications={editState.details?.medications || []}
                                        onChange={(meds) => updateEditField(item.id, "details", { ...editState.details, medications: meds })}
                                      />
                                    ) : (
                                      item.details?.medications && (
                                        <div className="space-y-2">
                                          {(item.details.medications as any[]).map((med: any, idx: number) => (
                                            <div key={idx} className="text-sm bg-white rounded p-2">
                                              <p className="font-medium">{med.name} {med.dosage}</p>
                                              <p className="text-muted-foreground">
                                                {med.frequency} • {med.duration} • Via: {med.route || "oral"}
                                              </p>
                                              {med.instructions && <p className="text-xs text-muted-foreground mt-1">{med.instructions}</p>}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "exam" && (
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <TestTube className="w-3.5 h-3.5" /> Exames Solicitados
                                    </h5>
                                    {isEditing ? (
                                      <ExamEditor
                                        exams={editState.details?.exams || []}
                                        onChange={(exams) => updateEditField(item.id, "details", { ...editState.details, exams })}
                                      />
                                    ) : (
                                      item.details?.exams && (
                                        <div className="space-y-2">
                                          {(item.details.exams as any[]).map((exam: any, idx: number) => (
                                            <div key={idx} className="text-sm bg-white rounded p-2">
                                              <p className="font-medium">{exam.name}</p>
                                              <p className="text-muted-foreground">
                                                {exam.type} • Urgência: {exam.urgency}
                                              </p>
                                              {exam.justification && <p className="text-xs text-muted-foreground mt-1">{exam.justification}</p>}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "referral" && (
                                  <div className="bg-orange-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <ArrowUpRight className="w-3.5 h-3.5" /> Encaminhamento
                                    </h5>
                                    {isEditing ? (
                                      <div className="bg-white rounded p-3 space-y-2">
                                        <div>
                                          <Label className="text-xs">Especialidade</Label>
                                          <Input
                                            value={editState.details?.specialty || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, specialty: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Motivo</Label>
                                          <Input
                                            value={editState.details?.reason || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, reason: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Urgência</Label>
                                          <Input
                                            value={editState.details?.urgency || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, urgency: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Notas</Label>
                                          <Textarea
                                            value={editState.details?.notes || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, notes: e.target.value })}
                                            className="h-16 text-sm"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      item.details && (
                                        <div className="text-sm bg-white rounded p-2">
                                          <p className="font-medium">Especialidade: {item.details.specialty}</p>
                                          <p className="text-muted-foreground">Motivo: {item.details.reason}</p>
                                          <p className="text-muted-foreground">Urgência: {item.details.urgency}</p>
                                          {item.details.notes && <p className="text-xs text-muted-foreground mt-1">{item.details.notes}</p>}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "followup" && (
                                  <div className="bg-green-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <CalendarCheck className="w-3.5 h-3.5" /> Retorno
                                    </h5>
                                    {isEditing ? (
                                      <div className="bg-white rounded p-3 space-y-2">
                                        <div>
                                          <Label className="text-xs">Data sugerida</Label>
                                          <Input
                                            value={editState.details?.suggestedDate || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, suggestedDate: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Motivo</Label>
                                          <Input
                                            value={editState.details?.reason || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, reason: e.target.value })}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Instruções</Label>
                                          <Textarea
                                            value={editState.details?.instructions || ""}
                                            onChange={(e) => updateEditField(item.id, "details", { ...editState.details, instructions: e.target.value })}
                                            className="h-16 text-sm"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      item.details && (
                                        <div className="text-sm bg-white rounded p-2">
                                          {item.details.suggestedDate && <p className="font-medium">Data sugerida: {item.details.suggestedDate}</p>}
                                          <p className="text-muted-foreground">{item.details.reason}</p>
                                          {item.details.instructions && <p className="text-xs text-muted-foreground mt-1">{item.details.instructions}</p>}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {isEditing && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-1">Resumo para o Paciente</h5>
                                    <Textarea
                                      value={editState.patientSummary}
                                      onChange={(e) => updateEditField(item.id, "patientSummary", e.target.value)}
                                      placeholder="Resumo em linguagem acessível para o paciente..."
                                      className="h-16 text-sm"
                                    />
                                  </div>
                                )}

                                {!isEditing && item.patientSummary && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-1">Resumo para o Paciente</h5>
                                    <p className="text-sm text-muted-foreground">{item.patientSummary}</p>
                                  </div>
                                )}

                                {isEditing && (item.status === 'approved' || item.status === 'signed') && (
                                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                    <h5 className="text-sm font-medium mb-1 text-amber-800 flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      Motivo da edição (obrigatório para itens aprovados)
                                    </h5>
                                    <Textarea
                                      value={editState.editReason}
                                      onChange={(e) => updateEditField(item.id, "editReason", e.target.value)}
                                      placeholder="Descreva o motivo da alteração..."
                                      className="h-16 text-sm border-amber-200"
                                    />
                                  </div>
                                )}

                                {isEditing && item.status === 'pending_review' && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-1">Motivo da edição (opcional)</h5>
                                    <Textarea
                                      value={editState.editReason}
                                      onChange={(e) => updateEditField(item.id, "editReason", e.target.value)}
                                      placeholder="Descreva o motivo da alteração..."
                                      className="h-16 text-sm"
                                    />
                                  </div>
                                )}

                                {!isEditing && (
                                  <div className="space-y-2">
                                    <Textarea
                                      placeholder="Notas de revisão (opcional)..."
                                      value={reviewNotes[item.id] || ""}
                                      onChange={(e) => setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })}
                                      className="h-20"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(item.id)}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                {isExpanded ? "Recolher" : "Detalhes"}
                              </Button>

                              {!isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditing(item)}
                                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                >
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Editar
                                </Button>
                              )}

                              {hasEditHistory && !isEditing && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHistoryDialog({ open: true, history: item.editHistory })}
                                  className="text-gray-500"
                                >
                                  <History className="w-4 h-4 mr-1" />
                                  Histórico ({item.editHistory.length})
                                </Button>
                              )}

                              {!isEditing && item.type === "prescription" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => analyzeMutation.mutate({ id: item.id, consultationId: item.consultationId })}
                                  disabled={analyzeMutation.isPending}
                                >
                                  <Search className="w-4 h-4 mr-1" />
                                  {analyzeMutation.isPending ? "Analisando..." : "Analisar Interações"}
                                </Button>
                              )}

                              <div className="flex-1" />

                              {isEditing ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelEditing(item.id)}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={() => saveEdit(item.id)}
                                    disabled={editMutation.isPending || ((item.status === 'approved' || item.status === 'signed') && !editState.editReason.trim())}
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => reviewMutation.mutate({ id: item.id, action: "reject", notes: reviewNotes[item.id] })}
                                    disabled={reviewMutation.isPending}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rejeitar
                                  </Button>

                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => reviewMutation.mutate({ id: item.id, action: "approve", notes: reviewNotes[item.id] })}
                                    disabled={reviewMutation.isPending}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="approved">
            {isLoadingApproved ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : !approvedItems?.length ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum item aprovado</h3>
                  <p className="text-muted-foreground">
                    Itens aprovados aparecerão aqui para edição posterior.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {approvedItems.map((item) => {
                  const config = typeConfig[item.type] || typeConfig.prescription;
                  const Icon = config.icon;
                  const isExpanded = expandedItems.has(item.id);
                  const isEditing = !!editingItems[item.id];
                  const editState = editingItems[item.id];
                  const hasEditHistory = Array.isArray(item.editHistory) && item.editHistory.length > 0;
                  const wasEditedAfterApproval = hasEditHistory && item.editHistory.some((e: any) => e.wasApproved);

                  return (
                    <Card key={item.id} className={`overflow-hidden ${isEditing ? "ring-1 ring-amber-200" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {item.status === 'signed' ? 'Assinado' : 'Aprovado'}
                              </Badge>
                              {wasEditedAfterApproval && (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                                  <PenLine className="w-3 h-3 mr-1" />
                                  Editado após aprovação
                                </Badge>
                              )}
                              {isEditing ? (
                                <Input
                                  value={editState.title}
                                  onChange={(e) => updateEditField(item.id, "title", e.target.value)}
                                  className="h-7 text-sm font-medium flex-1 min-w-[200px]"
                                />
                              ) : (
                                <span className="font-medium text-sm">{item.title}</span>
                              )}
                            </div>

                            {item.reviewedAt && !isEditing && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Aprovado em {format(new Date(item.reviewedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                {item.editedAt && ` • Última edição: ${format(new Date(item.editedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
                              </p>
                            )}

                            {isEditing ? (
                              <Textarea
                                value={editState.description}
                                onChange={(e) => updateEditField(item.id, "description", e.target.value)}
                                placeholder="Descrição..."
                                className="mt-2 text-sm h-16"
                              />
                            ) : (
                              item.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              )
                            )}

                            {isExpanded && (
                              <div className="mt-3 space-y-3">
                                {item.type === "prescription" && (
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <Pill className="w-3.5 h-3.5" /> Medicamentos
                                    </h5>
                                    {isEditing ? (
                                      <MedicationEditor
                                        medications={editState.details?.medications || []}
                                        onChange={(meds) => updateEditField(item.id, "details", { ...editState.details, medications: meds })}
                                      />
                                    ) : (
                                      item.details?.medications && (
                                        <div className="space-y-2">
                                          {(item.details.medications as any[]).map((med: any, idx: number) => (
                                            <div key={idx} className="text-sm bg-white rounded p-2">
                                              <p className="font-medium">{med.name} {med.dosage}</p>
                                              <p className="text-muted-foreground">
                                                {med.frequency} • {med.duration} • Via: {med.route || "oral"}
                                              </p>
                                              {med.instructions && <p className="text-xs text-muted-foreground mt-1">{med.instructions}</p>}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "exam" && (
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <TestTube className="w-3.5 h-3.5" /> Exames
                                    </h5>
                                    {isEditing ? (
                                      <ExamEditor
                                        exams={editState.details?.exams || []}
                                        onChange={(exams) => updateEditField(item.id, "details", { ...editState.details, exams })}
                                      />
                                    ) : (
                                      item.details?.exams && (
                                        <div className="space-y-2">
                                          {(item.details.exams as any[]).map((exam: any, idx: number) => (
                                            <div key={idx} className="text-sm bg-white rounded p-2">
                                              <p className="font-medium">{exam.name}</p>
                                              <p className="text-muted-foreground">{exam.type} • Urgência: {exam.urgency}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "referral" && (
                                  <div className="bg-orange-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <ArrowUpRight className="w-3.5 h-3.5" /> Encaminhamento
                                    </h5>
                                    {isEditing ? (
                                      <div className="bg-white rounded p-3 space-y-2">
                                        <div>
                                          <Label className="text-xs">Especialidade</Label>
                                          <Input value={editState.details?.specialty || ""} onChange={(e) => updateEditField(item.id, "details", { ...editState.details, specialty: e.target.value })} className="h-8 text-sm" />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Motivo</Label>
                                          <Input value={editState.details?.reason || ""} onChange={(e) => updateEditField(item.id, "details", { ...editState.details, reason: e.target.value })} className="h-8 text-sm" />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Urgência</Label>
                                          <Input value={editState.details?.urgency || ""} onChange={(e) => updateEditField(item.id, "details", { ...editState.details, urgency: e.target.value })} className="h-8 text-sm" />
                                        </div>
                                      </div>
                                    ) : (
                                      item.details && (
                                        <div className="text-sm bg-white rounded p-2">
                                          <p className="font-medium">Especialidade: {item.details.specialty}</p>
                                          <p className="text-muted-foreground">Motivo: {item.details.reason}</p>
                                          <p className="text-muted-foreground">Urgência: {item.details.urgency}</p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {item.type === "followup" && (
                                  <div className="bg-green-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <CalendarCheck className="w-3.5 h-3.5" /> Retorno
                                    </h5>
                                    {isEditing ? (
                                      <div className="bg-white rounded p-3 space-y-2">
                                        <div>
                                          <Label className="text-xs">Data sugerida</Label>
                                          <Input value={editState.details?.suggestedDate || ""} onChange={(e) => updateEditField(item.id, "details", { ...editState.details, suggestedDate: e.target.value })} className="h-8 text-sm" />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Motivo</Label>
                                          <Input value={editState.details?.reason || ""} onChange={(e) => updateEditField(item.id, "details", { ...editState.details, reason: e.target.value })} className="h-8 text-sm" />
                                        </div>
                                      </div>
                                    ) : (
                                      item.details && (
                                        <div className="text-sm bg-white rounded p-2">
                                          {item.details.suggestedDate && <p className="font-medium">Data sugerida: {item.details.suggestedDate}</p>}
                                          <p className="text-muted-foreground">{item.details.reason}</p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {isEditing && (
                                  <>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                      <h5 className="text-sm font-medium mb-1">Resumo para o Paciente</h5>
                                      <Textarea
                                        value={editState.patientSummary}
                                        onChange={(e) => updateEditField(item.id, "patientSummary", e.target.value)}
                                        placeholder="Resumo em linguagem acessível..."
                                        className="h-16 text-sm"
                                      />
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                      <h5 className="text-sm font-medium mb-1 text-amber-800 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Motivo da edição (obrigatório)
                                      </h5>
                                      <Textarea
                                        value={editState.editReason}
                                        onChange={(e) => updateEditField(item.id, "editReason", e.target.value)}
                                        placeholder="Descreva o motivo da alteração..."
                                        className="h-16 text-sm border-amber-200"
                                      />
                                    </div>
                                  </>
                                )}

                                {!isEditing && item.patientSummary && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-1">Resumo para o Paciente</h5>
                                    <p className="text-sm text-muted-foreground">{item.patientSummary}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <Button variant="ghost" size="sm" onClick={() => toggleExpand(item.id)}>
                                {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                {isExpanded ? "Recolher" : "Detalhes"}
                              </Button>

                              {!isEditing && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditing(item)}
                                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                >
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Editar
                                </Button>
                              )}

                              {hasEditHistory && !isEditing && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHistoryDialog({ open: true, history: item.editHistory })}
                                  className="text-gray-500"
                                >
                                  <History className="w-4 h-4 mr-1" />
                                  Histórico ({item.editHistory.length})
                                </Button>
                              )}

                              <div className="flex-1" />

                              {isEditing && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => cancelEditing(item.id)}>
                                    <X className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={() => saveEdit(item.id)}
                                    disabled={editMutation.isPending || !editState.editReason.trim()}
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EditHistoryDialog
        history={historyDialog.history}
        open={historyDialog.open}
        onOpenChange={(open) => setHistoryDialog({ ...historyDialog, open })}
      />

      <Dialog open={analysisDialog.open} onOpenChange={(open) => setAnalysisDialog({ ...analysisDialog, open })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Análise de Segurança Farmacológica
            </DialogTitle>
            <DialogDescription>
              Análise baseada em diretrizes OMS, ANVISA e Ministério da Saúde
            </DialogDescription>
          </DialogHeader>

          {analysisDialog.analysis && (
            <div className="space-y-4">
              {analysisDialog.analysis.drugInteractions && analysisDialog.analysis.drugInteractions.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    Interações Medicamentosas
                  </h4>
                  <div className="space-y-2">
                    {analysisDialog.analysis.drugInteractions.map((interaction, idx) => (
                      <div key={idx} className={`rounded-lg p-3 border ${
                        interaction.severity === "alta" ? "bg-red-50 border-red-200" :
                        interaction.severity === "média" ? "bg-yellow-50 border-yellow-200" :
                        "bg-green-50 border-green-200"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={interaction.severity === "alta" ? "destructive" : "secondary"}>
                            {interaction.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">{interaction.drugs.join(" + ")}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{interaction.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisDialog.analysis.contraindications && analysisDialog.analysis.contraindications.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    Contraindicações
                  </h4>
                  <div className="space-y-1">
                    {analysisDialog.analysis.contraindications.map((ci: any, idx: number) => (
                      <div key={idx} className="text-sm bg-red-50 rounded p-2 border border-red-100">
                        <span className="font-medium">{ci.drug}</span>: {ci.condition} — {ci.risk}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisDialog.analysis.adverseEffects && analysisDialog.analysis.adverseEffects.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    Efeitos Adversos
                  </h4>
                  <div className="space-y-1">
                    {analysisDialog.analysis.adverseEffects.map((ae: any, idx: number) => (
                      <div key={idx} className="text-sm bg-orange-50 rounded p-2 border border-orange-100">
                        <span className="font-medium">{ae.drug}</span>: {(ae.effects || []).join(", ")} ({ae.frequency})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisDialog.analysis.efficacy && (
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    Eficácia Estimada
                  </h4>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-bold text-green-700">{analysisDialog.analysis.efficacy.percentage}%</div>
                      <div className="flex-1 bg-green-200 rounded-full h-3">
                        <div className="bg-green-600 h-3 rounded-full" style={{ width: `${analysisDialog.analysis.efficacy.percentage}%` }} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysisDialog.analysis.efficacy.evidence}</p>
                  </div>
                </div>
              )}

              {analysisDialog.analysis.alternatives && analysisDialog.analysis.alternatives.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Alternativas Terapêuticas</h4>
                  <div className="space-y-1">
                    {analysisDialog.analysis.alternatives.map((alt: any, idx: number) => (
                      <div key={idx} className="text-sm bg-gray-50 rounded p-2 border">
                        <span className="font-medium">{alt.drug || alt.option}</span>
                        {alt.advantage && <span className="text-green-700 ml-2">✓ {alt.advantage}</span>}
                        {alt.disadvantage && <span className="text-red-600 ml-2">✗ {alt.disadvantage}</span>}
                        {alt.rationale && <span className="text-muted-foreground ml-2">— {alt.rationale}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisDialog.analysis.recommendations && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <h4 className="font-medium text-sm mb-1">Recomendações</h4>
                  <FormattedText text={analysisDialog.analysis.recommendations} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
