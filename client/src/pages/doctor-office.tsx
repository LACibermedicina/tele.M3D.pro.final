import { useState, useEffect, useRef } from "react";
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
import { Stethoscope, UserPlus, Copy, Link as LinkIcon, Users, Video, VideoOff, X, Clock, History, AlertTriangle, UserCheck } from "lucide-react";
import { TriageBadge } from "@/components/triage/triage-badge";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import DraggableDashboardPanel from "@/components/dashboard/draggable-dashboard-panel";
import { useMinimizedPanels } from "@/contexts/MinimizedPanelsContext";

export default function DoctorOffice() {
  const { restoreAll } = useMinimizedPanels();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isOfficeOpen, setIsOfficeOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [externalInviteLink, setExternalInviteLink] = useState("");
  const [specialistEmail, setSpecialistEmail] = useState("");
  const [participants, setParticipants] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chronoNow, setChronoNow] = useState(Date.now());
  
  // Agora RTC
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);

  const { data: officeStatus } = useQuery<{ isOpen: boolean; doctorName: string; channelName: string; openedAt: string | null; currentSessionId: string | null; lastHeartbeatAt: string | null }>({
    queryKey: ['/api/doctor-office/status', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      const res = await fetch(`/api/doctor-office/status/${user.id}`);
      if (!res.ok) throw new Error('Failed to fetch office status');
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  type SessionRow = { id: string; openedAt: string; closedAt: string | null; closeReason: string | null; totalSeconds: number | null; participantCount: number | null };
  const { data: sessionHistory = [], refetch: refetchHistory } = useQuery<SessionRow[]>({
    queryKey: ['/api/doctor-office/sessions', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/doctor-office/sessions?limit=20', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load history');
      return res.json();
    },
    enabled: !!user?.id && historyOpen,
  });

  type PendingRequest = {
    id: string;
    patientName: string;
    symptoms: string;
    urgencyLevel: string;
    queueType: 'directed' | 'general';
    requestedUrgent: boolean;
    directedToMe: boolean;
    waitingMinutes: number;
    createdAt: string;
  };
  const { data: pendingRequests = [] } = useQuery<PendingRequest[]>({
    queryKey: ['/api/doctor-office/pending-requests'],
    enabled: user?.role === 'doctor',
    refetchInterval: 5000,
  });

  const fmtWaiting = (minutes: number) => {
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const admitMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest('POST', `/api/doctor-office/admit/${requestId}`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Paciente admitido',
        description: `${data.patientName || 'Paciente'} foi chamado(a) para o consultório.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-office/pending-requests'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao admitir paciente', description: error.message, variant: 'destructive' });
    },
  });

  const { data: presenceCfg } = useQuery<Record<string, string>>({
    queryKey: ['/api/system-settings/public/presence'],
  });
  const heartbeatMs = Math.max(5, parseInt(presenceCfg?.doctor_office_heartbeat_seconds || '30', 10)) * 1000;

  // Live chronometer + heartbeat ping while office is open (interval from server settings)
  useEffect(() => {
    if (!isOfficeOpen) return;
    const tick = setInterval(() => setChronoNow(Date.now()), 1000);
    const heartbeat = setInterval(() => {
      const remoteCount = agoraClient?.remoteUsers?.length ?? participants.length;
      fetch('/api/doctor-office/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantCount: remoteCount }),
      }).catch(() => {});
    }, heartbeatMs);
    return () => { clearInterval(tick); clearInterval(heartbeat); };
  }, [isOfficeOpen, participants.length, heartbeatMs, agoraClient]);

  const elapsedSeconds = (() => {
    if (!officeStatus?.openedAt) return 0;
    return Math.max(0, Math.floor((chronoNow - new Date(officeStatus.openedAt).getTime()) / 1000));
  })();
  const fmtElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  const fmtDuration = (s: number | null) => {
    if (s === null || s === undefined) return '—';
    return fmtElapsed(s);
  };

  const cleanupAgora = async () => {
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
    }
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    if (agoraClient) {
      try { await agoraClient.leave(); } catch {}
    }
    document.querySelectorAll('[id^="remote-"]').forEach((el) => el.remove());
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setAgoraClient(null);
    setIsVideoOn(false);
    setIsAudioOn(false);
    setParticipants([]);
  };

  useEffect(() => {
    if (!officeStatus) return;
    // Detect server-side auto-close (e.g., inactivity cron) while we still hold an Agora client
    if (!officeStatus.isOpen && (isOfficeOpen || agoraClient)) {
      setIsOfficeOpen(false);
      cleanupAgora();
      toast({
        title: 'Consultório encerrado',
        description: 'A sessão foi fechada automaticamente por inatividade.',
      });
      return;
    }
    setIsOfficeOpen(officeStatus.isOpen);
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
        
        const channelName = data.channelName || `doctor-office-${user?.id}`;
        
        // Generate numeric UID from user ID (Agora requires numeric UID)
        const numericUid = user?.id ? parseInt(user.id.replace(/\D/g, '').slice(0, 10)) || 0 : 0;
        
        const tokenResponse = await fetch('/api/agora/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelName,
            uid: numericUid,
            displayName: user?.name,
            participantRole: user?.role || 'doctor',
          }),
        });
        
        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.message || 'Falha ao gerar token de acesso');
        }
        
        const { token, appId } = await tokenResponse.json();
        
        await client.join(appId, channelName, token, numericUid);
        
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
        setIsAudioOn(true);
        setIsVideoOn(true);
        
        await client.publish([audioTrack, videoTrack]);
        
        videoTrack.play('local-video');
        
        // Setup remote users handler
        client.on("user-published", async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);
          
          if (mediaType === "video") {
            const remotePlayerContainer = document.createElement("div");
            remotePlayerContainer.id = `remote-${remoteUser.uid}`;
            remotePlayerContainer.className = "absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden bg-gray-800";
            document.getElementById('local-video')?.appendChild(remotePlayerContainer);
            remoteUser.videoTrack?.play(`remote-${remoteUser.uid}`);
          }
          
          if (mediaType === "audio") {
            remoteUser.audioTrack?.play();
          }
        });
        
        client.on("user-unpublished", (remoteUser) => {
          const playerContainer = document.getElementById(`remote-${remoteUser.uid}`);
          playerContainer?.remove();
        });

        // Resolve numeric Agora UIDs to human-friendly names/roles via the
        // server-side participant directory, then rebuild the list from the
        // actual remote users currently in the channel.
        const resolveAndSetParticipants = async () => {
          const directory: Record<string, { name: string; role: string }> = {};
          try {
            const dirRes = await fetch(`/api/agora/participants/${encodeURIComponent(channelName)}`, {
              credentials: 'include',
            });
            if (dirRes.ok) {
              const data = await dirRes.json();
              for (const p of (data.participants || [])) {
                directory[String(p.uid)] = { name: p.name, role: p.role };
              }
            }
          } catch (err) {
            console.error('Failed to resolve participant directory:', err);
          }
          setParticipants(
            client.remoteUsers.map((u) => {
              const info = directory[String(u.uid)];
              return {
                uid: u.uid,
                name: info?.name || 'Participante convidado',
                role: info?.role || 'Convidado',
              };
            })
          );
        };

        client.on("user-joined", () => {
          void resolveAndSetParticipants();
        });

        client.on("user-left", (remoteUser) => {
          const playerContainer = document.getElementById(`remote-${remoteUser.uid}`);
          playerContainer?.remove();
          void resolveAndSetParticipants();
        });

        // Initialize from any users already in the channel
        void resolveAndSetParticipants();
        
      } catch (error) {
        console.error('Agora initialization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        toast({
          title: "Erro ao Abrir Consultório",
          description: errorMessage.includes('credentials') 
            ? "Credenciais do Agora.io não configuradas. Entre em contato com o administrador."
            : "Não foi possível iniciar o vídeo. Verifique suas permissões de câmera e microfone.",
          variant: "destructive",
        });
        // Rollback office open state on error
        closeOfficeMutation.mutate();
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

  // One-click "Abrir Consultório" from the dashboard: arriving with
  // ?autoOpen=1 opens the office and joins the video room immediately.
  const autoOpenTriggered = useRef(false);
  useEffect(() => {
    if (autoOpenTriggered.current) return;
    if (user?.role !== 'doctor') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoOpen') !== '1') return;
    autoOpenTriggered.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    openOfficeMutation.mutate();
  }, [user?.role]);

  const closeOfficeMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/doctor-office/close', {}),
    onSuccess: async () => {
      toast({
        title: "Consultório Fechado",
        description: "Seu consultório foi fechado.",
      });
      setIsOfficeOpen(false);
      await cleanupAgora();
      queryClient.invalidateQueries({ queryKey: ['/api/doctor-office/status'] });
    },
    onError: (err: any) => {
      console.error('Close office error:', err);
      const description = err?.message || 'Não foi possível fechar o consultório. Tente novamente.';
      toast({
        title: 'Erro ao fechar consultório',
        description,
        variant: 'destructive',
      });
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
      <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Acesso restrito a médicos.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
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
          
          <div className="flex gap-3 items-center">
            {isOfficeOpen && officeStatus?.openedAt && (
              <div data-testid="office-chronometer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono text-sm">
                <Clock className="h-4 w-4" />
                {fmtElapsed(elapsedSeconds)}
              </div>
            )}
            <Button variant="outline" onClick={() => { setHistoryOpen(true); refetchHistory(); }} data-testid="btn-history">
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
            {isOfficeOpen ? (
              <Button 
                variant="destructive" 
                onClick={() => closeOfficeMutation.mutate()}
                disabled={closeOfficeMutation.isPending}
                data-testid="btn-close-office"
              >
                <VideoOff className="h-4 w-4 mr-2" />
                Fechar Consultório
              </Button>
            ) : (
              <Button 
                onClick={() => openOfficeMutation.mutate()}
                disabled={openOfficeMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
                data-testid="btn-open-office"
              >
                <Video className="h-4 w-4 mr-2" />
                Abrir Consultório
              </Button>
            )}
          </div>
        </div>

        {/* Urgent patients awaiting admission */}
        <DraggableDashboardPanel id="office-urgencies" label="Pacientes Aguardando" icon="users" dashboardKey="doctor-office">
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 mb-6" data-testid="panel-urgent-requests">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pacientes Aguardando Atendimento
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" data-testid="badge-pending-count">{pendingRequests.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Solicitações pendentes de consulta — admita o paciente para atendê-lo agora no consultório
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum paciente aguardando no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {!isOfficeOpen && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Abra o consultório para poder admitir pacientes.
                  </p>
                )}
                {pendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-start justify-between gap-4 p-3 rounded-lg border ${r.requestedUrgent ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20' : 'bg-muted/40'}`}
                    data-testid={`row-urgent-${r.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" data-no-translate>{r.patientName}</span>
                        <TriageBadge level={r.urgencyLevel} size="sm" />
                        {r.queueType === 'general' && (
                          <Badge variant="outline" className={r.requestedUrgent ? 'border-red-400 text-red-600' : 'border-emerald-400 text-emerald-600'}>
                            {r.requestedUrgent ? 'Urgência' : 'Fila Geral'}
                          </Badge>
                        )}
                        {r.directedToMe && (
                          <Badge variant="outline" className="border-blue-400 text-blue-600">Para você</Badge>
                        )}
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          aguardando {fmtWaiting(r.waitingMinutes)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-no-translate>{r.symptoms}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => admitMutation.mutate(r.id)}
                      disabled={admitMutation.isPending || !isOfficeOpen}
                      data-testid={`btn-admit-${r.id}`}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Admitir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </DraggableDashboardPanel>

        {isOfficeOpen ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Area */}
            <DraggableDashboardPanel id="office-video" label="Sala de Consulta" icon="video" dashboardKey="doctor-office">
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
            </DraggableDashboardPanel>

            {/* Invites Panel */}
            <DraggableDashboardPanel id="office-invites" label="Participantes" icon="users" dashboardKey="doctor-office">
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
            </DraggableDashboardPanel>
          </div>
        ) : (
          <DraggableDashboardPanel id="office-closed" label="Status do Consultório" icon="stethoscope" dashboardKey="doctor-office">
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
          </DraggableDashboardPanel>
        )}
      </div>

      {/* Session History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Sessões do Consultório</DialogTitle>
            <DialogDescription>Últimas 20 sessões abertas/fechadas</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {sessionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma sessão registrada ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Aberto</th>
                    <th className="text-left py-2">Fechado</th>
                    <th className="text-left py-2">Duração</th>
                    <th className="text-left py-2">Motivo</th>
                    <th className="text-right py-2">Particip.</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionHistory.map((s) => (
                    <tr key={s.id} className="border-b last:border-0" data-testid={`row-session-${s.id}`}>
                      <td className="py-2">{new Date(s.openedAt).toLocaleString('pt-BR')}</td>
                      <td className="py-2">{s.closedAt ? new Date(s.closedAt).toLocaleString('pt-BR') : <Badge variant="outline" className="text-emerald-600">Em andamento</Badge>}</td>
                      <td className="py-2 font-mono">{fmtDuration(s.totalSeconds)}</td>
                      <td className="py-2 capitalize">{s.closeReason || (s.closedAt ? '—' : '—')}</td>
                      <td className="py-2 text-right">{s.participantCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
