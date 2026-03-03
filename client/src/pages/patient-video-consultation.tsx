import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMediaCleanupOnUnmount } from '@/hooks/use-media-guard';
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
import { Badge } from '@/components/ui/badge';
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
  ArrowLeftRight,
  Monitor,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/use-websocket';

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

type ConsultationNote = {
  id: string;
  consultationId: string;
  userId: string;
  type: 'chat' | 'ai_query' | 'ai_response' | 'doctor_note' | 'annotation' | 'transcription' | 'iam3d_diagnostic';
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
  useMediaCleanupOnUnmount('patient-video-consultation');

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
  const [videoSwapped, setVideoSwapped] = useState(false);
  const [isRemoteScreenShare, setIsRemoteScreenShare] = useState(false);
  const [screenShareMinimized, setScreenShareMinimized] = useState(false);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const screenShareRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isTranscribingRef = useRef(false);
  const transcriptBufferRef = useRef<string[]>([]);

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

  const flushTranscriptBuffer = useCallback(() => {
    if (transcriptBufferRef.current.length === 0 || !consultationId) return;
    const entries = transcriptBufferRef.current.map(text => {
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] Paciente: ${text}`;
    });
    const content = entries.join('\n');
    transcriptBufferRef.current = [];
    apiRequest('POST', '/api/video-consultations/' + consultationId + '/notes', {
      type: 'transcription',
      content,
      metadata: { speaker: 'patient', entryCount: entries.length },
    }).catch(() => {});
  }, [consultationId]);

  const startPatientTranscription = useCallback(() => {
    if (!SpeechRecognitionAPI || !consultationId) return;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) transcriptBufferRef.current.push(text);
        }
      }
      if (transcriptBufferRef.current.length >= 3) flushTranscriptBuffer();
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('Patient transcription error:', event.error);
    };

    recognition.onend = () => {
      if (isTranscribingRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    isTranscribingRef.current = true;
    recognition.start();
  }, [consultationId, flushTranscriptBuffer]);

  const stopPatientTranscription = useCallback(() => {
    isTranscribingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    flushTranscriptBuffer();
  }, [flushTranscriptBuffer]);

  useEffect(() => {
    if (joined && consultationId) {
      startPatientTranscription();
    }
    return () => { stopPatientTranscription(); };
  }, [joined, consultationId, startPatientTranscription, stopPatientTranscription]);

  useEffect(() => {
    if (!joined || !consultationId) return;
    const interval = setInterval(flushTranscriptBuffer, 15000);
    return () => clearInterval(interval);
  }, [joined, consultationId, flushTranscriptBuffer]);

  useEffect(() => {
    if (!joined) return;
    const timer = setTimeout(() => {
      if (localVideoTrack && localVideoRef.current) {
        localVideoTrack.play(localVideoRef.current);
      }
      if (remoteUsers.length > 0 && remoteVideoRef.current) {
        const remoteUser = remoteUsers[0];
        if (remoteUser.videoTrack) {
          remoteUser.videoTrack.play(remoteVideoRef.current);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [videoSwapped, joined, localVideoTrack, remoteUsers]);

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

    const handleBeforeUnload = () => {
      localAudioTrack?.close();
      localVideoTrack?.close();
      agoraClient.leave().catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    if (!latestMsg || !consultationId) return;
    
    if (latestMsg.type === 'consultation_note_added') {
      const noteData = latestMsg.data;
      if (!noteData?.consultationId || noteData.consultationId === consultationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
      }
    }
    
    if (latestMsg.type === 'doctor_joined' && latestMsg.data?.consultationId === consultationId) {
      toast({ title: 'Médico conectado', description: 'O médico entrou na consulta.' });
    }

    if (latestMsg.type === 'consultation_ended' && latestMsg.data?.consultationId === consultationId) {
      leaveChannel();
      toast({ title: 'Consulta encerrada', description: latestMsg.data?.message || 'A consulta foi encerrada pelo médico.' });
      setLocation('/my-consultations');
    }
  }, [wsMessages, consultationId]);

  useEffect(() => {
    if (!consultationId) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-consultations/${consultationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ended' || data.status === 'completed' || data.status === 'incomplete') {
            clearInterval(pollInterval);
            leaveChannel();
            toast({ title: 'Consulta encerrada', description: 'A consulta foi encerrada pelo médico.' });
            setLocation('/my-consultations');
          }
        }
      } catch {}
    }, 8000);
    return () => clearInterval(pollInterval);
  }, [consultationId]);

  const joinChannel = async () => {
    if (!client || !agoraConfig || joined) return;
    try {
      const safeUid = typeof agoraConfig.uid === 'number' && agoraConfig.uid > 0 && agoraConfig.uid <= 9999
        ? agoraConfig.uid
        : Math.floor(Math.random() * 9998) + 1;

      await client.join(
        agoraConfig.appId,
        agoraConfig.channelName,
        agoraConfig.token,
        safeUid
      );

      setJoined(true);

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
        try {
          await client.publish(tracksToPublish);
        } catch (pubErr) {
          console.warn('Could not publish tracks:', pubErr);
        }
      }

      toast({
        title: 'Conectado',
        description: 'Você entrou na consulta por vídeo.',
      });
    } catch (error: any) {
      console.error('Error joining channel:', error);
      const errorMsg = error?.message || error?.code || String(error);
      toast({
        title: 'Erro ao conectar',
        description: `Falha na conexão: ${errorMsg}`,
        variant: 'destructive',
      });
    }
  };

  const leaveChannel = async () => {
    stopPatientTranscription();
    if (!client) return;
    try {
      localAudioTrack?.close();
      localVideoTrack?.close();
      await client.leave();
    } catch (err) {
      console.warn('Error leaving channel:', err);
    }
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

  useEffect(() => {
    const screenShareNote = [...notes].reverse().find(
      (n) => n.type === 'annotation' && n.metadata?.screenShareStatus !== undefined
    );
    if (screenShareNote) {
      setIsRemoteScreenShare(screenShareNote.metadata.screenShareStatus === true);
      if (screenShareNote.metadata.screenShareStatus === true) {
        setScreenShareMinimized(false);
      }
    }
  }, [notes]);

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

  const mainVideoLabel = videoSwapped ? 'Você' : 'Médico';
  const pipVideoLabel = videoSwapped ? 'Médico' : 'Você';

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'container mx-auto p-4'} bg-black flex`}>
      {isRemoteScreenShare && !screenShareMinimized && (
        <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
          <div ref={screenShareRef} className="w-full h-full" />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-10">
            <Monitor className="h-4 w-4" />
            <span className="text-sm font-medium">Tela compartilhada pelo médico</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setScreenShareMinimized(true)}
            className="absolute top-4 right-4 z-10 rounded-full gap-1.5"
          >
            <Minimize className="h-4 w-4" /> Reduzir
          </Button>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="flex items-center gap-3 bg-gray-900/90 px-6 py-3 rounded-full">
              <Button variant={isAudioOn ? 'default' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full">
                {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              <Button variant={showChat ? 'secondary' : 'outline'} size="icon" onClick={() => setShowChat(!showChat)} className="rounded-full">
                <MessageSquare className="h-5 w-5" />
              </Button>
              <Button variant="destructive" size="icon" onClick={endCall} className="rounded-full">
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 relative flex flex-col ${showChat ? '' : ''}`}>
        <div className="flex-1 relative" style={{ minHeight: '100%' }}>
          <div
            ref={videoSwapped ? localVideoRef : remoteVideoRef}
            className="absolute inset-0 bg-gray-900"
          >
            {!videoSwapped && remoteUsers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Aguardando o médico...</p>
                  <p className="text-sm text-gray-400 mt-2">O médico será notificado da sua presença</p>
                </div>
              </div>
            )}
            {videoSwapped && !isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <VideoOff className="h-16 w-16 text-white opacity-50" />
              </div>
            )}
          </div>
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded z-10">{mainVideoLabel}</div>

          {isRemoteScreenShare && screenShareMinimized && (
            <button
              onClick={() => setScreenShareMinimized(false)}
              className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            >
              <Monitor className="h-3.5 w-3.5" /> Ver tela compartilhada
            </button>
          )}

          <div
            className="absolute bottom-16 right-4 w-40 h-28 sm:w-56 sm:h-40 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10 cursor-pointer group"
            onClick={() => setVideoSwapped(!videoSwapped)}
          >
            <div ref={videoSwapped ? remoteVideoRef : localVideoRef} className="w-full h-full" />
            {!videoSwapped && !isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <VideoOff className="h-8 w-8 text-white opacity-50" />
              </div>
            )}
            <div className="absolute bottom-1 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{pipVideoLabel}</div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
              <ArrowLeftRight className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-gray-900/90 px-6 py-3 rounded-full z-20">
            <Button variant={isVideoOn ? 'default' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full">
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
            <Button variant={isAudioOn ? 'default' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full">
              {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button variant={showChat ? 'secondary' : 'outline'} size="icon" onClick={() => setShowChat(!showChat)} className="rounded-full" title="Chat">
              {showChat ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              {chatNotes.length > 0 && !showChat && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-red-500">{chatNotes.length}</Badge>
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setVideoSwapped(!videoSwapped)} className="rounded-full" title="Trocar vídeos">
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="rounded-full">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
            <Button variant="destructive" size="icon" onClick={endCall} className="rounded-full ml-2">
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className={`bg-background border-l flex flex-col transition-all duration-300 ${showChat ? 'w-80 sm:w-96' : 'w-0 overflow-hidden'}`}>
        {showChat && (
          <>
            <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Chat da Consulta</span>
              {chatNotes.length > 0 && <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">{chatNotes.length}</Badge>}
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowChat(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2.5">
                {chatNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Envie uma mensagem para o médico.
                  </p>
                )}
                {chatNotes.map((note) => {
                  const isPatient = note.metadata?.senderRole === 'patient' || note.userId === user?.id;
                  return (
                    <div key={note.id} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${isPatient ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
            <div className="p-3 border-t flex gap-2 shrink-0">
              <Input
                placeholder="Mensagem para o médico..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <Button onClick={sendChatMessage} size="icon" className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
