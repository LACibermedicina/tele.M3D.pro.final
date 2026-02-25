import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormattedText } from '@/components/ui/formatted-text';
import {
  Loader2,
  Activity,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Search,
  Brain,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageWrapper from '@/components/layout/page-wrapper';
import origamiHeroImage from '@assets/image_1759773239051.png';

type SymptomData = {
  symptom: string;
  meshCode?: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
};

type DiagnosisData = {
  diagnosis: string;
  icdCode?: string;
  count: number;
  percentage: number;
};

type EpidReport = {
  totalConsultations: number;
  period: string;
  symptoms: SymptomData[];
  diagnoses: DiagnosisData[];
  triageLevels: { level: string; count: number; percentage: number }[];
  ageGroups: { group: string; count: number }[];
  summary: string;
};

export default function EpidemiologicalReports() {
  const { toast } = useToast();
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: report, isLoading } = useQuery<EpidReport>({
    queryKey: ['/api/epidemiological-reports', period],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/epidemiological-reports?period=${period}`);
      return res.json();
    },
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/epidemiological-reports/analyze', { period: parseInt(period) });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Análise concluída', description: 'Os dados epidemiológicos foram atualizados com IA.' });
    },
    onError: () => {
      toast({ title: 'Erro na análise', description: 'Não foi possível gerar a análise epidemiológica.', variant: 'destructive' });
    },
  });

  const triageColorMap: Record<string, string> = {
    emergency: 'bg-red-500',
    very_urgent: 'bg-orange-500',
    urgent: 'bg-yellow-500',
    standard: 'bg-green-500',
    non_urgent: 'bg-blue-500',
  };

  const triageLabelMap: Record<string, string> = {
    emergency: 'Emergência',
    very_urgent: 'Muito Urgente',
    urgent: 'Urgente',
    standard: 'Padrão',
    non_urgent: 'Não Urgente',
  };

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              Relatórios Epidemiológicos
            </h1>
            <p className="text-muted-foreground mt-1">Análise de dados clínicos com classificação MeSH via IA</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => analysisMutation.mutate()} disabled={analysisMutation.isPending}>
              {analysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
              Análise IA
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Carregando relatórios...</span>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{report?.totalConsultations || 0}</p>
                      <p className="text-xs text-muted-foreground">Consultas no período</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Search className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{report?.symptoms?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Sintomas identificados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{report?.diagnoses?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Diagnósticos registrados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {report?.triageLevels?.filter(t => t.level === 'emergency' || t.level === 'very_urgent').reduce((sum, t) => sum + t.count, 0) || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Casos urgentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview" className="gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Visão Geral
                </TabsTrigger>
                <TabsTrigger value="symptoms" className="gap-1.5">
                  <Search className="h-4 w-4" /> Sintomas / MeSH
                </TabsTrigger>
                <TabsTrigger value="diagnoses" className="gap-1.5">
                  <FileText className="h-4 w-4" /> Diagnósticos
                </TabsTrigger>
                <TabsTrigger value="triage" className="gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Classificação de Risco
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid md:grid-cols-2 gap-6">
                  {report?.summary && (
                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-purple-600" />
                          Resumo da IA
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormattedText content={report.summary} className="text-sm leading-relaxed" />
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Sintomas</CardTitle>
                      <CardDescription>Sintomas mais frequentes no período</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(report?.symptoms || []).slice(0, 8).map((s, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{s.symptom}</span>
                              {s.meshCode && <Badge variant="outline" className="text-xs">{s.meshCode}</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div className="bg-primary rounded-full h-2" style={{ width: `${s.percentage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{s.count}</span>
                              {s.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
                              {s.trend === 'down' && <TrendingUp className="h-3.5 w-3.5 text-green-500 rotate-180" />}
                            </div>
                          </div>
                        ))}
                        {(!report?.symptoms || report.symptoms.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível. Execute a análise IA.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Classificação de Risco</CardTitle>
                      <CardDescription>Distribuição por nível de triagem</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(report?.triageLevels || []).map((t, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${triageColorMap[t.level] || 'bg-gray-400'}`} />
                              <span className="text-sm">{triageLabelMap[t.level] || t.level}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div className={`rounded-full h-2 ${triageColorMap[t.level] || 'bg-gray-400'}`} style={{ width: `${t.percentage}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{t.count}</span>
                            </div>
                          </div>
                        ))}
                        {(!report?.triageLevels || report.triageLevels.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado de triagem disponível.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="symptoms">
                <Card>
                  <CardHeader>
                    <CardTitle>Sintomas com Classificação MeSH</CardTitle>
                    <CardDescription>Termos MeSH extraídos automaticamente por IA a partir dos registros clínicos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {(report?.symptoms || []).map((s, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="font-medium text-sm">{s.symptom}</p>
                              {s.meshCode && (
                                <p className="text-xs text-muted-foreground mt-0.5">MeSH: {s.meshCode}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={s.trend === 'up' ? 'destructive' : s.trend === 'down' ? 'default' : 'secondary'}>
                                {s.trend === 'up' ? '↑ Crescente' : s.trend === 'down' ? '↓ Decrescente' : '→ Estável'}
                              </Badge>
                              <span className="font-semibold">{s.count} casos</span>
                              <span className="text-sm text-muted-foreground">({s.percentage}%)</span>
                            </div>
                          </div>
                        ))}
                        {(!report?.symptoms || report.symptoms.length === 0) && (
                          <div className="text-center py-12">
                            <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-muted-foreground">Clique em "Análise IA" para extrair sintomas dos registros clínicos</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnoses">
                <Card>
                  <CardHeader>
                    <CardTitle>Diagnósticos Registrados</CardTitle>
                    <CardDescription>Diagnósticos extraídos dos prontuários e consultas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {(report?.diagnoses || []).map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="font-medium text-sm">{d.diagnosis}</p>
                              {d.icdCode && (
                                <p className="text-xs text-muted-foreground mt-0.5">CID: {d.icdCode}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">{d.count} casos</span>
                              <span className="text-sm text-muted-foreground">({d.percentage}%)</span>
                            </div>
                          </div>
                        ))}
                        {(!report?.diagnoses || report.diagnoses.length === 0) && (
                          <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-muted-foreground">Nenhum diagnóstico registrado no período selecionado.</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="triage">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Nível de Risco</CardTitle>
                      <CardDescription>Protocolo de Manchester</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(report?.triageLevels || []).map((t, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded ${triageColorMap[t.level] || 'bg-gray-400'}`} />
                                <span className="text-sm font-medium">{triageLabelMap[t.level] || t.level}</span>
                              </div>
                              <span className="text-sm">{t.count} ({t.percentage}%)</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-3">
                              <div className={`rounded-full h-3 transition-all ${triageColorMap[t.level] || 'bg-gray-400'}`} style={{ width: `${t.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Faixa Etária</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(report?.ageGroups || []).map((ag, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded border">
                            <span className="text-sm">{ag.group}</span>
                            <Badge variant="outline">{ag.count} pacientes</Badge>
                          </div>
                        ))}
                        {(!report?.ageGroups || report.ageGroups.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">Dados de faixa etária não disponíveis.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
