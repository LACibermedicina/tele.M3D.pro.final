import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Stethoscope, UserPlus, Copy, Link as LinkIcon, Users, Video, VideoOff, X } from "lucide-react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import PageWrapper from "@/components/layout/page-wrapper";

export default function DoctorOffice() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isOfficeOpen, setIsOfficeOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [externalInviteLink, setExternalInviteLink] = useState("");
  const [specialistEmail, setSpecialistEmail] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  
  // Agora RTC
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);

  const { data: officeStatus } = useQuery({
    queryKey: ['/api/doctor-office/status', user?.id],
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (officeStatus) {
      setIsOfficeOpen(officeStatus.isOpen);
    }
  }, [officeStatus]);

  const openOfficeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/doctor-office/open', {}),
    onSuccess: async (data: any) => {
      toast({
        title: "Consultório Aberto",
        description: "Seu consultório virtual está agora aberto para consultas.",
      });
      setIsOfficeOpen(true);
      
      // Initialize Agora
      try {
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setAgoraClient(client);
        
        const appId = import.meta.env.VITE_AGORA_APP_ID || "YOUR_AGORA_APP_ID";
        const channelName = data.channelName || `doctor-office-${user?.id}`;
        
        const tokenResponse = await fetch('/api/agora/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, uid: user?.id }),
        });
        const { token } = await tokenResponse.json();
        
        await client.join(appId, channelName, token, user?.id);
        
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
        setIsAudioOn(true);
        setIsVideoOn(true);
        
        await client.publish([audioTrack, videoTrack]);
        
        videoTrack.play('local-video');
      } catch (error) {
        console.error('Agora initialization error:', error);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-office/status'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o consultório.",
        variant: "destructive",
      });
    },
  });

  const closeOfficeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/doctor-office/close', {}),
    onSuccess: async () => {
      toast({
        title: "Consultório Fechado",
        description: "Seu consultório foi fechado.",
      });
      setIsOfficeOpen(false);
      
      // Cleanup Agora
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
      }
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
      }
      if (agoraClient) {
        await agoraClient.leave();
      }
      
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setAgoraClient(null);
      setIsVideoOn(false);
      setIsAudioOn(false);
      
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-office/status'] });
    },
  });

  const generateExternalLink = async () => {
    try {
      const response = await fetch('/api/doctor-office/generate-external-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: user?.id }),
      });
      const { link } = await response.json();
      setExternalInviteLink(link);
      setInviteDialogOpen(true);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar link de convite.",
        variant: "destructive",
      });
    }
  };

  const inviteSpecialist = async () => {
    if (!specialistEmail) return;
    
    try {
      await apiRequest('POST', '/api/doctor-office/invite-specialist', {
        email: specialistEmail,
        doctorId: user?.id,
      });
      
      toast({
        title: "Convite Enviado",
        description: `Convite enviado para ${specialistEmail}`,
      });
      
      setSpecialistEmail("");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar convite.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Link copiado para área de transferência.",
    });
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(!isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioOn);
      setIsAudioOn(!isAudioOn);
    }
  };

  if (user?.role !== 'doctor') {
    return (
      <PageWrapper variant="origami">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Acesso restrito a médicos.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <Stethoscope className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Consultório Virtual
              </h1>
              <p className="text-muted-foreground">Gerencie seu consultório e convide especialistas</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {isOfficeOpen ? (
              <Button 
                variant="destructive" 
                onClick={() => closeOfficeMutation.mutate()}
                disabled={closeOfficeMutation.isPending}
              >
                <VideoOff className="h-4 w-4 mr-2" />
                Fechar Consultório
              </Button>
            ) : (
              <Button 
                onClick={() => openOfficeMutation.mutate()}
                disabled={openOfficeMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                <Video className="h-4 w-4 mr-2" />
                Abrir Consultório
              </Button>
            )}
          </div>
        </div>

        {isOfficeOpen ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Area */}
            <div className="lg:col-span-2">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader>
                  <CardTitle>Sala de Consulta</CardTitle>
                  <CardDescription>Transmissão ao vivo do consultório</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                    <div id="local-video" className="w-full h-full"></div>
                    
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                      <Button
                        variant={isVideoOn ? "default" : "destructive"}
                        size="icon"
                        onClick={toggleVideo}
                      >
                        {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant={isAudioOn ? "default" : "destructive"}
                        size="icon"
                        onClick={toggleAudio}
                      >
                        <i className={`fas fa-${isAudioOn ? 'microphone' : 'microphone-slash'} text-sm`}></i>
                      </Button>
                    </div>

                    {!isVideoOn && !isAudioOn && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-white text-lg">Câmera e microfone desligados</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invites Panel */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Convidar Participantes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="specialist">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="specialist">Especialista</TabsTrigger>
                      <TabsTrigger value="external">Externo</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="specialist" className="space-y-3 mt-4">
                      <Label>Email do Especialista</Label>
                      <Input
                        type="email"
                        placeholder="email@especialista.com"
                        value={specialistEmail}
                        onChange={(e) => setSpecialistEmail(e.target.value)}
                      />
                      <Button onClick={inviteSpecialist} className="w-full">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Enviar Convite
                      </Button>
                    </TabsContent>
                    
                    <TabsContent value="external" className="space-y-3 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Gere um link para participantes externos (pacientes, familiares)
                      </p>
                      <Button onClick={generateExternalLink} className="w-full">
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Gerar Link de Acesso
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participantes ({participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum participante ainda
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <span className="text-sm font-medium">{p.name}</span>
                          <Badge variant="outline">{p.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  <Stethoscope className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Consultório Fechado</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Abra seu consultório virtual para começar a atender pacientes e colaborar com especialistas
                </p>
                <Button 
                  size="lg"
                  onClick={() => openOfficeMutation.mutate()}
                  disabled={openOfficeMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  <Video className="h-5 w-5 mr-2" />
                  Abrir Consultório Agora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* External Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de Acesso Externo</DialogTitle>
            <DialogDescription>
              Compartilhe este link com participantes externos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={externalInviteLink} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(externalInviteLink)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este link é válido por 24 horas e permite acesso único ao consultório virtual
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
