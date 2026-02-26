import { useState, useEffect, useCallback } from 'react';
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
import { Search, Plus, Trash2, AlertTriangle, Activity, TrendingUp, Loader2, Database, Globe, Sparkles, ShieldAlert, Info, CheckCircle2 } from 'lucide-react';
import { formatErrorForToast } from '@/lib/error-handler';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExternalMedication {
  externalId: string;
  source: string;
  name: string;
  genericName: string;
  activeIngredient: string;
  dosageForm: string;
  strength: string;
  route: string;
  category: string;
  manufacturer: string;
  registrationNumber: string;
  requiresPrescription: boolean;
}

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

interface AISuggestion {
  dosage: string;
  frequency: string;
  duration: string;
  observations: string;
  specialInstructions: string;
  warnings: {
    sideEffects: string[];
    contraindications: string[];
    adverseEffects: string[];
    drugInteractions: string[];
    riskLevel: string;
  };
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
  const [externalSearchTerm, setExternalSearchTerm] = useState('');
  const [externalResults, setExternalResults] = useState<ExternalMedication[]>([]);
  const [externalSources, setExternalSources] = useState<string[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [searchLocale, setSearchLocale] = useState('BR');
  const [showAISuggestionDialog, setShowAISuggestionDialog] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiSuggestionIndex, setAiSuggestionIndex] = useState<number>(0);
  const [isLoadingAISuggestion, setIsLoadingAISuggestion] = useState(false);

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

  const searchExternalDebounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (term: string) => {
        clearTimeout(timer);
        if (term.trim().length < 2) {
          setExternalResults([]);
          setExternalSources([]);
          return;
        }
        timer = setTimeout(async () => {
          setIsSearchingExternal(true);
          try {
            const res = await fetch(`/api/medications/search-external?term=${encodeURIComponent(term)}&locale=${searchLocale}&limit=15`);
            if (res.ok) {
              const data = await res.json();
              setExternalResults(data.results || []);
              setExternalSources(data.sources || []);
            }
          } catch (err) {
            console.error('External search error:', err);
          } finally {
            setIsSearchingExternal(false);
          }
        }, 400);
      };
    })(),
    [searchLocale]
  );

  useEffect(() => {
    searchExternalDebounced(externalSearchTerm);
  }, [externalSearchTerm, searchExternalDebounced]);

  const selectExternalMedication = (med: ExternalMedication, index: number) => {
    form.setValue(`items.${index}.customMedication`, `${med.name} (${med.genericName}) - ${med.strength} ${med.dosageForm}`);
    form.setValue(`items.${index}.dosage`, med.strength || '');
    form.setValue(`items.${index}.medicationId`, '');
    setExternalSearchTerm('');
    setExternalResults([]);
    toast({
      title: "Medicamento selecionado",
      description: `${med.name} da base ${med.source}`,
    });
  };

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

  const fetchAISuggestion = async (index: number) => {
    const patientId = form.getValues('patientId');
    const items = form.getValues('items');
    const item = items[index];

    if (!patientId) {
      toast({
        title: 'Selecione um paciente',
        description: 'É necessário selecionar um paciente para obter sugestões da IA.',
        variant: 'destructive',
      });
      return;
    }

    const medicationName = item.customMedication || 
      medications.find(m => m.id === item.medicationId)?.name || '';

    if (!medicationName && !item.medicationId) {
      toast({
        title: 'Selecione um medicamento',
        description: 'É necessário selecionar ou buscar um medicamento primeiro.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingAISuggestion(true);
    setAiSuggestionIndex(index);
    try {
      const response = await apiRequest('POST', '/api/prescriptions/ai-suggest', {
        patientId,
        medicationName,
        medicationId: item.medicationId || undefined,
      });
      const data = await response.json();
      setAiSuggestion(data);
      setShowAISuggestionDialog(true);
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      toast({
        title: 'Erro ao obter sugestão da IA',
        description: 'Não foi possível obter sugestões. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAISuggestion(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    const idx = aiSuggestionIndex;
    if (aiSuggestion.dosage) form.setValue(`items.${idx}.dosage`, aiSuggestion.dosage);
    if (aiSuggestion.frequency) form.setValue(`items.${idx}.frequency`, aiSuggestion.frequency);
    if (aiSuggestion.duration) form.setValue(`items.${idx}.duration`, aiSuggestion.duration);
    if (aiSuggestion.specialInstructions) form.setValue(`items.${idx}.instructions`, aiSuggestion.specialInstructions);
    if (aiSuggestion.observations) {
      const currentNotes = form.getValues(`items.${idx}.notes`) || '';
      form.setValue(`items.${idx}.notes`, currentNotes ? `${currentNotes}\n${aiSuggestion.observations}` : aiSuggestion.observations);
    }
    setShowAISuggestionDialog(false);
    toast({
      title: 'Sugestão aplicada',
      description: 'Os campos foram preenchidos com as sugestões da IA. Revise antes de salvar.',
    });
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel?.toLowerCase()) {
      case 'alto':
      case 'high':
        return 'destructive';
      case 'moderado':
      case 'medio':
      case 'medium':
        return 'default';
      case 'baixo':
      case 'low':
        return 'secondary';
      default:
        return 'outline';
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
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAISuggestion(index)}
                        disabled={isLoadingAISuggestion && aiSuggestionIndex === index}
                        className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950"
                        data-testid={`button-ai-suggest-${index}`}
                      >
                        {isLoadingAISuggestion && aiSuggestionIndex === index ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            Analisando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            Sugestão IA
                          </>
                        )}
                      </Button>
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
                          <FormLabel className="flex items-center gap-2">
                            <Database className="h-3.5 w-3.5" />
                            Buscar Base de Dados
                            {externalSources.length > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                {externalSources.join(' + ')}
                              </Badge>
                            )}
                          </FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Buscar medicamento nas bases externas..."
                                    value={externalSearchTerm || field.value || ''}
                                    onChange={(e) => {
                                      setExternalSearchTerm(e.target.value);
                                      field.onChange(e.target.value);
                                    }}
                                    className="pl-9"
                                  />
                                  {isSearchingExternal && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                                <Select value={searchLocale} onValueChange={setSearchLocale}>
                                  <SelectTrigger className="w-[100px]">
                                    <Globe className="h-3.5 w-3.5 mr-1" />
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="BR">Brasil</SelectItem>
                                    <SelectItem value="US">EUA</SelectItem>
                                    <SelectItem value="INT">Global</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {externalResults.length > 0 && (
                                <ScrollArea className="max-h-48 rounded-md border bg-popover">
                                  <div className="p-1">
                                    {externalResults.map((med) => (
                                      <button
                                        key={med.externalId}
                                        type="button"
                                        onClick={() => selectExternalMedication(med, index)}
                                        className="w-full text-left px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium truncate">{med.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                              {med.genericName} • {med.strength} • {med.dosageForm}
                                            </div>
                                            {med.activeIngredient && med.activeIngredient !== med.genericName && (
                                              <div className="text-xs text-muted-foreground truncate">
                                                Princípio ativo: {med.activeIngredient}
                                              </div>
                                            )}
                                          </div>
                                          <Badge variant="secondary" className="text-[10px] shrink-0 px-1.5 py-0">
                                            {med.source.split(' ')[0]}
                                          </Badge>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </ScrollArea>
                              )}
                              {externalSearchTerm.length >= 2 && !isSearchingExternal && externalResults.length === 0 && (
                                <p className="text-xs text-muted-foreground px-1">
                                  Nenhum resultado encontrado. O texto digitado será usado como medicamento personalizado.
                                </p>
                              )}
                            </div>
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

      {/* AI Suggestion Dialog */}
      <Dialog open={showAISuggestionDialog} onOpenChange={setShowAISuggestionDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-suggestion">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Sugestão da IA
            </DialogTitle>
            <DialogDescription>
              Sugestões baseadas no perfil do paciente e protocolos OMS/MS-Brasil. Revise antes de aplicar.
            </DialogDescription>
          </DialogHeader>

          {aiSuggestion && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Nível de Risco</h4>
                <Badge variant={getRiskLevelColor(aiSuggestion.warnings?.riskLevel || '')} className="text-sm px-3 py-1">
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                  {aiSuggestion.warnings?.riskLevel || 'Não avaliado'}
                </Badge>
              </div>

              <Separator />

              <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                    Posologia Sugerida
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">Dosagem</p>
                      <p className="font-medium text-sm">{aiSuggestion.dosage || '—'}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">Frequência</p>
                      <p className="font-medium text-sm">{aiSuggestion.frequency || '—'}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-md p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">Duração</p>
                      <p className="font-medium text-sm">{aiSuggestion.duration || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {aiSuggestion.observations && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      Observações
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{aiSuggestion.observations}</p>
                  </CardContent>
                </Card>
              )}

              {aiSuggestion.specialInstructions && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-green-600" />
                      Instruções Especiais
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{aiSuggestion.specialInstructions}</p>
                  </CardContent>
                </Card>
              )}

              {aiSuggestion.warnings && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Alertas e Avisos
                    </h4>

                    {aiSuggestion.warnings.sideEffects?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Efeitos Colaterais</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiSuggestion.warnings.sideEffects.map((effect, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {effect}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.warnings.contraindications?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-2">Contraindicações</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiSuggestion.warnings.contraindications.map((ci, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {ci}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.warnings.adverseEffects?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-orange-600 mb-2">Efeitos Adversos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiSuggestion.warnings.adverseEffects.map((ae, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-orange-300 text-orange-700">
                              {ae}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.warnings.drugInteractions?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-yellow-600 mb-2">Interações Medicamentosas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiSuggestion.warnings.drugInteractions.map((di, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-yellow-300 text-yellow-700">
                              {di}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAISuggestionDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={applyAISuggestion}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-apply-ai-suggestion"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Aplicar Sugestão
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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