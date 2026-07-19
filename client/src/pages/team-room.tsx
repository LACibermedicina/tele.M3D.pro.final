import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Video, FileUp, FileText, Users, Download, StickyNote, MessageSquare, AlertCircle, Stethoscope, ArrowLeft, Send, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormattedText } from "@/components/ui/formatted-text";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

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

interface TeamNote {
  id: string;
  content: string;
  noteType: string;
  isUrgent: boolean;
  parentNoteId: string | null;
  authorId: string;
  authorName: string;
  authorSpecialization: string | null;
  createdAt: string;
}

interface MedicalTeam {
  id: string;
  name: string;
  description: string | null;
  teamType: string;
  roomId: string | null;
  memberRole: string;
  members: TeamMember[];
  notes: TeamNote[];
  patient: any;
}

export default function TeamRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/team-room/:id");
  const teamId = params?.id;
  
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("discussion");
  const [isUrgent, setIsUrgent] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeNoteFilter, setActiveNoteFilter] = useState("all");

  const { data: team, isLoading } = useQuery<MedicalTeam>({
    queryKey: ['/api/medical-teams', teamId],
    enabled: !!teamId,
    refetchInterval: 5000,
  });

  const startVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/medical-teams/${teamId}/meeting`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.roomId) {
        setLocation(`/video-consultation/${data.roomId}`);
      }
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao iniciar chamada em grupo", variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ content, noteType, isUrgent }: { content: string; noteType: string; isUrgent: boolean }) => {
      const res = await apiRequest('POST', `/api/medical-teams/${teamId}/notes`, { content, noteType, isUrgent });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Anotação Adicionada", description: "Anotação compartilhada com a equipe" });
      setNoteContent("");
      setIsUrgent(false);
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams', teamId] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao adicionar anotação", variant: "destructive" });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/medical-teams/${teamId}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Upload failed');

      toast({ title: "Arquivo Enviado", description: "Arquivo compartilhado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams', teamId] });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast({ title: "Erro", description: "Digite uma anotação", variant: "destructive" });
      return;
    }
    addNoteMutation.mutate({ content: noteContent, noteType, isUrgent });
  };

  const getNoteTypeLabel = (type: string) => {
    switch (type) {
      case 'discussion': return 'Discussão';
      case 'interconsultation': return 'Inter-Consulta';
      case 'case_summary': return 'Resumo do Caso';
      case 'clinical_question': return 'Pergunta Clínica';
      default: return type;
    }
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'discussion': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'interconsultation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'case_summary': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'clinical_question': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getNoteTypeIcon = (type: string) => {
    switch (type) {
      case 'discussion': return <MessageSquare className="h-3 w-3" />;
      case 'interconsultation': return <Stethoscope className="h-3 w-3" />;
      case 'case_summary': return <FileText className="h-3 w-3" />;
      case 'clinical_question': return <BookOpen className="h-3 w-3" />;
      default: return <StickyNote className="h-3 w-3" />;
    }
  };

  const filteredNotes = (team?.notes || []).filter(note => {
    if (activeNoteFilter === 'all') return true;
    if (activeNoteFilter === 'urgent') return note.isUrgent;
    return note.noteType === activeNoteFilter;
  });

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

  if (isLoading) {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando sala da equipe...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!team) {
    return (
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Equipe não encontrada</p>
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/medical-teams')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{team.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {team.description || "Sala de colaboração da equipe"}
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => startVideoMutation.mutate()}
            disabled={startVideoMutation.isPending}
            size="lg"
            data-testid="button-start-group-call"
          >
            <Video className="h-5 w-5 mr-2" />
            Chamada em Grupo
          </Button>
        </div>

        {team.patient && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p data-no-translate className="font-medium text-sm">Paciente em discussão: {team.patient.name}</p>
                {team.patient.healthStatus && (
                  <p className="text-xs text-muted-foreground">Status: {team.patient.healthStatus}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Membros ({team.members?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] lg:h-[500px]">
                <div className="space-y-2">
                  {team.members?.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profilePicture || undefined} />
                        <AvatarFallback data-no-translate className="text-xs">
                          {member.userName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p data-no-translate className="font-medium text-sm truncate">{member.userName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.specialization || "Médico"}
                        </p>
                      </div>
                      {member.role === 'leader' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">Líder</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            <Tabs defaultValue="discussion" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="discussion" data-testid="tab-discussion">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Discussão
                </TabsTrigger>
                <TabsTrigger value="interconsultation" data-testid="tab-interconsultation">
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Inter-Consulta
                </TabsTrigger>
                <TabsTrigger value="files" data-testid="tab-files">
                  <FileText className="h-4 w-4 mr-2" />
                  Arquivos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="discussion">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Discussão de Caso</CardTitle>
                    <CardDescription>
                      Compartilhe notas clínicas, observações e resumos com a equipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                      <Textarea
                        placeholder="Compartilhe sua análise clínica, hipóteses diagnósticas ou observações..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={3}
                        data-testid="textarea-note"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Select value={noteType} onValueChange={setNoteType}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discussion">Discussão</SelectItem>
                            <SelectItem value="case_summary">Resumo do Caso</SelectItem>
                            <SelectItem value="clinical_question">Pergunta Clínica</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch checked={isUrgent} onCheckedChange={setIsUrgent} id="urgent" />
                          <Label htmlFor="urgent" className="text-sm cursor-pointer flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            Urgente
                          </Label>
                        </div>
                        <Button
                          onClick={handleAddNote}
                          disabled={addNoteMutation.isPending || !noteContent.trim()}
                          data-testid="button-add-note"
                          className="ml-auto"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Enviar
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {["all", "discussion", "case_summary", "clinical_question", "urgent"].map((filter) => (
                        <Button
                          key={filter}
                          variant={activeNoteFilter === filter ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveNoteFilter(filter)}
                        >
                          {filter === 'all' ? 'Todas' :
                           filter === 'urgent' ? '🔴 Urgentes' :
                           getNoteTypeLabel(filter)}
                        </Button>
                      ))}
                    </div>

                    <ScrollArea className="h-[400px]">
                      {filteredNotes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma anotação nesta categoria</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredNotes.map((note) => (
                            <div
                              key={note.id}
                              className={`border-l-4 pl-4 py-3 rounded-r-lg ${
                                note.isUrgent
                                  ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20'
                                  : 'border-primary bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px]">
                                    {note.authorName.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{note.authorName}</span>
                                {note.authorSpecialization && (
                                  <span className="text-xs text-muted-foreground">• {note.authorSpecialization}</span>
                                )}
                                <Badge className={`text-[10px] px-1.5 py-0 ${getNoteTypeColor(note.noteType)}`}>
                                  {getNoteTypeIcon(note.noteType)}
                                  <span className="ml-1">{getNoteTypeLabel(note.noteType)}</span>
                                </Badge>
                                {note.isUrgent && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    Urgente
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(note.createdAt).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <FormattedText content={note.content} className="text-sm" />
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="interconsultation">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Pedido de Inter-Consulta</CardTitle>
                    <CardDescription>
                      Solicite parecer de especialistas sobre o caso em discussão
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                      <Textarea
                        placeholder="Descreva o motivo da inter-consulta, hipóteses diagnósticas e informações relevantes do caso..."
                        value={noteType === 'interconsultation' ? noteContent : ''}
                        onChange={(e) => {
                          setNoteType('interconsultation');
                          setNoteContent(e.target.value);
                        }}
                        rows={5}
                        data-testid="textarea-interconsultation"
                      />
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isUrgent}
                            onCheckedChange={setIsUrgent}
                            id="urgent-ic"
                          />
                          <Label htmlFor="urgent-ic" className="text-sm cursor-pointer flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            Urgente
                          </Label>
                        </div>
                        <Button
                          onClick={() => {
                            if (!noteContent.trim()) {
                              toast({ title: "Erro", description: "Descreva o pedido de inter-consulta", variant: "destructive" });
                              return;
                            }
                            addNoteMutation.mutate({ content: noteContent, noteType: 'interconsultation', isUrgent });
                          }}
                          disabled={addNoteMutation.isPending}
                          className="ml-auto"
                        >
                          <Stethoscope className="h-4 w-4 mr-2" />
                          Enviar Pedido
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Histórico de Inter-Consultas</h4>
                      <ScrollArea className="h-[350px]">
                        {(team.notes || []).filter(n => n.noteType === 'interconsultation').length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhum pedido de inter-consulta registrado</p>
                            <p className="text-xs mt-1">Solicite parecer de especialistas sobre casos complexos</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(team.notes || [])
                              .filter(n => n.noteType === 'interconsultation')
                              .map((note) => (
                                <div
                                  key={note.id}
                                  className={`border rounded-lg p-4 ${
                                    note.isUrgent
                                      ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                                      : 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <Stethoscope className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                    <span className="font-medium text-sm">{note.authorName}</span>
                                    {note.authorSpecialization && (
                                      <Badge variant="outline" className="text-[10px]">{note.authorSpecialization}</Badge>
                                    )}
                                    {note.isUrgent && (
                                      <Badge variant="destructive" className="text-[10px]">Urgente</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {new Date(note.createdAt).toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                  <FormattedText content={note.content} className="text-sm" />
                                </div>
                              ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="files">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Arquivos Compartilhados</CardTitle>
                    <CardDescription>
                      Compartilhe exames, laudos e documentos relevantes ao caso
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="file-upload">Enviar Arquivo</Label>
                      <div className="flex gap-2">
                        <Input
                          id="file-upload"
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          data-testid="input-file-upload"
                        />
                        <Button disabled={uploadingFile} variant="outline">
                          <FileUp className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PDF, imagens, documentos - máximo 10MB
                      </p>
                    </div>

                    <ScrollArea className="h-[400px] border rounded-lg p-4">
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum arquivo compartilhado</p>
                        <p className="text-xs mt-1">Envie exames e documentos para discussão</p>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
