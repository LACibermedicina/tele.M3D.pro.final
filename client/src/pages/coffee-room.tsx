import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Coffee, Video, VideoOff, Users, Send, MessageCircle } from "lucide-react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";

export default function CoffeeRoom() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [agoraClient, setAgoraClient] = useState<IAgoraRTCClient | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  
  // Chat states
  const [messages, setMessages] = useState<Array<{id: string, user: string, text: string, timestamp: Date}>>([]);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const joinCoffeeRoom = async () => {
    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setAgoraClient(client);
      
      const channelName = "coffee-room-telemed";
      
      // Generate numeric UID from user ID (Agora requires numeric UID)
      const numericUid = user?.id ? parseInt(user.id.replace(/\D/g, '').slice(0, 10)) || 0 : 0;
      
      const tokenResponse = await fetch('/api/agora/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid: numericUid }),
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
      
      setIsInRoom(true);
      
      // Listen for remote users
      client.on("user-published", async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        
        if (mediaType === "video") {
          const remoteVideoTrack = remoteUser.videoTrack;
          const playerContainer = document.createElement("div");
          playerContainer.id = `remote-${remoteUser.uid}`;
          playerContainer.className = "relative bg-gray-900 rounded-lg overflow-hidden aspect-video";
          document.getElementById("remote-videos")?.appendChild(playerContainer);
          remoteVideoTrack?.play(playerContainer);
        }
        
        if (mediaType === "audio") {
          remoteUser.audioTrack?.play();
        }
        
        // Update participants
        setParticipants(prev => {
          const newSet = new Set([...prev, `User ${remoteUser.uid}`]);
          return Array.from(newSet);
        });
      });
      
      client.on("user-unpublished", (remoteUser) => {
        const playerContainer = document.getElementById(`remote-${remoteUser.uid}`);
        if (playerContainer) {
          playerContainer.remove();
        }
        setParticipants(prev => prev.filter(p => p !== `User ${remoteUser.uid}`));
      });
      
      toast({
        title: "Bem-vindo à Cafeteria!",
        description: "Você entrou na sala de café virtual.",
      });
    } catch (error) {
      console.error('Agora initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao Entrar na Cafeteria",
        description: errorMessage.includes('credentials') 
          ? "Credenciais do Agora.io não configuradas. Entre em contato com o administrador."
          : "Não foi possível entrar na sala. Verifique suas permissões de câmera e microfone.",
        variant: "destructive",
      });
    }
  };

  const leaveCoffeeRoom = async () => {
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
    setIsInRoom(false);
    setParticipants([]);
    
    toast({
      title: "Até logo!",
      description: "Você saiu da cafeteria virtual.",
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

  const sendMessage = () => {
    if (messageText.trim() && agoraClient) {
      const newMessage = {
        id: Date.now().toString(),
        user: user?.name || 'Anônimo',
        text: messageText.trim(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Send via Agora data channel (if available) or use WebSocket
      // For now, just local display - implement real-time sync as needed
      
      setMessageText("");
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isInRoom) {
        leaveCoffeeRoom();
      }
    };
  }, []);

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
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-8 gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Coffee className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Cafeteria Virtual
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Espaço de descontração e networking para médicos</p>
            </div>
          </div>
          
          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
            {isInRoom ? (
              <Button 
                variant="destructive" 
                onClick={leaveCoffeeRoom}
              >
                <VideoOff className="h-4 w-4 mr-2" />
                Sair da Cafeteria
              </Button>
            ) : (
              <Button 
                onClick={joinCoffeeRoom}
                className="bg-gradient-to-r from-amber-600 to-orange-600"
              >
                <Video className="h-4 w-4 mr-2" />
                Entrar na Cafeteria
              </Button>
            )}
          </div>
        </div>

        {isInRoom ? (
          <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Video Grid */}
            <div className="lg:col-span-3 space-y-2 sm:space-y-4">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Sala de Café</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Converse com colegas em um ambiente descontraído</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* Local Video */}
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                      <div id="local-video" className="w-full h-full"></div>
                      
                      <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 sm:gap-2">
                        <Button
                          variant={isVideoOn ? "default" : "destructive"}
                          size="icon"
                          onClick={toggleVideo}
                          className="w-11 h-11 sm:w-12 sm:h-12"
                        >
                          {isVideoOn ? <Video className="h-4 w-4 sm:h-5 sm:w-5" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </Button>
                        <Button
                          variant={isAudioOn ? "default" : "destructive"}
                          size="icon"
                          onClick={toggleAudio}
                          className="w-11 h-11 sm:w-12 sm:h-12"
                        >
                          <i className={`fas fa-${isAudioOn ? 'microphone' : 'microphone-slash'} text-sm`}></i>
                        </Button>
                      </div>

                      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm">
                        Você
                      </div>

                      {!isVideoOn && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                          <p className="text-white text-lg">Câmera desligada</p>
                        </div>
                      )}
                    </div>

                    {/* Remote Videos */}
                    <div id="remote-videos" className="grid grid-cols-1 gap-4">
                      {participants.length === 0 && (
                        <div className="flex items-center justify-center bg-gray-900 rounded-lg aspect-video">
                          <p className="text-white/60">Aguardando outros participantes...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chat and Participants Panel */}
            <div className="lg:col-span-1 space-y-3 sm:space-y-4">
              {/* Chat Panel */}
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-48 sm:h-[300px] px-3 sm:px-4">
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
                  <div className="p-3 sm:p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite sua mensagem..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1 text-sm"
                      />
                      <Button size="icon" onClick={sendMessage} disabled={!messageText.trim()} className="shrink-0">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participants Panel */}
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                    Participantes ({participants.length + 1})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">{user?.name}</span>
                      <Badge variant="outline" className="text-xs">Você</Badge>
                    </div>
                    {participants.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="text-sm font-medium">{p}</span>
                        <Badge variant="outline" className="text-xs">Médico</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
                  <Coffee className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Cafeteria Virtual</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Entre na cafeteria virtual para conversar com outros médicos em um ambiente descontraído
                </p>
                <Button 
                  size="lg"
                  onClick={joinCoffeeRoom}
                  className="bg-gradient-to-r from-amber-600 to-orange-600"
                >
                  <Coffee className="h-5 w-5 mr-2" />
                  Entrar na Cafeteria
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
