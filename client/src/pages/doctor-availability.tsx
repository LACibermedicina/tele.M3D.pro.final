import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Calendar, Plus, Trash2, Power, Clock3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DoctorSchedule {
  id?: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  consultationDuration: number;
  isActive: boolean;
}

const daysOfWeek = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export default function DoctorAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(false);
  const [availableForImmediate, setAvailableForImmediate] = useState(false);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [onDutyUntil, setOnDutyUntil] = useState<Date | null>(null);

  // Fetch doctor's current schedule
  const { data: existingSchedule, isLoading } = useQuery({
    queryKey: ['/api/doctors', user?.id, 'schedule'],
    queryFn: async () => {
      const res = await fetch(`/api/doctors/${user?.id}/schedule`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch doctor's current status
  const { data: doctorStatus } = useQuery({
    queryKey: ['/api/doctors', user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/doctors`);
      const doctors = await res.json();
      return doctors.find((d: any) => d.id === user?.id);
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (existingSchedule) {
      setSchedules(existingSchedule);
    }
  }, [existingSchedule]);

  useEffect(() => {
    if (doctorStatus) {
      setIsOnline(doctorStatus.isOnline || false);
      setAvailableForImmediate(doctorStatus.availableForImmediate || false);
      setOnDutyUntil(doctorStatus.onDutyUntil ? new Date(doctorStatus.onDutyUntil) : null);
    }
  }, [doctorStatus]);

  // Update online status mutation
  const statusMutation = useMutation({
    mutationFn: async (data: { isOnline: boolean; availableForImmediate: boolean }) => {
      const res = await apiRequest('POST', '/api/doctors/status', data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Status atualizado",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  // Update schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: { schedules: DoctorSchedule[] }) => {
      const res = await apiRequest('PUT', `/api/doctors/${user?.id}/schedule`, data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors', user?.id, 'schedule'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar horários",
        variant: "destructive",
      });
    },
  });

  // 24h on-duty mutation
  const onDutyMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const res = await apiRequest('POST', '/api/doctors/on-duty', { activate });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: activate ? "Plantão Ativado" : "Plantão Desativado",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctors'] });
      setOnDutyUntil(data.onDutyUntil ? new Date(data.onDutyUntil) : null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar plantão",
        variant: "destructive",
      });
    },
  });

  const handleStatusToggle = (field: 'isOnline' | 'availableForImmediate', value: boolean) => {
    if (field === 'isOnline') {
      setIsOnline(value);
      statusMutation.mutate({ isOnline: value, availableForImmediate: value ? availableForImmediate : false });
    } else {
      setAvailableForImmediate(value);
      statusMutation.mutate({ isOnline: isOnline, availableForImmediate: value });
    }
  };

  const addSchedule = () => {
    setSchedules([
      ...schedules,
      {
        doctorId: user?.id || '',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        consultationDuration: 15, // Changed to 15 minutes
        isActive: true,
      },
    ]);
  };

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const updateSchedule = (index: number, field: keyof DoctorSchedule, value: any) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const saveSchedule = () => {
    scheduleMutation.mutate({ schedules });
  };

  if (!user || user.role !== 'doctor') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Acesso restrito a médicos
              </p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciar Disponibilidade</h1>
        <p className="text-muted-foreground mt-2">
          Configure seus horários de atendimento e disponibilidade para consultas imediatas
        </p>
      </div>

      {/* Online Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Status Online
          </CardTitle>
          <CardDescription>
            Controle sua disponibilidade para atendimentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="online-status" className="text-base">
                Status Online
              </Label>
              <p className="text-sm text-muted-foreground">
                Marque-se como online quando estiver disponível
              </p>
            </div>
            <Switch
              id="online-status"
              checked={isOnline}
              onCheckedChange={(checked) => handleStatusToggle('isOnline', checked)}
              data-testid="switch-online-status"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="immediate-status" className="text-base">
                Disponível para Atendimento Imediato
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba solicitações de consultas emergenciais
              </p>
            </div>
            <Switch
              id="immediate-status"
              checked={availableForImmediate}
              onCheckedChange={(checked) => handleStatusToggle('availableForImmediate', checked)}
              disabled={!isOnline}
              data-testid="switch-immediate-availability"
            />
          </div>

          {isOnline && availableForImmediate && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Você está disponível para atendimentos imediatos. Pacientes podem solicitar consulta agora.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 24h On-Duty Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-5 w-5" />
            Plantão 24 Horas
          </CardTitle>
          <CardDescription>
            Ative o plantão e fique disponível automaticamente por 24 horas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base">
                Disponível 24hs
              </Label>
              <p className="text-sm text-muted-foreground">
                {onDutyUntil && onDutyUntil > new Date() 
                  ? `Plantão ativo - termina ${formatDistanceToNow(onDutyUntil, { addSuffix: true, locale: ptBR })}`
                  : 'Ative para receber pacientes automaticamente por 24 horas'
                }
              </p>
            </div>
            <Button
              variant={onDutyUntil && onDutyUntil > new Date() ? "destructive" : "default"}
              onClick={() => onDutyMutation.mutate(!(onDutyUntil && onDutyUntil > new Date()))}
              disabled={onDutyMutation.isPending}
              data-testid="button-toggle-on-duty"
            >
              {onDutyMutation.isPending 
                ? 'Processando...' 
                : (onDutyUntil && onDutyUntil > new Date() ? 'Desativar Plantão' : 'Ativar Plantão')
              }
            </Button>
          </div>

          {onDutyUntil && onDutyUntil > new Date() && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ✓ Você está em plantão! Sempre que fizer login, estará automaticamente disponível para atendimentos imediatos até o término do plantão.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Horários de Atendimento
          </CardTitle>
          <CardDescription>
            Defina seus horários semanais de disponibilidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <>
              {schedules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum horário definido</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Dia da Semana</Label>
                          <Select
                            value={schedule.dayOfWeek.toString()}
                            onValueChange={(value) => updateSchedule(index, 'dayOfWeek', parseInt(value))}
                          >
                            <SelectTrigger data-testid={`select-day-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {daysOfWeek.map((day) => (
                                <SelectItem key={day.value} value={day.value.toString()}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Início</Label>
                          <Input
                            type="time"
                            value={schedule.startTime}
                            onChange={(e) => updateSchedule(index, 'startTime', e.target.value)}
                            data-testid={`input-start-time-${index}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Fim</Label>
                          <Input
                            type="time"
                            value={schedule.endTime}
                            onChange={(e) => updateSchedule(index, 'endTime', e.target.value)}
                            data-testid={`input-end-time-${index}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Duração (min)</Label>
                          <Select
                            value={schedule.consultationDuration.toString()}
                            onValueChange={(value) => updateSchedule(index, 'consultationDuration', parseInt(value))}
                          >
                            <SelectTrigger data-testid={`select-duration-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min (15+15 espaço)</SelectItem>
                              <SelectItem value="45">45 min (30+15 espaço)</SelectItem>
                              <SelectItem value="60">60 min (45+15 espaço)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Inclui 15 min de espaço entre consultas
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.isActive}
                            onCheckedChange={(checked) => updateSchedule(index, 'isActive', checked)}
                            data-testid={`switch-active-${index}`}
                          />
                          <Label>Ativo</Label>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSchedule(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={addSchedule} variant="outline" className="flex-1" data-testid="button-add-schedule">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Horário
                </Button>
                <Button
                  onClick={saveSchedule}
                  disabled={scheduleMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-schedule"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {scheduleMutation.isPending ? 'Salvando...' : 'Salvar Horários'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </PageWrapper>
  );
}
