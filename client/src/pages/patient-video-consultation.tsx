import { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Maximize,
  Minimize,
  MessageSquare,
  Send,
  Stethoscope,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/use-websocket';

type ConsultationNote = {
  id: string;
  consultationId: string;
  userId: string;
  type: 'chat' | 'ai_query' | 'ai_response' | 'doctor_note' | 'annotation';
  content: string;
  metadata?: any;
  timestamp: string;
};

export default function PatientVideoConsultation() {
  const [, params] = useRoute('/patient/video/:consultationId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { messages: wsMessages } = useWebSocket();
  const consultationId = params?.consultationId || '';

  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  const { data: consultation } = useQuery<any>({
    queryKey: ['/api/video-consultations', consultationId],
    enabled: !!consultationId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (consultation?.status === 'ended') {
      leaveChannel();
      toast({
        title: 'Consulta encerrada',
        description: 'O médico encerrou a consulta.',
      });
      setLocation('/my-consultations');
    }
  }, [consultation?.status]);

  const { data: notes = [] } = useQuery<ConsultationNote[]>({
    queryKey: ['/api/video-consultations', consultationId, 'notes'],
    enabled: !!consultationId,
    refetchInterval: 3000,
  });

  const { data: agoraConfig, isLoading: tokenLoading } = useQuery<{
    token: string;
    appId: string;
    channelName: string;
    uid: number;
  }>({
    queryKey: ['agora-token-patient', consultationId],
    queryFn: async () => {
      const response = await apiRequest(
        'POST',
        '/api/video-consultations/agora-token',
        {
          channelName: consultationId,
          role: 'publisher',
        }
      );
      return response.json();
    },
    enabled: !!consultationId,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: { type: string; content: string; metadata?: any }) => {
      return apiRequest(
        'POST',
        '/api/video-consultations/' + consultationId + '/notes',
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
    },
  });

  useEffect(() => {
    const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setClient(agoraClient);

    agoraClient.on('user-published', async (remoteUser, mediaType) => {
      try {
        await agoraClient.subscribe(remoteUser, mediaType);
        if (mediaType === 'video') {
          setRemoteUsers((prev) => {
            if (prev.find((u) => u.uid === remoteUser.uid)) return prev;
            return [...prev, remoteUser];
          });
          if (remoteVideoRef.current) {
            remoteUser.videoTrack?.play(remoteVideoRef.current);
          }
        }
        if (mediaType === 'audio') {
          remoteUser.audioTrack?.play();
        }
      } catch (err) {
        console.error('Error subscribing to user:', err);
      }
    });

    agoraClient.on('user-unpublished', (remoteUser, mediaType) => {
      if (mediaType === 'video' && remoteVideoRef.current) {
        remoteUser.videoTrack?.stop();
      }
    });

    agoraClient.on('user-left', (remoteUser) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
    });

    agoraClient.on('user-joined', (remoteUser) => {
      console.log('Remote user joined:', remoteUser.uid);
      setRemoteUsers((prev) => {
        if (prev.find((u) => u.uid === remoteUser.uid)) return prev;
        return [...prev, remoteUser];
      });
    });

    return () => {
      agoraClient.removeAllListeners();
      leaveChannel();
    };
  }, []);

  useEffect(() => {
    if (agoraConfig && client && !joined) {
      joinChannel();
    }
  }, [agoraConfig, client, joined]);

  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(remoteVideoRef.current);
      }
    }
  }, [remoteUsers]);

  useEffect(() => {
    const latestMsg = wsMessages[wsMessages.length - 1];
    if (latestMsg?.type === 'consultation_note_added' && consultationId) {
      const noteData = latestMsg.data;
      if (!noteData?.consultationId || noteData.consultationId === consultationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
      }
    }
  }, [wsMessages, consultationId]);

  const joinChannel = async () => {
    if (!client || !agoraConfig || joined) return;
    try {
      await client.join(
        agoraConfig.appId,
        agoraConfig.channelName,
        agoraConfig.token,
        agoraConfig.uid
      );

      const tracksToPublish: (ICameraVideoTrack | IMicrophoneAudioTrack)[] = [];

      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(audioTrack);
        tracksToPublish.push(audioTrack);
      } catch (audioErr) {
        console.warn('Could not create audio track:', audioErr);
      }

      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        setLocalVideoTrack(videoTrack);
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
        tracksToPublish.push(videoTrack);
      } catch (videoErr) {
        console.warn('Could not create video track:', videoErr);
        setIsVideoOn(false);
      }

      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
      }

      setJoined(true);
      toast({
        title: 'Conectado',
        description: 'Você entrou na consulta por vídeo.',
      });
    } catch (error) {
      console.error('Error joining channel:', error);
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível entrar na vídeo consulta. Verifique suas permissões de câmera e microfone.',
        variant: 'destructive',
      });
    }
  };

  const leaveChannel = async () => {
    if (!client) return;
    localAudioTrack?.close();
    localVideoTrack?.close();
    await client.leave();
    setJoined(false);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
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

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    createNoteMutation.mutate({
      type: 'chat',
      content: chatMessage,
      metadata: { senderName: user?.name || 'Paciente', senderRole: 'patient' },
    });
    setChatMessage('');
  };

  const endCall = async () => {
    try {
      await apiRequest('POST', `/api/video-consultations/${consultationId}/leave`, {});
    } catch (e) {
      console.error('Error notifying leave:', e);
    }
    await leaveChannel();
    toast({
      title: 'Você saiu da consulta',
      description: 'Você saiu da vídeo consulta. O médico será notificado.',
    });
    setLocation('/my-consultations');
  };

  const chatNotes = notes.filter((n) => n.type === 'chat');

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <Stethoscope className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <p className="text-lg text-muted-foreground">Conectando à consulta...</p>
          <p className="text-sm text-muted-foreground">Preparando câmera e microfone</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'container mx-auto p-4'} bg-black flex flex-col`}>
      <div className="flex-1 relative" style={{ minHeight: showChat ? '60vh' : '85vh' }}>
        <div
          ref={remoteVideoRef}
          className="absolute inset-0 bg-gray-900"
        >
          {remoteUsers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aguardando o médico...</p>
                <p className="text-sm text-gray-400 mt-2">O médico será notificado da sua presença</p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 w-48 h-36 sm:w-64 sm:h-48 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <div ref={localVideoRef} className="w-full h-full" />
          {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-12 w-12 text-white opacity-50" />
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-gray-900/90 px-6 py-3 rounded-full">
          <Button
            variant={isVideoOn ? 'default' : 'destructive'}
            size="icon"
            onClick={toggleVideo}
            className="rounded-full"
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isAudioOn ? 'default' : 'destructive'}
            size="icon"
            onClick={toggleAudio}
            className="rounded-full"
          >
            {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={showChat ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowChat(!showChat)}
            className="rounded-full"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-full"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
            className="rounded-full ml-2"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showChat && (
        <div className="w-full bg-background border-t" style={{ height: '30vh' }}>
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="font-medium text-sm">Chat da Consulta</span>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {chatNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma mensagem ainda. Envie uma mensagem para o médico.
                  </p>
                )}
                {chatNotes.map((note) => {
                  const isPatient = note.metadata?.senderRole === 'patient' || note.userId === user?.id;
                  return (
                    <div key={note.id} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isPatient ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <div className="flex items-center gap-1 mb-0.5">
                          {isPatient ? <User className="h-3 w-3" /> : <Stethoscope className="h-3 w-3" />}
                          <span className="text-xs font-medium">{isPatient ? 'Você' : 'Dr.'}</span>
                        </div>
                        <p className="text-sm">{note.content}</p>
                        <p className={`text-xs mt-1 ${isPatient ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Mensagem para o médico..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <Button onClick={sendChatMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
