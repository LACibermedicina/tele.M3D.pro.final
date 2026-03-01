import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  Building2, Plus, Users, UserPlus, Copy, Settings, Trash2,
  Link2, Heart, Percent, Crown, UserCheck, CircleDot,
  FileText, ClipboardList, Calendar, ChevronRight, ExternalLink,
  Share2, QrCode
} from "lucide-react";
import { useLocation } from "wouter";

interface ClinicData {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  inviteCode: string;
  patientDiscountPercent: number;
  associateCommissionPercent: number;
  specialty: string | null;
  isActive: boolean;
  myRole: string;
  memberCount: number;
  patientCount: number;
  members: {
    id: string;
    userId: string;
    name: string;
    role: string;
    specialization: string | null;
    medicalLicense: string | null;
    isOnline: boolean;
    joinedAt: string;
  }[];
}

interface ClinicDetail extends ClinicData {
  patients: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    discountPercent: number;
    boundAt: string;
  }[];
  consultationLogs: any[];
}

export default function ClinicsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", description: "", specialty: "" });
  const [joinCode, setJoinCode] = useState("");
  const [editingClinic, setEditingClinic] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ patientDiscountPercent: 30, associateCommissionPercent: 15 });

  const isDoctor = user?.role === "doctor";
  const isPatient = user?.role === "patient";
  const isAdmin = user?.role === "admin";

  const { data: clinics = [], isLoading } = useQuery<ClinicData[]>({
    queryKey: ["/api/clinics"],
    enabled: isDoctor || isAdmin,
  });

  const { data: patientClinics = [] } = useQuery<any[]>({
    queryKey: ["/api/clinics/patient/my-clinics"],
    enabled: isPatient,
  });

  const { data: clinicDetail } = useQuery<ClinicDetail>({
    queryKey: ["/api/clinics", selectedClinicId],
    enabled: !!selectedClinicId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clinics", createForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      setShowCreateDialog(false);
      setCreateForm({ name: "", description: "", specialty: "" });
      toast({ title: "Clínica criada com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clinics/join", { inviteCode: joinCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/patient/my-clinics"] });
      setShowJoinDialog(false);
      setJoinCode("");
      toast({ title: "Entrou na clínica com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/clinics/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics", selectedClinicId] });
      setEditingClinic(null);
      toast({ title: "Clínica atualizada!" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ clinicId, userId }: { clinicId: string; userId: string }) =>
      apiRequest("DELETE", `/api/clinics/${clinicId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics", selectedClinicId] });
      toast({ title: "Membro removido" });
    },
  });

  const bindPatientMutation = useMutation({
    mutationFn: (clinicId: string) => apiRequest("POST", `/api/clinics/${clinicId}/bind-patient`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/patient/my-clinics"] });
      toast({ title: "Vinculado à clínica com desconto!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const unbindPatientMutation = useMutation({
    mutationFn: (clinicId: string) => apiRequest("DELETE", `/api/clinics/${clinicId}/unbind-patient`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/patient/my-clinics"] });
      toast({ title: "Vínculo removido" });
    },
  });

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/clinics?join=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  if (isPatient) {
    return (
      <PageWrapper variant="origami">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                Minhas Clínicas
              </h1>
              <p className="text-muted-foreground">Clínicas vinculadas com desconto preferencial</p>
            </div>
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogTrigger asChild>
                <Button><Link2 className="h-4 w-4 mr-2" /> Vincular a Clínica</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular-se a uma Clínica</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Código de Convite</Label>
                    <Input
                      placeholder="Ex: ABC12345"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={8}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Peça o código de convite ao médico ou clínica para se vincular e obter descontos.
                  </p>
                  <Button onClick={() => joinMutation.mutate()} disabled={!joinCode || joinMutation.isPending} className="w-full">
                    {joinMutation.isPending ? "Vinculando..." : "Vincular à Clínica"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {patientClinics.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma clínica vinculada</h3>
                <p className="text-muted-foreground mb-4">
                  Vincule-se a uma clínica para obter descontos em consultas com os médicos associados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {patientClinics.map((clinic: any) => (
                <Card key={clinic.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{clinic.name}</h3>
                        {clinic.specialty && (
                          <Badge variant="outline" className="mt-1">{clinic.specialty}</Badge>
                        )}
                        {clinic.description && (
                          <p className="text-sm text-muted-foreground mt-2">{clinic.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <Percent className="h-3 w-3 mr-1" />
                          {clinic.discountPercent}% desconto
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unbindPatientMutation.mutate(clinic.id)}
                        >
                          Desvincular
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Gestão de Clínicas
            </h1>
            <p className="text-muted-foreground">Administre suas clínicas, associados e pacientes</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogTrigger asChild>
                <Button variant="outline"><Link2 className="h-4 w-4 mr-2" /> Entrar com Código</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entrar em uma Clínica</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Código de Convite</Label>
                    <Input
                      placeholder="Ex: ABC12345"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={8}
                    />
                  </div>
                  <Button onClick={() => joinMutation.mutate()} disabled={!joinCode || joinMutation.isPending} className="w-full">
                    {joinMutation.isPending ? "Entrando..." : "Entrar na Clínica"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {isDoctor && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Criar Clínica</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Clínica</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome da Clínica</Label>
                      <Input
                        placeholder="Ex: Clínica São Lucas"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        placeholder="Descreva sua clínica..."
                        value={createForm.description}
                        onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Especialidade Principal</Label>
                      <Input
                        placeholder="Ex: Cardiologia"
                        value={createForm.specialty}
                        onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                      />
                    </div>
                    <Button
                      onClick={() => createMutation.mutate()}
                      disabled={!createForm.name || createMutation.isPending}
                      className="w-full"
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Clínica"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando clínicas...</div>
        ) : clinics.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma clínica encontrada</h3>
              <p className="text-muted-foreground">
                {isDoctor ? "Crie sua primeira clínica ou entre com um código de convite." : "Entre em uma clínica com o código de convite fornecido pelo médico principal."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {clinics.map((clinic) => (
                <Card
                  key={clinic.id}
                  className={`cursor-pointer hover:shadow-md transition-all ${
                    selectedClinicId === clinic.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedClinicId(clinic.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold truncate">{clinic.name}</h3>
                          {clinic.myRole === "owner" && (
                            <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        {clinic.specialty && (
                          <Badge variant="outline" className="text-xs mt-1">{clinic.specialty}</Badge>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {clinic.memberCount} médicos
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {clinic.patientCount} pacientes
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-2">
              {clinicDetail ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {clinicDetail.name}
                          {clinicDetail.myRole === "owner" && (
                            <Badge className="bg-amber-100 text-amber-800">Proprietário</Badge>
                          )}
                        </CardTitle>
                        {clinicDetail.specialty && (
                          <p className="text-sm text-muted-foreground mt-1">{clinicDetail.specialty}</p>
                        )}
                      </div>
                      {(clinicDetail.myRole === "owner" || isAdmin) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingClinic(clinicDetail.id);
                            setEditForm({
                              patientDiscountPercent: clinicDetail.patientDiscountPercent,
                              associateCommissionPercent: clinicDetail.associateCommissionPercent,
                            });
                          }}
                        >
                          <Settings className="h-4 w-4 mr-1" /> Configurar
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="overview">
                      <TabsList className="mb-4">
                        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                        <TabsTrigger value="members">Membros ({clinicDetail.members?.length || 0})</TabsTrigger>
                        <TabsTrigger value="patients">Pacientes ({clinicDetail.patients?.length || 0})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview">
                        <div className="space-y-4">
                          {clinicDetail.description && (
                            <p className="text-sm text-muted-foreground">{clinicDetail.description}</p>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Card>
                              <CardContent className="p-3 text-center">
                                <Users className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                                <div className="text-lg font-bold">{clinicDetail.members?.length || 0}</div>
                                <div className="text-xs text-muted-foreground">Associados</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <Heart className="h-5 w-5 mx-auto mb-1 text-rose-600" />
                                <div className="text-lg font-bold">{clinicDetail.patients?.length || 0}</div>
                                <div className="text-xs text-muted-foreground">Pacientes</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <Percent className="h-5 w-5 mx-auto mb-1 text-green-600" />
                                <div className="text-lg font-bold">{clinicDetail.patientDiscountPercent}%</div>
                                <div className="text-xs text-muted-foreground">Desconto Pacientes</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-3 text-center">
                                <Crown className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                                <div className="text-lg font-bold">{clinicDetail.associateCommissionPercent}%</div>
                                <div className="text-xs text-muted-foreground">Comissão Proprietário</div>
                              </CardContent>
                            </Card>
                          </div>

                          <Separator />

                          <div>
                            <Label className="text-sm font-semibold">Código de Convite para Médicos</Label>
                            <div className="flex items-center gap-2 mt-2">
                              <code className="bg-muted px-4 py-2 rounded-lg font-mono text-lg tracking-wider">
                                {clinicDetail.inviteCode}
                              </code>
                              <Button variant="outline" size="sm" onClick={() => copyInviteLink(clinicDetail.inviteCode)}>
                                <Copy className="h-4 w-4 mr-1" /> Copiar Link
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Compartilhe este código ou link com médicos para que se associem à sua clínica.
                            </p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="members">
                        <div className="space-y-3">
                          {clinicDetail.members?.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${member.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {member.name}
                                    {member.role === "owner" && <Crown className="h-3 w-3 text-amber-500" />}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {member.specialization || "Médico"} {member.medicalLicense && `• CRM ${member.medicalLicense}`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={member.role === "owner" ? "default" : "outline"} className="text-xs">
                                  {member.role === "owner" ? "Proprietário" : member.role === "associate" ? "Associado" : "Staff"}
                                </Badge>
                                {clinicDetail.myRole === "owner" && member.role !== "owner" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMemberMutation.mutate({ clinicId: clinicDetail.id, userId: member.userId })}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="patients">
                        <div className="space-y-3">
                          {clinicDetail.patients?.length === 0 ? (
                            <p className="text-center text-muted-foreground py-6">
                              Nenhum paciente vinculado ainda. Compartilhe o código da clínica com seus pacientes.
                            </p>
                          ) : (
                            clinicDetail.patients?.map((patient) => (
                              <div key={patient.id} className="flex items-center justify-between p-3 rounded-lg border">
                                <div>
                                  <div className="font-medium">{patient.name}</div>
                                  <div className="text-xs text-muted-foreground">{patient.email}</div>
                                </div>
                                <Badge className="bg-green-100 text-green-800">
                                  {patient.discountPercent}% desconto
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto mb-3" />
                    <p>Selecione uma clínica para ver os detalhes</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <Dialog open={!!editingClinic} onOpenChange={(open) => !open && setEditingClinic(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurações da Clínica</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Desconto para Pacientes Vinculados (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.patientDiscountPercent}
                  onChange={(e) => setEditForm({ ...editForm, patientDiscountPercent: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pacientes vinculados à clínica recebem este desconto em consultas com associados.
                </p>
              </div>
              <div>
                <Label>Comissão do Proprietário sobre Consultas (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.associateCommissionPercent}
                  onChange={(e) => setEditForm({ ...editForm, associateCommissionPercent: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Percentual que o proprietário recebe sobre cada consulta realizada por associados.
                </p>
              </div>
              <Button
                onClick={() => {
                  if (editingClinic) {
                    updateMutation.mutate({ id: editingClinic, data: editForm });
                  }
                }}
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  );
}