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
import { FormattedText } from '@/components/ui/formatted-text';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/use-admin';
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
  LayoutDashboard,
  Columns,
  Tv,
  ArrowLeftRight,
  PanelRightClose,
  PanelRightOpen,
  X,
  Check,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  Pill,
  TestTube,
  ArrowUpRight,
  CalendarCheck,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket, onForceDisconnect } from '@/hooks/use-websocket';
import ConsultationInactivityMonitor from '@/components/consultation-inactivity-monitor';
import { disconnectAllMediaServices } from '@/components/inactivity-monitor';

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
  const isAdmin = useIsAdmin();
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
  const [viewMode, setViewMode] = useState<'dashboard' | 'video' | 'compact'>('dashboard');
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
  const [showPostConsultSummary, setShowPostConsultSummary] = useState(false);

  type PostConsultItemSummary = {
    id: string;
    type: string;
    title: string;
    description: string;
    status: string;
    details?: Record<string, unknown>;
    patientSummary?: string;
  };
  type SusProntuarioSummary = {
    id: string;
    consultationId: string;
    chiefComplaint: string | null;
    assessment: string | null;
    soapComplianceScore: number | null;
    soapComplianceFlags: Array<{ section: string; severity: string; message: string }> | null;
    reviewedByDoctor: boolean | null;
  };

  const [postConsultItems, setPostConsultItems] = useState<PostConsultItemSummary[]>([]);
  const [postConsultLoading, setPostConsultLoading] = useState(false);
  const [susProntuarioLoading, setSusProntuarioLoading] = useState(false);
  const [susProntuario, setSusProntuario] = useState<SusProntuarioSummary | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');
  const [editingItemDescription, setEditingItemDescription] = useState('');
  const [videoSwapped, setVideoSwapped] = useState(false);
  const [screenShareFullscreen, setScreenShareFullscreen] = useState(true);
  const [showSideChat, setShowSideChat] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptIdRef = useRef(0);
  const transcriptionStartTimeRef = useRef<Date | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const screenShareOverlayRef = useRef<HTMLDivElement>(null);
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
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId] });
      const isCompleted = variables.completionStatus === 'completed';
      if (isCompleted && consultationId && user?.role === 'doctor') {
        toast({ title: 'Consulta Concluída', description: 'Carregando resumo pós-consulta...' });
        setPostConsultLoading(true);
        setShowPostConsultSummary(true);
        try {
          const [summaryRes, susRes] = await Promise.all([
            fetch('/api/post-consultation/summary/' + consultationId, { credentials: 'include' }),
            fetch('/api/sus-prontuario/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ consultationId }),
            }),
          ]);
          if (summaryRes.ok) {
            const summary = await summaryRes.json();
            setPostConsultItems(summary.items || []);
          }
          if (susRes.ok) {
            const susData = await susRes.json();
            setSusProntuario(susData);
          }
        } catch (err) {
          console.error('Failed to load post-consultation summary:', err);
        }
        setPostConsultLoading(false);
      } else {
        toast({
          title: isCompleted ? 'Consulta Concluída' : 'Consulta Encerrada',
          description: isCompleted 
            ? 'Consulta concluída com sucesso. Prontuário gerado automaticamente.'
            : 'Consulta encerrada como inconcluída. Você poderá retomá-la posteriormente.',
        });
        setLocation('/schedule');
      }
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

    const handleBeforeUnload = () => {
      localAudioTrack?.close();
      localVideoTrack?.close();
      screenTrack?.close();
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
    if (isScreenSharing && screenTrack && screenShareOverlayRef.current && screenShareFullscreen) {
      screenTrack.play(screenShareOverlayRef.current);
    }
  }, [isScreenSharing, screenTrack, screenShareFullscreen]);

  useEffect(() => {
    const latestMsg = wsMessages[wsMessages.length - 1];
    if (latestMsg?.type === 'consultation_note_added' && consultationId) {
      const noteData = latestMsg.data;
      if (!noteData?.consultationId || noteData.consultationId === consultationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/video-consultations', consultationId, 'notes'] });
      }
    }
  }, [wsMessages, consultationId]);

  useEffect(() => {
    const unsubscribe = onForceDisconnect((_reason, message) => {
      disconnectAllMediaServices();
      leaveChannel();
      toast({
        title: 'Sessão encerrada',
        description: message,
        variant: 'destructive',
      });
      setLocation('/schedule');
    });
    return unsubscribe;
  }, []);

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
      screenTrack?.close();
      await client.leave();
    } catch (err) {
      console.warn('Error leaving channel:', err);
    }
    setJoined(false);
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setScreenTrack(null);
    setIsScreenSharing(false);
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

  const notifyScreenShare = useCallback((status: boolean) => {
    if (!consultationId) return;
    apiRequest('POST', `/api/video-consultations/${consultationId}/notes`, {
      type: 'annotation',
      content: status ? 'Médico iniciou compartilhamento de tela' : 'Médico encerrou compartilhamento de tela',
      metadata: { screenShareStatus: status },
    }).catch(() => {});
  }, [consultationId]);

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
      setScreenShareFullscreen(false);
      notifyScreenShare(false);
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
        setScreenShareFullscreen(true);
        notifyScreenShare(true);
        (videoTrack as any).on?.('track-ended', async () => {
          await client.unpublish(videoTrack);
          videoTrack.close();
          setScreenTrack(null);
          if (localVideoTrack) {
            await client.publish(localVideoTrack);
            if (localVideoRef.current) localVideoTrack.play(localVideoRef.current);
          }
          setIsScreenSharing(false);
          setScreenShareFullscreen(false);
          notifyScreenShare(false);
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
  const iam3dNotes = notes.filter((n) => n.type === 'iam3d_diagnostic');
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

  const mainVideoLabel = videoSwapped ? 'Você' : 'Paciente';
  const pipVideoLabel = videoSwapped ? 'Paciente' : 'Você';

  const videoArea = (className?: string, compact?: boolean) => (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className || ''}`}>
      <div ref={videoSwapped ? localVideoRef : remoteVideoRef} className="absolute inset-0" data-testid="video-remote">
        {!videoSwapped && remoteUsers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <Video className={`${compact ? 'h-8 w-8' : 'h-16 w-16'} mx-auto mb-2 opacity-50`} />
              <p className={compact ? 'text-sm' : 'text-lg'}>Aguardando paciente...</p>
            </div>
          </div>
        )}
        {videoSwapped && !isVideoOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <VideoOff className={`${compact ? 'h-8 w-8' : 'h-16 w-16'} text-white opacity-50`} />
          </div>
        )}
      </div>
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded z-10">{mainVideoLabel}</div>
      <div
        className={`absolute ${compact ? 'bottom-2 right-2 w-28 h-20' : 'bottom-16 right-4 w-56 h-40'} bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg z-10 cursor-pointer group`}
        onClick={() => setVideoSwapped(!videoSwapped)}
      >
        <div ref={videoSwapped ? remoteVideoRef : localVideoRef} className="w-full h-full" data-testid="video-local" />
        {!videoSwapped && !isVideoOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <VideoOff className={`${compact ? 'h-6 w-6' : 'h-10 w-10'} text-white opacity-50`} />
          </div>
        )}
        <div className="absolute bottom-1 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{pipVideoLabel}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <ArrowLeftRight className={`${compact ? 'h-4 w-4' : 'h-6 w-6'} text-white opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>
      </div>
      {isRecording && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-full z-10" data-testid="status-recording">
          <CircleDot className="h-3 w-3 animate-pulse" /><span className="font-semibold text-xs">REC</span>
        </div>
      )}
      {isTranscribing && (
        <div className={`absolute top-2 ${isRecording ? 'right-24' : 'right-2'} flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-full z-10`}>
          <AudioLines className="h-3 w-3 animate-pulse" /><span className="font-semibold text-xs">Transcrição</span>
        </div>
      )}
    </div>
  );

  const controlBar = (compact?: boolean) => (
    <div className={`flex items-center justify-center gap-2 ${compact ? 'py-2 px-3' : 'py-3 px-6'} bg-gray-900/95 rounded-full`}>
      <Button variant={isVideoOn ? 'default' : 'destructive'} size="icon" onClick={toggleVideo} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} data-testid="button-toggle-video">
        {isVideoOn ? <Video className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <VideoOff className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
      </Button>
      <Button variant={isAudioOn ? 'default' : 'destructive'} size="icon" onClick={toggleAudio} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} data-testid="button-toggle-audio">
        {isAudioOn ? <Mic className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <MicOff className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
      </Button>
      <Button variant={isRecording ? 'destructive' : 'secondary'} size="icon" onClick={toggleRecording} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} data-testid="button-toggle-recording" title="Gravar">
        {isRecording ? <Pause className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <Play className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
      </Button>
      <Button variant={isTranscribing ? 'destructive' : 'secondary'} size="icon" onClick={toggleTranscription} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} title="Transcrição">
        <AudioLines className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </Button>
      <Button variant={isScreenSharing ? 'destructive' : 'secondary'} size="icon" onClick={toggleScreenShare} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} title={isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}>
        {isScreenSharing ? <MonitorOff className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <Monitor className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
      </Button>
      <Button variant="outline" size="icon" onClick={() => setVideoSwapped(!videoSwapped)} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} title="Trocar vídeos">
        <ArrowLeftRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </Button>
      <Button variant="secondary" size="icon" onClick={() => setShowSpecialistDialog(true)} className={`rounded-full ${compact ? 'h-8 w-8' : ''}`} title="Convidar Especialista">
        <UserPlus className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </Button>
      <Button variant="destructive" size="icon" onClick={endCall} className={`rounded-full ml-1 ${compact ? 'h-8 w-8' : ''}`} data-testid="button-end-call">
        <PhoneOff className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </Button>
    </div>
  );

  const chatPanel = (heightClass?: string) => (
    <Card className={`flex flex-col overflow-hidden ${heightClass || 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Chat</span>
        {chatNotes.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-auto">{chatNotes.length}</Badge>}
      </div>
      <ScrollArea className="flex-1 p-2" data-testid="scroll-chat">
        <div className="space-y-1.5" ref={chatScrollRef}>
          {chatNotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem mensagens</p>}
          {chatNotes.map((note) => {
            const isDoctor = note.metadata?.senderRole === 'doctor' || note.userId === user?.id;
            return (
              <div key={note.id} className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`} data-testid={`message-chat-${note.id}`}>
                <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 ${isDoctor ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <div className="flex items-center gap-1">
                    {isDoctor ? <Stethoscope className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                    <span className="text-[10px] font-medium">{isDoctor ? 'Dr.' : 'Pac.'}</span>
                    <span className={`text-[10px] ml-auto ${isDoctor ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5">{note.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="p-2 border-t flex gap-1.5">
        <Input placeholder="Mensagem..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()} className="text-xs h-8" data-testid="input-chat-message" />
        <Button onClick={sendChatMessage} size="icon" disabled={createNoteMutation.isPending} className="h-8 w-8 shrink-0" data-testid="button-send-chat"><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );

  const aiPanel = (heightClass?: string) => (
    <Card className={`flex flex-col overflow-hidden ${heightClass || 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Brain className="h-4 w-4 text-green-600" />
        <span className="text-xs font-semibold">{isAdmin ? 'Interconsulta IAM3D' : 'Interconsulta'}</span>
        {iam3dNotes.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-purple-100 text-purple-800">🔬 {iam3dNotes.length}</Badge>}
        {aiLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto text-green-600" />}
      </div>
      <ScrollArea className="flex-1 p-2" data-testid="scroll-ai">
        <div className="space-y-1.5" ref={aiScrollRef}>
          {iam3dNotes.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">{isAdmin ? 'Hipóteses Diagnósticas IAM3D' : 'Hipóteses Diagnósticas'}</span>
              </div>
              {iam3dNotes.slice(-1).map((note) => (
                <Card key={note.id} className="p-2 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700 border-l-4 border-l-purple-600" data-testid={`message-iam3d-${note.id}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400">{isAdmin ? '🔬 IAM3D' : '🔬 Análise'}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      {new Date(note.timestamp || note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <FormattedText content={note.content} className="text-xs" />
                </Card>
              ))}
              {iam3dNotes.length > 1 && (
                <details className="mt-1">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Ver {iam3dNotes.length - 1} análise(s) anterior(es)</summary>
                  <div className="space-y-1 mt-1">
                    {iam3dNotes.slice(0, -1).reverse().map((note) => (
                      <Card key={note.id} className="p-2 bg-purple-50/50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 opacity-75">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-semibold text-purple-600">{isAdmin ? 'IAM3D' : 'Análise'}</span>
                          <span className="text-[9px] text-muted-foreground ml-auto">
                            {new Date(note.timestamp || note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <FormattedText content={note.content} className="text-xs" />
                      </Card>
                    ))}
                  </div>
                </details>
              )}
              <div className="border-t border-dashed border-muted-foreground/30 my-2" />
            </div>
          )}
          {aiNotes.length === 0 && iam3dNotes.length === 0 && (
            <div className="text-center py-4">
              <Brain className="h-6 w-6 mx-auto mb-1 text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">{isAdmin ? 'Pergunte à IA ou adicione anotações para ativar o IAM3D' : 'Pergunte ou adicione anotações para ativar a análise'}</p>
            </div>
          )}
          {aiNotes.map((note) => (
            <Card key={note.id} className={`p-2 ${note.type === 'ai_query' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`} data-testid={`message-ai-${note.id}`}>
              <div className="flex items-center gap-1 mb-0.5">
                {note.type === 'ai_query' ? <Stethoscope className="h-3 w-3 text-blue-600" /> : <Brain className="h-3 w-3 text-green-600" />}
                <span className="text-[10px] font-semibold">{note.type === 'ai_query' ? 'Pergunta' : (isAdmin ? 'IA' : 'Resposta')}</span>
              </div>
              <FormattedText content={note.content} className="text-xs" />
            </Card>
          ))}
          {aiLoading && <Card className="p-2 bg-green-50 dark:bg-green-950"><div className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-green-600" /><span className="text-xs">Analisando...</span></div></Card>}
        </div>
      </ScrollArea>
      <div className="p-2 border-t flex gap-1.5">
        <Textarea placeholder="Pergunta diagnóstica..." value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiQuery(); } }}
          rows={1} className="resize-none min-h-[32px] text-xs" data-testid="input-ai-query" />
        <Button onClick={sendAiQuery} size="icon" disabled={aiLoading || createNoteMutation.isPending} className="h-8 w-8 shrink-0" data-testid="button-send-ai"><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );

  const transcriptionPanel = (heightClass?: string) => (
    <Card className={`flex flex-col overflow-hidden ${heightClass || 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <AudioLines className="h-4 w-4 text-purple-600" />
        <span className="text-xs font-semibold">Transcrição</span>
        {transcriptEntries.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-auto">{transcriptEntries.length}</Badge>}
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1" ref={transcriptScrollRef}>
          {transcriptEntries.length === 0 && !isTranscribing && (
            <div className="text-center py-4">
              <AudioLines className="h-6 w-6 mx-auto mb-1 text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">Inicie a transcrição</p>
            </div>
          )}
          {transcriptEntries.map((entry) => (
            <div key={entry.id} className={`flex items-start gap-1.5 p-1.5 rounded ${entry.speaker === 'doctor' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-50 dark:bg-orange-950/50'}`}>
              {entry.speaker === 'doctor' ? <Stethoscope className="h-3 w-3 text-blue-600 mt-0.5 shrink-0" /> : <User className="h-3 w-3 text-orange-600 mt-0.5 shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-semibold ${entry.speaker === 'doctor' ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>
                    {entry.speaker === 'doctor' ? 'Dr.' : 'Pac.'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => markAsSpeaker(entry.id, entry.speaker === 'doctor' ? 'patient' : 'doctor')} className="text-[10px] text-muted-foreground hover:text-foreground ml-auto underline">↔</button>
                </div>
                <p className="text-xs">{entry.text}</p>
              </div>
            </div>
          ))}
          {interimText && (
            <div className="flex items-start gap-1.5 p-1.5 rounded bg-gray-50 dark:bg-gray-900 opacity-60">
              <Stethoscope className="h-3 w-3 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs italic">{interimText}...</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-2 border-t flex items-center gap-1.5 flex-wrap">
        <Button variant={isTranscribing ? 'destructive' : 'default'} size="sm" onClick={toggleTranscription} className="gap-1 h-7 text-xs">
          {isTranscribing ? <><Pause className="h-3 w-3" /> Parar</> : <><AudioLines className="h-3 w-3" /> Iniciar</>}
        </Button>
        {transcriptEntries.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={saveTranscriptionToNotes} className="gap-1 h-7 text-xs"><FileText className="h-3 w-3" /> Salvar</Button>
            <Button variant="outline" size="sm" onClick={exportTranscription} className="gap-1 h-7 text-xs"><Download className="h-3 w-3" /> .txt</Button>
          </>
        )}
      </div>
    </Card>
  );

  const notesPanel = (heightClass?: string) => (
    <Card className={`flex flex-col overflow-hidden ${heightClass || 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Notas Clínicas</span>
      </div>
      <ScrollArea className="flex-1 p-2" data-testid="scroll-notes">
        <div className="space-y-1.5">
          {doctorNotes.length === 0 && transcriptionNotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem anotações</p>}
          {doctorNotes.map((note) => (
            <Card key={note.id} className="p-2 border-l-3 border-l-primary" data-testid={`note-doctor-${note.id}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <FileText className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold">Nota</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <FormattedText content={note.content} className="text-xs" />
            </Card>
          ))}
          {transcriptionNotes.map((note) => (
            <Card key={note.id} className="p-2 border-l-3 border-l-blue-500">
              <div className="flex items-center gap-1 mb-0.5">
                <AudioLines className="h-3 w-3 text-blue-500" /><span className="text-[10px] font-semibold">Transcrição</span>
              </div>
              <pre className="text-[10px] whitespace-pre-wrap font-mono bg-muted/50 p-1.5 rounded max-h-20 overflow-y-auto">{note.content}</pre>
            </Card>
          ))}
        </div>
      </ScrollArea>
      <div className="p-2 border-t flex gap-1.5">
        <Textarea placeholder="Observações clínicas..." value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDoctorNote(); }}
          rows={1} className="resize-none min-h-[32px] text-xs" data-testid="input-doctor-note" />
        <Button onClick={saveDoctorNote} size="icon" disabled={createNoteMutation.isPending} className="h-8 w-8 shrink-0" data-testid="button-save-note" title="Ctrl+Enter"><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );

  const viewModeSelector = () => (
    <div className="flex items-center gap-1 bg-gray-800 rounded-full px-1 py-0.5">
      <button onClick={() => setViewMode('dashboard')} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${viewMode === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-gray-300 hover:text-white'}`} title="Dashboard">
        <LayoutDashboard className="h-3.5 w-3.5" /><span className="hidden sm:inline">Dashboard</span>
      </button>
      <button onClick={() => setViewMode('video')} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${viewMode === 'video' ? 'bg-primary text-primary-foreground' : 'text-gray-300 hover:text-white'}`} title="Vídeo">
        <Tv className="h-3.5 w-3.5" /><span className="hidden sm:inline">Vídeo</span>
      </button>
      <button onClick={() => setViewMode('compact')} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${viewMode === 'compact' ? 'bg-primary text-primary-foreground' : 'text-gray-300 hover:text-white'}`} title="Compacto">
        <Columns className="h-3.5 w-3.5" /><span className="hidden sm:inline">Compacto</span>
      </button>
    </div>
  );

  const renderDashboardLayout = () => (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="video-consultation-page">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {viewModeSelector()}
          <div className="text-white text-xs flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            <span className="font-medium">Teleconsulta</span>
            {isRecording && <Badge className="bg-red-600 text-white text-[10px] h-5 animate-pulse">REC</Badge>}
            {isTranscribing && <Badge className="bg-blue-600 text-white text-[10px] h-5">Transcrevendo</Badge>}
          </div>
        </div>
        {controlBar(true)}
      </div>

      {/* Dashboard grid */}
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-2 p-2 overflow-hidden">
        {/* Video - takes top-left, 1 col x 1 row */}
        <div className="row-span-1">
          {videoArea('w-full h-full', true)}
        </div>
        {/* Chat - top-center */}
        <div className="row-span-1">
          {chatPanel()}
        </div>
        {/* AI - top-right */}
        <div className="row-span-1">
          {aiPanel()}
        </div>
        {/* Transcription - bottom-left */}
        <div className="row-span-1">
          {transcriptionPanel()}
        </div>
        {/* Notes - bottom-center and right, spanning 2 cols */}
        <div className="col-span-2 row-span-1">
          {notesPanel()}
        </div>
      </div>
    </div>
  );

  const sideChatPanel = () => (
    <div className={`bg-background border-l flex flex-col transition-all duration-300 ${showSideChat ? 'w-80' : 'w-0 overflow-hidden'}`}>
      {showSideChat && (
        <>
          <div className="px-3 py-2 border-b flex items-center gap-2 shrink-0">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Chat</span>
            {chatNotes.length > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-auto">{chatNotes.length}</Badge>}
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowSideChat(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-2" data-testid="scroll-side-chat">
            <div className="space-y-1.5" ref={chatScrollRef}>
              {chatNotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem mensagens</p>}
              {chatNotes.map((note) => {
                const isDoctor = note.metadata?.senderRole === 'doctor' || note.userId === user?.id;
                return (
                  <div key={note.id} className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 ${isDoctor ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <div className="flex items-center gap-1">
                        {isDoctor ? <Stethoscope className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                        <span className="text-[10px] font-medium">{isDoctor ? 'Dr.' : 'Pac.'}</span>
                        <span className={`text-[10px] ml-auto ${isDoctor ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5">{note.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-2 border-t flex gap-1.5 shrink-0">
            <Input placeholder="Mensagem..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()} className="text-xs h-8" />
            <Button onClick={sendChatMessage} size="icon" disabled={createNoteMutation.isPending} className="h-8 w-8 shrink-0"><Send className="h-3.5 w-3.5" /></Button>
          </div>
        </>
      )}
    </div>
  );

  const screenShareOverlay = () => {
    if (!isScreenSharing || !screenShareFullscreen) return null;
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
        <div ref={screenShareOverlayRef} className="w-full h-full" />
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg z-10">
          <Monitor className="h-4 w-4" />
          <span className="text-sm font-medium">Compartilhando tela</span>
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setScreenShareFullscreen(false)} className="rounded-full gap-1.5">
            <Minimize className="h-4 w-4" /> Reduzir
          </Button>
          <Button variant="destructive" size="sm" onClick={toggleScreenShare} className="rounded-full gap-1.5">
            <MonitorOff className="h-4 w-4" /> Parar
          </Button>
        </div>
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          {controlBar()}
        </div>
      </div>
    );
  };

  const renderVideoLayout = () => (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'container mx-auto p-4'} bg-black flex`} data-testid="video-consultation-page">
      {screenShareOverlay()}

      <div className="flex-1 flex flex-col">
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          {viewModeSelector()}
          <Button variant={showSideChat ? 'secondary' : 'outline'} size="icon" onClick={() => setShowSideChat(!showSideChat)} className="rounded-full h-8 w-8 bg-gray-800/80 border-gray-600 text-white hover:text-white relative" title="Chat lateral">
            {showSideChat ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            {chatNotes.length > 0 && !showSideChat && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-red-500">{chatNotes.length}</Badge>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="rounded-full h-8 w-8 bg-gray-800/80 border-gray-600 text-white hover:text-white" data-testid="button-toggle-fullscreen">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 relative" style={{ minHeight: '60vh' }}>
          {videoArea('absolute inset-0')}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            {controlBar()}
          </div>
        </div>

        <div className="w-full bg-background border-t" style={{ height: '40vh' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-4 h-10">
              <TabsTrigger value="chat" className="flex items-center gap-1 text-xs" data-testid="tab-chat">
                <MessageSquare className="h-3.5 w-3.5" /> Chat
                {chatNotes.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{chatNotes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-1 text-xs" data-testid="tab-ai">
                <Brain className="h-3.5 w-3.5" /> {isAdmin ? 'IA' : 'Análise'}
                {aiLoading && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </TabsTrigger>
              <TabsTrigger value="transcription" className="flex items-center gap-1 text-xs">
                <AudioLines className="h-3.5 w-3.5" /> Transcrição
                {transcriptEntries.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{transcriptEntries.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1 text-xs" data-testid="tab-notes">
                <FileText className="h-3.5 w-3.5" /> Notas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden mt-0">
              <ScrollArea className="flex-1 p-3" data-testid="scroll-chat">
                <div className="space-y-2" ref={!showSideChat ? chatScrollRef : undefined}>
                  {chatNotes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem. Envie uma mensagem para o paciente.</p>}
                  {chatNotes.map((note) => {
                    const isDoctor = note.metadata?.senderRole === 'doctor' || note.userId === user?.id;
                    return (
                      <div key={note.id} className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}>
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
                <Input placeholder="Mensagem para o paciente..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()} data-testid="input-chat-message" />
                <Button onClick={sendChatMessage} size="icon" disabled={createNoteMutation.isPending} data-testid="button-send-chat"><Send className="h-4 w-4" /></Button>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden mt-0">
              <ScrollArea className="flex-1 p-3"><div className="space-y-2" ref={aiScrollRef}>
                {iam3dNotes.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide">{isAdmin ? 'Interconsulta IAM3D' : 'Interconsulta'}</span>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">{iam3dNotes.length}</Badge>
                    </div>
                    {iam3dNotes.slice(-1).map((note) => (
                      <Card key={note.id} className="p-3 bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700 border-l-4 border-l-purple-600">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400">{isAdmin ? '🔬 IAM3D — Hipóteses Diagnósticas' : '🔬 Hipóteses Diagnósticas'}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{new Date(note.timestamp || note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      <FormattedText content={note.content} className="text-sm" />
                    </Card>
                  ))}
                  {iam3dNotes.length > 1 && (
                    <details className="mt-1">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver {iam3dNotes.length - 1} análise(s) anterior(es)</summary>
                      <div className="space-y-1 mt-1">
                        {iam3dNotes.slice(0, -1).reverse().map((note) => (
                          <Card key={note.id} className="p-2 bg-purple-50/50 dark:bg-purple-950/50 border-purple-200 opacity-75">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-semibold text-purple-600">{isAdmin ? 'IAM3D' : 'Análise'}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(note.timestamp || note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <FormattedText content={note.content} className="text-xs" />
                          </Card>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="border-t border-dashed border-muted-foreground/30 my-2" />
                </div>
              )}
              {aiNotes.length === 0 && iam3dNotes.length === 0 && <div className="text-center py-8"><Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">{isAdmin ? 'Faça perguntas diagnósticas ou adicione anotações para ativar o IAM3D.' : 'Faça perguntas diagnósticas ou adicione anotações para ativar a análise.'}</p></div>}
              {aiNotes.map((note) => (
                <Card key={note.id} className={`p-3 ${note.type === 'ai_query' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {note.type === 'ai_query' ? <Stethoscope className="h-3.5 w-3.5 text-blue-600" /> : <Brain className="h-3.5 w-3.5 text-green-600" />}
                    <span className="text-xs font-semibold">{note.type === 'ai_query' ? 'Sua pergunta' : (isAdmin ? 'Resposta da IA' : 'Resposta')}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <FormattedText content={note.content} className="text-sm" />
                </Card>
              ))}
              {aiLoading && <Card className="p-3 bg-green-50 dark:bg-green-950"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-green-600" /><span className="text-sm text-muted-foreground">Analisando...</span></div></Card>}
            </div></ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Textarea placeholder="Faça uma pergunta diagnóstica..." value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiQuery(); } }} rows={1} className="resize-none min-h-[36px]" data-testid="input-ai-query" />
              <Button onClick={sendAiQuery} size="icon" disabled={aiLoading || createNoteMutation.isPending} data-testid="button-send-ai"><Send className="h-4 w-4" /></Button>
            </div>
          </TabsContent>

          <TabsContent value="transcription" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3"><div className="space-y-1.5" ref={transcriptScrollRef}>
              {transcriptEntries.length === 0 && !isTranscribing && <div className="text-center py-8"><AudioLines className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm text-muted-foreground">Clique no botão de transcrição para iniciar.</p></div>}
              {transcriptEntries.map((entry) => (
                <div key={entry.id} className={`flex items-start gap-2 p-2 rounded-lg ${entry.speaker === 'doctor' ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-orange-50 dark:bg-orange-950/50'}`}>
                  {entry.speaker === 'doctor' ? <Stethoscope className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" /> : <User className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${entry.speaker === 'doctor' ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>{entry.speaker === 'doctor' ? 'Doutor' : 'Paciente'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <button onClick={() => markAsSpeaker(entry.id, entry.speaker === 'doctor' ? 'patient' : 'doctor')} className="text-xs text-muted-foreground hover:text-foreground ml-auto underline">{entry.speaker === 'doctor' ? 'Marcar como Paciente' : 'Marcar como Doutor'}</button>
                    </div>
                    <p className="text-sm mt-0.5">{entry.text}</p>
                  </div>
                </div>
              ))}
              {interimText && <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900 opacity-60"><Stethoscope className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" /><p className="text-sm italic">{interimText}...</p></div>}
            </div></ScrollArea>
            <div className="p-3 border-t flex items-center gap-2">
              <Button variant={isTranscribing ? 'destructive' : 'default'} size="sm" onClick={toggleTranscription} className="gap-1.5">{isTranscribing ? <><Pause className="h-3.5 w-3.5" /> Parar</> : <><AudioLines className="h-3.5 w-3.5" /> Iniciar Transcrição</>}</Button>
              {transcriptEntries.length > 0 && <>
                <Button variant="outline" size="sm" onClick={saveTranscriptionToNotes} className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Salvar em Notas</Button>
                <Button variant="outline" size="sm" onClick={exportTranscription} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Exportar .txt</Button>
              </>}
              <span className="text-xs text-muted-foreground ml-auto">{transcriptEntries.length} segmento(s)</span>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 p-3"><div className="space-y-2">
              {doctorNotes.length === 0 && transcriptionNotes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma anotação. Registre observações clínicas importantes.</p>}
              {doctorNotes.map((note) => (
                <Card key={note.id} className="p-3 border-l-4 border-l-primary"><div className="flex items-center gap-1.5 mb-1"><FileText className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold">Anotação Médica</span><span className="text-xs text-muted-foreground ml-auto">{new Date(note.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><FormattedText content={note.content} className="text-sm" /></Card>
              ))}
              {transcriptionNotes.map((note) => (
                <Card key={note.id} className="p-3 border-l-4 border-l-blue-500"><div className="flex items-center gap-1.5 mb-1"><AudioLines className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-semibold">Transcrição Salva</span></div><pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded mt-1 max-h-32 overflow-y-auto">{note.content}</pre></Card>
              ))}
            </div></ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Textarea placeholder="Observações clínicas, diagnóstico, conduta..." value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDoctorNote(); }} rows={1} className="resize-none min-h-[36px]" data-testid="input-doctor-note" />
              <Button onClick={saveDoctorNote} size="icon" disabled={createNoteMutation.isPending} data-testid="button-save-note" title="Salvar (Ctrl+Enter)"><Send className="h-4 w-4" /></Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </div>
      {sideChatPanel()}
    </div>
  );

  const renderCompactLayout = () => (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="video-consultation-page">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        {viewModeSelector()}
        {controlBar(true)}
      </div>

      {/* Side by side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video */}
        <div className="w-1/2 p-2 flex flex-col">
          {videoArea('flex-1', true)}
        </div>
        {/* Right: Tabs */}
        <div className="w-1/2 border-l">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="w-full grid grid-cols-4 h-9 rounded-none">
              <TabsTrigger value="chat" className="text-xs gap-1"><MessageSquare className="h-3 w-3" /> Chat</TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1"><Brain className="h-3 w-3" /> {isAdmin ? 'IA' : 'Análise'}</TabsTrigger>
              <TabsTrigger value="transcription" className="text-xs gap-1"><AudioLines className="h-3 w-3" /> Trans.</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1"><FileText className="h-3 w-3" /> Notas</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">{chatPanel('h-full')}</TabsContent>
            <TabsContent value="ai" className="flex-1 overflow-hidden mt-0">{aiPanel('h-full')}</TabsContent>
            <TabsContent value="transcription" className="flex-1 overflow-hidden mt-0">{transcriptionPanel('h-full')}</TabsContent>
            <TabsContent value="notes" className="flex-1 overflow-hidden mt-0">{notesPanel('h-full')}</TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {viewMode === 'dashboard' && renderDashboardLayout()}
      {viewMode === 'video' && renderVideoLayout()}
      {viewMode === 'compact' && renderCompactLayout()}

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

      {isScreenSharing && !screenShareFullscreen && (
        <div className="fixed top-4 right-4 z-[60] bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <Monitor className="h-4 w-4" />
          <span className="text-sm font-medium">Compartilhando tela</span>
          <Button variant="ghost" size="sm" onClick={() => setScreenShareFullscreen(true)} className="text-white hover:text-white hover:bg-red-700 h-6 px-2">
            Expandir
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleScreenShare} className="text-white hover:text-white hover:bg-red-700 h-6 px-2">
            Parar
          </Button>
        </div>
      )}

      <Dialog open={showEndCallDialog} onOpenChange={setShowEndCallDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Encerrar Consulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Como deseja encerrar?
            </p>
            <Button
              className="w-full justify-start h-auto py-2.5 px-3"
              variant="default"
              onClick={() => confirmEndCall('completed')}
              disabled={endConsultationMutation.isPending}
            >
              <div className="text-left">
                <p className="font-medium text-sm">Concluir Consulta</p>
                <p className="text-[11px] opacity-80 mt-0.5">Prontuário gerado automaticamente.</p>
              </div>
            </Button>
            <Button
              className="w-full justify-start h-auto py-2.5 px-3"
              variant="outline"
              onClick={() => confirmEndCall('incomplete')}
              disabled={endConsultationMutation.isPending}
            >
              <div className="text-left">
                <p className="font-medium text-sm text-orange-600 dark:text-orange-400">Sair sem Concluir</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Poderá retomar depois.</p>
              </div>
            </Button>
            <Textarea
              placeholder="Motivo (opcional)..."
              value={endCallReason}
              onChange={(e) => setEndCallReason(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowEndCallDialog(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-Consultation Summary Panel */}
      <Dialog open={showPostConsultSummary} onOpenChange={(open) => {
        if (!open) {
          setShowPostConsultSummary(false);
          setLocation('/schedule');
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              Resumo Pós-Consulta
            </DialogTitle>
          </DialogHeader>
          {postConsultLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Gerando itens pós-consulta...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postConsultItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item pós-consulta foi gerado automaticamente.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Revise os itens gerados automaticamente. Use os botões para ativar ou desativar cada item antes de prosseguir.
                  </p>
                  <div className="space-y-2">
                    {postConsultItems.map((item, idx) => {
                      const isEnabled = item.status !== 'disabled';
                      const typeIcons: Record<string, any> = {
                        prescription: Pill,
                        exam: TestTube,
                        referral: ArrowUpRight,
                        followup: CalendarCheck,
                      };
                      const typeLabels: Record<string, string> = {
                        prescription: 'Prescrição',
                        exam: 'Exame',
                        referral: 'Encaminhamento',
                        followup: 'Retorno',
                      };
                      const typeColors: Record<string, string> = {
                        prescription: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
                        exam: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400',
                        referral: 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400',
                        followup: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400',
                      };
                      const IconComponent = typeIcons[item.type] || FileText;
                      return (
                        <div
                          key={item.id || idx}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                            isEnabled
                              ? 'border-border bg-card'
                              : 'border-dashed border-muted bg-muted/30 opacity-60'
                          }`}
                        >
                          <div className={`p-1.5 rounded-md ${typeColors[item.type] || 'text-gray-600 bg-gray-50'}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {typeLabels[item.type] || item.type}
                              </Badge>
                              {item.type === 'followup' && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                                  Opcional
                                </Badge>
                              )}
                            </div>
                            {editingItemId === item.id ? (
                              <div className="space-y-1.5 w-full">
                                <Input
                                  value={editingItemTitle}
                                  onChange={(e) => setEditingItemTitle(e.target.value)}
                                  className="h-7 text-sm"
                                  placeholder="Título"
                                />
                                <Textarea
                                  value={editingItemDescription}
                                  onChange={(e) => setEditingItemDescription(e.target.value)}
                                  className="text-xs min-h-[50px]"
                                  rows={2}
                                  placeholder="Descrição"
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-6 text-[10px] px-2" onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/post-consultation/items/${item.id}/edit`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          title: editingItemTitle,
                                          description: editingItemDescription,
                                          editReason: 'Editado no resumo pós-consulta',
                                        }),
                                      });
                                      if (res.ok) {
                                        const updated = await res.json();
                                        setPostConsultItems(prev => prev.map(i =>
                                          i.id === item.id ? { ...i, title: editingItemTitle, description: editingItemDescription } : i
                                        ));
                                        setEditingItemId(null);
                                        toast({ title: 'Item atualizado' });
                                      } else {
                                        toast({ title: 'Erro ao salvar edição', variant: 'destructive' });
                                      }
                                    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
                                  }}>
                                    <Check className="w-3 h-3 mr-0.5" /> Salvar
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingItemId(null)}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="font-medium text-sm truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                              </>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            {editingItemId !== item.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5"
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingItemTitle(item.title || '');
                                  setEditingItemDescription(item.description || '');
                                }}
                              >
                                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8 px-2"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/post-consultation/items/${item.id}/toggle`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ enabled: !isEnabled }),
                                });
                                if (res.ok) {
                                  setPostConsultItems(prev => prev.map(i =>
                                    i.id === item.id ? { ...i, status: isEnabled ? 'disabled' : 'pending_review' } : i
                                  ));
                                } else {
                                  toast({ title: 'Erro ao alternar item', variant: 'destructive' });
                                }
                              } catch (err) {
                                console.error('Toggle error:', err);
                                toast({ title: 'Erro ao alternar item', variant: 'destructive' });
                              }
                            }}
                          >
                            {isEnabled ? (
                              <ToggleRight className="w-5 h-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* SUS Prontuário Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium">Prontuário SUS</span>
                  </div>
                  {susProntuario ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        Gerado
                      </Badge>
                      {susProntuario.soapComplianceScore != null && (
                        <Badge variant={susProntuario.soapComplianceScore >= 70 ? 'default' : 'destructive'} className="text-[10px]">
                          SOAP: {susProntuario.soapComplianceScore}%
                        </Badge>
                      )}
                    </div>
                  ) : susProntuarioLoading ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Gerando...
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={susProntuarioLoading}
                      onClick={async () => {
                        setSusProntuarioLoading(true);
                        try {
                          const res = await fetch('/api/sus-prontuario/generate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ consultationId }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setSusProntuario(data);
                            toast({ title: 'Prontuário SUS gerado com sucesso' });
                          } else {
                            toast({ title: 'Erro ao gerar prontuário', variant: 'destructive' });
                          }
                        } catch (err) {
                          console.error('SUS generation error:', err);
                          toast({ title: 'Erro ao gerar prontuário', variant: 'destructive' });
                        }
                        setSusProntuarioLoading(false);
                      }}
                    >
                      Regenerar Prontuário SUS
                    </Button>
                  )}
                </div>
                {susProntuario && (
                  <div className="space-y-2 mt-2">
                    {susProntuario.soapComplianceFlags && susProntuario.soapComplianceFlags.length > 0 && (
                      <div className="space-y-1">
                        {susProntuario.soapComplianceFlags.map((flag: any, i: number) => (
                          <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${
                            flag.severity === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' :
                            flag.severity === 'warning' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                            'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                          }`}>
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{flag.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-muted/50 rounded">
                        <span className="font-medium block mb-1">Queixa Principal</span>
                        <span className="text-muted-foreground line-clamp-3">{susProntuario.chiefComplaint || '-'}</span>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <span className="font-medium block mb-1">Avaliação</span>
                        <span className="text-muted-foreground line-clamp-3">{susProntuario.assessment || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowPostConsultSummary(false);
                    setLocation('/post-consultation-review');
                  }}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Revisar Itens
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPostConsultSummary(false);
                    setLocation('/schedule');
                  }}
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConsultationInactivityMonitor
        consultationId={consultationId}
        isJoined={joined}
        onTimeout={() => {
          leaveChannel();
          setLocation('/schedule');
        }}
      />
    </>
  );
}
