import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Microscope,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  Brain,
  Shield,
  Loader2,
} from "lucide-react";

interface Hypothesis {
  code: string;
  system: string;
  description: string;
  confidence: number;
  category: string;
  differentials: string[];
  redFlags?: string[];
  suggestedExams?: string[];
}

interface DiagnosticInference {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  hypotheses: Hypothesis[];
  overallConfidence: number;
  needsReview: boolean;
  reviewStatus: string;
  clinicalHistoryAuthorized: boolean;
  epidemiologicalAuthorized: boolean;
  reviewNotes: string | null;
  compiledAt: string | null;
  createdAt: string;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 96 ? "bg-green-600" : confidence >= 70 ? "bg-yellow-500" : "bg-red-500";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${color}`}>
      {confidence}%
    </span>
  );
}

function SystemBadge({ system }: { system: string }) {
  const colors: Record<string, string> = {
    "CID-10": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "CID-11": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "DSM-5": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "DSM-5-TR": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[system] || "bg-gray-100 text-gray-800"}`}>
      {system}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    "Infeccioso": "bg-red-50 text-red-700 border-red-200",
    "Neuropsiquiátrico": "bg-purple-50 text-purple-700 border-purple-200",
    "Cardiovascular": "bg-rose-50 text-rose-700 border-rose-200",
    "Endócrino": "bg-amber-50 text-amber-700 border-amber-200",
    "Gastrointestinal": "bg-orange-50 text-orange-700 border-orange-200",
    "Respiratório": "bg-cyan-50 text-cyan-700 border-cyan-200",
    "Musculoesquelético": "bg-teal-50 text-teal-700 border-teal-200",
    "Dermatológico": "bg-pink-50 text-pink-700 border-pink-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${colors[category] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
      {category}
    </span>
  );
}

function HypothesisCard({ hypothesis, index }: { hypothesis: Hypothesis; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className={`border rounded-lg p-4 ${index === 0 ? "border-purple-300 bg-purple-50/50 dark:bg-purple-900/20 dark:border-purple-700" : "border-gray-200 dark:border-gray-700"}`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-mono font-bold text-purple-700 dark:text-purple-300 shrink-0">{hypothesis.code}</span>
          <SystemBadge system={hypothesis.system} />
          <span className="text-sm font-medium truncate">{hypothesis.description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <CategoryBadge category={hypothesis.category} />
          <ConfidenceBadge confidence={hypothesis.confidence} />
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3 border-gray-200 dark:border-gray-700">
          {hypothesis.differentials && hypothesis.differentials.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Diagnósticos diferenciais</p>
              <div className="flex flex-wrap gap-1">
                {hypothesis.differentials.map((d, i) => (
                  <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{d}</span>
                ))}
              </div>
            </div>
          )}

          {hypothesis.redFlags && hypothesis.redFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Sinais de alerta
              </p>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {hypothesis.redFlags.map((rf, i) => (
                  <li key={i}>• {rf}</li>
                ))}
              </ul>
            </div>
          )}

          {hypothesis.suggestedExams && hypothesis.suggestedExams.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-500 uppercase mb-1">Exames sugeridos</p>
              <div className="flex flex-wrap gap-1">
                {hypothesis.suggestedExams.map((e, i) => (
                  <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InferenceReviewCard({ inference }: { inference: DiagnosticInference }) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [authorizeClinicHistory, setAuthorizeClinicHistory] = useState(true);
  const [authorizeEpidemiological, setAuthorizeEpidemiological] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const { toast } = useToast();

  const reviewMutation = useMutation({
    mutationFn: async ({ action }: { action: "approve" | "reject" }) => {
      const res = await apiRequest("POST", `/api/diagnostic-inferences/${inference.id}/review`, {
        action,
        reviewNotes,
        authorizeClinicHistory,
        authorizeEpidemiological,
      });
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: action === "approve" ? "Inferência aprovada" : "Inferência rejeitada",
        description: action === "approve"
          ? "Compilação da história clínica autorizada."
          : "A inferência diagnóstica foi rejeitada.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/diagnostic-inferences/pending"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao processar revisão.",
        variant: "destructive",
      });
    },
  });

  const hypotheses = (inference.hypotheses || []) as Hypothesis[];

  return (
    <Card className="border-purple-200 dark:border-purple-800 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Microscope className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Inferência Diagnóstica Sindrômica</CardTitle>
              <p className="text-sm text-gray-500">
                {new Date(inference.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={inference.needsReview ? "destructive" : "default"}
              className={!inference.needsReview ? "bg-green-600" : ""}
            >
              {inference.needsReview ? "Revisão necessária" : "Alta confiança"}
            </Badge>
            <ConfidenceBadge confidence={inference.overallConfidence} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {hypotheses.length} hipótese(s) diagnóstica(s) identificada(s)
          </p>
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
            {showDetails ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {showDetails && (
          <div className="space-y-2">
            {hypotheses.map((h, i) => (
              <HypothesisCard key={i} hypothesis={h} index={i} />
            ))}
          </div>
        )}

        <div className="border-t pt-4 border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-600" />
            Autorização para compilação
          </h4>

          <div className="space-y-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-4 border border-purple-100 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <Checkbox
                id={`clinic-${inference.id}`}
                checked={authorizeClinicHistory}
                onCheckedChange={(v) => setAuthorizeClinicHistory(!!v)}
              />
              <label htmlFor={`clinic-${inference.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Autorizar compilação da história clínica completa
              </label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id={`epi-${inference.id}`}
                checked={authorizeEpidemiological}
                onCheckedChange={(v) => setAuthorizeEpidemiological(!!v)}
              />
              <label htmlFor={`epi-${inference.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                Autorizar quadro de inferência diagnóstico-epidemiológica
              </label>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              A compilação gerará história clínica estruturada com referências OMS, Protocolos MS/Brasil e DSM-5. 
              O quadro epidemiológico relacionará os diagnósticos com dados populacionais (DataSUS, MeSH, CID-10).
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Notas de revisão (opcional)</label>
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Adicione observações, ajustes ou justificativa..."
            className="min-h-[60px]"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => reviewMutation.mutate({ action: "reject" })}
            disabled={reviewMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Rejeitar
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => reviewMutation.mutate({ action: "approve" })}
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Aprovar e Compilar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiagnosticReview() {
  const { data: inferences = [], isLoading } = useQuery<DiagnosticInference[]>({
    queryKey: ["/api/diagnostic-inferences/pending"],
    refetchInterval: 10000,
  });

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
          <Brain className="h-7 w-7 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Revisão de Inferências Diagnósticas</h1>
          <p className="text-gray-500">
            Classificações sindrômicas CID-10/DSM-5 geradas por IA aguardando revisão e autorização
          </p>
        </div>
        {inferences.length > 0 && (
          <Badge className="ml-auto bg-purple-600 text-white text-lg px-3 py-1">
            {inferences.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-500">Carregando inferências...</span>
        </div>
      ) : inferences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Microscope className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">Nenhuma inferência pendente</p>
            <p className="text-gray-400 text-sm mt-1">
              As inferências diagnósticas são geradas automaticamente ao final de cada consulta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {inferences.map((inf) => (
            <InferenceReviewCard key={inf.id} inference={inf} />
          ))}
        </div>
      )}
    </div>
    </PageWrapper>
  );
}
