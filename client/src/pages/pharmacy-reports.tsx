import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatErrorForToast } from "@/lib/error-handler";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  BarChart3, Calendar, Clock, FileText, Filter, Loader2, Pill,
  Printer, Shield, User, Building2, Activity, TrendingUp, Download,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

interface PharmacyReport {
  id: string;
  pharmacistId: string;
  reportType: string;
  startDate: string;
  endDate: string;
  totalDispensed: number;
  totalPrescriptions: number;
  medicationBreakdown: Record<string, number> | null;
  doctorBreakdown: Record<string, number> | null;
  pathologyBreakdown: Record<string, number> | null;
  scheduleBreakdown: Record<string, number> | null;
  lgpdCompliant: boolean;
  generatedAt: string;
  createdAt: string;
}

export default function PharmacyReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reportType, setReportType] = useState("daily");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [lgpdCompliant, setLgpdCompliant] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PharmacyReport | null>(null);
  const [filterMedication, setFilterMedication] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterPathology, setFilterPathology] = useState("");

  const { data: reports = [], isLoading } = useQuery<PharmacyReport[]>({
    queryKey: ["/api/pharmacy/reports"],
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { reportType: string; startDate: string; endDate: string; lgpdCompliant: boolean }) => {
      const res = await apiRequest("POST", "/api/pharmacy/reports/generate", params);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Relatório Gerado", description: "Relatório gerado com sucesso!" });
      setSelectedReport(data);
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacy/reports"] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ reportType, startDate, endDate, lgpdCompliant });
  };

  const handlePrint = () => {
    window.print();
  };

  const filterEntries = (data: Record<string, number> | null, filter: string): [string, number][] => {
    if (!data) return [];
    const entries = Object.entries(data);
    if (!filter) return entries.sort((a, b) => b[1] - a[1]);
    return entries
      .filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "daily": return "Diário";
      case "weekly": return "Semanal";
      case "monthly": return "Mensal";
      case "custom": return "Personalizado";
      default: return type;
    }
  };

  const getReportTypeBadgeColor = (type: string) => {
    switch (type) {
      case "daily": return "bg-blue-100 text-blue-700";
      case "weekly": return "bg-green-100 text-green-700";
      case "monthly": return "bg-purple-100 text-purple-700";
      case "custom": return "bg-orange-100 text-orange-700";
      default: return "";
    }
  };

  const reportToView = selectedReport;

  const maxBarValue = (data: Record<string, number> | null) => {
    if (!data) return 1;
    const vals = Object.values(data);
    return Math.max(...vals, 1);
  };

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Link href="/pharmacy">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            </Link>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Relatórios da Farmácia</h1>
              <p className="text-sm text-muted-foreground">
                Geração e visualização de relatórios LGPD-compliant
              </p>
            </div>
          </div>
          {reportToView && (
            <Button variant="outline" onClick={handlePrint} className="print:hidden">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          )}
        </div>

        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="print:hidden">
            <TabsTrigger value="generate">Gerar Relatório</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            {reportToView && <TabsTrigger value="view">Visualizar Relatório</TabsTrigger>}
          </TabsList>

          <TabsContent value="generate" className="space-y-4 print:hidden">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="w-5 h-5" />
                  <span>Parâmetros do Relatório</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Relatório</Label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    >
                      <option value="daily">Dispensação Diária</option>
                      <option value="weekly">Uso de Medicamentos (Semanal)</option>
                      <option value="monthly">Associações Médico-Medicamento (Mensal)</option>
                      <option value="custom">Padrões Patologia-Medicamento</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>LGPD Compliant</span>
                    </Label>
                    <div className="flex items-center space-x-2 pt-1">
                      <Switch
                        checked={lgpdCompliant}
                        onCheckedChange={setLgpdCompliant}
                      />
                      <span className="text-sm text-muted-foreground">
                        {lgpdCompliant ? "Dados anonimizados" : "Dados completos"}
                      </span>
                    </div>
                  </div>
                </div>

                {lgpdCompliant && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 flex items-start space-x-2">
                    <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-800 dark:text-green-400">
                      <p className="font-semibold">Proteção LGPD Ativa</p>
                      <p>Nomes de pacientes serão substituídos por IDs anonimizados. Dados de médicos serão parcialmente anonimizados.</p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 mr-2" />
                  )}
                  Gerar Relatório
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 print:hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhum relatório gerado ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((report: PharmacyReport) => (
                  <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport(report)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge className={getReportTypeBadgeColor(report.reportType)}>
                            {getReportTypeLabel(report.reportType)}
                          </Badge>
                          <div className="text-sm">
                            <p className="font-semibold">
                              {new Date(report.startDate).toLocaleDateString("pt-BR")} — {new Date(report.endDate).toLocaleDateString("pt-BR")}
                            </p>
                            <p className="text-muted-foreground">
                              {report.totalDispensed} dispensados • {report.totalPrescriptions} prescrições
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {report.lgpdCompliant && (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <Shield className="w-3 h-3 mr-1" /> LGPD
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.generatedAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {reportToView && (
            <TabsContent value="view" className="space-y-4">
              <div className="print:block">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Pill className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportToView.totalDispensed}</p>
                        <p className="text-xs text-muted-foreground">Total Dispensado</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportToView.totalPrescriptions}</p>
                        <p className="text-xs text-muted-foreground">Prescrições</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Object.keys(reportToView.medicationBreakdown || {}).length}</p>
                        <p className="text-xs text-muted-foreground">Medicamentos</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{Object.keys(reportToView.doctorBreakdown || {}).length}</p>
                        <p className="text-xs text-muted-foreground">Médicos</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center space-x-2 mb-4 print:hidden">
                  <Badge className={getReportTypeBadgeColor(reportToView.reportType)}>
                    {getReportTypeLabel(reportToView.reportType)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Período: {new Date(reportToView.startDate).toLocaleDateString("pt-BR")} — {new Date(reportToView.endDate).toLocaleDateString("pt-BR")}
                  </span>
                  {reportToView.lgpdCompliant && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <Shield className="w-3 h-3 mr-1" /> LGPD
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 print:hidden">
                  <div className="relative">
                    <Pill className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar medicamento..."
                      value={filterMedication}
                      onChange={(e) => setFilterMedication(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar médico..."
                      value={filterDoctor}
                      onChange={(e) => setFilterDoctor(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar patologia..."
                      value={filterPathology}
                      onChange={(e) => setFilterPathology(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Pill className="w-4 h-4 text-blue-600" />
                        <span>Uso de Medicamentos</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {filterEntries(reportToView.medicationBreakdown, filterMedication).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {filterEntries(reportToView.medicationBreakdown, filterMedication).map(([name, count]) => (
                            <div key={name} className="flex items-center space-x-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                <div className="w-full bg-muted rounded-full h-2 mt-1">
                                  <div
                                    className="bg-blue-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(count / maxBarValue(reportToView.medicationBreakdown)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm font-bold text-blue-600 min-w-[40px] text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-orange-600" />
                        <span>Prescrições por Médico</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {filterEntries(reportToView.doctorBreakdown, filterDoctor).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {filterEntries(reportToView.doctorBreakdown, filterDoctor).map(([name, count]) => (
                            <div key={name} className="flex items-center space-x-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                <div className="w-full bg-muted rounded-full h-2 mt-1">
                                  <div
                                    className="bg-orange-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(count / maxBarValue(reportToView.doctorBreakdown)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm font-bold text-orange-600 min-w-[40px] text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-purple-600" />
                        <span>Padrões por Patologia</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {filterEntries(reportToView.pathologyBreakdown, filterPathology).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {filterEntries(reportToView.pathologyBreakdown, filterPathology).map(([name, count]) => (
                            <div key={name} className="flex items-center space-x-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{name}</p>
                                <div className="w-full bg-muted rounded-full h-2 mt-1">
                                  <div
                                    className="bg-purple-500 h-2 rounded-full transition-all"
                                    style={{ width: `${(count / maxBarValue(reportToView.pathologyBreakdown)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm font-bold text-purple-600 min-w-[40px] text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        <span>Horários de Dispensação</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!reportToView.scheduleBreakdown || Object.keys(reportToView.scheduleBreakdown).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(reportToView.scheduleBreakdown)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([timeSlot, count]) => (
                              <div key={timeSlot} className="flex items-center space-x-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{timeSlot}</p>
                                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                                    <div
                                      className="bg-green-500 h-2 rounded-full transition-all"
                                      style={{ width: `${((count as number) / maxBarValue(reportToView.scheduleBreakdown)) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-green-600 min-w-[40px] text-right">{count as number}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}