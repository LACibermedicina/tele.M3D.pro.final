import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, Users, Key, Activity, AlertTriangle, Plus, Eye, EyeOff, Copy, Trash2, UserCheck, UserX, Edit3, Clock, Zap, Database, DollarSign, Send, Search, FileText, Settings, CreditCard, Pill, ArrowUpDown, ArrowUp, ArrowDown, Unplug, Stethoscope, ServerCrash, ScrollText, Code, GripVertical, ToggleLeft, Play, Pause, ChevronDown, ChevronUp, BarChart3, BrainCircuit } from 'lucide-react';
import { useIsPermanentAdmin } from '@/hooks/use-permanent-admin';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/use-websocket';
import { formatErrorForToast } from '@/lib/error-handler';
import PageWrapper from '@/components/layout/page-wrapper';
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";
import { ECGConfigTab, RadiologyConfigTab } from '@/components/admin/ai-prompt-config';
import { useAccessModality } from '@/contexts/AccessModalityContext';
import { CRMVerificationConfigTab } from '@/components/admin/crm-verification-config';

interface Collaborator {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  address: string;
  cnpj: string;
  cnes: string;
  specialization: string[];
  isActive: boolean;
  createdAt: string;
}

interface ApiKey {
  id: string;
  collaboratorId: string;
  keyName: string;
  hashedKey: string;
  permissions: string[];
  isActive: boolean;
  lastUsed: string | null;
  expiresAt: string | null;
  ipWhitelist: string[];
  rateLimit: number;
  createdAt: string;
}

interface CollaboratorIntegration {
  id: string;
  collaboratorId: string;
  collaboratorName?: string;
  integrationType: string;
  entityId: string;
  action: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  requestData?: any;
  createdAt: string;
}

interface AdminUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isBlocked: boolean;
  blockedBy?: string;
  deactivationReason?: string;
  isProtected?: boolean;
  lastLogin?: string;
  totalUsageSeconds?: number;
  hierarchyLevel?: number;
  superiorDoctorId?: string;
  medicalLicense?: string;
  specialization?: string;
  tmcCredits?: number;
  createdAt: string;
  crfNumber?: string;
  pharmacyName?: string;
  cnpj?: string;
}

interface ErrorLog {
  id: string;
  errorCode: string;
  userId?: string;
  errorType: string;
  endpoint?: string;
  method?: string;
  technicalMessage: string;
  userMessage: string;
  stackTrace?: string;
  context?: any;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  adminNotes?: string;
  createdAt: string;
}

function formatUsageTime(seconds: number): string {
  if (seconds <= 0) return '0min';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export default function AdminPage() {
  const { restoreAll } = useMinimizedPanels();
  const { toast } = useToast();
  const isPermanentAdmin = useIsPermanentAdmin();
  const { isClassic: isClassicModality } = useAccessModality();
  const [showCreateCollaborator, setShowCreateCollaborator] = useState(false);
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [realtimeActivities, setRealtimeActivities] = useState<any[]>([]);
  
  // PDF Reference upload states
  const [uploadedPdfData, setUploadedPdfData] = useState<any>(null);
  const [refTitle, setRefTitle] = useState('');
  const [refContent, setRefContent] = useState('');
  const [refCategory, setRefCategory] = useState('');
  
  // Error Logs filters
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');
  const [selectedErrorLog, setSelectedErrorLog] = useState<ErrorLog | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  // User management filters and edit dialog
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editUserRole, setEditUserRole] = useState('');
  const [editDeactivationReason, setEditDeactivationReason] = useState('');
  const [userSortColumn, setUserSortColumn] = useState<string>('username');
  const [userSortDirection, setUserSortDirection] = useState<'asc' | 'desc'>('asc');

  // WebSocket for real-time activity monitoring
  const { isConnected, messages } = useWebSocket();

  // Process WebSocket messages for admin activities
  useEffect(() => {
    const adminMessages = messages.filter(msg => msg.type === 'admin-activity');
    if (adminMessages.length > 0) {
      const latestMessage = adminMessages[adminMessages.length - 1];
      const activity = (latestMessage as any).activity; // Type assertion for admin activity messages
      setRealtimeActivities(prev => [activity, ...prev.slice(0, 49)]); // Keep last 50 activities
      
      // Show toast notification for new activities
      if (activity.action === 'user_blocked') {
        toast({
          title: "Usuário Bloqueado",
          description: `${activity.details.blockedUsername} foi bloqueado por ${activity.details.blockedBy}`,
          variant: "destructive",
        });
      } else if (activity.action === 'user_unblocked') {
        toast({
          title: "Usuário Desbloqueado",
          description: `${activity.details.unblockedUsername} foi desbloqueado por ${activity.details.unblockedBy}`,
        });
      }
    }
  }, [messages, toast]);

  // Queries
  const { data: collaborators = [], isLoading: loadingCollaborators } = useQuery({
    queryKey: ['/api/collaborators'],
  });

  const { data: apiKeys = [], isLoading: loadingApiKeys } = useQuery({
    queryKey: ['/api/admin/api-keys'],
  });

  const { data: integrations = [], isLoading: loadingIntegrations } = useQuery({
    queryKey: ['/api/admin/integrations'],
  });

  const { data: analytics } = useQuery({
    queryKey: ['/api/admin/analytics'],
  });

  const { data: adminUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  const { data: recentActivity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ['/api/admin/users/activity/recent'],
  });

  // Error Logs query with filters
  const errorLogsQueryKey = [
    '/api/admin/error-logs',
    { 
      errorType: errorTypeFilter !== 'all' ? errorTypeFilter : undefined,
      resolved: resolvedFilter !== 'all' ? resolvedFilter : undefined,
      limit: 100
    }
  ];
  
  const { data: errorLogs = [], isLoading: loadingErrorLogs } = useQuery({
    queryKey: errorLogsQueryKey,
  });

  // Mutations
  const createCollaboratorMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/collaborators', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaborators'] });
      setShowCreateCollaborator(false);
      toast({ title: 'Sucesso', description: 'Colaborador criado com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const createApiKeyMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/api-keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      setShowCreateApiKey(false);
      toast({ title: 'Sucesso', description: 'Chave de API criada com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const toggleApiKeyMutation = useMutation({
    mutationFn: ({ keyId, isActive }: { keyId: string; isActive: boolean }) => 
      apiRequest('PATCH', `/api/admin/api-keys/${keyId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      toast({ title: 'Sucesso', description: 'Chave de API atualizada com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => 
      apiRequest('POST', `/api/admin/users/${userId}/block`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Sucesso', description: 'Usuário bloqueado com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const unblockUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('POST', `/api/admin/users/${userId}/unblock`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Sucesso', description: 'Usuário desbloqueado com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const forceDisconnectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/force-disconnect`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: 'Desconectado', description: data.message || 'Usuário desconectado com sucesso.' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const protectUserMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest('PATCH', `/api/admin/users/${userId}/protect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Sucesso', description: 'Status de proteção atualizado' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) => 
      apiRequest('PATCH', `/api/admin/users/${userId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const resolveErrorMutation = useMutation({
    mutationFn: ({ errorId, adminNotes }: { errorId: string; adminNotes?: string }) =>
      apiRequest('PATCH', `/api/admin/error-logs/${errorId}/resolve`, { adminNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: errorLogsQueryKey });
      setShowErrorDetails(false);
      setSelectedErrorLog(null);
      setResolveNotes('');
      toast({ title: 'Sucesso', description: 'Erro marcado como resolvido com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const [activeTab, setActiveTab] = useState('users');
  const [disconnectConfirm, setDisconnectConfirm] = useState<'users' | 'doctors' | 'services' | null>(null);

  const disconnectAllUsersMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/disconnect-all-users', {}),
    onSuccess: async (response) => {
      const data = await response.json();
      setDisconnectConfirm(null);
      toast({ title: 'Sucesso', description: data.message });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const disconnectAllDoctorsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/disconnect-all-doctors', {}),
    onSuccess: async (response) => {
      const data = await response.json();
      setDisconnectConfirm(null);
      toast({ title: 'Sucesso', description: data.message });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const disconnectAllServicesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/disconnect-all-services', {}),
    onSuccess: async (response) => {
      const data = await response.json();
      setDisconnectConfirm(null);
      toast({ title: 'Sucesso', description: data.message });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: 'Copiado para a área de transferência' });
  };

  const toggleShowApiKey = (keyId: string) => {
    setShowApiKey(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const formatJsonData = (data: any) => {
    if (!data) return 'N/A';
    return JSON.stringify(data, null, 2);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getIntegrationTypeColor = (type: string) => {
    switch (type) {
      case 'api_access': return 'bg-blue-100 text-blue-800';
      case 'prescription_share': return 'bg-green-100 text-green-800';
      case 'authorization_violation': return 'bg-red-100 text-red-800';
      case 'rate_limit': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <PageWrapper variant="admin">
      <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 lg:space-y-8" data-testid="admin-page">
        <div className="flex items-center gap-2 sm:gap-3">
          <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-400" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Administração do Sistema</h1>
        </div>

        {/* Dashboard Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { tab: 'users', label: 'Usuários', icon: Users, badge: String((adminUsers as AdminUser[]).length), badgeVariant: 'secondary' as const },
            { tab: 'activity', label: 'Atividade', icon: Zap, badge: isConnected ? 'Online' : 'Offline', badgeVariant: (isConnected ? 'default' : 'destructive') as const },
            { tab: 'error-logs', label: 'Logs de Erro', icon: AlertTriangle, badge: String((errorLogs as ErrorLog[]).filter((e: ErrorLog) => !e.resolved).length), badgeVariant: 'destructive' as const },
            { tab: 'collaborators', label: 'Colaboradores', icon: Key, badge: String((collaborators as Collaborator[]).length), badgeVariant: 'secondary' as const },
            { tab: 'financial', label: 'Financeiro', icon: DollarSign, badge: null, badgeVariant: 'secondary' as const },
            { tab: 'ai-ecg-config', label: 'Config IA', icon: BrainCircuit, badge: null, badgeVariant: 'secondary' as const },
            { tab: 'system-settings', label: 'Sistema', icon: Settings, badge: null, badgeVariant: 'secondary' as const },
            { tab: 'security', label: 'Segurança', icon: Shield, badge: String((analytics as any)?.securityAlerts || 0), badgeVariant: 'destructive' as const },
            { tab: 'monitoring', label: 'Monitoramento', icon: BarChart3, badge: null, badgeVariant: 'secondary' as const },
            { tab: 'database-cleanup', label: 'Banco de Dados', icon: Database, badge: null, badgeVariant: 'secondary' as const },
          ].map(({ tab, label, icon: Icon, badge, badgeVariant }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-150 text-left ${
                activeTab === tab
                  ? 'bg-indigo-600/20 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className={`p-2 rounded-lg ${activeTab === tab ? 'bg-indigo-500/20' : 'bg-white/10'}`}>
                <Icon className={`h-5 w-5 ${activeTab === tab ? 'text-indigo-400' : 'text-white/60'}`} />
              </div>
              <span className={`text-xs font-medium text-center leading-tight ${activeTab === tab ? 'text-indigo-300' : 'text-white/70'}`}>{label}</span>
              {badge !== null && (
                <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                  {badge}
                </Badge>
              )}
            </button>
          ))}
        </div>

      {/* Analytics Cards */}
      <DraggableDashboardPanel id="admin-analytics" label="Métricas do Sistema" icon="activity" dashboardKey="admin">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-collaborators">
              {(collaborators as Collaborator[]).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ativos: {(collaborators as Collaborator[]).filter((c: Collaborator) => c.isActive).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chaves de API</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-api-keys">
              {(apiKeys as ApiKey[]).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ativas: {(apiKeys as ApiKey[]).filter((k: ApiKey) => k.isActive).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisições de Hoje</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="today-requests">
              {(analytics as any)?.todayRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Sucesso: {(analytics as any)?.todaySuccess || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Segurança</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="security-alerts">
              {(analytics as any)?.securityAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>
      </div>
      </DraggableDashboardPanel>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users" data-testid="tab-users">Usuários</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Atividade ao Vivo</span>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </TabsTrigger>
          <TabsTrigger value="error-logs" data-testid="tab-error-logs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Logs de Erro</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="collaborators" data-testid="tab-collaborators">Colaboradores</TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">Chaves de API</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoramento</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Segurança</TabsTrigger>
          <TabsTrigger value="ai-references" data-testid="tab-ai-references">Referências de IA</TabsTrigger>
          <TabsTrigger value="layout-theme" data-testid="tab-layout-theme">Layout & Tema</TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Gestão Financeira</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="database-cleanup" data-testid="tab-database-cleanup">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Limpeza de Dados</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="ai-ecg-config" data-testid="tab-ai-ecg-config">
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-4 w-4" />
              <span>Config ECG</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="access-modality-config" data-testid="tab-access-modality-config">
            Modalidades de Acesso
          </TabsTrigger>
          {!isClassicModality && (
            <TabsTrigger value="ai-radiology-config" data-testid="tab-ai-radiology-config">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Config Radiologia</span>
              </div>
            </TabsTrigger>
          )}
          <TabsTrigger value="crm-verification" data-testid="tab-crm-verification">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Verificação CRM</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="system-settings" data-testid="tab-system-settings">
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>Configurações</span>
            </div>
          </TabsTrigger>
          {isPermanentAdmin && (
            <TabsTrigger value="postload-settings" data-testid="tab-postload-settings">
              <div className="flex items-center space-x-2">
                <ScrollText className="h-4 w-4" />
                <span>Pós-Carregamento</span>
              </div>
            </TabsTrigger>
          )}
          <TabsTrigger value="presence-settings" data-testid="tab-presence-settings">
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>Tempos de Presença</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="doctor-registrations" data-testid="tab-doctor-registrations">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Registros Profissionais</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presence-settings" className="space-y-4">
          <PresenceSettingsPanel />
        </TabsContent>

        <TabsContent value="doctor-registrations" className="space-y-4">
          <DoctorRegistrationsPanel />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="total-users">
                  {(adminUsers as AdminUser[]).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Ativos: {(adminUsers as AdminUser[]).filter((u: AdminUser) => !u.isBlocked).length}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usuários Bloqueados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="blocked-users">
                  {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.isBlocked).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Requerem atenção
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-4 w-4 text-purple-600" />
                  Farmacêuticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="pharmacist-count">
                  {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.role === 'pharmacist').length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Ativos: {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.role === 'pharmacist' && !u.isBlocked).length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Atividade Recente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="recent-activity">
                  {(recentActivity as AdminUser[]).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Usuários ativos hoje
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gestão de Usuários</CardTitle>
                  <CardDescription>
                    Gerencie usuários do sistema, papéis e permissões de acesso
                  </CardDescription>
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Papéis</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="doctor">Médico</SelectItem>
                    <SelectItem value="patient">Paciente</SelectItem>
                    <SelectItem value="pharmacist">Farmacêutico</SelectItem>
                    <SelectItem value="researcher">Pesquisador</SelectItem>
                    <SelectItem value="visitor">Visitante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-center py-8">Carregando usuários...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        { key: 'username', label: 'Usuário' },
                        { key: 'name', label: 'Nome' },
                        { key: 'role', label: 'Papel' },
                        { key: 'status', label: 'Status' },
                        { key: 'lastLogin', label: 'Último Login' },
                        { key: 'usageTime', label: 'Tempo de Uso' },
                        { key: 'credits', label: 'Créditos TM3D' },
                      ].map(col => (
                        <TableHead
                          key={col.key}
                          className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            if (userSortColumn === col.key) {
                              setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setUserSortColumn(col.key);
                              setUserSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {userSortColumn === col.key ? (
                              userSortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                            )}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(adminUsers as AdminUser[])
                      .filter((u: AdminUser) => userRoleFilter === 'all' || u.role === userRoleFilter)
                      .sort((a: AdminUser, b: AdminUser) => {
                        let valA: any, valB: any;
                        switch (userSortColumn) {
                          case 'username': valA = a.username?.toLowerCase() || ''; valB = b.username?.toLowerCase() || ''; break;
                          case 'name': valA = a.name?.toLowerCase() || ''; valB = b.name?.toLowerCase() || ''; break;
                          case 'role': valA = a.role || ''; valB = b.role || ''; break;
                          case 'status': valA = a.isBlocked ? 1 : 0; valB = b.isBlocked ? 1 : 0; break;
                          case 'lastLogin': valA = a.lastLogin ? new Date(a.lastLogin).getTime() : 0; valB = b.lastLogin ? new Date(b.lastLogin).getTime() : 0; break;
                          case 'usageTime': valA = a.totalUsageSeconds || 0; valB = b.totalUsageSeconds || 0; break;
                          case 'credits': valA = a.tmcCredits || 0; valB = b.tmcCredits || 0; break;
                          default: valA = a.username?.toLowerCase() || ''; valB = b.username?.toLowerCase() || '';
                        }
                        if (valA < valB) return userSortDirection === 'asc' ? -1 : 1;
                        if (valA > valB) return userSortDirection === 'asc' ? 1 : -1;
                        return 0;
                      })
                      .map((user: AdminUser) => (
                      <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                        <TableCell className="font-medium" data-no-translate>{user.username}</TableCell>
                        <TableCell>
                          <div data-no-translate>
                            <span data-no-translate>{user.name}</span>
                            {user.role === 'pharmacist' && user.medicalLicense && (
                              <span className="block text-xs text-muted-foreground">CRF: {user.medicalLicense}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            user.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'patient' ? 'bg-green-100 text-green-800' :
                            user.role === 'pharmacist' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'researcher' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {user.role === 'pharmacist' && <Pill className="h-3 w-3 mr-1 inline" />}
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={user.isBlocked ? 'destructive' : 'default'}
                              className={user.username !== 'root' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                              onClick={() => {
                                if (user.username === 'root') return;
                                if (user.isBlocked) {
                                  unblockUserMutation.mutate(user.id);
                                } else {
                                  blockUserMutation.mutate({ userId: user.id, reason: 'Inativo por questões administrativas' });
                                }
                              }}
                              title={user.username === 'root' ? 'Superusuário root — não pode ser desativado' : user.isBlocked ? 'Clique para ativar' : 'Clique para desativar'}
                            >
                              {user.isBlocked ? 'Inativo' : 'Ativo'}
                            </Badge>
                            {user.isProtected && (
                              <ShieldCheck className="h-4 w-4 text-blue-500" title="Protegido contra exclusão" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-xs">{user.lastLogin ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm') : 'Nunca'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{formatUsageTime(user.totalUsageSeconds || 0)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{user.tmcCredits || 0} TM3D</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {user.isBlocked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unblockUserMutation.mutate(user.id)}
                                data-testid={`button-unblock-${user.id}`}
                                disabled={unblockUserMutation.isPending}
                                title="Desbloquear"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => blockUserMutation.mutate({ 
                                  userId: user.id, 
                                  reason: 'Ação administrativa' 
                                })}
                                data-testid={`button-block-${user.id}`}
                                disabled={blockUserMutation.isPending}
                                title="Bloquear"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                            {user.username !== 'root' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => forceDisconnectMutation.mutate(user.id)}
                                disabled={forceDisconnectMutation.isPending}
                                title="Desconectar imediatamente"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                <Unplug className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-edit-${user.id}`}
                              onClick={() => {
                                setEditingUser(user);
                                setEditUserRole(user.role);
                                setEditDeactivationReason(user.deactivationReason || '');
                                setShowEditUserDialog(true);
                              }}
                              title="Editar"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Usuário: <span data-no-translate>{editingUser?.name}</span></DialogTitle>
                <DialogDescription>
                  Atualize o papel e as permissões do usuário. Login: <span data-no-translate>{editingUser?.username}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={editUserRole} onValueChange={setEditUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="doctor">Médico</SelectItem>
                      <SelectItem value="patient">Paciente</SelectItem>
                      <SelectItem value="pharmacist">Farmacêutico</SelectItem>
                      <SelectItem value="researcher">Pesquisador</SelectItem>
                      <SelectItem value="visitor">Visitante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingUser && (
                  <div className="space-y-2 text-sm text-muted-foreground" data-no-translate>
                    <p>E-mail: {editingUser.email || 'N/A'}</p>
                    <p>Telefone: {editingUser.phone || 'N/A'}</p>
                    <p>Criado em: {format(new Date(editingUser.createdAt), 'dd/MM/yyyy')}</p>
                    {editingUser.role === 'pharmacist' && editingUser.medicalLicense && (
                      <p>CRF: {editingUser.medicalLicense}</p>
                    )}
                    {editingUser.role === 'pharmacist' && editingUser.specialization && (
                      <p>Farmácia: {editingUser.specialization}</p>
                    )}
                  </div>
                )}

                {editingUser && editingUser.username !== 'root' && (
                  <>
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Acesso ativo</Label>
                          <p className="text-xs text-muted-foreground">Desativar impede o login do usuário</p>
                        </div>
                        <Switch
                          checked={!editingUser.isBlocked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              unblockUserMutation.mutate(editingUser.id);
                              setEditingUser({ ...editingUser, isBlocked: false, deactivationReason: undefined });
                              setEditDeactivationReason('');
                            } else {
                              const reason = editDeactivationReason || 'Inativo por questões administrativas';
                              blockUserMutation.mutate({ userId: editingUser.id, reason });
                              setEditingUser({ ...editingUser, isBlocked: true, deactivationReason: reason });
                            }
                          }}
                          disabled={blockUserMutation.isPending || unblockUserMutation.isPending}
                        />
                      </div>
                      {editingUser.isBlocked && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Observação</Label>
                          <Textarea
                            value={editDeactivationReason}
                            onChange={(e) => setEditDeactivationReason(e.target.value)}
                            placeholder="Inativo por questões administrativas"
                            rows={2}
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const reason = editDeactivationReason || 'Inativo por questões administrativas';
                              blockUserMutation.mutate({ userId: editingUser.id, reason });
                              setEditingUser({ ...editingUser, deactivationReason: reason });
                            }}
                            disabled={blockUserMutation.isPending}
                          >
                            Salvar observação
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                            Proteger contra exclusão
                          </Label>
                          <p className="text-xs text-muted-foreground">Impede que este usuário seja removido</p>
                        </div>
                        <Switch
                          checked={!!editingUser.isProtected}
                          onCheckedChange={() => {
                            protectUserMutation.mutate(editingUser.id);
                            setEditingUser({ ...editingUser, isProtected: !editingUser.isProtected });
                          }}
                          disabled={protectUserMutation.isPending}
                        />
                      </div>
                    </div>
                  </>
                )}

                {editingUser && editingUser.username === 'root' && (
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                      <span>Superusuário root — sempre protegido, não pode ser desativado</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEditUserDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (editingUser) {
                      updateUserMutation.mutate({
                        userId: editingUser.id,
                        data: { role: editUserRole }
                      });
                      setShowEditUserDialog(false);
                    }
                  }}
                  disabled={updateUserMutation.isPending}
                >
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Live Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>WebSocket</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Status da conexão em tempo real
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Atividades ao Vivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="live-activities-count">
                  {realtimeActivities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ações administrativas recentes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mensagens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="websocket-messages-count">
                  {messages.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de mensagens WebSocket
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-green-600">
                  Online
                </div>
                <p className="text-xs text-muted-foreground">
                  Todos os sistemas operacionais
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real-time Activity Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Feed de Atividade ao Vivo</span>
                  <Badge variant="outline" className="ml-2">
                    {realtimeActivities.length} atividades
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Ações administrativas e eventos do sistema em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {realtimeActivities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhuma atividade recente</p>
                      <p className="text-sm">Ações administrativas aparecerão aqui em tempo real</p>
                    </div>
                  ) : (
                    realtimeActivities.map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg"
                        data-testid={`activity-item-${index}`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          activity.action === 'user_blocked' ? 'bg-red-500' :
                          activity.action === 'user_unblocked' ? 'bg-green-500' :
                          'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {activity.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.timestamp), 'HH:mm:ss')}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">
                            {activity.action === 'user_blocked' && (
                              <>Usuário <span data-no-translate>{activity.details.blockedUsername}</span> foi bloqueado</>
                            )}
                            {activity.action === 'user_unblocked' && (
                              <>Usuário <span data-no-translate>{activity.details.unblockedUsername}</span> foi desbloqueado</>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.action === 'user_blocked' && (
                              <>Por <span data-no-translate>{activity.details.blockedBy}</span> - <span data-no-translate>{activity.details.reason}</span></>
                            )}
                            {activity.action === 'user_unblocked' && (
                              <>Por <span data-no-translate>{activity.details.unblockedBy}</span></>
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* WebSocket Messages Debug */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Mensagens WebSocket</span>
                  <Badge variant="outline" className="ml-2">
                    {messages.length} mensagens
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Informações de depuração da comunicação WebSocket
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhuma mensagem WebSocket</p>
                      <p className="text-sm">As mensagens aparecerão aqui quando recebidas</p>
                    </div>
                  ) : (
                    messages.slice(-20).reverse().map((message, index) => (
                      <div
                        key={index}
                        className="p-2 bg-muted/30 rounded text-xs font-mono"
                        data-testid={`websocket-message-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {message.type}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(new Date(), 'HH:mm:ss')}
                          </span>
                        </div>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Collaborators Tab */}
        <TabsContent value="collaborators" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Colaboradores Externos</CardTitle>
                  <CardDescription>
                    Gerencie farmácias, laboratórios e hospitais integrados ao sistema
                  </CardDescription>
                </div>
                <Dialog open={showCreateCollaborator} onOpenChange={setShowCreateCollaborator}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-collaborator">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Colaborador
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Criar Novo Colaborador</DialogTitle>
                      <DialogDescription>
                        Adicione uma nova farmácia, laboratório ou hospital ao sistema
                      </DialogDescription>
                    </DialogHeader>
                    <CreateCollaboratorForm 
                      onSubmit={(data) => createCollaboratorMutation.mutate(data)}
                      isLoading={createCollaboratorMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCollaborators ? (
                <div className="text-center py-8">Carregando colaboradores...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>CNES</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(collaborators as Collaborator[]).map((collaborator: Collaborator) => (
                      <TableRow key={collaborator.id} data-testid={`collaborator-row-${collaborator.id}`}>
                        <TableCell className="font-medium" data-no-translate>{collaborator.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{collaborator.type}</Badge>
                        </TableCell>
                        <TableCell>{collaborator.cnpj}</TableCell>
                        <TableCell>{collaborator.cnes}</TableCell>
                        <TableCell>
                          <Badge variant={collaborator.isActive ? 'default' : 'secondary'}>
                            {collaborator.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(collaborator.createdAt), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gestão de Chaves de API</CardTitle>
                  <CardDescription>
                    Gere e gerencie chaves de API para acesso de colaboradores
                  </CardDescription>
                </div>
                <Dialog open={showCreateApiKey} onOpenChange={setShowCreateApiKey}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-api-key">
                      <Plus className="h-4 w-4 mr-2" />
                      Gerar Chave de API
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Gerar Nova Chave de API</DialogTitle>
                      <DialogDescription>
                        Crie uma nova chave de API para acesso de colaboradores
                      </DialogDescription>
                    </DialogHeader>
                    <CreateApiKeyForm 
                      collaborators={collaborators as Collaborator[]}
                      onSubmit={(data) => createApiKeyMutation.mutate(data)}
                      isLoading={createApiKeyMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingApiKeys ? (
                <div className="text-center py-8">Carregando chaves de API...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Chave</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Chave de API</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último Uso</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apiKeys as ApiKey[]).map((apiKey: ApiKey) => {
                      const collaborator = (collaborators as Collaborator[]).find((c: Collaborator) => c.id === apiKey.collaboratorId);
                      return (
                        <TableRow key={apiKey.id} data-testid={`api-key-row-${apiKey.id}`}>
                          <TableCell className="font-medium" data-no-translate>{apiKey.keyName}</TableCell>
                          <TableCell data-no-translate>{collaborator?.name || 'Desconhecido'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <code className="px-2 py-1 bg-muted rounded text-sm">
                                {showApiKey[apiKey.id] ? apiKey.hashedKey : '••••••••••••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleShowApiKey(apiKey.id)}
                                data-testid={`button-toggle-key-${apiKey.id}`}
                              >
                                {showApiKey[apiKey.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(apiKey.hashedKey)}
                                data-testid={`button-copy-key-${apiKey.id}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                              {apiKey.isActive ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {apiKey.lastUsed ? format(new Date(apiKey.lastUsed), 'dd/MM/yyyy HH:mm') : 'Nunca'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleApiKeyMutation.mutate({ 
                                keyId: apiKey.id, 
                                isActive: !apiKey.isActive 
                              })}
                              data-testid={`button-toggle-status-${apiKey.id}`}
                            >
                              {apiKey.isActive ? 'Desativar' : 'Ativar'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Atividade de Integrações</CardTitle>
              <CardDescription>
                Monitore todos os eventos de integração e uso da API
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingIntegrations ? (
                <div className="text-center py-8">Carregando registros de integração...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(integrations as CollaboratorIntegration[]).slice(0, 50).map((integration: CollaboratorIntegration) => (
                      <TableRow key={integration.id} data-testid={`integration-row-${integration.id}`}>
                        <TableCell>{format(new Date(integration.createdAt), 'dd/MM HH:mm:ss')}</TableCell>
                        <TableCell data-no-translate>{integration.collaboratorName || 'Desconhecido'}</TableCell>
                        <TableCell>
                          <Badge className={getIntegrationTypeColor(integration.integrationType)}>
                            {integration.integrationType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{integration.action}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(integration.status)}>
                            {integration.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {integration.errorMessage && (
                            <span className="text-red-600 text-sm">{integration.errorMessage}</span>
                          )}
                          {integration.requestData && (
                            <details className="cursor-pointer">
                              <summary className="text-sm text-muted-foreground">Ver dados</summary>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-w-xs">
                                {formatJsonData(integration.requestData)}
                              </pre>
                            </details>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unplug className="h-5 w-5 text-red-500" />
                Controle de Conexões
              </CardTitle>
              <CardDescription>
                Desconectar sessões ativas de usuários, médicos ou todos os serviços (WebSocket + Agora)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-yellow-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-yellow-600" />
                      <h4 className="font-semibold">Todos os Usuários</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Encerra todas as conexões WebSocket ativas exceto a do administrador atual.</p>
                    {disconnectConfirm === 'users' ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-600">Confirma a desconexão de todos os usuários?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => disconnectAllUsersMutation.mutate()}
                            disabled={disconnectAllUsersMutation.isPending}
                          >
                            {disconnectAllUsersMutation.isPending ? 'Desconectando...' : 'Confirmar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDisconnectConfirm(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-yellow-500/50 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                        onClick={() => setDisconnectConfirm('users')}
                      >
                        <Unplug className="h-4 w-4 mr-2" />
                        Desconectar Todos os Usuários
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-orange-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-orange-600" />
                      <h4 className="font-semibold">Todos os Médicos</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Encerra apenas as conexões WebSocket de usuários identificados como médicos.</p>
                    {disconnectConfirm === 'doctors' ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-600">Confirma a desconexão de todos os médicos?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => disconnectAllDoctorsMutation.mutate()}
                            disabled={disconnectAllDoctorsMutation.isPending}
                          >
                            {disconnectAllDoctorsMutation.isPending ? 'Desconectando...' : 'Confirmar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDisconnectConfirm(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-orange-500/50 text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                        onClick={() => setDisconnectConfirm('doctors')}
                      >
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Desconectar Todos os Médicos
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-red-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ServerCrash className="h-5 w-5 text-red-600" />
                      <h4 className="font-semibold">Todos os Serviços</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Encerra todas as conexões WebSocket E notifica todas as salas de consulta para desconectar Agora.</p>
                    {disconnectConfirm === 'services' ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-600">Confirma a desconexão de TODOS os serviços? Isto afetará todas as consultas ativas.</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => disconnectAllServicesMutation.mutate()}
                            disabled={disconnectAllServicesMutation.isPending}
                          >
                            {disconnectAllServicesMutation.isPending ? 'Desconectando...' : 'Confirmar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDisconnectConfirm(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-red-500/50 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => setDisconnectConfirm('services')}
                      >
                        <ServerCrash className="h-4 w-4 mr-2" />
                        Desconectar Todos os Serviços
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eventos de Segurança</CardTitle>
              <CardDescription>
                Monitore falhas de autenticação, violações de limite de requisições e alertas de segurança
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo de Evento</TableHead>
                    <TableHead>Endereço IP</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Severidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(integrations as CollaboratorIntegration[])
                    .filter((i: CollaboratorIntegration) => 
                      i.status === 'failed' || 
                      i.integrationType === 'authorization_violation' ||
                      i.action.includes('failed')
                    )
                    .slice(0, 20)
                    .map((event: CollaboratorIntegration) => (
                      <TableRow key={event.id} data-testid={`security-event-row-${event.id}`}>
                        <TableCell>{format(new Date(event.createdAt), 'dd/MM HH:mm:ss')}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {event.integrationType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {event.requestData?.clientIp || 'Desconhecido'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {event.errorMessage || event.action}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            event.integrationType === 'authorization_violation' ? 'destructive' : 'secondary'
                          }>
                            {event.integrationType === 'authorization_violation' ? 'Alta' : 'Média'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI References Tab */}
        <TabsContent value="ai-references" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documentos de Referência de IA</CardTitle>
              <CardDescription>
                Envie e gerencie documentos PDF de referência para o assistente de diagnóstico de IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload PDF Section */}
              <div className="border-2 border-dashed rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Enviar Nova Referência em PDF</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pdf-upload">Arquivo PDF (máx. 20MB)</Label>
                    <Input 
                      id="pdf-upload" 
                      type="file" 
                      accept=".pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const formData = new FormData();
                        formData.append('pdfFile', file);
                        
                        try {
                          const response = await fetch('/api/chatbot-references/upload-pdf', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                          });
                          
                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(`${response.status}: ${JSON.stringify(errorData)}`);
                          }
                          
                          const data = await response.json();
                          setUploadedPdfData(data);
                          // Auto-fill content with extracted text preview (first 500 chars)
                          if (data.extractedText) {
                            const preview = data.extractedText.substring(0, 500);
                            setRefContent(preview + (data.extractedText.length > 500 ? '...' : ''));
                          }
                          toast({
                            title: "PDF Carregado",
                            description: `Arquivo ${data.filename} carregado com sucesso. Texto extraído automaticamente.`,
                          });
                        } catch (error) {
                          const errorInfo = formatErrorForToast(error);
                          toast({
                            title: errorInfo.title,
                            description: errorInfo.description,
                            variant: "destructive"
                          });
                        }
                      }}
                      data-testid="input-pdf-upload"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ref-title">Título da Referência</Label>
                    <Input 
                      id="ref-title" 
                      placeholder="ex.: Diretrizes Clínicas de Diabetes 2024"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      data-testid="input-ref-title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ref-content">Conteúdo/Resumo</Label>
                    <textarea 
                      id="ref-content" 
                      className="w-full min-h-[100px] p-2 border rounded-md"
                      placeholder="Forneça um resumo ou pontos-chave do PDF..."
                      value={refContent}
                      onChange={(e) => setRefContent(e.target.value)}
                      data-testid="input-ref-content"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ref-category">Categoria</Label>
                    <Select value={refCategory} onValueChange={setRefCategory}>
                      <SelectTrigger id="ref-category" data-testid="select-ref-category">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medical">Médica</SelectItem>
                        <SelectItem value="procedural">Procedimental</SelectItem>
                        <SelectItem value="emergency">Emergência</SelectItem>
                        <SelectItem value="diagnostic">Diagnóstica</SelectItem>
                        <SelectItem value="general">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={async () => {
                      if (!uploadedPdfData) {
                        toast({
                          title: "Nenhum PDF",
                          description: "Por favor, faça upload de um PDF primeiro",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      if (!refTitle || !refContent) {
                        toast({
                          title: "Campos obrigatórios",
                          description: "Por favor, preencha título e conteúdo",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      try {
                        const response = await fetch('/api/chatbot-references', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            title: refTitle,
                            content: refContent,
                            category: refCategory || 'general',
                            sourceType: 'pdf',
                            fileUrl: uploadedPdfData.fileUrl,
                            fileName: uploadedPdfData.filename,
                            fileSize: uploadedPdfData.fileSize,
                            pdfExtractedText: uploadedPdfData.extractedText,
                            language: 'pt-BR',
                            allowedRoles: ['admin', 'doctor', 'patient'],
                            useForDiagnostics: true,
                            priority: 1,
                            isActive: true
                          })
                        });
                        
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(`${response.status}: ${JSON.stringify(errorData)}`);
                        }
                        
                        toast({
                          title: "Referência Criada",
                          description: "Documento de referência de IA criado com sucesso"
                        });
                        
                        // Clear form
                        setRefTitle('');
                        setRefContent('');
                        setRefCategory('');
                        setUploadedPdfData(null);
                        (document.getElementById('pdf-upload') as HTMLInputElement).value = '';
                        
                        queryClient.invalidateQueries({ queryKey: ['/api/chatbot-references'] });
                      } catch (error) {
                        const errorInfo = formatErrorForToast(error);
                        toast({
                          title: errorInfo.title,
                          description: errorInfo.description,
                          variant: "destructive"
                        });
                      }
                    }}
                    data-testid="button-create-reference"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Referência
                  </Button>
                </div>
              </div>

              {/* References List */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Referências Existentes</h3>
                <AIReferencesTable />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Logs Tab */}
        <TabsContent value="error-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Erro do Sistema</CardTitle>
              <CardDescription>Visualize e gerencie logs de erro da plataforma</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Erro</Label>
                  <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
                    <SelectTrigger data-testid="select-error-type-filter">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="authentication">Autenticação</SelectItem>
                      <SelectItem value="validation">Validação</SelectItem>
                      <SelectItem value="database">Banco de Dados</SelectItem>
                      <SelectItem value="external_api">API Externa</SelectItem>
                      <SelectItem value="permission">Permissão</SelectItem>
                      <SelectItem value="not_found">Não Encontrado</SelectItem>
                      <SelectItem value="internal">Interno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                    <SelectTrigger data-testid="select-resolved-filter">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="false">Não Resolvidos</SelectItem>
                      <SelectItem value="true">Resolvidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estatísticas</Label>
                  <div className="p-2 border rounded-md">
                    <div className="text-sm">
                      <span className="font-medium">Total: </span>
                      {(errorLogs as ErrorLog[]).length}
                    </div>
                    <div className="text-sm text-red-600">
                      <span className="font-medium">Não Resolvidos: </span>
                      {(errorLogs as ErrorLog[]).filter((log: ErrorLog) => !log.resolved).length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Logs Table */}
              {loadingErrorLogs ? (
                <div className="text-center py-8">Carregando logs de erro...</div>
              ) : (errorLogs as ErrorLog[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log de erro encontrado
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(errorLogs as ErrorLog[]).map((log: ErrorLog) => (
                        <TableRow key={log.id} data-testid={`error-log-${log.id}`}>
                          <TableCell className="font-mono text-xs">{log.errorCode}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {log.errorType.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">
                            {log.endpoint || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {log.userMessage}
                          </TableCell>
                          <TableCell>
                            {log.resolved ? (
                              <Badge variant="default">Resolvido</Badge>
                            ) : (
                              <Badge variant="destructive">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedErrorLog(log);
                                setShowErrorDetails(true);
                              }}
                              data-testid={`button-view-error-${log.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Details Dialog */}
          <Dialog open={showErrorDetails} onOpenChange={setShowErrorDetails}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Detalhes do Erro</DialogTitle>
                <DialogDescription>
                  Código: {selectedErrorLog?.errorCode}
                </DialogDescription>
              </DialogHeader>

              {selectedErrorLog && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold">Tipo de Erro</Label>
                      <p className="text-sm capitalize">{selectedErrorLog.errorType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Status</Label>
                      <p className="text-sm">
                        {selectedErrorLog.resolved ? (
                          <Badge variant="default">Resolvido</Badge>
                        ) : (
                          <Badge variant="destructive">Pendente</Badge>
                        )}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Endpoint</Label>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {selectedErrorLog.method} {selectedErrorLog.endpoint || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Mensagem para Usuário</Label>
                    <p className="text-sm bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      {selectedErrorLog.userMessage}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Mensagem Técnica</Label>
                    <p className="text-sm font-mono bg-red-50 dark:bg-red-950 p-3 rounded text-red-900 dark:text-red-100">
                      {selectedErrorLog.technicalMessage}
                    </p>
                  </div>

                  {selectedErrorLog.stackTrace && (
                    <div>
                      <Label className="text-sm font-semibold">Stack Trace</Label>
                      <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto max-h-[200px]">
                        {selectedErrorLog.stackTrace}
                      </pre>
                    </div>
                  )}

                  {selectedErrorLog.context && (
                    <div>
                      <Label className="text-sm font-semibold">Contexto</Label>
                      <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
                        {JSON.stringify(selectedErrorLog.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold">IP Address</Label>
                      <p className="text-sm font-mono">{selectedErrorLog.ipAddress || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">User Agent</Label>
                      <p className="text-xs truncate">{selectedErrorLog.userAgent || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Data</Label>
                    <p className="text-sm">
                      {format(new Date(selectedErrorLog.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss")}
                    </p>
                  </div>

                  {selectedErrorLog.resolved && (
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded">
                      <Label className="text-sm font-semibold">Resolução</Label>
                      <p className="text-sm mt-2">
                        Resolvido em: {selectedErrorLog.resolvedAt ? format(new Date(selectedErrorLog.resolvedAt), "dd/MM/yyyy 'às' HH:mm") : 'N/A'}
                      </p>
                      {selectedErrorLog.adminNotes && (
                        <div className="mt-2">
                          <Label className="text-xs font-semibold">Observações do Admin</Label>
                          <p className="text-sm mt-1">{selectedErrorLog.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedErrorLog.resolved && (
                    <div className="space-y-2">
                      <Label htmlFor="resolve-notes">Observações da Resolução (opcional)</Label>
                      <Input
                        id="resolve-notes"
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                        placeholder="Adicione observações sobre como o erro foi resolvido"
                        data-testid="input-resolve-notes"
                      />
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                {selectedErrorLog && !selectedErrorLog.resolved && (
                  <Button
                    onClick={() => {
                      if (selectedErrorLog) {
                        resolveErrorMutation.mutate({
                          errorId: selectedErrorLog.id,
                          adminNotes: resolveNotes || undefined
                        });
                      }
                    }}
                    disabled={resolveErrorMutation.isPending}
                    data-testid="button-resolve-error"
                  >
                    {resolveErrorMutation.isPending ? 'Resolvendo...' : 'Marcar como Resolvido'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowErrorDetails(false)}
                  data-testid="button-close-error-details"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Layout & Theme Tab */}
        <LayoutThemeTab />

        {/* Financial Management Tab */}
        <FinancialManagementTab />

        {/* Database Cleanup Tab */}
        <DatabaseCleanupTab />

        {/* System Settings Tab */}
        <SystemSettingsTab />

        {/* Post-Load Settings Tab (permanent admins only) */}
        {isPermanentAdmin && <PostLoadSettingsTab />}
      </Tabs>
      </div>
    </PageWrapper>
  );
}

// AI References Table Component
function AIReferencesTable() {
  const { toast } = useToast();
  const { data: references = [], isLoading } = useQuery({
    queryKey: ['/api/chatbot-references'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/chatbot-references/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Falha ao excluir a referência');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Referência Excluída",
        description: "Documento de referência de IA excluído com sucesso"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot-references'] });
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return <div>Carregando referências...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Tipo de Fonte</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(references as any[]).map((ref) => (
          <TableRow key={ref.id} data-testid={`ref-row-${ref.id}`}>
            <TableCell className="font-medium">{ref.title}</TableCell>
            <TableCell>
              <Badge>{ref.category}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{ref.sourceType}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={ref.isActive ? "default" : "secondary"}>
                {ref.isActive ? "Ativa" : "Inativa"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                {ref.fileUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(ref.fileUrl, '_blank')}
                    data-testid={`button-view-${ref.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(ref.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${ref.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Create Collaborator Form Component
function CreateCollaboratorForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    email: '',
    phone: '',
    address: '',
    cnpj: '',
    cnes: '',
    specialization: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            data-testid="input-collaborator-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger data-testid="select-collaborator-type">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pharmacy">Farmácia</SelectItem>
              <SelectItem value="laboratory">Laboratório</SelectItem>
              <SelectItem value="hospital">Hospital</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            data-testid="input-collaborator-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
            data-testid="input-collaborator-phone"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
          data-testid="input-collaborator-address"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={formData.cnpj}
            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
            placeholder="XX.XXX.XXX/XXXX-XX"
            required
            data-testid="input-collaborator-cnpj"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnes">CNES</Label>
          <Input
            id="cnes"
            value={formData.cnes}
            onChange={(e) => setFormData({ ...formData, cnes: e.target.value })}
            placeholder="XXXXXXX"
            required
            data-testid="input-collaborator-cnes"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="button-submit-collaborator">
          {isLoading ? 'Criando...' : 'Criar Colaborador'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Create API Key Form Component
function CreateApiKeyForm({ 
  collaborators, 
  onSubmit, 
  isLoading 
}: { 
  collaborators: Collaborator[]; 
  onSubmit: (data: any) => void; 
  isLoading: boolean; 
}) {
  const [formData, setFormData] = useState({
    collaboratorId: '',
    keyName: '',
    permissions: [] as string[],
    ipWhitelist: [] as string[],
    rateLimit: 1000,
    expiresAt: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="collaborator">Colaborador</Label>
        <Select 
          value={formData.collaboratorId} 
          onValueChange={(value) => setFormData({ ...formData, collaboratorId: value })}
        >
          <SelectTrigger data-testid="select-api-key-collaborator">
            <SelectValue placeholder="Selecione o colaborador" />
          </SelectTrigger>
          <SelectContent>
            {collaborators.map((collaborator: Collaborator) => (
              <SelectItem data-no-translate key={collaborator.id} value={collaborator.id}>
                {collaborator.name} ({collaborator.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keyName">Nome da Chave</Label>
        <Input
          id="keyName"
          value={formData.keyName}
          onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
          placeholder="Chave de API de Produção"
          required
          data-testid="input-api-key-name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rateLimit">Limite de Requisições (por hora)</Label>
          <Input
            id="rateLimit"
            type="number"
            value={formData.rateLimit}
            onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
            min="1"
            data-testid="input-api-key-rate-limit"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Data de Expiração (opcional)</Label>
          <Input
            id="expiresAt"
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            data-testid="input-api-key-expiration"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="button-submit-api-key">
          {isLoading ? 'Gerando...' : 'Gerar Chave de API'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface SystemSetting {
  id: string;
  settingKey: string;
  settingValue: string;
  settingType: string;
  description: string | null;
  category: string;
  isEditable: boolean;
  updatedAt: string;
}

const categoryLabels: Record<string, string> = {
  access: "Acesso",
  consultations: "Consultas",
  ai: "Inteligência Artificial",
  notifications: "Notificações",
  prescriptions: "Prescrições",
  financial: "Financeiro",
  general: "Geral",
  pharmacy: "Farmácia",
  postload: "Pós-Carregamento",
};

function LayoutThemeTab() {
  const { toast } = useToast();

  const { data: layoutSettings, isLoading } = useQuery<any[]>({
    queryKey: ['/api/layout-settings/public'],
  });

  const currentMobileMenuStyle = (() => {
    if (!layoutSettings) return 'sidebar';
    const s = layoutSettings.find((ls: any) => ls.settingKey === 'mobile_menu_style');
    return s?.settingValue || 'sidebar';
  })();

  const saveSetting = useMutation({
    mutationFn: async ({ key, value, type, category, description }: { key: string; value: string; type: string; category: string; description: string }) => {
      await apiRequest('POST', '/api/admin/layout-settings', {
        settingKey: key,
        settingValue: value,
        settingType: type,
        category,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/layout-settings/public'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/layout-settings'] });
      toast({ title: 'Configuração salva', description: 'A configuração de layout foi atualizada.' });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível salvar a configuração.', variant: 'destructive' });
    },
  });

  const menuStyles = [
    {
      value: 'sidebar',
      label: 'Sidebar Lateral',
      description: 'Menu lateral fixo que empurra o conteúdo. Pode ser expandido ou recolhido (somente ícones). Ideal para navegação rápida sem sobrepor a tela.',
      icon: '◫',
    },
    {
      value: 'slide',
      label: 'Slide-out (Deslizante)',
      description: 'Menu que desliza da esquerda e sobrepõe o conteúdo. Estilo clássico de apps mobile com sobreposição escura.',
      icon: '☰',
    },
    {
      value: 'bottom',
      label: 'Barra Inferior',
      description: 'Navegação fixa na parte inferior da tela com os itens principais. Itens adicionais ficam no botão "Mais". Estilo iOS/Android.',
      icon: '▂',
    },
  ];

  return (
    <TabsContent value="layout-theme" className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Layout
          </CardTitle>
          <CardDescription className="text-gray-400">
            Personalize a aparência e comportamento do sistema para todos os usuários.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-white text-sm font-semibold mb-3 block">
              Estilo do Menu Mobile
            </Label>
            <p className="text-xs text-gray-400 mb-4">
              Define como o menu de navegação é exibido em dispositivos móveis (telas menores que 768px). Essa configuração não afeta a visualização desktop.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {menuStyles.map((style) => (
                <div
                  key={style.value}
                  onClick={() => saveSetting.mutate({
                    key: 'mobile_menu_style',
                    value: style.value,
                    type: 'text',
                    category: 'layout',
                    description: 'Estilo do menu de navegação mobile',
                  })}
                  className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-lg ${
                    currentMobileMenuStyle === style.value
                      ? 'border-primary bg-primary/10 shadow-primary/20 shadow-md'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  {currentMobileMenuStyle === style.value && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="text-3xl mb-2">{style.icon}</div>
                  <h4 className="text-white font-semibold text-sm mb-1">{style.label}</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">{style.description}</p>

                  {style.value === 'sidebar' && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <div className="w-16 h-10 rounded border border-white/20 flex">
                        <div className="w-4 bg-primary/30 rounded-l flex flex-col items-center justify-center gap-0.5">
                          <div className="w-2 h-0.5 bg-white/40 rounded" />
                          <div className="w-2 h-0.5 bg-white/40 rounded" />
                          <div className="w-2 h-0.5 bg-white/40 rounded" />
                        </div>
                        <div className="flex-1 bg-white/5 p-1">
                          <div className="w-full h-1 bg-white/10 rounded mb-0.5" />
                          <div className="w-3/4 h-1 bg-white/10 rounded" />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500">Recolhível</span>
                    </div>
                  )}
                  {style.value === 'slide' && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <div className="w-16 h-10 rounded border border-white/20 relative overflow-hidden">
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-white/20 border-r border-white/20 p-0.5">
                          <div className="w-full h-1 bg-white/30 rounded mb-0.5" />
                          <div className="w-full h-1 bg-white/30 rounded mb-0.5" />
                          <div className="w-full h-1 bg-white/30 rounded" />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500">Sobreposição</span>
                    </div>
                  )}
                  {style.value === 'bottom' && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <div className="w-16 h-10 rounded border border-white/20 flex flex-col">
                        <div className="flex-1 bg-white/5 p-1">
                          <div className="w-full h-1 bg-white/10 rounded mb-0.5" />
                          <div className="w-3/4 h-1 bg-white/10 rounded" />
                        </div>
                        <div className="h-2.5 bg-primary/20 border-t border-white/20 flex items-center justify-around px-1">
                          <div className="w-1 h-1 bg-white/40 rounded-full" />
                          <div className="w-1 h-1 bg-white/40 rounded-full" />
                          <div className="w-1 h-1 bg-white/40 rounded-full" />
                          <div className="w-1 h-1 bg-white/40 rounded-full" />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500">Barra fixa</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {saveSetting.isPending && (
              <p className="text-xs text-primary mt-2 flex items-center gap-1">
                <span className="animate-spin">⏳</span> Salvando...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Tema por Perfil de Usuário
          </CardTitle>
          <CardDescription className="text-gray-400">
            Configure cores e aparência distintas para cada papel de usuário no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { role: 'admin', label: 'Administrador', desc: 'Tema escuro padrão com gradiente indigo/slate', color: 'bg-indigo-500' },
            { role: 'doctor', label: 'Médico', desc: 'Tons profissionais e confiáveis', color: 'bg-sky-500' },
            { role: 'patient', label: 'Paciente', desc: 'Interface acessível e acolhedora', color: 'bg-emerald-500' },
            { role: 'pharmacist', label: 'Farmacêutico', desc: 'Cores de confiança e saúde', color: 'bg-teal-500' },
            { role: 'researcher', label: 'Pesquisador', desc: 'Interface analítica e focada em dados', color: 'bg-violet-500' },
          ].map((item) => {
            const colorFields = [
              { suffix: 'accent', label: 'Destaque', defaultVal: '#6366f1' },
              { suffix: 'panel_bg', label: 'Painel BG', defaultVal: '#1e293b' },
              { suffix: 'text', label: 'Texto', defaultVal: '#e2e8f0' },
              { suffix: 'titlebar', label: 'Barra Título', defaultVal: '#0f172a' },
              { suffix: 'icon', label: 'Ícones', defaultVal: '#38bdf8' },
            ];
            return (
              <div key={item.role} className="p-3 rounded-lg bg-white/[0.04] border border-white/5 space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {item.label[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pl-11">
                  {colorFields.map((cf) => {
                    const settingKey = `theme_${cf.suffix}_${item.role}`;
                    const currentSetting = layoutSettings?.find((s: { settingKey: string; settingValue: string }) => s.settingKey === settingKey);
                    const currentColor = currentSetting?.settingValue || cf.defaultVal;
                    return (
                      <div key={cf.suffix} className="flex items-center gap-1.5">
                        <Input
                          type="color"
                          className="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent rounded"
                          defaultValue={currentColor}
                          onBlur={(e) => {
                            saveSetting.mutate({
                              key: settingKey,
                              value: e.target.value,
                              type: 'text',
                              category: 'theme',
                              description: `${cf.label} para ${item.label}`,
                            });
                          }}
                        />
                        <span className="text-[10px] text-gray-400">{cf.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Transparência Desktop
          </CardTitle>
          <CardDescription className="text-gray-400">
            Ajuste a opacidade das janelas no ambiente desktop. Valores mais baixos deixam o fundo mais visível.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'desktop_glass_opacity', label: 'Janelas (Glass)', desc: 'Opacidade das janelas flutuantes', defaultVal: '72' },
            { key: 'desktop_titlebar_opacity', label: 'Barra de Título', desc: 'Contraste da barra de título das janelas', defaultVal: '45' },
          ].map((item) => {
            const currentSetting = layoutSettings?.find((s: { settingKey: string; settingValue: string }) => s.settingKey === item.key);
            const currentVal = currentSetting?.settingValue || item.defaultVal;
            return (
              <div key={item.key} className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="range"
                    min="30"
                    max="100"
                    defaultValue={currentVal}
                    className="w-24 accent-primary"
                    onMouseUp={(e) => {
                      saveSetting.mutate({
                        key: item.key,
                        value: (e.target as HTMLInputElement).value,
                        type: 'number',
                        category: 'theme',
                        description: item.desc,
                      });
                    }}
                  />
                  <span className="text-xs text-gray-400 w-8 text-right">{currentVal}%</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function SystemSettingsTab() {
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: settings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['/api/system-settings'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest('PUT', `/api/system-settings/${key}`, { settingValue: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
      setEditingKey(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: formatErrorForToast(error), variant: "destructive" });
    },
  });

  const startEdit = (setting: SystemSetting) => {
    setEditingKey(setting.settingKey);
    setEditValue(setting.settingValue);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const saveEdit = (key: string) => {
    updateMutation.mutate({ key, value: editValue });
  };

  const categories = [...new Set((settings || []).map(s => s.category))];
  const filtered = filterCategory === 'all' 
    ? settings || [] 
    : (settings || []).filter(s => s.category === filterCategory);

  const grouped = filtered.reduce<Record<string, SystemSetting[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const renderValueInput = (setting: SystemSetting) => {
    if (setting.settingType === 'boolean') {
      return (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ativado</SelectItem>
            <SelectItem value="false">Desativado</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input 
        value={editValue} 
        onChange={e => setEditValue(e.target.value)}
        type={setting.settingType === 'number' ? 'number' : 'text'}
        className="w-32"
      />
    );
  };

  const renderValueDisplay = (setting: SystemSetting) => {
    if (setting.settingType === 'boolean') {
      return (
        <Badge variant={setting.settingValue === 'true' ? 'default' : 'secondary'}>
          {setting.settingValue === 'true' ? 'Ativado' : 'Desativado'}
        </Badge>
      );
    }
    return <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{setting.settingValue}</span>;
  };

  return (
    <TabsContent value="system-settings" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>Configurações do Sistema</span>
              </CardTitle>
              <CardDescription>
                Gerencie parâmetros de configuração do sistema como períodos de validade, limites e funcionalidades
              </CardDescription>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{categoryLabels[cat] || cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>
          ) : !settings?.length ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma configuração encontrada</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="border rounded-lg divide-y">
                    {items.map(setting => (
                      <div key={setting.settingKey} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{setting.description || setting.settingKey}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{setting.settingKey}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {editingKey === setting.settingKey ? (
                            <>
                              {renderValueInput(setting)}
                              <Button size="sm" onClick={() => saveEdit(setting.settingKey)} disabled={updateMutation.isPending}>
                                <Shield className="h-3 w-3 mr-1" />
                                Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              {renderValueDisplay(setting)}
                              {setting.isEditable && (
                                <Button size="sm" variant="ghost" onClick={() => startEdit(setting)}>
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

interface PostLoadScript {
  name: string;
  code: string;
  enabled: boolean;
  order: number;
}

function PostLoadSettingsTab() {
  const { toast } = useToast();
  const [scripts, setScripts] = useState<PostLoadScript[]>([]);
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [newScriptCode, setNewScriptCode] = useState('');
  const [editingScript, setEditingScript] = useState<number | null>(null);
  const [editScriptName, setEditScriptName] = useState('');
  const [editScriptCode, setEditScriptCode] = useState('');

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['/api/system-settings/public/postload'],
  });

  useEffect(() => {
    if (settings?.postload_custom_scripts) {
      try {
        const parsed = JSON.parse(settings.postload_custom_scripts);
        if (Array.isArray(parsed)) setScripts(parsed);
      } catch {}
    }
  }, [settings]);

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest('PUT', `/api/system-settings/${key}`, { settingValue: value });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configuração atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/public/postload'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings'] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: formatErrorForToast(error), variant: "destructive" });
    },
  });

  const autoscrollEnabled = settings?.postload_autoscroll_enabled === 'true';
  const autoscrollDistance = settings?.postload_autoscroll_distance || '5';
  const autoscrollDelay = settings?.postload_autoscroll_delay_ms || '300';
  const autoscrollReturnDelay = settings?.postload_autoscroll_return_delay_ms || '150';
  const customScriptsEnabled = settings?.postload_custom_scripts_enabled === 'true';

  const saveScripts = (updated: PostLoadScript[]) => {
    setScripts(updated);
    updateSetting.mutate({ key: 'postload_custom_scripts', value: JSON.stringify(updated) });
  };

  const addScript = () => {
    if (!newScriptName.trim() || !newScriptCode.trim()) return;
    const updated = [...scripts, { name: newScriptName.trim(), code: newScriptCode.trim(), enabled: true, order: scripts.length }];
    saveScripts(updated);
    setNewScriptName('');
    setNewScriptCode('');
    setShowAddScript(false);
  };

  const removeScript = (idx: number) => {
    const updated = scripts.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
    saveScripts(updated);
  };

  const toggleScript = (idx: number) => {
    const updated = scripts.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s);
    saveScripts(updated);
  };

  const moveScript = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= scripts.length) return;
    const updated = [...scripts];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    saveScripts(updated.map((s, i) => ({ ...s, order: i })));
  };

  const startEditScript = (idx: number) => {
    setEditingScript(idx);
    setEditScriptName(scripts[idx].name);
    setEditScriptCode(scripts[idx].code);
  };

  const saveEditScript = () => {
    if (editingScript === null) return;
    const updated = scripts.map((s, i) => i === editingScript ? { ...s, name: editScriptName.trim(), code: editScriptCode.trim() } : s);
    saveScripts(updated);
    setEditingScript(null);
  };

  return (
    <TabsContent value="postload-settings" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ScrollText className="h-5 w-5" />
            <span>Configurações Pós-Carregamento</span>
          </CardTitle>
          <CardDescription>
            Configure comportamentos executados automaticamente após o carregamento de cada página.
            Apenas administradores permanentes podem modificar estas configurações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>
          ) : (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  Rolagem Automática
                </h3>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Ativar rolagem automática</p>
                      <p className="text-xs text-muted-foreground">
                        Rolar a página para baixo e retornar ao topo após carregamento
                      </p>
                    </div>
                    <Switch
                      checked={autoscrollEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting.mutate({ key: 'postload_autoscroll_enabled', value: String(checked) })
                      }
                    />
                  </div>

                  {autoscrollEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs">Distância (pixels)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="500"
                          value={autoscrollDistance}
                          onChange={(e) =>
                            updateSetting.mutate({ key: 'postload_autoscroll_distance', value: e.target.value })
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground">Pixels para rolar para baixo</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Atraso inicial (ms)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="5000"
                          value={autoscrollDelay}
                          onChange={(e) =>
                            updateSetting.mutate({ key: 'postload_autoscroll_delay_ms', value: e.target.value })
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground">Espera antes de rolar (ms)</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Atraso de retorno (ms)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="5000"
                          value={autoscrollReturnDelay}
                          onChange={(e) =>
                            updateSetting.mutate({ key: 'postload_autoscroll_return_delay_ms', value: e.target.value })
                          }
                          className="w-full"
                        />
                        <p className="text-[10px] text-muted-foreground">Espera antes de voltar ao topo (ms)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Scripts Personalizados
                </h3>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Ativar scripts personalizados</p>
                      <p className="text-xs text-muted-foreground">
                        Executar código JavaScript customizado após o carregamento da página
                      </p>
                    </div>
                    <Switch
                      checked={customScriptsEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting.mutate({ key: 'postload_custom_scripts_enabled', value: String(checked) })
                      }
                    />
                  </div>

                  {customScriptsEnabled && (
                    <div className="space-y-3 pt-2 border-t">
                      {scripts.length === 0 && !showAddScript && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum script configurado. Adicione um novo script abaixo.
                        </p>
                      )}

                      {scripts.map((script, idx) => (
                        <div key={idx} className="border rounded-md p-3 space-y-2">
                          {editingScript === idx ? (
                            <div className="space-y-2">
                              <Input
                                value={editScriptName}
                                onChange={(e) => setEditScriptName(e.target.value)}
                                placeholder="Nome do script"
                              />
                              <Textarea
                                value={editScriptCode}
                                onChange={(e) => setEditScriptCode(e.target.value)}
                                placeholder="Código JavaScript..."
                                className="font-mono text-xs min-h-[80px]"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveEditScript}>Salvar</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingScript(null)}>Cancelar</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{script.name}</span>
                                  <Badge variant={script.enabled ? 'default' : 'secondary'} className="text-[10px]">
                                    {script.enabled ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveScript(idx, -1)} disabled={idx === 0}>
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveScript(idx, 1)} disabled={idx === scripts.length - 1}>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleScript(idx)}>
                                    {script.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditScript(idx)}>
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeScript(idx)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <pre className="text-[11px] font-mono bg-muted p-2 rounded overflow-x-auto max-h-20">
                                {script.code}
                              </pre>
                            </>
                          )}
                        </div>
                      ))}

                      {showAddScript ? (
                        <div className="border rounded-md p-3 space-y-2 border-dashed border-primary/50">
                          <Input
                            value={newScriptName}
                            onChange={(e) => setNewScriptName(e.target.value)}
                            placeholder="Nome do script (ex: Analytics, Header Fix...)"
                          />
                          <Textarea
                            value={newScriptCode}
                            onChange={(e) => setNewScriptCode(e.target.value)}
                            placeholder="Código JavaScript a executar após carregamento..."
                            className="font-mono text-xs min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={addScript} disabled={!newScriptName.trim() || !newScriptCode.trim()}>
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddScript(false)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setShowAddScript(true)} className="w-full">
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar Novo Script
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

interface CreditUser {
  id: string;
  username: string;
  name: string;
  role: string;
  tmcCredits: number;
  email?: string;
}

interface TmcConfigItem {
  id: string;
  functionName: string;
  costInCredits: number;
  description: string | null;
  category: string;
  isActive: boolean;
  minimumRole: string;
  bonusForPatient: number;
  commissionPercentage: number;
}

interface AuditLogEntry {
  id: string;
  userId: string;
  username?: string;
  action: string;
  amount: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  relatedUserId?: string;
  createdAt: string;
}

function FinancialManagementTab() {
  const { toast } = useToast();
  const [creditSearch, setCreditSearch] = useState('');
  const [sendCreditsOpen, setSendCreditsOpen] = useState(false);
  const [sendUserId, setSendUserId] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendReason, setSendReason] = useState('');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState('');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [auditLimit, setAuditLimit] = useState(50);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editingPkg, setEditingPkg] = useState<any>({});

  const { data: creditUsers = [], isLoading: loadingCreditUsers } = useQuery<CreditUser[]>({
    queryKey: ['/api/admin/credits/users'],
  });

  const { data: creditPackages = [], isLoading: loadingPackages } = useQuery<any[]>({
    queryKey: ['/api/admin/credit-packages'],
  });

  const { data: exchangeRate } = useQuery<{ rate: number }>({
    queryKey: ['/api/admin/exchange-rate'],
  });

  const updatePackageMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest('PATCH', `/api/admin/credit-packages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credit-packages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/packages'] });
      setEditingPkgId(null);
      setEditingPkg({});
      toast({ title: 'Sucesso', description: 'Pacote atualizado' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    },
  });

  const togglePackageMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest('PATCH', `/api/admin/credit-packages/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credit-packages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/packages'] });
      toast({ title: 'Sucesso', description: 'Status atualizado' });
    },
  });

  const updateExchangeRateMutation = useMutation({
    mutationFn: (rate: number) => apiRequest('PUT', '/api/admin/exchange-rate', { rate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/exchange-rate'] });
      toast({ title: 'Sucesso', description: 'Taxa de câmbio atualizada' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    },
  });

  const { data: tmcConfigs = [], isLoading: loadingConfigs } = useQuery<TmcConfigItem[]>({
    queryKey: ['/api/tmc/config'],
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/wallet/audit-log', { action: auditFilter !== 'all' ? auditFilter : undefined, limit: auditLimit }],
  });

  const sendCreditsMutation = useMutation({
    mutationFn: (data: { userId: string; amount: number; reason: string }) =>
      apiRequest('POST', '/api/admin/credits/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/audit-log'] });
      setSendCreditsOpen(false);
      setSendUserId('');
      setSendAmount('');
      setSendReason('');
      toast({ title: 'Sucesso', description: 'Créditos enviados com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, costInCredits }: { id: string; costInCredits: number }) =>
      apiRequest('PATCH', `/api/tmc/config/${id}`, { costInCredits }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tmc/config'] });
      setEditingConfigId(null);
      setEditingCost('');
      toast({ title: 'Sucesso', description: 'Custo atualizado com sucesso' });
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    },
  });

  const filteredUsers = (creditUsers as CreditUser[]).filter(
    (u) =>
      u.name.toLowerCase().includes(creditSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(creditSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(creditSearch.toLowerCase())
  );

  const configCategories = Array.from(new Set((tmcConfigs as TmcConfigItem[]).map((c) => c.category)));

  return (
    <TabsContent value="financial" className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Saldos de Créditos dos Usuários</span>
              </CardTitle>
              <CardDescription>Visualize e gerencie os créditos TM3D de todos os usuários</CardDescription>
            </div>
            <Dialog open={sendCreditsOpen} onOpenChange={setSendCreditsOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-send-credits">
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Créditos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar Créditos TM3D</DialogTitle>
                  <DialogDescription>Envie créditos para um usuário do sistema</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Select value={sendUserId} onValueChange={setSendUserId}>
                      <SelectTrigger data-testid="select-send-user">
                        <SelectValue placeholder="Selecione o usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {(creditUsers as CreditUser[]).map((u) => (
                          <SelectItem data-no-translate key={u.id} value={u.id}>
                            {u.name} ({u.username}) - {u.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade (TM3D)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="Ex: 100"
                      data-testid="input-send-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Input
                      value={sendReason}
                      onChange={(e) => setSendReason(e.target.value)}
                      placeholder="Ex: Bônus de boas-vindas"
                      data-testid="input-send-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!sendUserId || !sendAmount || !sendReason) {
                        toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
                        return;
                      }
                      sendCreditsMutation.mutate({
                        userId: sendUserId,
                        amount: parseInt(sendAmount),
                        reason: sendReason,
                      });
                    }}
                    disabled={sendCreditsMutation.isPending}
                    data-testid="button-confirm-send-credits"
                  >
                    {sendCreditsMutation.isPending ? 'Enviando...' : 'Enviar Créditos'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, username ou role..."
                value={creditSearch}
                onChange={(e) => setCreditSearch(e.target.value)}
                className="pl-10"
                data-testid="input-credit-search"
              />
            </div>
          </div>
          {loadingCreditUsers ? (
            <div className="text-center py-8">Carregando saldos...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Saldo TM3D</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`credit-user-row-${user.id}`}>
                      <TableCell data-no-translate className="font-medium">{user.name}</TableCell>
                      <TableCell className="font-mono text-sm">{user.username}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.role === 'admin'
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'doctor'
                              ? 'bg-blue-100 text-blue-800'
                              : user.role === 'patient'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell data-no-translate className="text-sm text-muted-foreground">{user.email || '-'}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{user.tmcCredits || 0} TM3D</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Custos das Funcionalidades</span>
          </CardTitle>
          <CardDescription>Configure os custos em créditos TM3D para cada funcionalidade do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfigs ? (
            <div className="text-center py-8">Carregando configurações...</div>
          ) : (
            <div className="space-y-6">
              {configCategories.map((category) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(tmcConfigs as TmcConfigItem[])
                      .filter((c) => c.category === category)
                      .map((config) => (
                        <Card key={config.id} className={`${!config.isActive ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{config.description || config.functionName}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-1">{config.functionName}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">{config.minimumRole}</Badge>
                                  {!config.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {editingConfigId === config.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={editingCost}
                                      onChange={(e) => setEditingCost(e.target.value)}
                                      className="w-20 h-8 text-sm"
                                      data-testid={`input-config-cost-${config.id}`}
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        updateConfigMutation.mutate({
                                          id: config.id,
                                          costInCredits: parseInt(editingCost),
                                        });
                                      }}
                                      disabled={updateConfigMutation.isPending}
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        setEditingConfigId(null);
                                        setEditingCost('');
                                      }}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono font-bold text-lg">{config.costInCredits}</span>
                                    <span className="text-xs text-muted-foreground">TM3D</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2"
                                      onClick={() => {
                                        setEditingConfigId(config.id);
                                        setEditingCost(String(config.costInCredits));
                                      }}
                                      data-testid={`button-edit-config-${config.id}`}
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {config.bonusForPatient > 0 && (
                              <p className="text-xs text-green-600 mt-2">Bônus paciente: +{config.bonusForPatient} TM3D</p>
                            )}
                            {config.commissionPercentage > 0 && (
                              <p className="text-xs text-blue-600 mt-1">Comissão: {config.commissionPercentage}%</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Pacotes de Créditos & Taxa de Câmbio</span>
              </CardTitle>
              <CardDescription>Gerencie os pacotes disponíveis para compra e a taxa TM3D/USD</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5">
                <span className="text-sm text-muted-foreground">1 USD =</span>
                <Input
                  type="number"
                  min="1"
                  className="w-16 h-7 text-sm font-mono"
                  defaultValue={exchangeRate?.rate || 5}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0 && val !== (exchangeRate?.rate || 5)) {
                      updateExchangeRateMutation.mutate(val);
                    }
                  }}
                />
                <span className="text-sm font-medium">TM3D</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPackages ? (
            <div className="text-center py-8">Carregando pacotes...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(creditPackages as any[]).map((pkg) => (
                <Card key={pkg.id} className={`${!pkg.isActive ? 'opacity-50' : ''} ${pkg.isPromotional ? 'border-amber-400' : ''}`}>
                  <CardContent className="p-4">
                    {editingPkgId === pkg.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input
                              className="h-8 text-sm"
                              value={editingPkg.name || ''}
                              onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Preço (USD)</Label>
                            <Input
                              className="h-8 text-sm"
                              value={editingPkg.priceUsd || ''}
                              onChange={(e) => setEditingPkg({ ...editingPkg, priceUsd: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Créditos</Label>
                            <Input
                              type="number"
                              className="h-8 text-sm"
                              value={editingPkg.credits || 0}
                              onChange={(e) => setEditingPkg({ ...editingPkg, credits: parseInt(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Bônus</Label>
                            <Input
                              type="number"
                              className="h-8 text-sm"
                              value={editingPkg.bonusCredits || 0}
                              onChange={(e) => setEditingPkg({ ...editingPkg, bonusCredits: parseInt(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Preço (BRL)</Label>
                            <Input
                              className="h-8 text-sm"
                              value={editingPkg.priceBrl || ''}
                              onChange={(e) => setEditingPkg({ ...editingPkg, priceBrl: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={editingPkg.isPromotional || false}
                              onChange={(e) => setEditingPkg({ ...editingPkg, isPromotional: e.target.checked })}
                            />
                            Promocional
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updatePackageMutation.mutate({ id: pkg.id, data: editingPkg })}
                            disabled={updatePackageMutation.isPending}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingPkgId(null); setEditingPkg({}); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">{pkg.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {pkg.isPromotional && <Badge className="bg-amber-500 text-white text-xs">Promo</Badge>}
                            <Badge variant={pkg.isActive ? 'default' : 'secondary'} className="text-xs">
                              {pkg.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-mono font-bold text-lg">${pkg.priceUsd}</span>
                          <span className="text-muted-foreground">{pkg.credits} + {pkg.bonusCredits || 0} créditos</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setEditingPkgId(pkg.id);
                              setEditingPkg({
                                name: pkg.name, credits: pkg.credits, priceUsd: pkg.priceUsd,
                                priceBrl: pkg.priceBrl, bonusCredits: pkg.bonusCredits,
                                description: pkg.description, isPromotional: pkg.isPromotional,
                              });
                            }}
                          >
                            <Edit3 className="h-3 w-3 mr-1" /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={pkg.isActive ? 'destructive' : 'default'}
                            onClick={() => togglePackageMutation.mutate({ id: pkg.id, isActive: !pkg.isActive })}
                          >
                            {pkg.isActive ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Log de Auditoria da Carteira</span>
              </CardTitle>
              <CardDescription>Histórico de todas as transações TM3D do sistema</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={auditFilter} onValueChange={setAuditFilter}>
                <SelectTrigger className="w-40" data-testid="select-audit-filter">
                  <SelectValue placeholder="Filtrar ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="recharge">Recarga</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="commission">Comissão</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(auditLimit)} onValueChange={(v) => setAuditLimit(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAudit ? (
            <div className="text-center py-8">Carregando log de auditoria...</div>
          ) : (auditLogs as AuditLogEntry[]).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo Antes</TableHead>
                    <TableHead className="text-right">Saldo Depois</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditLogs as AuditLogEntry[]).map((log) => (
                    <TableRow key={log.id} data-testid={`audit-row-${log.id}`}>
                      <TableCell className="text-xs">
                        {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action === 'credit' || log.action === 'recharge'
                              ? 'default'
                              : log.action === 'debit'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell data-no-translate className="text-sm">{log.username || log.userId}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{log.reason}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${log.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.amount >= 0 ? '+' : ''}{log.amount} TM3D
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {log.balanceBefore} TM3D
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {log.balanceAfter} TM3D
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Database Cleanup Tab Content Component
function DatabaseCleanupTab() {
  const { toast } = useToast();
  const [confirmationText, setConfirmationText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const clearDatabaseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/admin/clear-database', {
        confirmation: 'CLEAR_ALL_DATA'
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Banco de dados limpo com sucesso!",
        description: data.message,
      });
      setConfirmationText('');
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      const errorInfo = formatErrorForToast(error);
      toast({
        title: errorInfo.title,
        description: errorInfo.description,
        variant: "destructive",
      });
    },
  });

  const handleClearDatabase = () => {
    if (confirmationText !== 'LIMPAR TUDO') {
      toast({
        title: "Confirmação inválida",
        description: "Digite exatamente 'LIMPAR TUDO' para confirmar.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('⚠️ ATENÇÃO: Esta ação é irreversível e irá remover TODOS os dados de usuários, pacientes, médicos e agendamentos. Apenas seu usuário administrador será preservado. Tem certeza?')) {
      return;
    }

    setIsClearing(true);
    clearDatabaseMutation.mutate();
    setTimeout(() => setIsClearing(false), 3000);
  };

  return (<>
    <TabsContent value="ai-ecg-config" className="space-y-4">
      <ECGConfigTab />
    </TabsContent>

    <TabsContent value="access-modality-config" className="space-y-4">
      <AccessModalityAdminSection />
    </TabsContent>

    <TabsContent value="ai-radiology-config" className="space-y-4">
      <RadiologyConfigTab />
    </TabsContent>

    <TabsContent value="crm-verification" className="space-y-4">
      <CRMVerificationConfigTab />
    </TabsContent>

    <TabsContent value="database-cleanup" className="space-y-4">
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-destructive">
            <Database className="h-6 w-6" />
            <span>Limpeza Completa do Banco de Dados</span>
          </CardTitle>
          <CardDescription>
            Remove todos os dados de teste para preparar o sistema para usuários reais. 
            <strong className="text-destructive"> Esta ação é irreversível!</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning Section */}
          <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">⚠️ Atenção: Operação Destrutiva</h3>
                <p className="text-sm text-muted-foreground">
                  Esta operação irá <strong>remover permanentemente</strong> os seguintes dados:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Todos os usuários (exceto administradores)</li>
                  <li>Todos os pacientes cadastrados</li>
                  <li>Todos os agendamentos</li>
                  <li>Todos os prontuários médicos</li>
                  <li>Todas as prescrições</li>
                  <li>Todos os resultados de exames</li>
                  <li>Todas as mensagens do WhatsApp</li>
                  <li>Todas as transações TM3D</li>
                  <li>Todas as fotos de perfil</li>
                </ul>
                <p className="text-sm font-semibold text-destructive mt-2">
                  ✅ Seu usuário administrador será preservado.
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Para confirmar, digite <strong className="text-destructive">LIMPAR TUDO</strong> abaixo:
              </Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Digite: LIMPAR TUDO"
                className="font-mono"
                data-testid="input-clear-database-confirmation"
              />
            </div>

            <Button
              onClick={handleClearDatabase}
              disabled={confirmationText !== 'LIMPAR TUDO' || isClearing || clearDatabaseMutation.isPending}
              variant="destructive"
              className="w-full"
              size="lg"
              data-testid="button-clear-database"
            >
              {(isClearing || clearDatabaseMutation.isPending) ? (
                <>
                  <div className="animate-spin mr-2 h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                  Limpando banco de dados...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-5 w-5" />
                  Limpar Banco de Dados
                </>
              )}
            </Button>
          </div>

          {/* Success Message */}
          {clearDatabaseMutation.isSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-green-700 dark:text-green-400">
                    ✅ Banco de dados limpo com sucesso!
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-300">
                    O sistema está pronto para receber novos usuários de teste. 
                    Novos usuários podem se registrar com fotos de perfil personalizadas.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </>);
}

function AccessModalityAdminSection() {
  const { globalDefault, setGlobalDefault } = useAccessModality();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userOverride, setUserOverride] = useState<Record<string, string>>({});

  const { data: counts } = useQuery<{ classic: number; professional: number; assisted: number; inherit: number; globalDefault: string }>({
    queryKey: ['/api/admin/access-modality-counts'],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ['/api/admin/users'],
  });

  const overrideMutation = useMutation({
    mutationFn: ({ userId, value }: { userId: string; value: 'classic' | 'professional' | 'assisted' | null }) =>
      apiRequest('PATCH', `/api/admin/users/${userId}/access-modality`, { accessModality: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-modality-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-modality-audit'] });
      toast({ title: 'Modalidade do usuário atualizada' });
    },
    onError: (e: any) => {
      toast({ title: 'Falha ao atualizar usuário', description: e?.message || 'Erro', variant: 'destructive' });
    },
  });

  const options: { key: 'classic' | 'professional' | 'assisted'; title: string; desc: string }[] = [
    { key: 'classic', title: 'Clássica', desc: 'Experiência minimalista, sem propostas #39 e #5 ativas. Foco em fluxos essenciais.' },
    { key: 'professional', title: 'Profissional', desc: 'Experiência completa com toolbox unificada (#39) e radiologia avançada (#5).' },
    { key: 'assisted', title: 'Assistida', desc: 'Modo autônomo com IAM3D voz + visual e prompt narrativo (efêmero).' },
  ];

  const onPick = async (m: 'classic' | 'professional' | 'assisted') => {
    try {
      setSaving(true);
      await setGlobalDefault(m);
      toast({ title: 'Modalidade global atualizada', description: `Padrão definido para "${m}".` });
    } catch (e: any) {
      toast({ title: 'Falha ao salvar', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modalidade de Acesso (Padrão Global)</CardTitle>
        <CardDescription>
          Define a modalidade aplicada a usuários sem preferência individual. Usuários podem sobrescrever em seu perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {options.map(opt => {
            const active = globalDefault === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onPick(opt.key)}
                disabled={saving}
                data-testid={`btn-modality-${opt.key}`}
                className={`text-left rounded-lg border-2 p-4 transition-all ${
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${saving ? 'opacity-60 cursor-wait' : ''}`}
              >
                <div className="font-semibold mb-1">{opt.title}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
                {active && (
                  <div className="mt-2 text-xs font-medium text-primary">Padrão atual</div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          O modo Assistido pode ser encerrado a qualquer momento pelo botão "Sair do modo assistido" ou pela frase de voz "voltar para profissional".
        </p>

        <div className="border-t pt-3 mt-2">
          <div className="text-sm font-semibold mb-2">Distribuição efetiva de usuários por modalidade</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            {(['classic', 'professional', 'assisted'] as const).map(k => (
              <div key={k} className="rounded border p-2 bg-muted/30" data-testid={`stat-modality-${k}`}>
                <div className="text-xs uppercase text-muted-foreground">{k}</div>
                <div className="text-lg font-semibold">{counts?.[k] ?? 0}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2" data-testid="stat-modality-inherit">
            {counts?.inherit ?? 0} usuário(s) sem preferência individual — herdam o padrão global atual ({counts?.globalDefault ?? globalDefault}) e já estão somados acima.
          </p>
        </div>

        <div className="border-t pt-3 mt-2 space-y-2">
          <div className="text-sm font-semibold">Sobrescrever por usuário</div>
          <Input
            placeholder="Filtrar por nome ou email..."
            value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
            data-testid="input-modality-user-filter"
          />
          <div className="max-h-72 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Usuário</th>
                  <th className="text-left p-2">Atual</th>
                  <th className="text-left p-2">Definir</th>
                </tr>
              </thead>
              <tbody>
                {(users || [])
                  .filter((u: any) => {
                    if (!userQuery.trim()) return true;
                    const q = userQuery.toLowerCase();
                    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map((u: any) => {
                    const current = u.accessModality ?? 'inherit';
                    const draft = userOverride[u.id] ?? current;
                    return (
                      <tr key={u.id} className="border-t">
                        <td className="p-2">
                          <div data-no-translate className="font-medium">{u.name}</div>
                          <div data-no-translate className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="p-2 text-xs">{current}</td>
                        <td className="p-2">
                          <div className="flex gap-1 items-center">
                            <select
                              value={draft}
                              onChange={e => setUserOverride(s => ({ ...s, [u.id]: e.target.value }))}
                              className="border rounded px-2 py-1 text-xs bg-background"
                              data-testid={`select-modality-user-${u.id}`}
                            >
                              <option value="inherit">Padrão global</option>
                              <option value="classic">Clássica</option>
                              <option value="professional">Profissional</option>
                              <option value="assisted">Assistida</option>
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={overrideMutation.isPending || draft === current}
                              onClick={() => {
                                const value = draft === 'inherit'
                                  ? null
                                  : (draft === 'classic' || draft === 'professional' || draft === 'assisted')
                                    ? draft
                                    : null;
                                overrideMutation.mutate({ userId: u.id, value });
                              }}
                              data-testid={`btn-save-modality-user-${u.id}`}
                            >
                              Salvar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">"Padrão global" remove a preferência individual e o usuário herda o padrão definido acima.</p>
        </div>

        <AccessModalityAuditTrail />
      </CardContent>
    </Card>
  );
}

type AccessModalityAuditEntry = {
  id: string;
  scope: 'global' | 'user';
  adminId: string;
  adminName: string | null;
  adminEmail: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
};

function AccessModalityAuditTrail() {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'user'>('all');
  const { data: entries, isLoading } = useQuery<AccessModalityAuditEntry[]>({
    queryKey: ['/api/admin/access-modality-audit', scopeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' });
      if (scopeFilter !== 'all') params.set('scope', scopeFilter);
      const res = await fetch(`/api/admin/access-modality-audit?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
  };

  return (
    <div className="border-t pt-3 mt-2 space-y-2" data-testid="section-access-modality-audit">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold">Histórico de mudanças (últimas 20)</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1" role="tablist" aria-label="Filtrar por escopo">
            {([
              ['all', 'Todas'],
              ['global', 'Padrão global'],
              ['user', 'Por usuário'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScopeFilter(key)}
                aria-pressed={scopeFilter === key}
                data-testid={`audit-filter-${key}`}
                className={`text-xs px-2 py-1 rounded border ${scopeFilter === key ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <a
            href={scopeFilter === 'all'
              ? '/api/admin/access-modality-audit.csv'
              : `/api/admin/access-modality-audit.csv?scope=${scopeFilter}`}
            download
            data-testid="audit-export-csv"
            className="text-xs px-2 py-1 rounded border bg-background hover:bg-muted inline-flex items-center gap-1"
            title="Baixar CSV (até 10.000 linhas) com o filtro atual"
          >
            Exportar CSV
          </a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mudanças do padrão global e sobrescritas individuais são registradas com administrador, alvo, valor anterior e novo valor.
      </p>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Carregando...</div>
      ) : !entries || entries.length === 0 ? (
        <div className="text-xs text-muted-foreground" data-testid="audit-empty">
          Nenhuma mudança registrada ainda.
        </div>
      ) : (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 uppercase">
              <tr>
                <th className="text-left p-2">Quando</th>
                <th className="text-left p-2">Escopo</th>
                <th className="text-left p-2">Administrador</th>
                <th className="text-left p-2">Alvo</th>
                <th className="text-left p-2">De</th>
                <th className="text-left p-2">Para</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-t" data-testid={`audit-row-${e.id}`}>
                  <td className="p-2 whitespace-nowrap">{fmt(e.createdAt)}</td>
                  <td className="p-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${e.scope === 'user' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-muted'}`}
                      data-testid={`audit-scope-${e.id}`}
                    >
                      {e.scope === 'user' ? 'Usuário' : 'Global'}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{e.adminName || '—'}</div>
                    <div className="text-muted-foreground">{e.adminEmail || e.adminId}</div>
                  </td>
                  <td className="p-2">
                    {e.scope === 'user' ? (
                      <>
                        <div className="font-medium">{e.targetUserName || '—'}</div>
                        <div className="text-muted-foreground">{e.targetUserEmail || e.targetUserId || '—'}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2"><code>{e.previousValue ?? '—'}</code></td>
                  <td className="p-2"><code className="font-semibold">{e.newValue ?? 'inherit'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PresenceSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PRESENCE_KEYS: { key: string; label: string; help: string; min: number; max: number }[] = [
    { key: "doctor_office_inactivity_minutes", label: "Inatividade do consultório (min)", help: "Tempo sem heartbeat antes do auto-fechamento", min: 1, max: 240 },
    { key: "doctor_office_warning_minutes", label: "Aviso prévio (min)", help: "Quanto antes do fechamento o médico recebe um aviso", min: 0, max: 60 },
    { key: "doctor_office_heartbeat_seconds", label: "Intervalo de heartbeat (s)", help: "Frequência do ping enviado pelo navegador do médico", min: 5, max: 300 },
    { key: "auto_logoff_minutes", label: "Auto-logoff por inatividade (min)", help: "Encerramento automático da sessão do usuário", min: 1, max: 240 },
    { key: "auto_logoff_warning_seconds", label: "Aviso antes do logoff (s)", help: "Janela do modal de \"Continuar online?\"", min: 30, max: 600 },
  ];
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/system-settings/public/presence"],
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setDraft({ ...data }); }, [data]);
  const saveMutation = useMutation({
    mutationFn: async (entry: { key: string; value: string }) => {
      const res = await fetch(`/api/system-settings/${entry.key}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingValue: entry.value, settingType: "number", description: "Presence/auto-logoff timing" }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvo", description: "Configuração atualizada." });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/public/presence"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message || "Falha", variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempos de Presença</CardTitle>
        <CardDescription>Ajuste os tempos de inatividade do consultório, heartbeat e auto-logoff.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {PRESENCE_KEYS.map((cfg) => (
              <div key={cfg.key} className="space-y-1.5" data-testid={`presence-row-${cfg.key}`}>
                <Label htmlFor={cfg.key}>{cfg.label}</Label>
                <div className="flex gap-2">
                  <Input id={cfg.key} type="number" min={cfg.min} max={cfg.max} value={draft[cfg.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [cfg.key]: e.target.value }))} data-testid={`input-${cfg.key}`} />
                  <Button onClick={() => saveMutation.mutate({ key: cfg.key, value: draft[cfg.key] || "" })} disabled={saveMutation.isPending} data-testid={`btn-save-${cfg.key}`}>Salvar</Button>
                </div>
                <p className="text-xs text-muted-foreground">{cfg.help}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DoctorRegistration {
  id: string;
  doctorId: string;
  country: string;
  registrationType: string;
  registrationNumber: string;
  registrationState?: string | null;
  specialty?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  isDefault: boolean;
  isVerified: boolean;
  verifiedSource?: string | null;
  notes?: string | null;
  createdAt: string;
}

type RegistrationFormState = {
  country: string;
  registrationType: string;
  registrationNumber: string;
  registrationState: string;
  specialty: string;
  notes: string;
  isActive: boolean;
  isDefault: boolean;
};

const REGISTRATION_TYPES: { value: string; label: string }[] = [
  { value: 'medical_license', label: 'Registro médico (genérico)' },
  { value: 'crm', label: 'CRM (Brasil)' },
  { value: 'matricula', label: 'Matrícula' },
  { value: 'npi', label: 'NPI (EUA)' },
  { value: 'gmc', label: 'GMC (Reino Unido)' },
  { value: 'cedula', label: 'Cédula profissional' },
];

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: 'BR', label: 'Brasil (BR)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'AR', label: 'Argentina (AR)' },
  { value: 'PY', label: 'Paraguai (PY)' },
  { value: 'UY', label: 'Uruguai (UY)' },
  { value: 'US', label: 'Estados Unidos (US)' },
  { value: 'GB', label: 'Reino Unido (GB)' },
  { value: 'ES', label: 'Espanha (ES)' },
];

const emptyRegistrationForm: RegistrationFormState = {
  country: 'BR',
  registrationType: 'crm',
  registrationNumber: '',
  registrationState: '',
  specialty: '',
  notes: '',
  isActive: true,
  isDefault: false,
};

function DoctorRegistrationsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorRegistration | null>(null);
  const [form, setForm] = useState<RegistrationFormState>(emptyRegistrationForm);

  const { data: adminUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
  });
  const doctors = (adminUsers as AdminUser[]).filter((u) => u.role === 'doctor');

  const { data: registrations = [], isLoading } = useQuery<DoctorRegistration[]>({
    queryKey: ['/api/doctor-registrations', selectedDoctorId],
    enabled: !!selectedDoctorId,
    queryFn: async () => {
      const res = await fetch(`/api/doctor-registrations?doctorId=${encodeURIComponent(selectedDoctorId)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Falha ao carregar registros');
      return res.json();
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/doctor-registrations', selectedDoctorId] });

  const createMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', '/api/doctor-registrations', payload),
    onSuccess: () => {
      toast({ title: 'Registro criado', description: 'Registro profissional adicionado.' });
      invalidate();
      setDialogOpen(false);
    },
    onError: (err: any) => toast(formatErrorForToast(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiRequest('PATCH', `/api/doctor-registrations/${id}`, payload),
    onSuccess: () => {
      toast({ title: 'Registro atualizado', description: 'Alterações salvas.' });
      invalidate();
      setDialogOpen(false);
    },
    onError: (err: any) => toast(formatErrorForToast(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/doctor-registrations/${id}`),
    onSuccess: () => {
      toast({ title: 'Registro removido', description: 'Registro profissional excluído.' });
      invalidate();
    },
    onError: (err: any) => toast(formatErrorForToast(err)),
  });

  const toggleDefaultMutation = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      apiRequest('PATCH', `/api/doctor-registrations/${id}`, { isDefault }),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast(formatErrorForToast(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRegistrationForm);
    setDialogOpen(true);
  };

  const openEdit = (reg: DoctorRegistration) => {
    setEditing(reg);
    setForm({
      country: reg.country,
      registrationType: reg.registrationType,
      registrationNumber: reg.registrationNumber,
      registrationState: reg.registrationState || '',
      specialty: reg.specialty || '',
      notes: reg.notes || '',
      isActive: reg.isActive,
      isDefault: reg.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedDoctorId) {
      toast({ title: 'Selecione um médico', variant: 'destructive' });
      return;
    }
    if (!form.registrationNumber.trim()) {
      toast({ title: 'Número obrigatório', description: 'Informe o número do registro.', variant: 'destructive' });
      return;
    }
    const payload: any = {
      doctorId: selectedDoctorId,
      country: form.country,
      registrationType: form.registrationType,
      registrationNumber: form.registrationNumber.trim(),
      registrationState: form.registrationState.trim() || null,
      specialty: form.specialty.trim() || null,
      notes: form.notes.trim() || null,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros Profissionais</CardTitle>
        <CardDescription>
          Gerencie os registros (CRM, conselhos estrangeiros) de cada médico por país. O registro marcado como padrão é usado
          como fallback nas assinaturas quando não há correspondência exata com o país do paciente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5 w-full md:max-w-sm">
            <Label htmlFor="reg-doctor-select">Médico</Label>
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger id="reg-doctor-select" data-testid="select-registration-doctor">
                <SelectValue placeholder="Selecione um médico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem data-no-translate key={d.id} value={d.id}>
                    {d.name} {d.medicalLicense ? `· ${d.medicalLicense}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreate} disabled={!selectedDoctorId} data-testid="btn-add-registration">
            <Plus className="h-4 w-4 mr-2" /> Adicionar registro
          </Button>
        </div>

        {!selectedDoctorId ? (
          <p className="text-sm text-muted-foreground">Selecione um médico para ver e gerenciar seus registros.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (registrations as DoctorRegistration[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro cadastrado para este médico.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>País</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>UF/Região</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registrations as DoctorRegistration[]).map((reg) => (
                <TableRow key={reg.id} data-testid={`row-registration-${reg.id}`}>
                  <TableCell className="font-medium">{reg.country}</TableCell>
                  <TableCell>
                    {REGISTRATION_TYPES.find((t) => t.value === reg.registrationType)?.label || reg.registrationType}
                  </TableCell>
                  <TableCell>{reg.registrationNumber}</TableCell>
                  <TableCell>{reg.registrationState || '—'}</TableCell>
                  <TableCell>{reg.specialty || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={reg.isActive ? 'default' : 'secondary'}>
                        {reg.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {reg.isVerified && <Badge variant="outline">Verificado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={reg.isDefault}
                      onCheckedChange={(checked) => toggleDefaultMutation.mutate({ id: reg.id, isDefault: checked })}
                      disabled={toggleDefaultMutation.isPending}
                      data-testid={`switch-default-${reg.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(reg)} data-testid={`btn-edit-registration-${reg.id}`}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Remover este registro profissional?')) deleteMutation.mutate(reg.id);
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`btn-delete-registration-${reg.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-registration-form">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar registro' : 'Novo registro profissional'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do registro. País e tipo determinam como o registro é usado nas assinaturas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>País</Label>
                <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                  <SelectTrigger data-testid="select-registration-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de registro</Label>
                <Select value={form.registrationType} onValueChange={(v) => setForm((f) => ({ ...f, registrationType: v }))}>
                  <SelectTrigger data-testid="select-registration-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-number">Número</Label>
                <Input
                  id="reg-number"
                  value={form.registrationNumber}
                  onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                  data-testid="input-registration-number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-state">UF / Região</Label>
                <Input
                  id="reg-state"
                  value={form.registrationState}
                  onChange={(e) => setForm((f) => ({ ...f, registrationState: e.target.value }))}
                  data-testid="input-registration-state"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-specialty">Especialidade</Label>
              <Input
                id="reg-specialty"
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                data-testid="input-registration-specialty"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-notes">Observações</Label>
              <Textarea
                id="reg-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="input-registration-notes"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  data-testid="switch-registration-active"
                />
                <Label>Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isDefault: checked }))}
                  data-testid="switch-registration-default"
                />
                <Label>Padrão (fallback)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel-registration">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-registration"
            >
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
