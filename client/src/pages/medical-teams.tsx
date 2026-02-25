import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Video, Plus, UserPlus, Crown, Eye, MessageSquare, AlertCircle, Stethoscope, BookOpen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

const createTeamSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  teamType: z.enum(["clinical_discussion", "patient_case", "study_group"]),
  patientId: z.string().optional(),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

interface MedicalTeam {
  id: string;
  name: string;
  description: string | null;
  teamType: string;
  patientId: string | null;
  isActive: boolean;
  roomId: string | null;
  lastMeetingAt: string | null;
  memberRole: string;
  membersCount: number;
  notesCount: number;
  urgentNotesCount: number;
  members: TeamMember[];
  patient: any;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  userName: string;
  userEmail: string;
  profilePicture: string | null;
  medicalLicense: string | null;
  specialization: string | null;
}

interface AvailableDoctor {
  id: string;
  name: string;
  email: string;
  specialization: string | null;
  medicalLicense: string | null;
  profilePicture: string | null;
  isOnline: boolean;
}

export default function MedicalTeams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTeam, setSelectedTeam] = useState<MedicalTeam | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchDoctor, setSearchDoctor] = useState("");

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      teamType: "clinical_discussion",
      patientId: "",
    },
  });

  const { data: teams = [], isLoading } = useQuery<MedicalTeam[]>({
    queryKey: ['/api/medical-teams'],
    refetchInterval: 10000,
  });

  const { data: availableDoctors = [] } = useQuery<AvailableDoctor[]>({
    queryKey: ['/api/medical-teams/available-doctors'],
    enabled: isAddMemberOpen,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamForm) => {
      const res = await apiRequest('POST', '/api/medical-teams', data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Equipe Criada!", description: "Equipe médica criada com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams'] });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao criar equipe médica", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) => {
      const res = await apiRequest('POST', `/api/medical-teams/${teamId}/members`, { userId, role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Membro Adicionado!", description: "Médico adicionado à equipe com sucesso." });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams'] });
      setIsAddMemberOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error?.message || "Erro ao adicionar membro", variant: "destructive" });
    },
  });

  const handleCreateTeam = (data: CreateTeamForm) => {
    createTeamMutation.mutate(data);
  };

  const handleOpenTeamRoom = (team: MedicalTeam) => {
    setLocation(`/team-room/${team.id}`);
  };

  const handleAddMember = (doctorId: string) => {
    if (!selectedTeam) return;
    addMemberMutation.mutate({ teamId: selectedTeam.id, userId: doctorId, role: 'member' });
  };

  const getTeamTypeLabel = (type: string) => {
    switch (type) {
      case 'clinical_discussion': return 'Discussão Clínica';
      case 'patient_case': return 'Caso de Paciente';
      case 'study_group': return 'Grupo de Estudo';
      default: return type;
    }
  };

  const getTeamTypeColor = (type: string) => {
    switch (type) {
      case 'clinical_discussion': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'patient_case': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'study_group': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTeamTypeIcon = (type: string) => {
    switch (type) {
      case 'clinical_discussion': return <Stethoscope className="h-4 w-4" />;
      case 'patient_case': return <AlertCircle className="h-4 w-4" />;
      case 'study_group': return <BookOpen className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const filteredDoctors = availableDoctors.filter(d =>
    d.name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    (d.specialization || '').toLowerCase().includes(searchDoctor.toLowerCase())
  );

  if (!user || user.role !== 'doctor') {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Acesso restrito a médicos</p>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Equipes Médicas & Inter-Consultas</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Colaboração entre especialistas, discussão de casos clínicos e inter-consultas
            </p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-team">
                <Plus className="h-4 w-4 mr-2" />
                Nova Equipe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Equipe</DialogTitle>
                <DialogDescription>
                  Crie uma equipe para colaborar com outros médicos em discussões clínicas ou inter-consultas
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateTeam)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Equipe</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Inter-Consulta Cardiologia" {...field} data-testid="input-team-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descreva o caso clínico ou propósito da equipe..." {...field} data-testid="textarea-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="teamType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Equipe</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-team-type">
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="clinical_discussion">Discussão Clínica</SelectItem>
                            <SelectItem value="patient_case">Caso de Paciente / Inter-Consulta</SelectItem>
                            <SelectItem value="study_group">Grupo de Estudo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createTeamMutation.isPending} data-testid="button-submit-team">
                    {createTeamMutation.isPending ? "Criando..." : "Criar Equipe"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando equipes...</p>
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma equipe encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira equipe para colaborar com outros médicos em inter-consultas
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Equipe
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="hover:shadow-lg transition-shadow relative" data-testid={`team-card-${team.id}`}>
                {team.urgentNotesCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                    {team.urgentNotesCount}
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-muted">
                        {getTeamTypeIcon(team.teamType)}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {team.description || "Sem descrição"}
                        </CardDescription>
                      </div>
                    </div>
                    {team.memberRole === 'leader' && (
                      <Crown className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge className={getTeamTypeColor(team.teamType)}>
                      {getTeamTypeLabel(team.teamType)}
                    </Badge>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {team.membersCount} {team.membersCount === 1 ? 'membro' : 'membros'}
                    </Badge>
                    {team.notesCount > 0 && (
                      <Badge variant="secondary">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {team.notesCount} {team.notesCount === 1 ? 'nota' : 'notas'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {team.patient && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Paciente: {team.patient.name}</p>
                    </div>
                  )}

                  {team.lastMeetingAt && (
                    <p className="text-xs text-muted-foreground">
                      Última reunião: {new Date(team.lastMeetingAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOpenTeamRoom(team)}
                      className="flex-1"
                      data-testid={`button-open-room-${team.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Abrir Sala
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTeam(team);
                        setIsDetailsOpen(true);
                      }}
                      data-testid={`button-view-team-${team.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTeam?.name}</DialogTitle>
              <DialogDescription>{selectedTeam?.description}</DialogDescription>
            </DialogHeader>
            
            {selectedTeam && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getTeamTypeColor(selectedTeam.teamType)}>
                    {getTeamTypeLabel(selectedTeam.teamType)}
                  </Badge>
                  {selectedTeam.notesCount > 0 && (
                    <Badge variant="secondary">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {selectedTeam.notesCount} notas de discussão
                    </Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Membros da Equipe</h4>
                  <div className="space-y-2">
                    {selectedTeam.members?.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <Avatar>
                          <AvatarImage src={member.profilePicture || undefined} />
                          <AvatarFallback>
                            {member.userName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{member.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.specialization || member.userEmail}
                          </p>
                        </div>
                        {member.role === 'leader' && (
                          <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900">
                            <Crown className="h-3 w-3 mr-1" />
                            Líder
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedTeam.memberRole === 'leader' && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsAddMemberOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Convidar Especialista
                    </Button>
                  )}
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      handleOpenTeamRoom(selectedTeam);
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Ir para Discussão
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Convidar Especialista</DialogTitle>
              <DialogDescription>
                Adicione um médico à equipe para inter-consulta
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou especialidade..."
                  value={searchDoctor}
                  onChange={(e) => setSearchDoctor(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {filteredDoctors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum médico encontrado</p>
                ) : (
                  filteredDoctors.map((doctor) => {
                    const isAlreadyMember = selectedTeam?.members?.some(m => m.userId === doctor.id);
                    return (
                      <div key={doctor.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                        <Avatar>
                          <AvatarImage src={doctor.profilePicture || undefined} />
                          <AvatarFallback>{doctor.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{doctor.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doctor.specialization || doctor.email}
                          </p>
                        </div>
                        {doctor.isOnline && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                        )}
                        <Button
                          size="sm"
                          variant={isAlreadyMember ? "secondary" : "default"}
                          disabled={isAlreadyMember || addMemberMutation.isPending}
                          onClick={() => handleAddMember(doctor.id)}
                        >
                          {isAlreadyMember ? "Na equipe" : "Convidar"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  );
}
