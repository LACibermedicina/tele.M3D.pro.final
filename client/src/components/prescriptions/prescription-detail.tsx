import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, User, Pill, AlertTriangle, Download, Share2, FileSignature, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import QRCodeGenerator from '@/components/ui/qr-code-generator';

interface PrescriptionDetailProps {
  prescriptionId: string;
  onClose: () => void;
}

interface PrescriptionItem {
  id: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  customMedication?: string;
  isGenericAllowed: boolean;
  priority: number;
  notes?: string;
  medication?: {
    id: string;
    name: string;
    genericName: string;
    activeIngredient: string;
    dosageForm: string;
    strength: string;
  };
}

interface PrescriptionDetail {
  id: string;
  prescriptionNumber: string;
  diagnosis: string;
  notes?: string;
  status: string;
  isElectronic: boolean;
  isUrgent: boolean;
  allowGeneric: boolean;
  specialInstructions?: string;
  expiresAt: string;
  dispensedAt?: string;
  tmcCostPaid: number;
  createdAt: string;
  updatedAt: string;
  patientId: string;
  doctorId: string;
  digitalSignatureId?: string;
  items: PrescriptionItem[];
}

export default function PrescriptionDetail({ prescriptionId, onClose }: PrescriptionDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [signForm, setSignForm] = useState({
    pin: '',
    doctorName: '',
    crm: '',
    crmState: 'SP',
  });

  const { data: prescription, isLoading, error } = useQuery<PrescriptionDetail>({
    queryKey: ['/api/prescriptions', prescriptionId],
    enabled: !!prescriptionId,
  });

  // Sign prescription mutation
  const signPrescriptionMutation = useMutation({
    mutationFn: async (data: typeof signForm) => {
      const res = await apiRequest('POST', `/api/prescriptions/${prescriptionId}/sign`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prescrição Assinada!",
        description: "A prescrição foi assinada digitalmente com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/prescriptions', prescriptionId] });
      setShowSignDialog(false);
      setSignForm({ pin: '', doctorName: '', crm: '', crmState: 'SP' });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao Assinar",
        description: error.message || "Não foi possível assinar a prescrição.",
        variant: "destructive",
      });
    },
  });

  const handleSignPrescription = () => {
    if (!signForm.pin || signForm.pin.length < 6) {
      toast({
        title: "PIN Inválido",
        description: "O PIN deve ter no mínimo 6 dígitos.",
        variant: "destructive",
      });
      return;
    }
    signPrescriptionMutation.mutate(signForm);
  };

  // Download PDF mutation
  const handleDownloadPDF = async () => {
    try {
      toast({
        title: "Gerando PDF",
        description: "Aguarde enquanto o PDF é gerado...",
      });
      
      const response = await fetch(`/api/prescriptions/${prescriptionId}/pdf`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const htmlContent = await response.text();
      
      // Open HTML in new window for printing/saving as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load then trigger print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
        
        toast({
          title: "PDF Pronto",
          description: "Use a opção 'Salvar como PDF' na janela de impressão.",
        });
      } else {
        throw new Error('Popup bloqueado. Permita popups para baixar o PDF.');
      }
    } catch (error) {
      toast({
        title: "Erro ao Gerar PDF",
        description: error instanceof Error ? error.message : "Não foi possível gerar o PDF da prescrição.",
        variant: "destructive",
      });
    }
  };

  // Cancel prescription mutation
  const cancelPrescriptionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/prescriptions/${prescriptionId}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prescrição Cancelada",
        description: "A prescrição foi cancelada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/prescriptions', prescriptionId] });
      setShowCancelDialog(false);
    },
    onError: () => {
      toast({
        title: "Erro ao Cancelar",
        description: "Não foi possível cancelar a prescrição.",
        variant: "destructive",
      });
    },
  });

  const handleCancelPrescription = () => {
    cancelPrescriptionMutation.mutate();
  };

  const handleViewHistory = () => {
    toast({
      title: "Histórico da Prescrição",
      description: "Visualização de histórico será implementada em breve.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dispensed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativa';
      case 'dispensed':
        return 'Dispensada';
      case 'cancelled':
        return 'Cancelada';
      case 'expired':
        return 'Expirada';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Erro ao carregar prescrição
        </h3>
        <p className="text-muted-foreground mb-4">
          Não foi possível carregar os detalhes da prescrição.
        </p>
        <Button onClick={onClose} variant="outline">
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {prescription.prescriptionNumber}
            </h2>
            <p className="text-sm text-muted-foreground">
              Prescrição Médica Eletrônica
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={`${getStatusColor(prescription.status)} border`}>
            {getStatusLabel(prescription.status)}
          </Badge>
          {prescription.isUrgent && (
            <Badge variant="destructive">
              Urgente
            </Badge>
          )}
          {prescription.isElectronic && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              Digital
            </Badge>
          )}
          {prescription.digitalSignatureId && (
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Assinada
            </Badge>
          )}
        </div>
      </div>
      
      {/* Sign button for doctors */}
      {user?.role === 'doctor' && user.id === prescription.doctorId && !prescription.digitalSignatureId && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileSignature className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Assinatura Digital</p>
                  <p className="text-sm text-muted-foreground">
                    Esta prescrição ainda não foi assinada digitalmente
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowSignDialog(true)}
                data-testid="button-sign-prescription"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                Assinar Prescrição
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informações da Prescrição</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Diagnóstico</p>
              <p className="font-medium">{prescription.diagnosis}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Número da Prescrição</p>
              <p className="font-medium font-mono">{prescription.prescriptionNumber}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Data de Criação</p>
              <p className="font-medium">
                {format(new Date(prescription.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Data de Expiração</p>
              <p className="font-medium">
                {format(new Date(prescription.expiresAt), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
            
            {prescription.dispensedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Data de Dispensação</p>
                <p className="font-medium">
                  {format(new Date(prescription.dispensedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-sm text-muted-foreground">Genérico Permitido</p>
              <p className="font-medium">{prescription.allowGeneric ? 'Sim' : 'Não'}</p>
            </div>
          </div>
          
          {prescription.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Observações</p>
              <p className="text-sm bg-muted p-3 rounded-lg">{prescription.notes}</p>
            </div>
          )}
          
          {prescription.specialInstructions && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Instruções Especiais</p>
              <p className="text-sm bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800">
                {prescription.specialInstructions}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Pill className="h-5 w-5" />
            <span>Medicamentos Prescritos ({prescription.items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prescription.items
            .sort((a, b) => a.priority - b.priority)
            .map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      #{item.priority}
                    </Badge>
                    <h4 className="font-medium">
                      {item.medication?.name || item.customMedication}
                    </h4>
                  </div>
                  
                  {item.isGenericAllowed && (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                      Genérico OK
                    </Badge>
                  )}
                </div>
                
                {item.medication && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome Genérico: </span>
                      <span className="font-medium">{item.medication.genericName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Forma: </span>
                      <span className="font-medium">{item.medication.dosageForm}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Concentração: </span>
                      <span className="font-medium">{item.medication.strength}</span>
                    </div>
                  </div>
                )}
                
                <Separator className="my-3" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Dosagem</span>
                    <span className="font-medium">{item.dosage}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Frequência</span>
                    <span className="font-medium">{item.frequency}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Duração</span>
                    <span className="font-medium">{item.duration}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Quantidade</span>
                    <span className="font-medium">{item.quantity} unidades</span>
                  </div>
                </div>
                
                <div className="mt-3">
                  <span className="text-muted-foreground text-sm block mb-1">Instruções de Uso</span>
                  <p className="text-sm bg-blue-50 border border-blue-200 p-2 rounded text-blue-800">
                    {item.instructions}
                  </p>
                </div>
                
                {item.notes && (
                  <div className="mt-2">
                    <span className="text-muted-foreground text-sm block mb-1">Observações</span>
                    <p className="text-sm text-muted-foreground italic">
                      {item.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
            
            <QRCodeGenerator
              url={`${window.location.origin}/prescriptions/${prescriptionId}`}
              title="QR Code da Prescrição"
              description="Compartilhe este QR code para acesso rápido à prescrição"
            />
            
            <Button 
              variant="outline" 
              onClick={() => setShowShareDialog(true)}
              data-testid="button-share-pharmacy"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar com Farmácia
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleViewHistory}
              data-testid="button-view-history"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Ver Histórico
            </Button>
            
            {prescription.status === 'active' && user?.role === 'doctor' && user.id === prescription.doctorId && (
              <Button 
                variant="outline" 
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
                onClick={() => setShowCancelDialog(true)}
                data-testid="button-cancel-prescription"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Cancelar Prescrição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TMC Cost Information */}
      {prescription.tmcCostPaid > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-amber-800">
              <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
              <span className="text-sm font-medium">
                Custo TMC: {prescription.tmcCostPaid} créditos
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Sign Prescription Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Assinar Prescrição Digitalmente
            </DialogTitle>
            <DialogDescription>
              Utilize seu certificado digital ICP-Brasil A3 para assinar esta prescrição médica.
              A assinatura garante autenticidade e integridade do documento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN do Token A3 *</Label>
              <Input
                id="pin"
                type="password"
                placeholder="Digite o PIN do seu token"
                value={signForm.pin}
                onChange={(e) => setSignForm({ ...signForm, pin: e.target.value })}
                maxLength={8}
                data-testid="input-pin"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 6 dígitos
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="doctorName">Nome Completo do Médico</Label>
              <Input
                id="doctorName"
                placeholder="Ex: Dr. João Silva"
                value={signForm.doctorName}
                onChange={(e) => setSignForm({ ...signForm, doctorName: e.target.value })}
                data-testid="input-doctor-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="crm">CRM</Label>
                <Input
                  id="crm"
                  placeholder="Ex: 123456"
                  value={signForm.crm}
                  onChange={(e) => setSignForm({ ...signForm, crm: e.target.value })}
                  data-testid="input-crm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="crmState">UF</Label>
                <Input
                  id="crmState"
                  placeholder="Ex: SP"
                  value={signForm.crmState}
                  onChange={(e) => setSignForm({ ...signForm, crmState: e.target.value.toUpperCase() })}
                  maxLength={2}
                  data-testid="input-crm-state"
                />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Certificado Digital ICP-Brasil A3</p>
                  <p className="text-xs">
                    Esta assinatura utiliza padrão ICP-Brasil A3 com algoritmo RSA-PSS e SHA-256,
                    garantindo conformidade com a legislação brasileira para documentos médicos eletrônicos.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSignDialog(false)}
              disabled={signPrescriptionMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSignPrescription}
              disabled={signPrescriptionMutation.isPending || !signForm.pin}
              data-testid="button-confirm-sign"
            >
              {signPrescriptionMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Assinando...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Assinar Prescrição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share with Pharmacy Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Compartilhar com Farmácia
            </DialogTitle>
            <DialogDescription>
              Compartilhe esta prescrição com uma farmácia parceira para facilitar a dispensação dos medicamentos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">Funcionalidade em Desenvolvimento</p>
              <p className="text-xs">
                Em breve você poderá compartilhar prescrições diretamente com farmácias parceiras
                através da plataforma, facilitando a dispensação de medicamentos.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShareDialog(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cancel Prescription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Cancelar Prescrição
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta prescrição? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Atenção</p>
                  <ul className="text-xs space-y-1">
                    <li>• A prescrição será marcada como cancelada</li>
                    <li>• O paciente será notificado sobre o cancelamento</li>
                    <li>• Esta ação é permanente e não pode ser revertida</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelPrescriptionMutation.isPending}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPrescription}
              disabled={cancelPrescriptionMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelPrescriptionMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Cancelando...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}