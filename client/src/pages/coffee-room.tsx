import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Coffee, Video, VideoOff, Users } from "lucide-react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import PageWrapper from "@/components/page-wrapper";
import origamiHeroImage from "@/assets/origami-hero.png";

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

  const joinCoffeeRoom = async () => {
    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setAgoraClient(client);
      
      const appId = import.meta.env.VITE_AGORA_APP_ID || "YOUR_AGORA_APP_ID";
      const channelName = "coffee-room-telemed";
      
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
        setParticipants(prev => [...new Set([...prev, `User ${remoteUser.uid}`])]);
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
      toast({
        title: "Erro",
        description: "Não foi possível entrar na sala.",
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
            <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Coffee className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Cafeteria Virtual
              </h1>
              <p className="text-muted-foreground">Espaço de descontração e networking para médicos</p>
            </div>
          </div>
          
          <div className="flex gap-3">
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Video Grid */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader>
                  <CardTitle>Sala de Café</CardTitle>
                  <CardDescription>Converse com colegas em um ambiente descontraído</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Local Video */}
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

            {/* Participants Panel */}
            <div className="lg:col-span-1">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Na Cafeteria ({participants.length + 1})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">{user?.name}</span>
                      <Badge variant="outline">Você</Badge>
                    </div>
                    {participants.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="text-sm font-medium">{p}</span>
                        <Badge variant="outline">Médico</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-white/80 dark:bg-black/40 border-white/20 mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">Sobre a Cafeteria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>☕ Espaço informal para networking</p>
                  <p>👥 Converse com colegas médicos</p>
                  <p>💡 Troque experiências e conhecimento</p>
                  <p>🤝 Faça novas conexões profissionais</p>
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
