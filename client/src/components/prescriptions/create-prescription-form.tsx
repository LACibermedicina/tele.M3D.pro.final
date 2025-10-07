import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Trash2, AlertTriangle, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { formatErrorForToast } from '@/lib/error-handler';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// Form validation schema
const prescriptionFormSchema = z.object({
  patientId: z.string().min(1, 'Paciente é obrigatório'),
  diagnosis: z.string().min(1, 'Diagnóstico é obrigatório'),
  notes: z.string().optional(),
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    medicationId: z.string().optional(),
    customMedication: z.string().optional(),
    dosage: z.string().min(1, 'Dosagem é obrigatória'),
    frequency: z.string().min(1, 'Frequência é obrigatória'),
    duration: z.string().min(1, 'Duração é obrigatória'),
    quantity: z.number().min(1, 'Quantidade deve ser maior que 0'),
    instructions: z.string().min(1, 'Instruções são obrigatórias'),
    isGenericAllowed: z.boolean().default(true),
    notes: z.string().optional(),
  })).min(1, 'Pelo menos um medicamento é obrigatório'),
});

type PrescriptionFormData = z.infer<typeof prescriptionFormSchema>;

interface Medication {
  id: string;
  name: string;
  genericName: string;
  activeIngredient: string;
  dosageForm: string;
  strength: string;
  category: string;
}

interface Patient {
  id: string;
  name: string;
  email?: string;
  phone: string;
}

interface CreatePrescriptionFormProps {
  onSuccess: () => void;
}

interface DrugInteractionAnalysis {
  drugName: string;
  activeIngredient: string;
  summary: string;
  interactions: Array<{
    type: string;
    description: string;
    riskLevel: number;
  }>;
  sideEffects: Array<{
    name: string;
    probability: number;
  }>;
  patientRiskFactors: Array<{
    factor: string;
    riskLevel: number;
  }>;
  overallRisk: number;
}

export default function CreatePrescriptionForm({ onSuccess }: CreatePrescriptionFormProps) {
  const { toast } = useToast();
  const [searchMedication, setSearchMedication] = useState('');
  const [searchPatient, setSearchPatient] = useState('');
  const [interactions, setInteractions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInteractionDialog, setShowInteractionDialog] = useState(false);
  const [interactionAnalysis, setInteractionAnalysis] = useState<DrugInteractionAnalysis[]>([]);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      patientId: '',
      diagnosis: '',
      notes: '',
      specialInstructions: '',
      items: [{
        medicationId: '',
        customMedication: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        isGenericAllowed: true,
        notes: '',
      }],
    },
  });

  // Get medications
  const { data: medications = [] } = useQuery<Medication[]>({
    queryKey: ['/api/medications'],
    select: (data) => data || []
  });

  // Get patients
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
    select: (data) => data || []
  });

  const filteredMedications = medications.filter(med =>
    !searchMedication || 
    med.name.toLowerCase().includes(searchMedication.toLowerCase()) ||
    med.genericName.toLowerCase().includes(searchMedication.toLowerCase())
  );

  const filteredPatients = patients.filter(patient =>
    !searchPatient ||
    patient.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
    patient.phone.includes(searchPatient)
  );

  const addMedicationItem = () => {
    const currentItems = form.getValues('items');
    form.setValue('items', [...currentItems, {
      medicationId: '',
      customMedication: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: '',
      isGenericAllowed: true,
      notes: '',
    }]);
  };

  const removeMedicationItem = (index: number) => {
    const currentItems = form.getValues('items');
    if (currentItems.length > 1) {
      form.setValue('items', currentItems.filter((_, i) => i !== index));
    }
  };

  const checkInteractions = async () => {
    const items = form.getValues('items');
    const patientId = form.getValues('patientId');
    const diagnosis = form.getValues('diagnosis');
    
    if (!patientId) {
      toast({
        title: 'Selecione um paciente',
        description: 'É necessário selecionar um paciente para verificar interações.',
        variant: 'destructive',
      });
      return;
    }

    const medicationIds = items
      .filter(item => item.medicationId)
      .map(item => item.medicationId);

    if (medicationIds.length === 0) {
      toast({
        title: 'Adicione medicamentos',
        description: 'É necessário adicionar medicamentos para verificar interações.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingInteractions(true);
    try {
      const response = await apiRequest('POST', '/api/prescriptions/check-interactions', {
        medicationIds,
        patientId,
        diagnosis
      });
      const data = await response.json();
      setInteractionAnalysis(data.analysis || []);
      setShowInteractionDialog(true);
    } catch (error) {
      console.error('Error checking interactions:', error);
      toast({
        title: 'Erro ao verificar interações',
        description: 'Não foi possível verificar interações medicamentosas. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  const onSubmit = async (data: PrescriptionFormData) => {
    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/prescriptions', data);
      
      toast({
        title: 'Prescrição criada com sucesso',
        description: 'A prescrição foi criada e está pronta para uso.',
      });
      
      onSuccess();
    } catch (error: any) {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger data-testid="select-patient">
                        <SelectValue placeholder="Selecione um paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Buscar paciente..."
                            value={searchPatient}
                            onChange={(e) => setSearchPatient(e.target.value)}
                            className="mb-2"
                          />
                        </div>
                        {filteredPatients.map(patient => (
                          <SelectItem key={patient.id} value={patient.id}>
                            <div>
                              <div className="font-medium">{patient.name}</div>
                              <div className="text-sm text-muted-foreground">{patient.phone}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Prescription Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Prescrição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnóstico</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Digite o diagnóstico..."
                      {...field}
                      data-testid="input-diagnosis"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instruções Especiais</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Instruções especiais para o paciente..."
                      {...field}
                      data-testid="textarea-special-instructions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Medications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Medicamentos</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={checkInteractions}
                  size="sm"
                  disabled={isCheckingInteractions}
                  data-testid="button-check-interactions"
                >
                  {isCheckingInteractions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 mr-2" />
                      Verificar Interações
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={addMedicationItem}
                  size="sm"
                  data-testid="button-add-medication"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Medicamento
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drug Interactions Warning */}
            {interactions.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <h4 className="font-medium text-orange-800">Interações Medicamentosas Detectadas</h4>
                </div>
                {interactions.map((interaction, index) => (
                  <div key={index} className="text-sm text-orange-700 mb-2">
                    <Badge variant="outline" className="mr-2 text-orange-600 border-orange-600">
                      {interaction.severity}
                    </Badge>
                    {interaction.effect}
                  </div>
                ))}
              </div>
            )}

            {form.watch('items').map((item, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Medicamento {index + 1}</h4>
                    {form.watch('items').length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMedicationItem(index)}
                        data-testid={`button-remove-medication-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.medicationId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medicamento</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um medicamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-2">
                                  <Input
                                    placeholder="Buscar medicamento..."
                                    value={searchMedication}
                                    onChange={(e) => setSearchMedication(e.target.value)}
                                    className="mb-2"
                                  />
                                </div>
                                {filteredMedications.map(medication => (
                                  <SelectItem key={medication.id} value={medication.id}>
                                    <div>
                                      <div className="font-medium">{medication.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {medication.strength} - {medication.dosageForm}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.customMedication`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Medicamento Personalizado</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ou digite o nome do medicamento..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.dosage`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dosagem</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 500mg, 1 comprimido"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.frequency`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 3x ao dia, a cada 8 horas"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.duration`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: 7 dias, até acabar"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade Total</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.instructions`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instruções de Uso</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ex: Tomar com alimentos, evitar álcool..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-32"
            data-testid="button-create-prescription"
          >
            {isSubmitting ? 'Criando...' : 'Criar Prescrição'}
          </Button>
        </div>
      </form>

      {/* Drug Interaction Analysis Dialog */}
      <Dialog open={showInteractionDialog} onOpenChange={setShowInteractionDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-drug-interactions">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Análise de Interações Medicamentosas
            </DialogTitle>
            <DialogDescription>
              Análise detalhada dos medicamentos, interações e riscos para o paciente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {interactionAnalysis.map((drug, index) => (
              <Card key={index} className="border-2" data-testid={`card-drug-analysis-${index}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-drug-name-${index}`}>{drug.drugName}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Princípio Ativo: <span className="font-medium" data-testid={`text-active-ingredient-${index}`}>{drug.activeIngredient}</span>
                      </p>
                    </div>
                    <Badge 
                      variant={drug.overallRisk > 70 ? "destructive" : drug.overallRisk > 40 ? "default" : "secondary"}
                      className="text-lg px-4 py-2"
                      data-testid={`badge-overall-risk-${index}`}
                    >
                      Risco: {drug.overallRisk}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Resumo do Princípio Ativo
                    </h4>
                    <p className="text-sm text-muted-foreground">{drug.summary}</p>
                  </div>

                  <Separator />

                  {/* Drug Interactions */}
                  {drug.interactions.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Interações Medicamentosas</h4>
                      <div className="space-y-3">
                        {drug.interactions.map((interaction, idx) => (
                          <div key={idx} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-medium text-sm">{interaction.type}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {interaction.riskLevel}%
                                </span>
                                <Progress value={interaction.riskLevel} className="w-20 h-2" />
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{interaction.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Side Effects Chart */}
                  <div>
                    <h4 className="font-semibold mb-3">Efeitos Adversos (Probabilidade)</h4>
                    <div className="space-y-2">
                      {drug.sideEffects.map((effect, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span>{effect.name}</span>
                            <span className="font-medium">{effect.probability}%</span>
                          </div>
                          <Progress 
                            value={effect.probability} 
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Visual Chart */}
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-end justify-around h-32 gap-2">
                        {drug.sideEffects.map((effect, idx) => (
                          <div key={idx} className="flex flex-col items-center flex-1">
                            <div 
                              className="w-full bg-primary rounded-t transition-all"
                              style={{ height: `${effect.probability}%` }}
                            />
                            <span className="text-xs mt-2 text-center truncate w-full">
                              {effect.name.split(' ')[0]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Patient Risk Factors */}
                  {drug.patientRiskFactors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Fatores de Risco do Paciente
                      </h4>
                      <div className="space-y-3">
                        {drug.patientRiskFactors.map((risk, idx) => (
                          <div key={idx} className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{risk.factor}</span>
                              <Badge 
                                variant={risk.riskLevel > 70 ? "destructive" : "default"}
                                className="ml-2"
                              >
                                {risk.riskLevel}% risco
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowInteractionDialog(false)} data-testid="button-close-interaction-analysis">
              Fechar Análise
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}