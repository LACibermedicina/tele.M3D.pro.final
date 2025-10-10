import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  UserPlus,
  FileText,
  Brain,
  Send,
  Users,
  Stethoscope,
  MessageCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function ConsultationSession() {
  const [, params] = useRoute('/consultation-session/:sessionId');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const sessionId = params?.sessionId || '';

  // Agora states
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  // UI states
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);
  
  // Chat states
  const [messages, setMessages] = useState<Array<{id: string, user: string, text: string, timestamp: Date}>>([]);
  const [messageText, setMessageText] = useState('');

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session data
  const { data: session, isLoading } = useQuery<any>({
    queryKey: ['/api/consultation-sessions', sessionId],
    enabled: !!sessionId,
  });

  // Fetch available doctors for invitation
  const { data: allDoctors = [] } = useQuery<any[]>({
    queryKey: ['/api/users/doctors'],
    enabled: isInviteDialogOpen,
  });

  // Update clinical notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return await apiRequest(`/api/consultation-sessions/${sessionId}/clinical-notes`, 'POST', {
        notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consultation-sessions', sessionId] });
      toast({ title: "Notas salvas com sucesso!" });
    },
  });

  // Invite specialists mutation
  const inviteSpecialistsMutation = useMutation({
    mutationFn: async (specialistIds: string[]) => {
      return await apiRequest(`/api/consultation-sessions/${sessionId}/invite`, 'POST', {
        specialistIds
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consultation-sessions', sessionId] });
      toast({ title: "Especialistas convidados!" });
      setIsInviteDialogOpen(false);
      setSelectedSpecialists([]);
    },
  });

  // Generate AI summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/consultation-sessions/${sessionId}/summary`, 'POST');
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Resumo clínico gerado!",
        description: data.summary?.chiefComplaint || "Resumo disponível"
      });
    },
  });

  // Generate Agora token
  const { data: agoraConfig } = useQuery<{
    token: string;
    appId: string;
    channelName: string;
    uid: number;
  }>({
    queryKey: ['agora-token', sessionId],
    queryFn: async () => {
      return await apiRequest('/api/video-consultations/agora-token', 'POST', {
        channelName: sessionId,
        role: 'publisher',
      }) as any;
    },
    enabled: !!sessionId,
  });

  // Initialize Agora client
  useEffect(() => {
    const initAgora = async () => {
      if (!agoraConfig) return;

      const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setClient(agoraClient);

      agoraClient.on('user-published', async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);

        if (mediaType === 'video' && remoteVideoRef.current) {
          user.videoTrack?.play(remoteVideoRef.current);
        }
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
      });

      agoraClient.on('user-unpublished', (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      try {
        await agoraClient.join(
          agoraConfig.appId,
          agoraConfig.channelName,
          agoraConfig.token,
          agoraConfig.uid
        );

        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

        setLocalVideoTrack(videoTrack);
        setLocalAudioTrack(audioTrack);

        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        await agoraClient.publish([videoTrack, audioTrack]);
        setJoined(true);
      } catch (error) {
        console.error('Error joining channel:', error);
        toast({
          title: 'Erro ao conectar',
          description: 'Não foi possível conectar à videochamada',
          variant: 'destructive',
        });
      }
    };

    initAgora();

    return () => {
      localVideoTrack?.close();
      localAudioTrack?.close();
      client?.leave();
    };
  }, [agoraConfig]);

  // Load existing notes
  useEffect(() => {
    if (session?.clinicalNotes) {
      setClinicalNotes(session.clinicalNotes);
    }
  }, [session]);

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

  const handleLeave = async () => {
    if (clinicalNotes.trim()) {
      await updateNotesMutation.mutateAsync(clinicalNotes);
    }
    
    localVideoTrack?.close();
    localAudioTrack?.close();
    await client?.leave();
    navigate('/my-consultations');
  };

  const handleSaveNotes = () => {
    updateNotesMutation.mutate(clinicalNotes);
  };

  const handleInviteSpecialists = () => {
    if (selectedSpecialists.length > 0) {
      inviteSpecialistsMutation.mutate(selectedSpecialists);
    }
  };

  const sendMessage = () => {
    if (messageText.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        user: user?.name || 'Anônimo',
        text: messageText.trim(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="p-6">
            <p>Sessão não encontrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDoctor = user?.role === 'doctor';
  const invitedSpecialists = session.invitedSpecialists || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 h-screen">
        {/* Video Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[70vh]">
            <CardContent className="p-4 h-full">
              <div className="relative h-full bg-gray-900 rounded-lg overflow-hidden">
                {/* Remote Video */}
                <div ref={remoteVideoRef} className="w-full h-full" data-testid="video-remote" />
                
                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
                  <div ref={localVideoRef} className="w-full h-full" data-testid="video-local" />
                </div>

                {/* Video Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                  <Button
                    data-testid="button-toggle-video"
                    variant={isVideoOn ? 'default' : 'destructive'}
                    size="lg"
                    onClick={toggleVideo}
                    className="rounded-full w-14 h-14"
                  >
                    {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </Button>
                  <Button
                    data-testid="button-toggle-audio"
                    variant={isAudioOn ? 'default' : 'destructive'}
                    size="lg"
                    onClick={toggleAudio}
                    className="rounded-full w-14 h-14"
                  >
                    {isAudioOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </Button>
                  <Button
                    data-testid="button-leave"
                    variant="destructive"
                    size="lg"
                    onClick={handleLeave}
                    className="rounded-full w-14 h-14"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                {/* Participants Badge */}
                <div className="absolute top-4 left-4">
                  <Badge variant="secondary" className="bg-black/50 text-white">
                    <Users className="w-4 h-4 mr-2" />
                    {remoteUsers.length + 1} participante(s)
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specialist Invitation (Doctor only) */}
          {isDoctor && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    Especialistas
                  </CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setIsInviteDialogOpen(true)}
                    data-testid="button-invite-specialist"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Convidar
                  </Button>
                </div>
              </CardHeader>
              {invitedSpecialists.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex gap-2 flex-wrap">
                    {invitedSpecialists.map((id: string) => (
                      <Badge key={id} variant="outline">
                        Especialista
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          <Card className="h-[85vh]">
            <Tabs defaultValue="notes" className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="notes" data-testid="tab-notes">
                    <FileText className="w-4 h-4 mr-2" />
                    Notas
                  </TabsTrigger>
                  <TabsTrigger value="chat" data-testid="tab-chat">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="ai" data-testid="tab-ai">
                    <Brain className="w-4 h-4 mr-2" />
                    IA
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden">
                <TabsContent value="notes" className="h-full space-y-3 mt-0">
                  <Textarea
                    data-testid="textarea-clinical-notes"
                    placeholder="Anote observações clínicas durante a consulta..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="h-[calc(100%-50px)] resize-none"
                    disabled={!isDoctor}
                  />
                  {isDoctor && (
                    <Button 
                      onClick={handleSaveNotes}
                      disabled={updateNotesMutation.isPending}
                      className="w-full"
                      data-testid="button-save-notes"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Salvar Notas
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="chat" className="h-full flex flex-col mt-0">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-3 pb-4">
                      {messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhuma mensagem ainda. Comece a conversar!
                        </p>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className="space-y-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium">{msg.user}</span>
                              <span className="text-xs text-muted-foreground">
                                {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm bg-muted px-3 py-2 rounded-lg">{msg.text}</p>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2 pt-3">
                    <Input
                      data-testid="input-chat-message"
                      placeholder="Digite sua mensagem..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button 
                      size="icon" 
                      onClick={sendMessage} 
                      disabled={!messageText.trim()}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="h-full space-y-3 mt-0">
                  <ScrollArea className="h-[calc(100%-50px)]">
                    <div className="space-y-3 pr-4">
                      <p className="text-sm text-muted-foreground">
                        Gere um resumo clínico automatizado da consulta usando IA
                      </p>
                    </div>
                  </ScrollArea>
                  {isDoctor && (
                    <Button 
                      onClick={() => generateSummaryMutation.mutate()}
                      disabled={generateSummaryMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-summary"
                    >
                      <Brain className="w-4 h-4 mr-2" />
                      Gerar Resumo Clínico
                    </Button>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Invite Specialists Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Especialistas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ScrollArea className="h-64">
              {allDoctors.map((doctor: any) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between p-3 border rounded-lg mb-2 cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setSelectedSpecialists((prev) =>
                      prev.includes(doctor.id)
                        ? prev.filter((id) => id !== doctor.id)
                        : [...prev, doctor.id]
                    );
                  }}
                >
                  <div>
                    <p className="font-medium">{doctor.name}</p>
                    <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedSpecialists.includes(doctor.id)}
                    readOnly
                  />
                </div>
              ))}
            </ScrollArea>
            <Button
              onClick={handleInviteSpecialists}
              disabled={selectedSpecialists.length === 0 || inviteSpecialistsMutation.isPending}
              className="w-full"
              data-testid="button-confirm-invite"
            >
              Convidar Selecionados
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
