import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
} from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Maximize,
  Minimize,
  MessageSquare,
  Brain,
  FileText,
  CircleDot,
  Play,
  Pause,
  Send,
  Loader2,
  AudioLines,
  User,
  Stethoscope,
  Download,
  Monitor,
  MonitorOff,
  UserPlus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';

type ConsultationNote = {
  id: string;
  consultationId: string;
  userId: string;
  type: 'chat' | 'ai_query' | 'ai_response' | 'doctor_note' | 'annotation' | 'transcription';
  content: string;
  metadata?: any;
  timestamp: string;
};

type TranscriptEntry = {
  id: string;
  speaker: 'doctor' | 'patient';
  text: string;
  timestamp: string;
  isFinal: boolean;
};

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function VideoConsultation() {
  const [, params] = useRoute('/consultation/video/:patientId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { messages: wsMessages } = useWebSocket();
  const patientId = params?.patientId || '';
  const [consultationId, setConsultationId] = useState<string>('');

  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [doctorNote, setDoctorNote] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [aiLoading, setAiLoading] = useState(false);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [showSpecialistDialog, setShowSpecialistDialog] = useState(false);
  const [showEndCallDialog, setShowEndCallDialog] = useState(false);
  const [endCallReason, setEndCallReason] = useState('');

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptIdRef = useRef(0);
  const transcriptionStartTimeRef = useRef<Date | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const { data: consultationData } = useQuery<{ id: string }>({
    queryKey: ['start-consultation', patientId],
    queryFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/video-consultations/start-with-patient/${patientId}`
      );
      return response.json();
    },
    enabled: !!patientId,
  });

  useEffect(() => {
    if (consultationData?.id) {
      setConsultationId(consultationData.id);
    }
  }, [consultationData]);

  const { data: consultation } = useQuery({
    queryKey: ['/api/video-consultations', consultationId],
    enabled: !!consultationId,
  });

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
    queryKey: ['agora-token', consultationId],
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

  const startConsultationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(
        'POST',
        '/api/video-consultations/' + consultationId + '/start'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId] });
    },
  });

  const endConsultationMutation = useMutation({
    mutationFn: async (data: { duration: number; meetingNotes: string; completionStatus: string; endReason?: string }) => {
      return apiRequest(
        'POST',
        '/api/video-consultations/' + consultationId + '/end',
        data
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId] });
      const isCompleted = variables.completionStatus === 'completed';
      toast({
        title: isCompleted ? 'Consulta Concluída' : 'Consulta Encerrada',
        description: isCompleted 
          ? 'Consulta concluída com sucesso. Prontuário gerado automaticamente.'
          : 'Consulta encerrada como inconcluída. Você poderá retomá-la posteriormente.',
      });
      setLocation('/schedule');
    },
  });

  useEffect(() => {
    const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setClient(agoraClient);

    agoraClient.on('user-published', async (u, mediaType) => {
      try {
        await agoraClient.subscribe(u, mediaType);
        if (mediaType === 'video') {
          setRemoteUsers((prev) => {
            if (prev.find((x) => x.uid === u.uid)) return prev;
            return [...prev, u];
          });
          if (remoteVideoRef.current) {
            u.videoTrack?.play(remoteVideoRef.current);
          }
        }
        if (mediaType === 'audio') {
          u.audioTrack?.play();
        }
      } catch (err) {
        console.error('Error subscribing to user:', err);
      }
    });

    agoraClient.on('user-unpublished', (u, mediaType) => {
      if (mediaType === 'video' && remoteVideoRef.current) {
        u.videoTrack?.stop();
      }
    });

    agoraClient.on('user-left', (u) => {
      setRemoteUsers((prev) => prev.filter((x) => x.uid !== u.uid));
    });

    agoraClient.on('user-joined', (u) => {
      console.log('Remote user joined:', u.uid);
      setRemoteUsers((prev) => {
        if (prev.find((x) => x.uid === u.uid)) return prev;
        return [...prev, u];
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
      const safeUid = typeof agoraConfig.uid === 'number' && agoraConfig.uid > 0 && agoraConfig.uid <= 9999
        ? agoraConfig.uid
        : Math.floor(Math.random() * 9998) + 1;

      await client.join(agoraConfig.appId, agoraConfig.channelName, agoraConfig.token, safeUid);

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
        if (localVideoRef.current) videoTrack.play(localVideoRef.current);
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

      startConsultationMutation.mutate();
      toast({ title: 'Conectado', description: 'Você entrou na vídeo consulta com sucesso.' });
    } catch (error: any) {
      console.error('Error joining channel:', error);
      const errorMsg = error?.message || error?.code || String(error);
      toast({ title: 'Erro ao conectar', description: `Falha na conexão: ${errorMsg}`, variant: 'destructive' });
    }
  };

  const leaveChannel = async () => {
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

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const endTime = new Date();
          const duration = recordingStartTime ? Math.floor((endTime.getTime() - recordingStartTime.getTime()) / 1000) : 0;
          try {
            await apiRequest('POST', `/api/video-consultations/${consultationId}/recordings`, {
              segmentUrl: `recording-${Date.now()}`,
              startTime: recordingStartTime?.toISOString(),
              endTime: endTime.toISOString(),
              duration,
              segmentType: 'video',
              fileSize: blob.size
            });
            toast({ title: 'Gravação Salva', description: `Gravação de ${duration}s salva.` });
          } catch {
            toast({ title: 'Erro ao Salvar', description: 'Não foi possível salvar a gravação.', variant: 'destructive' });
          }
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        setRecordingStartTime(new Date());
        toast({ title: 'Gravação Iniciada', description: 'A consulta está sendo gravada.' });
      } catch {
        toast({ title: 'Erro na Gravação', description: 'Não foi possível iniciar a gravação.', variant: 'destructive' });
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setRecordingStartTime(null);
      toast({ title: 'Gravação Parada', description: 'A gravação foi finalizada.' });
    }
  };

  // ---- Transcription (Speech Recognition) ----
  const startTranscription = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      toast({ title: 'Não suportado', description: 'Seu navegador não suporta transcrição de áudio. Use Chrome ou Edge.', variant: 'destructive' });
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;

    transcriptionStartTimeRef.current = new Date();

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const entry: TranscriptEntry = {
            id: `t-${++transcriptIdRef.current}`,
            speaker: 'doctor',
            text: transcript.trim(),
            timestamp: new Date().toISOString(),
            isFinal: true,
          };
          setTranscriptEntries(prev => [...prev, entry]);
          setInterimText('');
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
      toast({ title: 'Erro na transcrição', description: `Erro: ${event.error}`, variant: 'destructive' });
    };

    recognition.onend = () => {
      if (isTranscribing && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsTranscribing(true);
    toast({ title: 'Transcrição Iniciada', description: 'O áudio da consulta está sendo transcrito em tempo real.' });
  }, [isTranscribing, toast]);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
    setInterimText('');
    toast({ title: 'Transcrição Parada', description: 'A transcrição foi interrompida.' });
  }, [toast]);

  const toggleTranscription = () => {
    if (isTranscribing) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  const toggleScreenShare = async () => {
    if (!client || !joined) return;
    if (isScreenSharing) {
      if (screenTrack) {
        await client.unpublish(screenTrack);
        screenTrack.close();
        setScreenTrack(null);
      }
      if (localVideoTrack) {
        await client.publish(localVideoTrack);
        if (localVideoRef.current) localVideoTrack.play(localVideoRef.current);
      }
      setIsScreenSharing(false);
      toast({ title: 'Compartilhamento encerrado', description: 'Voltou para a câmera.' });
    } else {
      try {
        const track = await AgoraRTC.createScreenVideoTrack({}, 'disable');
        const videoTrack = Array.isArray(track) ? track[0] : track;
        if (localVideoTrack) {
          await client.unpublish(localVideoTrack);
        }
        await client.publish(videoTrack);
        if (localVideoRef.current) videoTrack.play(localVideoRef.current);
        setScreenTrack(videoTrack);
        setIsScreenSharing(true);
        (videoTrack as any).on?.('track-ended', async () => {
          await client.unpublish(videoTrack);
          videoTrack.close();
          setScreenTrack(null);
          if (localVideoTrack) {
            await client.publish(localVideoTrack);
            if (localVideoRef.current) localVideoTrack.play(localVideoRef.current);
          }
          setIsScreenSharing(false);
        });
        toast({ title: 'Compartilhando tela', description: 'Sua tela está sendo compartilhada com o paciente.' });
      } catch (err: any) {
        if (err?.message?.includes('Permission')) {
          toast({ title: 'Permissão negada', description: 'Você cancelou o compartilhamento de tela.', variant: 'destructive' });
        } else {
          toast({ title: 'Erro', description: 'Não foi possível compartilhar a tela.', variant: 'destructive' });
        }
      }
    }
  };

  const { data: onlineDoctors } = useQuery<any[]>({
    queryKey: ['/api/doctors/online'],
    enabled: showSpecialistDialog,
    refetchInterval: showSpecialistDialog ? 10000 : false,
  });

  const inviteSpecialistMutation = useMutation({
    mutationFn: async (specialistId: number) => {
      return apiRequest('POST', `/api/video-consultations/${consultationId}/invite-specialist`, { specialistId });
    },
    onSuccess: () => {
      toast({ title: 'Convite enviado', description: 'O especialista foi notificado e poderá entrar na consulta.' });
      setShowSpecialistDialog(false);
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Não foi possível enviar o convite.', variant: 'destructive' });
    },
  });

  const markAsSpeaker = (entryId: string, speaker: 'doctor' | 'patient') => {
    setTranscriptEntries(prev => prev.map(e => e.id === entryId ? { ...e, speaker } : e));
  };

  const saveTranscriptionToNotes = () => {
    if (transcriptEntries.length === 0) return;
    const formatted = transcriptEntries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const label = e.speaker === 'doctor' ? 'Dr.' : 'Paciente';
      return `[${time}] ${label}: ${e.text}`;
    }).join('\n');

    createNoteMutation.mutate({
      type: 'transcription',
      content: formatted,
      metadata: {
        entryCount: transcriptEntries.length,
        startTime: transcriptionStartTimeRef.current?.toISOString(),
        endTime: new Date().toISOString(),
      }
    });
    toast({ title: 'Transcrição Salva', description: 'A transcrição foi salva nas notas da consulta.' });
  };

  const exportTranscription = () => {
    if (transcriptEntries.length === 0) return;
    const formatted = transcriptEntries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const label = e.speaker === 'doctor' ? 'Dr.' : 'Paciente';
      return `[${time}] ${label}: ${e.text}`;
    }).join('\n');

    const header = `TRANSCRIÇÃO DE CONSULTA\nData: ${new Date().toLocaleDateString('pt-BR')}\nInício: ${transcriptionStartTimeRef.current?.toLocaleTimeString('pt-BR') || '-'}\n${'='.repeat(50)}\n\n`;
    const blob = new Blob([header + formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-consulta-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Chat / AI / Notes handlers ----
  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    createNoteMutation.mutate({ type: 'chat', content: chatMessage, metadata: { senderName: user?.name || 'Doutor', senderRole: 'doctor' } });
    setChatMessage('');
  };

  const sendAiQuery = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    createNoteMutation.mutate({ type: 'ai_query', content: aiQuery }, {
      onSettled: () => {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
            setAiLoading(false);
          }, 5000);
        }, 3000);
      }
    });
    setAiQuery('');
  };

  const saveDoctorNote = () => {
    if (!doctorNote.trim()) return;
    createNoteMutation.mutate({ type: 'doctor_note', content: doctorNote });
    setDoctorNote('');
    toast({ title: 'Anotação Salva', description: 'Sua anotação foi salva com sucesso.' });
  };

  const prepareEndCallData = async () => {
    if (isTranscribing) stopTranscription();

    if (transcriptEntries.length > 0) {
      const formatted = transcriptEntries.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const label = e.speaker === 'doctor' ? 'Dr.' : 'Paciente';
        return `[${time}] ${label}: ${e.text}`;
      }).join('\n');
      try {
        await apiRequest('POST', '/api/video-consultations/' + consultationId + '/notes', {
          type: 'transcription',
          content: formatted,
          metadata: { entryCount: transcriptEntries.length, autoSaved: true }
        });
      } catch {}
    }

    const duration = (consultation as any)?.startedAt
      ? Math.floor((Date.now() - new Date((consultation as any).startedAt).getTime()) / 1000)
      : 0;

    const allDoctorNotes = notes.filter((n) => n.type === 'doctor_note').map((n) => n.content).join('\n\n');
    const savedTranscriptions = notes.filter((n) => n.type === 'transcription').map((n) => n.content).join('\n\n');
    const unsavedTranscription = transcriptEntries.length > 0 ? transcriptEntries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] ${e.speaker === 'doctor' ? 'Dr.' : 'Paciente'}: ${e.text}`;
    }).join('\n') : '';
    const allTranscriptions = [savedTranscriptions, unsavedTranscription].filter(Boolean).join('\n');
    const meetingNotes = [allDoctorNotes, allTranscriptions ? `\n\n--- TRANSCRIÇÃO ---\n${allTranscriptions}` : ''].filter(Boolean).join('');

    return { duration, meetingNotes };
  };

  const endCall = () => {
    setShowEndCallDialog(true);
  };

  const confirmEndCall = async (completionStatus: 'completed' | 'incomplete') => {
    setShowEndCallDialog(false);
    const { duration, meetingNotes } = await prepareEndCallData();
    await leaveChannel();
    endConsultationMutation.mutate({ 
      duration, 
      meetingNotes, 
      completionStatus,
      endReason: completionStatus === 'incomplete' ? (endCallReason || 'Saída sem conclusão pelo médico') : undefined
    });
  };

  const chatNotes = notes.filter((n) => n.type === 'chat');
  const aiNotes = notes.filter((n) => n.type === 'ai_query' || n.type === 'ai_response');
  const doctorNotes = notes.filter((n) => n.type === 'doctor_note');
  const transcriptionNotes = notes.filter((n) => n.type === 'transcription');

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatNotes.length]);
  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiNotes.length]);
  useEffect(() => {
    if (transcriptScrollRef.current) transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
  }, [transcriptEntries.length]);

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
        <p className="text-lg text-muted-foreground">Carregando consulta...</p>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'container mx-auto p-4'} bg-black flex flex-col`} data-testid="video-consultation-page">
      <div className="flex-1 relative" style={{ minHeight: '60vh' }}>
        <div ref={remoteVideoRef} className="absolute inset-0 bg-gray-900" data-testid="video-remote">
          {remoteUsers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aguardando paciente...</p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-20 right-4 w-56 h-40 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10">
          <div ref={localVideoRef} className="w-full h-full" data-testid="video-local" />
          {!isVideoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-10 w-10 text-white opacity-50" />
            </div>
          )}
          <div className="absolute bottom-1 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            Você
          </div>
        </div>

        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full z-10" data-testid="status-recording">
            <CircleDot className="h-4 w-4 animate-pulse" />
            <span className="font-semibold text-sm">Gravando</span>
          </div>
        )}

        {isTranscribing && (
          <div className="absolute top-4 left-40 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full z-10">
            <AudioLines className="h-4 w-4 animate-pulse" />
            <span className="font-semibold text-sm">Transcrevendo</span>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 bg-gray-900/90 px-6 py-3 rounded-full z-20">
          <Button variant={isVideoOn ? 'default' : 'destructive'} size="icon" onClick={toggleVideo} className="rounded-full" data-testid="button-toggle-video">
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button variant={isAudioOn ? 'default' : 'destructive'} size="icon" onClick={toggleAudio} className="rounded-full" data-testid="button-toggle-audio">
            {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button variant={isRecording ? 'destructive' : 'secondary'} size="icon" onClick={toggleRecording} className="rounded-full" data-testid="button-toggle-recording" title="Gravar">
            {isRecording ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button variant={isTranscribing ? 'destructive' : 'secondary'} size="icon" onClick={toggleTranscription} className="rounded-full" title="Transcrição de Áudio">
            <AudioLines className="h-5 w-5" />
          </Button>
          <Button variant={isScreenSharing ? 'destructive' : 'secondary'} size="icon" onClick={toggleScreenShare} className="rounded-full" title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}>
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setShowSpecialistDialog(true)} className="rounded-full" title="Convidar Especialista">
            <UserPlus className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="rounded-full" data-testid="button-toggle-fullscreen">
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
          <Button variant="destructive" size="icon" onClick={endCall} className="rounded-full ml-2" data-testid="button-end-call">
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="w-full bg-background border-t" style={{ height: '40vh' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full grid grid-cols-4 h-10">
            <TabsTrigger value="chat" className="flex items-center gap-1 text-xs" data-testid="tab-chat">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
              {chatNotes.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{chatNotes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1 text-xs" data-testid="tab-ai">
              <Brain className="h-3.5 w-3.5" />
              IA
              {aiLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="transcription" className="flex items-center gap-1 text-xs">
              <AudioLines className="h-3.5 w-3.5" />
              Transcrição
              {transcriptEntries.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{transcriptEntries.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1 text-xs" data-testid="tab-notes">
              <FileText className="h-3.5 w-3.5" />
              Notas
            </TabsTrigger>
          </TabsList>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3" data-testid="scroll-chat">
              <div className="space-y-2" ref={chatScrollRef}>
                {chatNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem. Envie uma mensagem para o paciente.</p>
                )}
                {chatNotes.map((note) => {
                  const isDoctor = note.metadata?.senderRole === 'doctor' || note.userId === user?.id;
                  return (
                    <div key={note.id} className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`} data-testid={`message-chat-${note.id}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isDoctor ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <div className="flex items-center gap-1 mb-0.5">
                          {isDoctor ? <Stethoscope className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          <span className="text-xs font-medium">{isDoctor ? 'Dr.' : 'Paciente'}</span>
                        </div>
                        <p className="text-sm">{note.content}</p>
                        <p className={`text-xs mt-1 ${isDoctor ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
                placeholder="Mensagem para o paciente..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                data-testid="input-chat-message"
              />
              <Button onClick={sendChatMessage} size="icon" disabled={createNoteMutation.isPending} data-testid="button-send-chat">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* AI TAB */}
          <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3" data-testid="scroll-ai">
              <div className="space-y-2" ref={aiScrollRef}>
                {aiNotes.length === 0 && (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Faça perguntas diagnósticas à IA durante a consulta.</p>
                    <p className="text-xs text-muted-foreground mt-1">A IA terá acesso ao histórico do paciente.</p>
                  </div>
                )}
                {aiNotes.map((note) => (
                  <Card
                    key={note.id}
                    className={`p-3 ${note.type === 'ai_query' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}
                    data-testid={`message-ai-${note.id}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {note.type === 'ai_query' ? <Stethoscope className="h-3.5 w-3.5 text-blue-600" /> : <Brain className="h-3.5 w-3.5 text-green-600" />}
                      <span className="text-xs font-semibold">
                        {note.type === 'ai_query' ? 'Sua pergunta' : 'Resposta da IA'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </Card>
                ))}
                {aiLoading && (
                  <Card className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                      <span className="text-sm text-muted-foreground">IA analisando...</span>
                    </div>
                  </Card>
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Textarea
                placeholder="Faça uma pergunta diagnóstica..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiQuery(); } }}
                rows={1}
                className="resize-none min-h-[36px]"
                data-testid="input-ai-query"
              />
              <Button onClick={sendAiQuery} size="icon" disabled={aiLoading || createNoteMutation.isPending} data-testid="button-send-ai">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* TRANSCRIPTION TAB */}
          <TabsContent value="transcription" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1.5" ref={transcriptScrollRef}>
                {transcriptEntries.length === 0 && !isTranscribing && (
                  <div className="text-center py-8">
                    <AudioLines className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique no botão de transcrição na barra de controles para iniciar.</p>
                    <p className="text-xs text-muted-foreground mt-1">O áudio será transcrito em tempo real com identificação de quem falou.</p>
                    {!SpeechRecognitionAPI && (
                      <p className="text-xs text-destructive mt-2">Seu navegador não suporta transcrição. Use Chrome ou Edge.</p>
                    )}
                  </div>
                )}
                {transcriptEntries.map((entry) => (
                  <div key={entry.id} className={`flex items-start gap-2 p-2 rounded-lg ${entry.speaker === 'doctor' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-50 dark:bg-orange-950/50'}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {entry.speaker === 'doctor' ? (
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                      ) : (
                        <User className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${entry.speaker === 'doctor' ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                          {entry.speaker === 'doctor' ? 'Doutor' : 'Paciente'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <button
                          onClick={() => markAsSpeaker(entry.id, entry.speaker === 'doctor' ? 'patient' : 'doctor')}
                          className="text-xs text-muted-foreground hover:text-foreground ml-auto underline"
                          title="Alternar identificação"
                        >
                          {entry.speaker === 'doctor' ? 'Marcar como Paciente' : 'Marcar como Doutor'}
                        </button>
                      </div>
                      <p className="text-sm mt-0.5">{entry.text}</p>
                    </div>
                  </div>
                ))}
                {interimText && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 opacity-60">
                    <Stethoscope className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-blue-600">Doutor</span>
                      <p className="text-sm italic">{interimText}...</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex items-center gap-2">
              <Button
                variant={isTranscribing ? 'destructive' : 'default'}
                size="sm"
                onClick={toggleTranscription}
                className="gap-1.5"
              >
                {isTranscribing ? <><Pause className="h-3.5 w-3.5" /> Parar</> : <><AudioLines className="h-3.5 w-3.5" /> Iniciar Transcrição</>}
              </Button>
              {transcriptEntries.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={saveTranscriptionToNotes} className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Salvar em Notas
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportTranscription} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Exportar .txt
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {transcriptEntries.length} segmento(s)
              </span>
            </div>
          </TabsContent>

          {/* NOTES TAB */}
          <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3" data-testid="scroll-notes">
              <div className="space-y-2">
                {doctorNotes.length === 0 && transcriptionNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma anotação. Registre observações clínicas importantes.</p>
                )}
                {doctorNotes.map((note) => (
                  <Card key={note.id} className="p-3 border-l-4 border-l-primary" data-testid={`note-doctor-${note.id}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold">Anotação Médica</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </Card>
                ))}
                {transcriptionNotes.map((note) => (
                  <Card key={note.id} className="p-3 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AudioLines className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-semibold">Transcrição Salva</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded mt-1 max-h-32 overflow-y-auto">{note.content}</pre>
                  </Card>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Textarea
                placeholder="Observações clínicas, diagnóstico, conduta..."
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDoctorNote(); }}
                rows={1}
                className="resize-none min-h-[36px]"
                data-testid="input-doctor-note"
              />
              <Button onClick={saveDoctorNote} size="icon" disabled={createNoteMutation.isPending} data-testid="button-save-note" title="Salvar (Ctrl+Enter)">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSpecialistDialog} onOpenChange={setShowSpecialistDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Convidar Especialista
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {!onlineDoctors || onlineDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum médico online no momento.</p>
            ) : (
              onlineDoctors.filter((d: any) => d.id !== user?.id).map((doctor: any) => (
                <Card key={doctor.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{doctor.name}</p>
                    <p className="text-xs text-muted-foreground">{doctor.specialty || 'Clínico Geral'}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => inviteSpecialistMutation.mutate(doctor.id)}
                    disabled={inviteSpecialistMutation.isPending}
                  >
                    {inviteSpecialistMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Convidar'}
                  </Button>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isScreenSharing && (
        <div className="fixed top-4 right-4 z-[60] bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Monitor className="h-4 w-4" />
          <span className="text-sm font-medium">Compartilhando tela</span>
          <Button variant="ghost" size="sm" onClick={toggleScreenShare} className="text-white hover:text-white hover:bg-red-700 h-6 px-2 ml-1">
            Parar
          </Button>
        </div>
      )}

      <Dialog open={showEndCallDialog} onOpenChange={setShowEndCallDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar Consulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Como você deseja encerrar esta consulta?
            </p>
            <div className="space-y-3">
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="default"
                onClick={() => confirmEndCall('completed')}
                disabled={endConsultationMutation.isPending}
              >
                <div className="text-left">
                  <p className="font-medium">Concluir Consulta</p>
                  <p className="text-xs opacity-80 mt-0.5">Consulta finalizada com sucesso. Prontuário será gerado automaticamente.</p>
                </div>
              </Button>
              <div className="space-y-2">
                <Button
                  className="w-full justify-start h-auto py-3 px-4"
                  variant="outline"
                  onClick={() => confirmEndCall('incomplete')}
                  disabled={endConsultationMutation.isPending}
                >
                  <div className="text-left">
                    <p className="font-medium text-orange-600 dark:text-orange-400">Sair sem Concluir</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Problema técnico ou desconexão. Poderá retomar ou concluir depois.</p>
                  </div>
                </Button>
                <Textarea
                  placeholder="Motivo (opcional): ex. queda de conexão, paciente saiu..."
                  value={endCallReason}
                  onChange={(e) => setEndCallReason(e.target.value)}
                  className="text-sm"
                  rows={2}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowEndCallDialog(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
