import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  prescription: { icon: Pill, label: "Prescrição", color: "bg-blue-100 text-blue-800 border-blue-200" },
  exam: { icon: TestTube, label: "Exame", color: "bg-purple-100 text-purple-800 border-purple-200" },
  referral: { icon: ArrowUpRight, label: "Encaminhamento", color: "bg-orange-100 text-orange-800 border-orange-200" },
  followup: { icon: CalendarCheck, label: "Retorno", color: "bg-green-100 text-green-800 border-green-200" },
};

export default function PostConsultationReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [analysisDialog, setAnalysisDialog] = useState<{ open: boolean; itemId: string; analysis: AnalysisResult | null }>({ open: false, itemId: "", analysis: null });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: pendingItems, isLoading } = useQuery<PostConsultationItem[]>({
    queryKey: ["/api/post-consultation/pending"],
    enabled: !!user && user.role === "doctor",
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
              Revise e aprove prescrições, exames e encaminhamentos gerados automaticamente
            </p>
          </div>
          {selectedItems.size > 0 && (
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

                    return (
                      <div key={item.id} className={`p-4 transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={config.color}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              <span className="font-medium text-sm">{item.title}</span>
                            </div>

                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                            )}

                            {isExpanded && (
                              <div className="mt-3 space-y-3">
                                {item.type === "prescription" && item.details?.medications && (
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <Pill className="w-3.5 h-3.5" /> Medicamentos
                                    </h5>
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
                                  </div>
                                )}

                                {item.type === "exam" && item.details?.exams && (
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <TestTube className="w-3.5 h-3.5" /> Exames Solicitados
                                    </h5>
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
                                  </div>
                                )}

                                {item.type === "referral" && item.details && (
                                  <div className="bg-orange-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <ArrowUpRight className="w-3.5 h-3.5" /> Encaminhamento
                                    </h5>
                                    <div className="text-sm bg-white rounded p-2">
                                      <p className="font-medium">Especialidade: {item.details.specialty}</p>
                                      <p className="text-muted-foreground">Motivo: {item.details.reason}</p>
                                      <p className="text-muted-foreground">Urgência: {item.details.urgency}</p>
                                      {item.details.notes && <p className="text-xs text-muted-foreground mt-1">{item.details.notes}</p>}
                                    </div>
                                  </div>
                                )}

                                {item.type === "followup" && item.details && (
                                  <div className="bg-green-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                                      <CalendarCheck className="w-3.5 h-3.5" /> Retorno
                                    </h5>
                                    <div className="text-sm bg-white rounded p-2">
                                      {item.details.suggestedDate && <p className="font-medium">Data sugerida: {item.details.suggestedDate}</p>}
                                      <p className="text-muted-foreground">{item.details.reason}</p>
                                      {item.details.instructions && <p className="text-xs text-muted-foreground mt-1">{item.details.instructions}</p>}
                                    </div>
                                  </div>
                                )}

                                {item.patientSummary && (
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <h5 className="text-sm font-medium mb-1">Resumo para o Paciente</h5>
                                    <p className="text-sm text-muted-foreground">{item.patientSummary}</p>
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Textarea
                                    placeholder="Notas de revisão (opcional)..."
                                    value={reviewNotes[item.id] || ""}
                                    onChange={(e) => setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })}
                                    className="h-20"
                                  />
                                </div>
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

                              {item.type === "prescription" && (
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
      </div>

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
