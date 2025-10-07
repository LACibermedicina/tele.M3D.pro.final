import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  FileText, 
  Upload, 
  TrendingUp,
  Calendar,
  Brain,
  BarChart3,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Header from "@/components/layout/header";

interface TimelineEvent {
  type: string;
  date: string;
  title: string;
  description: string;
}

interface ClinicalDashboard {
  patient: any;
  summary: {
    totalRecords: number;
    totalExams: number;
    totalAssets: number;
    pendingConsultations: number;
  };
  timeline: TimelineEvent[];
}

export default function ClinicalDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetType, setAssetType] = useState("");
  const [patientIdForUpload, setPatientIdForUpload] = useState("");

  // Get patient ID
  const { data: patientData } = useQuery<any>({
    queryKey: ['/api/patients/me'],
    enabled: !!user && user.role === 'patient',
  });

  const patientId = user?.role === 'patient' ? patientData?.id : patientIdForUpload;

  // Fetch clinical dashboard
  const { data: dashboard, isLoading } = useQuery<ClinicalDashboard>({
    queryKey: ['/api/clinical-dashboard', patientId],
    enabled: !!patientId,
  });

  // Fetch clinical assets
  const { data: clinicalAssets = [] } = useQuery<any[]>({
    queryKey: ['/api/clinical-assets', patientId],
    enabled: !!patientId,
  });

  // Upload clinical asset mutation
  const uploadAssetMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/clinical-assets/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clinical-assets', patientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/clinical-dashboard', patientId] });
      toast({ 
        title: "Exame enviado com sucesso!",
        description: data.analysis?.summary || "Análise IA concluída"
      });
      setSelectedFile(null);
      setAssetType("");
    },
    onError: () => {
      toast({ 
        title: "Erro ao enviar exame", 
        variant: "destructive" 
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !assetType || !patientId) {
      toast({ 
        title: "Preencha todos os campos", 
        variant: "destructive" 
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('patientId', patientId);
    formData.append('assetType', assetType);

    uploadAssetMutation.mutate(formData);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'medical_record': return <Activity className="w-4 h-4" />;
      case 'exam_result': return <BarChart3 className="w-4 h-4" />;
      case 'clinical_asset': return <FileText className="w-4 h-4" />;
      case 'consultation_request': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'medical_record': return 'bg-blue-500';
      case 'exam_result': return 'bg-green-500';
      case 'clinical_asset': return 'bg-purple-500';
      case 'consultation_request': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (user?.role !== 'patient' && user?.role !== 'doctor' && user?.role !== 'admin') {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6">
              <p>Acesso não autorizado</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Clínico</h1>
          <p className="text-muted-foreground">
            Visualize exames, sinais vitais e evolução clínica
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !dashboard ? (
          <Card>
            <CardContent className="p-6">
              <p>Nenhum dado clínico disponível</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Registros Médicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-records">
                    {dashboard.summary.totalRecords}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Exames
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-exams">
                    {dashboard.summary.totalExams}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Assets Clínicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-assets">
                    {dashboard.summary.totalAssets}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Consultas Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-consultations">
                    {dashboard.summary.pendingConsultations}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="timeline" className="space-y-4">
              <TabsList>
                <TabsTrigger value="timeline" data-testid="tab-timeline">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="assets" data-testid="tab-assets">
                  <FileText className="w-4 h-4 mr-2" />
                  Exames
                </TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </TabsTrigger>
              </TabsList>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Evolução Clínica
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboard.timeline.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Nenhum evento registrado
                        </p>
                      ) : (
                        dashboard.timeline.map((event, index) => (
                          <div 
                            key={index} 
                            className="flex gap-4"
                            data-testid={`timeline-event-${index}`}
                          >
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full ${getEventColor(event.type)} flex items-center justify-center text-white`}>
                                {getEventIcon(event.type)}
                              </div>
                              {index < dashboard.timeline.length - 1 && (
                                <div className="w-0.5 h-full bg-border mt-2" />
                              )}
                            </div>
                            <div className="flex-1 pb-6">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium">{event.title}</h4>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(event.date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assets Tab */}
              <TabsContent value="assets">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clinicalAssets.length === 0 ? (
                    <Card className="col-span-full">
                      <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">Nenhum exame carregado</p>
                      </CardContent>
                    </Card>
                  ) : (
                    clinicalAssets.map((asset: any) => (
                      <Card key={asset.id} data-testid={`card-asset-${asset.id}`}>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {asset.assetType}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {asset.aiAnalysisSummary && (
                            <div>
                              <Badge variant="secondary" className="mb-2">
                                <Brain className="w-3 h-3 mr-1" />
                                Análise IA
                              </Badge>
                              <p className="text-sm text-muted-foreground">
                                {asset.aiAnalysisSummary}
                              </p>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(asset.timeline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Upload Tab */}
              <TabsContent value="upload">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Upload de Exame
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="asset-type">Tipo de Exame</Label>
                      <Input
                        id="asset-type"
                        data-testid="input-asset-type"
                        placeholder="Ex: Hemograma, Glicemia, Raio-X..."
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="file-upload">Arquivo (PDF ou Imagem)</Label>
                      <Input
                        id="file-upload"
                        data-testid="input-file-upload"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                    </div>

                    {selectedFile && (
                      <div className="text-sm text-muted-foreground">
                        Arquivo selecionado: {selectedFile.name}
                      </div>
                    )}

                    <Button
                      data-testid="button-upload-exam"
                      onClick={handleUpload}
                      disabled={uploadAssetMutation.isPending || !selectedFile || !assetType}
                      className="w-full"
                    >
                      {uploadAssetMutation.isPending ? (
                        <>Analisando com IA...</>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Enviar e Analisar com IA
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </>
  );
}
