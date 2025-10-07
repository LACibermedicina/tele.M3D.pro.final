import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Video, FileUp, FileText, Users, Download, Trash2, StickyNote } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface TeamFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

interface TeamNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface MedicalTeam {
  id: string;
  name: string;
  description: string | null;
  teamType: string;
  roomId: string | null;
  members: TeamMember[];
  files: TeamFile[];
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
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch team details
  const { data: team, isLoading } = useQuery<MedicalTeam>({
    queryKey: ['/api/medical-teams', teamId],
    enabled: !!teamId,
    refetchInterval: 5000,
  });

  // Start video call mutation
  const startVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/medical-teams/${teamId}/meeting`, {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.roomId) {
        // Open video consultation in new window or navigate
        setLocation(`/video-consultation/${data.roomId}`);
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao iniciar chamada em grupo",
        variant: "destructive",
      });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest('POST', `/api/medical-teams/${teamId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Anotação Adicionada",
        description: "Anotação compartilhada com sucesso",
      });
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams', teamId] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar anotação",
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
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

      toast({
        title: "Arquivo Enviado",
        description: "Arquivo compartilhado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/medical-teams', teamId] });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma anotação",
        variant: "destructive",
      });
      return;
    }
    addNoteMutation.mutate(noteContent);
  };

  const handleStartVideo = () => {
    startVideoMutation.mutate();
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
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{team.name}</h1>
            <p className="text-muted-foreground mt-2">
              {team.description || "Sala de colaboração da equipe"}
            </p>
          </div>
          
          <Button
            onClick={handleStartVideo}
            disabled={startVideoMutation.isPending}
            size="lg"
            data-testid="button-start-group-call"
          >
            <Video className="h-5 w-5 mr-2" />
            Iniciar Chamada em Grupo
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membros ({team.members?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {team.members?.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <Avatar>
                        <AvatarImage src={member.profilePicture || undefined} />
                        <AvatarFallback>
                          {member.userName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.userName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {member.specialization || member.userEmail}
                        </p>
                        {member.role === 'leader' && (
                          <Badge variant="outline" className="mt-1 text-xs">Líder</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Center/Right Panel - Tabs for Files and Notes */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="notes" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="notes" data-testid="tab-notes">
                  <StickyNote className="h-4 w-4 mr-2" />
                  Anotações Compartilhadas
                </TabsTrigger>
                <TabsTrigger value="files" data-testid="tab-files">
                  <FileText className="h-4 w-4 mr-2" />
                  Arquivos Compartilhados
                </TabsTrigger>
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Anotações da Equipe</CardTitle>
                    <CardDescription>
                      Compartilhe notas e observações com os membros da equipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add Note Form */}
                    <div className="space-y-2">
                      <Label htmlFor="note-content">Nova Anotação</Label>
                      <Textarea
                        id="note-content"
                        placeholder="Digite suas anotações aqui..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={4}
                        data-testid="textarea-note"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={addNoteMutation.isPending || !noteContent.trim()}
                        data-testid="button-add-note"
                      >
                        <StickyNote className="h-4 w-4 mr-2" />
                        Adicionar Anotação
                      </Button>
                    </div>

                    {/* Notes List */}
                    <ScrollArea className="h-[400px] border rounded-lg p-4">
                      {!team.notes || team.notes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <StickyNote className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhuma anotação ainda</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {team.notes.map((note) => (
                            <div key={note.id} className="border-l-4 border-primary pl-4 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm">{note.authorName}</p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(note.createdAt).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Files Tab */}
              <TabsContent value="files">
                <Card>
                  <CardHeader>
                    <CardTitle>Arquivos Compartilhados</CardTitle>
                    <CardDescription>
                      Faça upload e compartilhe documentos com a equipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Upload Form */}
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

                    {/* Files List */}
                    <ScrollArea className="h-[400px] border rounded-lg p-4">
                      {!team.files || team.files.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhum arquivo compartilhado</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {team.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{file.fileName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Por {file.uploadedByName} • {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                >
                                  <a href={file.fileUrl} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
