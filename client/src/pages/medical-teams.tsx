import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Video, Plus, UserPlus, Crown, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

export default function MedicalTeams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTeam, setSelectedTeam] = useState<MedicalTeam | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
      teamType: "clinical_discussion",
      patientId: "",
    },
  });

  // Fetch teams
  const { data: teams = [], isLoading } = useQuery<MedicalTeam[]>({
    queryKey: ['/api/medical-teams'],
    refetchInterval: 10000,
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamForm) => {
      const res = await apiRequest('POST', '/api/medical-teams', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Equipe Criada!",
        description: "Equipe médica criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams'] });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar equipe médica",
        variant: "destructive",
      });
    },
  });

  const handleCreateTeam = (data: CreateTeamForm) => {
    createTeamMutation.mutate(data);
  };

  const handleOpenTeamRoom = (team: MedicalTeam) => {
    // Navigate to team room
    setLocation(`/team-room/${team.id}`);
  };

  const getTeamTypeLabel = (type: string) => {
    switch (type) {
      case 'clinical_discussion':
        return 'Discussão Clínica';
      case 'patient_case':
        return 'Caso de Paciente';
      case 'study_group':
        return 'Grupo de Estudo';
      default:
        return type;
    }
  };

  const getTeamTypeColor = (type: string) => {
    switch (type) {
      case 'clinical_discussion':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'patient_case':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'study_group':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
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
      <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Equipes Médicas</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Salas de reunião para discussão de casos clínicos e estudos
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
                  Crie uma equipe para colaborar com outros médicos
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
                          <Input placeholder="Ex: Equipe de Cardiologia" {...field} data-testid="input-team-name" />
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
                          <Textarea placeholder="Descreva o propósito da equipe..." {...field} data-testid="textarea-description" />
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
                            <SelectItem value="patient_case">Caso de Paciente</SelectItem>
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
                  Crie sua primeira equipe para colaborar com outros médicos
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
              <Card key={team.id} className="hover:shadow-lg transition-shadow" data-testid={`team-card-${team.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {team.description || "Sem descrição"}
                      </CardDescription>
                    </div>
                    {team.memberRole === 'leader' && (
                      <Crown className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <Badge className={getTeamTypeColor(team.teamType)}>
                      {getTeamTypeLabel(team.teamType)}
                    </Badge>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {team.membersCount} {team.membersCount === 1 ? 'membro' : 'membros'}
                    </Badge>
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
                      <Users className="h-4 w-4 mr-2" />
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

        {/* Team Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTeam?.name}</DialogTitle>
              <DialogDescription>{selectedTeam?.description}</DialogDescription>
            </DialogHeader>
            
            {selectedTeam && (
              <div className="space-y-4">
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
                          <Badge variant="outline" className="bg-yellow-50">
                            <Crown className="h-3 w-3 mr-1" />
                            Líder
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTeam.memberRole === 'leader' && (
                  <Button variant="outline" className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar Membro
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  );
}
