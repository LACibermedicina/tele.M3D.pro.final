import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, ShieldCheck, Globe, Key, Settings2 } from 'lucide-react';

interface ResponseMapping {
  nameField?: string;
  registrationField?: string;
  stateField?: string;
  specialtyField?: string;
  situationField?: string;
  dateField?: string;
  activeValues?: string[];
  expiredValues?: string[];
  invalidValues?: string[];
}

interface CountryConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  provider: string;
  httpMethod?: 'GET' | 'POST';
  responseMapping?: ResponseMapping;
}

interface CRMConfig {
  enabled: boolean;
  countries: {
    BR: CountryConfig;
    PT: CountryConfig;
  };
}

export function CRMVerificationConfigTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CRMConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery<CRMConfig>({
    queryKey: ['/api/admin/crm-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/crm-config', { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar');
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setConfig(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (c: CRMConfig) => apiRequest('PUT', '/api/admin/crm-config', c),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm-config'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração CRM salva com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar configuração', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/crm-config/reset'),
    onSuccess: async (res) => {
      const defaults = await res.json();
      setConfig(defaults);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/crm-config'] });
      setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Configuração CRM restaurada para os padrões' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao restaurar padrões', variant: 'destructive' });
    },
  });

  const updateConfig = (updates: Partial<CRMConfig>) => {
    if (config) {
      setConfig({ ...config, ...updates });
      setHasChanges(true);
    }
  };

  const updateCountry = (country: 'BR' | 'PT', updates: Partial<CountryConfig>) => {
    if (config) {
      setConfig({
        ...config,
        countries: {
          ...config.countries,
          [country]: { ...config.countries[country], ...updates },
        },
      });
      setHasChanges(true);
    }
  };

  const updateMapping = (country: 'BR' | 'PT', field: keyof ResponseMapping, value: string) => {
    if (!config) return;
    const current = config.countries[country].responseMapping || {};
    const isArrayField = field === 'activeValues' || field === 'expiredValues' || field === 'invalidValues';
    updateCountry(country, {
      responseMapping: {
        ...current,
        [field]: isArrayField ? value.split(',').map(v => v.trim()).filter(Boolean) : value,
      },
    });
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Verificação de Registro Profissional (CRM)</h2>
          <p className="text-sm text-muted-foreground">
            Configure a verificação automática de registro médico via APIs oficiais
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              Alterações não salvas
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Restaurar Padrões
          </Button>
          <Button
            size="sm"
            onClick={() => config && saveMutation.mutate(config)}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-400" />
              <CardTitle className="text-lg">Configuração Geral</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="crm-enabled" className="text-sm">Verificação Ativa</Label>
              <Switch
                id="crm-enabled"
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>
          </div>
          <CardDescription>
            Quando ativada, médicos podem verificar seu CRM diretamente pelo perfil. 
            Admins podem verificar qualquer médico.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-lg">Brasil — CFM (Conselho Federal de Medicina)</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="br-enabled" className="text-sm">Ativo</Label>
              <Switch
                id="br-enabled"
                checked={config.countries.BR.enabled}
                onCheckedChange={(checked) => updateCountry('BR', { enabled: checked })}
              />
            </div>
          </div>
          <CardDescription>
            Verificação via API do Conselho Federal de Medicina. Sem chave de API, usa validação local.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Input
                value={config.countries.BR.provider}
                onChange={(e) => updateCountry('BR', { provider: e.target.value })}
                placeholder="CFM"
              />
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={config.countries.BR.apiUrl}
                onChange={(e) => updateCountry('BR', { apiUrl: e.target.value })}
                placeholder="https://www.consultacrm.com.br/api/index.php"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Chave de API (opcional)
              </Label>
              <Input
                type="password"
                value={config.countries.BR.apiKey}
                onChange={(e) => updateCountry('BR', { apiKey: e.target.value })}
                placeholder="Deixe vazio para usar validação local"
              />
              <p className="text-xs text-muted-foreground">
                Obtenha uma chave em consultacrm.com.br.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Método HTTP</Label>
              <Select
                value={config.countries.BR.httpMethod || 'GET'}
                onValueChange={(v) => updateCountry('BR', { httpMethod: v as 'GET' | 'POST' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4" />
              Mapeamento de Resposta
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Campo Situação</Label>
                <Input
                  value={config.countries.BR.responseMapping?.situationField || ''}
                  onChange={(e) => updateMapping('BR', 'situationField', e.target.value)}
                  placeholder="item.0.situacao"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valores Ativos (vírgula)</Label>
                <Input
                  value={(config.countries.BR.responseMapping?.activeValues || []).join(', ')}
                  onChange={(e) => updateMapping('BR', 'activeValues', e.target.value)}
                  placeholder="Regular, Ativo"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valores Expirados (vírgula)</Label>
                <Input
                  value={(config.countries.BR.responseMapping?.expiredValues || []).join(', ')}
                  onChange={(e) => updateMapping('BR', 'expiredValues', e.target.value)}
                  placeholder="Cancelado, Cassado"
                  className="text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valores Inválidos (vírgula)</Label>
              <Input
                value={(config.countries.BR.responseMapping?.invalidValues || []).join(', ')}
                onChange={(e) => updateMapping('BR', 'invalidValues', e.target.value)}
                placeholder="Não encontrado, Inválido"
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-green-400" />
              <CardTitle className="text-lg">Portugal — Ordem dos Médicos</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="pt-enabled" className="text-sm">Ativo</Label>
              <Switch
                id="pt-enabled"
                checked={config.countries.PT.enabled}
                onCheckedChange={(checked) => updateCountry('PT', { enabled: checked })}
              />
            </div>
          </div>
          <CardDescription>
            Verificação via API da Ordem dos Médicos de Portugal (configuração futura).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Input
                value={config.countries.PT.provider}
                onChange={(e) => updateCountry('PT', { provider: e.target.value })}
                placeholder="Ordem dos Médicos"
              />
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={config.countries.PT.apiUrl}
                onChange={(e) => updateCountry('PT', { apiUrl: e.target.value })}
                placeholder="URL da API"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Chave de API
              </Label>
              <Input
                type="password"
                value={config.countries.PT.apiKey}
                onChange={(e) => updateCountry('PT', { apiKey: e.target.value })}
                placeholder="Chave de API"
              />
            </div>
            <div className="space-y-2">
              <Label>Método HTTP</Label>
              <Select
                value={config.countries.PT.httpMethod || 'GET'}
                onValueChange={(v) => updateCountry('PT', { httpMethod: v as 'GET' | 'POST' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4" />
              Mapeamento de Resposta
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valores Ativos (vírgula)</Label>
                <Input
                  value={(config.countries.PT.responseMapping?.activeValues || []).join(', ')}
                  onChange={(e) => updateMapping('PT', 'activeValues', e.target.value)}
                  placeholder="Activo, Ativo"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valores Expirados (vírgula)</Label>
                <Input
                  value={(config.countries.PT.responseMapping?.expiredValues || []).join(', ')}
                  onChange={(e) => updateMapping('PT', 'expiredValues', e.target.value)}
                  placeholder="Suspenso, Cancelado"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valores Inválidos (vírgula)</Label>
                <Input
                  value={(config.countries.PT.responseMapping?.invalidValues || []).join(', ')}
                  onChange={(e) => updateMapping('PT', 'invalidValues', e.target.value)}
                  placeholder="Não encontrado"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
