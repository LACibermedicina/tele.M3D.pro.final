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
import { Save, RotateCcw, ShieldCheck, Globe, Key } from 'lucide-react';

interface CountryConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  provider: string;
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
      if (!res.ok) throw new Error('Failed to load');
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
              Obtenha uma chave em consultacrm.com.br. Sem chave, o sistema faz validação local do formato CRM.
            </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
