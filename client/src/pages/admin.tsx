import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Shield, ShieldCheck, Users, Key, Activity, AlertTriangle, Plus, Eye, EyeOff, Copy, Trash2, UserCheck, UserX, Edit3, Clock, Zap, Database, DollarSign, Send, Search, FileText, Settings, CreditCard, Pill, ArrowUpDown, ArrowUp, ArrowDown, Unplug, Stethoscope, ServerCrash, ScrollText, Code, GripVertical, ToggleLeft, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsPermanentAdmin } from '@/hooks/use-permanent-admin';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/use-websocket';
import { formatErrorForToast } from '@/lib/error-handler';
import PageWrapper from '@/components/layout/page-wrapper';

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

export default function AdminPage() {
  const { toast } = useToast();
  const isPermanentAdmin = useIsPermanentAdmin();
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
          title: "User Blocked",
          description: `${activity.details.blockedUsername} was blocked by ${activity.details.blockedBy}`,
          variant: "destructive",
        });
      } else if (activity.action === 'user_unblocked') {
        toast({
          title: "User Unblocked",
          description: `${activity.details.unblockedUsername} was unblocked by ${activity.details.unblockedBy}`,
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
      toast({ title: 'Success', description: 'Collaborator created successfully' });
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
      toast({ title: 'Success', description: 'API key created successfully' });
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
      toast({ title: 'Success', description: 'API key updated successfully' });
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
      toast({ title: 'Success', description: 'User blocked successfully' });
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
      toast({ title: 'Success', description: 'User unblocked successfully' });
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
      toast({ title: 'Success', description: 'User updated successfully' });
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
    toast({ title: 'Copied', description: 'Copied to clipboard' });
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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">System Administration</h1>
        </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collaborators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-collaborators">
              {(collaborators as Collaborator[]).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active: {(collaborators as Collaborator[]).filter((c: Collaborator) => c.isActive).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-api-keys">
              {(apiKeys as ApiKey[]).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Active: {(apiKeys as ApiKey[]).filter((k: ApiKey) => k.isActive).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="today-requests">
              {(analytics as any)?.todayRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Success: {(analytics as any)?.todaySuccess || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="security-alerts">
              {(analytics as any)?.securityAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 24h</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="collaborators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Live Activity</span>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </TabsTrigger>
          <TabsTrigger value="error-logs" data-testid="tab-error-logs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Error Logs</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="collaborators" data-testid="tab-collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="ai-references" data-testid="tab-ai-references">AI References</TabsTrigger>
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
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="total-users">
                  {(adminUsers as AdminUser[]).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Active: {(adminUsers as AdminUser[]).filter((u: AdminUser) => !u.isBlocked).length}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Blocked Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="blocked-users">
                  {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.isBlocked).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Require attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-4 w-4 text-purple-600" />
                  Pharmacists
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="pharmacist-count">
                  {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.role === 'pharmacist').length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Active: {(adminUsers as AdminUser[]).filter((u: AdminUser) => u.role === 'pharmacist' && !u.isBlocked).length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="recent-activity">
                  {(recentActivity as AdminUser[]).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Users active today
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage system users, roles, and access permissions
                  </CardDescription>
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                    <SelectItem value="visitor">Visitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="text-center py-8">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        { key: 'username', label: 'Username' },
                        { key: 'name', label: 'Name' },
                        { key: 'role', label: 'Role' },
                        { key: 'status', label: 'Status' },
                        { key: 'lastLogin', label: 'Last Login' },
                        { key: 'credits', label: 'TM3D Credits' },
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
                      <TableHead>Actions</TableHead>
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
                          case 'credits': valA = a.tmcCredits || 0; valB = b.tmcCredits || 0; break;
                          default: valA = a.username?.toLowerCase() || ''; valB = b.username?.toLowerCase() || '';
                        }
                        if (valA < valB) return userSortDirection === 'asc' ? -1 : 1;
                        if (valA > valB) return userSortDirection === 'asc' ? 1 : -1;
                        return 0;
                      })
                      .map((user: AdminUser) => (
                      <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>
                          <div>
                            <span>{user.name}</span>
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
                          {user.lastLogin ? format(new Date(user.lastLogin), 'MMM dd, yyyy HH:mm') : 'Never'}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{user.tmcCredits || 0} TM3D</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {user.isBlocked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unblockUserMutation.mutate(user.id)}
                                data-testid={`button-unblock-${user.id}`}
                                disabled={unblockUserMutation.isPending}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => blockUserMutation.mutate({ 
                                  userId: user.id, 
                                  reason: 'Administrative action' 
                                })}
                                data-testid={`button-block-${user.id}`}
                                disabled={blockUserMutation.isPending}
                              >
                                <UserX className="h-4 w-4" />
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
                <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
                <DialogDescription>
                  Update user role and permissions. Username: {editingUser?.username}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editUserRole} onValueChange={setEditUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="visitor">Visitor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingUser && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Email: {editingUser.email || 'N/A'}</p>
                    <p>Phone: {editingUser.phone || 'N/A'}</p>
                    <p>Created: {format(new Date(editingUser.createdAt), 'MMM dd, yyyy')}</p>
                    {editingUser.role === 'pharmacist' && editingUser.medicalLicense && (
                      <p>CRF: {editingUser.medicalLicense}</p>
                    )}
                    {editingUser.role === 'pharmacist' && editingUser.specialization && (
                      <p>Pharmacy: {editingUser.specialization}</p>
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
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Real-time connection status
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="live-activities-count">
                  {realtimeActivities.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recent admin actions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="websocket-messages-count">
                  {messages.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total WebSocket messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-green-600">
                  Online
                </div>
                <p className="text-xs text-muted-foreground">
                  All systems operational
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
                  <span>Live Activity Feed</span>
                  <Badge variant="outline" className="ml-2">
                    {realtimeActivities.length} activities
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Real-time administrative actions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {realtimeActivities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p>No recent activity</p>
                      <p className="text-sm">Administrative actions will appear here in real-time</p>
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
                            {activity.action === 'user_blocked' && 
                              `User ${activity.details.blockedUsername} was blocked`}
                            {activity.action === 'user_unblocked' && 
                              `User ${activity.details.unblockedUsername} was unblocked`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.action === 'user_blocked' && 
                              `By ${activity.details.blockedBy} - ${activity.details.reason}`}
                            {activity.action === 'user_unblocked' && 
                              `By ${activity.details.unblockedBy}`}
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
                  <span>WebSocket Messages</span>
                  <Badge variant="outline" className="ml-2">
                    {messages.length} messages
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Debug information for WebSocket communication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2" />
                      <p>No WebSocket messages</p>
                      <p className="text-sm">Messages will appear here when received</p>
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
                  <CardTitle>External Collaborators</CardTitle>
                  <CardDescription>
                    Manage pharmacies, laboratories, and hospitals integrated with the system
                  </CardDescription>
                </div>
                <Dialog open={showCreateCollaborator} onOpenChange={setShowCreateCollaborator}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-collaborator">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Collaborator
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Collaborator</DialogTitle>
                      <DialogDescription>
                        Add a new pharmacy, laboratory, or hospital to the system
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
                <div className="text-center py-8">Loading collaborators...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>CNES</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(collaborators as Collaborator[]).map((collaborator: Collaborator) => (
                      <TableRow key={collaborator.id} data-testid={`collaborator-row-${collaborator.id}`}>
                        <TableCell className="font-medium">{collaborator.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{collaborator.type}</Badge>
                        </TableCell>
                        <TableCell>{collaborator.cnpj}</TableCell>
                        <TableCell>{collaborator.cnes}</TableCell>
                        <TableCell>
                          <Badge variant={collaborator.isActive ? 'default' : 'secondary'}>
                            {collaborator.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(collaborator.createdAt), 'MMM dd, yyyy')}</TableCell>
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
                  <CardTitle>API Key Management</CardTitle>
                  <CardDescription>
                    Generate and manage API keys for collaborator access
                  </CardDescription>
                </div>
                <Dialog open={showCreateApiKey} onOpenChange={setShowCreateApiKey}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-api-key">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate API Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate New API Key</DialogTitle>
                      <DialogDescription>
                        Create a new API key for collaborator access
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
                <div className="text-center py-8">Loading API keys...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key Name</TableHead>
                      <TableHead>Collaborator</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(apiKeys as ApiKey[]).map((apiKey: ApiKey) => {
                      const collaborator = (collaborators as Collaborator[]).find((c: Collaborator) => c.id === apiKey.collaboratorId);
                      return (
                        <TableRow key={apiKey.id} data-testid={`api-key-row-${apiKey.id}`}>
                          <TableCell className="font-medium">{apiKey.keyName}</TableCell>
                          <TableCell>{collaborator?.name || 'Unknown'}</TableCell>
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
                              {apiKey.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {apiKey.lastUsed ? format(new Date(apiKey.lastUsed), 'MMM dd, yyyy HH:mm') : 'Never'}
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
                              {apiKey.isActive ? 'Deactivate' : 'Activate'}
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
              <CardTitle>Integration Activity</CardTitle>
              <CardDescription>
                Monitor all integration events and API usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingIntegrations ? (
                <div className="text-center py-8">Loading integration logs...</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Collaborator</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(integrations as CollaboratorIntegration[]).slice(0, 50).map((integration: CollaboratorIntegration) => (
                      <TableRow key={integration.id} data-testid={`integration-row-${integration.id}`}>
                        <TableCell>{format(new Date(integration.createdAt), 'MMM dd HH:mm:ss')}</TableCell>
                        <TableCell>{integration.collaboratorName || 'Unknown'}</TableCell>
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
                              <summary className="text-sm text-muted-foreground">View data</summary>
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
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Monitor authentication failures, rate limit violations, and security alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Severity</TableHead>
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
                        <TableCell>{format(new Date(event.createdAt), 'MMM dd HH:mm:ss')}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {event.integrationType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {event.requestData?.clientIp || 'Unknown'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {event.errorMessage || event.action}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            event.integrationType === 'authorization_violation' ? 'destructive' : 'secondary'
                          }>
                            {event.integrationType === 'authorization_violation' ? 'High' : 'Medium'}
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
              <CardTitle>AI Reference Documents</CardTitle>
              <CardDescription>
                Upload and manage PDF reference documents for AI diagnostic assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload PDF Section */}
              <div className="border-2 border-dashed rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Upload New PDF Reference</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="pdf-upload">PDF File (max 20MB)</Label>
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
                    <Label htmlFor="ref-title">Reference Title</Label>
                    <Input 
                      id="ref-title" 
                      placeholder="e.g., Diabetes Clinical Guidelines 2024"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      data-testid="input-ref-title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ref-content">Content/Summary</Label>
                    <textarea 
                      id="ref-content" 
                      className="w-full min-h-[100px] p-2 border rounded-md"
                      placeholder="Provide a summary or key points from the PDF..."
                      value={refContent}
                      onChange={(e) => setRefContent(e.target.value)}
                      data-testid="input-ref-content"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="ref-category">Category</Label>
                    <Select value={refCategory} onValueChange={setRefCategory}>
                      <SelectTrigger id="ref-category" data-testid="select-ref-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medical">Medical</SelectItem>
                        <SelectItem value="procedural">Procedural</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="diagnostic">Diagnostic</SelectItem>
                        <SelectItem value="general">General</SelectItem>
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
                          description: "Documento de referência AI criado com sucesso"
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
                    Create Reference
                  </Button>
                </div>
              </div>

              {/* References List */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Existing References</h3>
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
      if (!response.ok) throw new Error('Failed to delete reference');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reference Deleted",
        description: "AI reference document deleted successfully"
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
    return <div>Loading references...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Source Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
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
                {ref.isActive ? "Active" : "Inactive"}
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
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            data-testid="input-collaborator-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger data-testid="select-collaborator-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="laboratory">Laboratory</SelectItem>
              <SelectItem value="hospital">Hospital</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
          <Label htmlFor="phone">Phone</Label>
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
        <Label htmlFor="address">Address</Label>
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
          {isLoading ? 'Creating...' : 'Create Collaborator'}
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
        <Label htmlFor="collaborator">Collaborator</Label>
        <Select 
          value={formData.collaboratorId} 
          onValueChange={(value) => setFormData({ ...formData, collaboratorId: value })}
        >
          <SelectTrigger data-testid="select-api-key-collaborator">
            <SelectValue placeholder="Select collaborator" />
          </SelectTrigger>
          <SelectContent>
            {collaborators.map((collaborator: Collaborator) => (
              <SelectItem key={collaborator.id} value={collaborator.id}>
                {collaborator.name} ({collaborator.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keyName">Key Name</Label>
        <Input
          id="keyName"
          value={formData.keyName}
          onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
          placeholder="Production API Key"
          required
          data-testid="input-api-key-name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rateLimit">Rate Limit (per hour)</Label>
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
          <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
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
          {isLoading ? 'Generating...' : 'Generate API Key'}
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
                          <SelectItem key={u.id} value={u.id}>
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
                      <TableCell className="font-medium">{user.name}</TableCell>
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
                      <TableCell className="text-sm text-muted-foreground">{user.email || '-'}</TableCell>
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
                      <TableCell className="text-sm">{log.username || log.userId}</TableCell>
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

  return (
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
  );
}