import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatErrorForToast } from "@/lib/error-handler";
import PageWrapper from "@/components/layout/page-wrapper";
import { Link } from "wouter";
import {
  Pill, Search, QrCode, CheckCircle, XCircle, Clock, Shield, AlertTriangle,
  FileText, Eye, ChevronDown, ChevronUp, Loader2, Package, Building2,
  Calendar, User, ClipboardCheck, ShieldAlert, Info, BarChart3
} from "lucide-react";

interface PrescriptionItem {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

interface PharmacyPrescription {
  id: string;
  prescriptionNumber?: string;
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  items: PrescriptionItem[];
  digitalSignatureId?: string;
  pharmacistReadAt?: string;
}

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPrescription, setSelectedPrescription] = useState<PharmacyPrescription | null>(null);
  const [expandedDrugInfo, setExpandedDrugInfo] = useState<string | null>(null);
  const [showCrmVerification, setShowCrmVerification] = useState(false);
  const [dispensingForm, setDispensingForm] = useState({
    batchNumber: "",
    manufacturer: "",
    expiryDate: "",
    dispensedQuantity: "",
    dispensingNotes: "",
  });

  const { data: prescriptions = [], isLoading } = useQuery<PharmacyPrescription[]>({
    queryKey: ['/api/pharmacy/prescriptions'],
  });

  const verifyMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      const res = await apiRequest('POST', `/api/pharmacy/prescriptions/${prescriptionId}/verify`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verificação Concluída",
        description: data.signatureValid ? "Prescrição verificada com sucesso!" : "Falha na verificação da assinatura.",
        variant: data.signatureValid ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pharmacy/prescriptions'] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const verifyCrmMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      const res = await apiRequest('POST', `/api/pharmacy/prescriptions/${prescriptionId}/verify-crm`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Verificação CRM",
        description: data.valid ? "CRM do médico verificado com sucesso!" : "CRM não pôde ser verificado.",
        variant: data.valid ? "default" : "destructive",
      });
      setShowCrmVerification(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pharmacy/prescriptions'] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: async ({ prescriptionId, data }: { prescriptionId: string; data: any }) => {
      const res = await apiRequest('POST', `/api/pharmacy/prescriptions/${prescriptionId}/dispense`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Medicamento Dispensado",
        description: "Dispensação registrada com sucesso!",
      });
      setDispensingForm({ batchNumber: "", manufacturer: "", expiryDate: "", dispensedQuantity: "", dispensingNotes: "" });
      setSelectedPrescription(null);
      queryClient.invalidateQueries({ queryKey: ['/api/pharmacy/prescriptions'] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const confirmReadMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      const res = await apiRequest('POST', `/api/pharmacy/prescriptions/${prescriptionId}/confirm-read`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Leitura Confirmada", description: "Confirmação de leitura registrada." });
      queryClient.invalidateQueries({ queryKey: ['/api/pharmacy/prescriptions'] });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const filteredPrescriptions = prescriptions.filter((p: PharmacyPrescription) => {
    const matchesSearch = !searchQuery ||
      p.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.doctorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'dispensed': return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Dispensado</Badge>;
      case 'partial': return <Badge className="bg-yellow-100 text-yellow-700"><Package className="w-3 h-3 mr-1" />Parcial</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      case 'expired': return <Badge className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" />Expirado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDispense = (prescriptionId: string) => {
    const prescription = prescriptions.find(p => p.id === prescriptionId);
    const itemsPayload = (prescription?.items || []).map(item => ({
      prescriptionItemId: item.id,
      medicationName: item.medicationName,
      dispensedQuantity: parseInt(dispensingForm.dispensedQuantity) || item.quantity || 1,
      batchNumber: dispensingForm.batchNumber || null,
      manufacturer: dispensingForm.manufacturer || null,
      expiryDate: dispensingForm.expiryDate || null,
      notes: dispensingForm.dispensingNotes || null,
    }));
    dispenseMutation.mutate({
      prescriptionId,
      data: {
        items: itemsPayload,
        verificationMethod: 'manual',
        signatureVerified: false,
      },
    });
  };

  return (
    <PageWrapper>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Pill className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Painel da Farmácia</h1>
              <p className="text-sm text-muted-foreground">
                {user?.specialization && <span className="mr-2">{user.specialization}</span>}
                {user?.medicalLicense && <span>CRF: {user.medicalLicense}</span>}
              </p>
            </div>
          </div>
          <Link href="/pharmacy/reports">
            <Button variant="outline">
              <BarChart3 className="w-4 h-4 mr-2" /> Relatórios
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.filter((p: PharmacyPrescription) => p.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.filter((p: PharmacyPrescription) => p.status === 'dispensed').length}</p>
                <p className="text-xs text-muted-foreground">Dispensados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.filter((p: PharmacyPrescription) => p.pharmacistReadAt).length}</p>
                <p className="text-xs text-muted-foreground">Verificados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Pill className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente, médico ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4" onValueChange={(v) => setStatusFilter(v)}>
          <TabsList>
            <TabsTrigger value="active">Pendentes</TabsTrigger>
            <TabsTrigger value="dispensed">Dispensadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>

          {["active", "dispensed", "all"].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPrescriptions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhuma prescrição encontrada</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredPrescriptions.map((prescription: PharmacyPrescription) => (
                    <Card key={prescription.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              {prescription.prescriptionNumber && (
                                <span className="text-xs font-mono text-muted-foreground">#{prescription.prescriptionNumber}</span>
                              )}
                              {getStatusBadge(prescription.status)}
                              {prescription.pharmacistReadAt && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                                  <Eye className="w-3 h-3 mr-1" /> Lido
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span><strong>Paciente:</strong> {prescription.patientName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span><strong>Médico:</strong> {prescription.doctorName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span><strong>Data:</strong> {prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 mt-1 text-sm">
                              <Shield className="w-4 h-4 text-muted-foreground" />
                              <span><strong>CRM:</strong> {prescription.doctorCrm || 'N/A'}</span>
                            </div>
                            {prescription.items && prescription.items.length > 0 && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                <strong>{prescription.items.length}</strong> medicamento(s):
                                {prescription.items.slice(0, 3).map((item: PrescriptionItem, i: number) => (
                                  <span key={i}> {item.medicationName}{i < Math.min(prescription.items.length, 3) - 1 ? ',' : ''}</span>
                                ))}
                                {prescription.items.length > 3 && <span> e mais {prescription.items.length - 3}...</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col space-y-1 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPrescription(prescription)}
                              data-testid={`btn-view-${prescription.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" /> Ver
                            </Button>
                            {!prescription.pharmacistReadAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => confirmReadMutation.mutate(prescription.id)}
                                disabled={confirmReadMutation.isPending}
                              >
                                <ClipboardCheck className="w-4 h-4 mr-1" /> Confirmar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {selectedPrescription && (
          <Dialog open={!!selectedPrescription} onOpenChange={() => setSelectedPrescription(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Detalhes da Prescrição</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="font-semibold">{selectedPrescription.patientName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Médico</p>
                    <p className="font-semibold">{selectedPrescription.doctorName || 'N/A'}</p>
                    {selectedPrescription.doctorCrm && (
                      <p className="text-xs text-muted-foreground">CRM: {selectedPrescription.doctorCrm}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    {getStatusBadge(selectedPrescription.status)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="text-sm">{selectedPrescription.createdAt ? new Date(selectedPrescription.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => verifyMutation.mutate(selectedPrescription.id)}
                    disabled={verifyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {verifyMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <QrCode className="w-4 h-4 mr-1" />}
                    Verificar Assinatura
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCrmVerification(!showCrmVerification)}
                    className="text-orange-600 border-orange-300"
                  >
                    <ShieldAlert className="w-4 h-4 mr-1" />
                    Verificar CRM
                  </Button>
                  {!selectedPrescription.pharmacistReadAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmReadMutation.mutate(selectedPrescription.id)}
                      disabled={confirmReadMutation.isPending}
                      className="text-emerald-600 border-emerald-300"
                    >
                      <ClipboardCheck className="w-4 h-4 mr-1" /> Confirmar Leitura
                    </Button>
                  )}
                </div>

                {showCrmVerification && (
                  <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/10">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <ShieldAlert className="w-5 h-5 text-orange-600" />
                        <p className="font-semibold text-orange-800 dark:text-orange-400">Verificação de CRM</p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use esta ferramenta apenas se suspeitar de fraude na prescrição.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => verifyCrmMutation.mutate(selectedPrescription.id)}
                        disabled={verifyCrmMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {verifyCrmMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
                        Verificar CRM do Médico
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedPrescription.items && selectedPrescription.items.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center">
                      <Pill className="w-5 h-5 mr-2" /> Medicamentos
                    </h3>
                    <div className="space-y-3">
                      {selectedPrescription.items.map((item: PrescriptionItem) => (
                        <Card key={item.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-lg">{item.medicationName}</p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                  <p><strong>Dosagem:</strong> {item.dosage || 'N/A'}</p>
                                  <p><strong>Frequência:</strong> {item.frequency || 'N/A'}</p>
                                  <p><strong>Duração:</strong> {item.duration || 'N/A'}</p>
                                  <p><strong>Quantidade:</strong> {item.quantity || 'N/A'}</p>
                                </div>
                                {item.instructions && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    <strong>Instruções:</strong> {item.instructions}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedDrugInfo(expandedDrugInfo === item.id ? null : item.id)}
                              >
                                <Info className="w-4 h-4 mr-1" />
                                {expandedDrugInfo === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </div>
                            {expandedDrugInfo === item.id && (
                              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200">
                                <div className="flex items-center space-x-2 mb-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                                  <p className="font-semibold text-amber-800 dark:text-amber-400">Informações do Medicamento</p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Consulte a bula do medicamento para informações completas sobre efeitos colaterais,
                                  contraindicações, interações medicamentosas e reações adversas.
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPrescription.status === 'active' && (
                  <Card className="border-emerald-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Package className="w-5 h-5 mr-2 text-emerald-600" />
                        Formulário de Dispensação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Número do Lote</Label>
                          <Input
                            value={dispensingForm.batchNumber}
                            onChange={(e) => setDispensingForm(f => ({ ...f, batchNumber: e.target.value }))}
                            placeholder="Ex: LOT-2024-001"
                          />
                        </div>
                        <div>
                          <Label>Fabricante</Label>
                          <Input
                            value={dispensingForm.manufacturer}
                            onChange={(e) => setDispensingForm(f => ({ ...f, manufacturer: e.target.value }))}
                            placeholder="Nome do fabricante"
                          />
                        </div>
                        <div>
                          <Label>Data de Validade</Label>
                          <Input
                            type="date"
                            value={dispensingForm.expiryDate}
                            onChange={(e) => setDispensingForm(f => ({ ...f, expiryDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label>Quantidade Dispensada</Label>
                          <Input
                            type="number"
                            value={dispensingForm.dispensedQuantity}
                            onChange={(e) => setDispensingForm(f => ({ ...f, dispensedQuantity: e.target.value }))}
                            placeholder="1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Observações da Dispensação</Label>
                        <Textarea
                          value={dispensingForm.dispensingNotes}
                          onChange={(e) => setDispensingForm(f => ({ ...f, dispensingNotes: e.target.value }))}
                          placeholder="Observações adicionais..."
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={() => handleDispense(selectedPrescription.id)}
                        disabled={dispenseMutation.isPending}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {dispenseMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Registrar Dispensação
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PageWrapper>
  );
}
