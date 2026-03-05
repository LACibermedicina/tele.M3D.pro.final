import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/use-websocket";
import { useLocation } from "wouter";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { formatErrorForToast } from "@/lib/error-handler";
import { TriageBadge } from "@/components/triage/triage-badge";
import PageWrapper from "@/components/layout/page-wrapper";
import origamiHeroImage from "@assets/image_1759773239051.png";
import {
  Clock,
  Users,
  ArrowRightLeft,
  Eye,
  Play,
  RefreshCw,
  Stethoscope,
  AlertTriangle,
  Timer,
  UserCheck,
  Loader2,
  Video,
} from "lucide-react";

interface WaitingPatient {
  id: string;
  patientName: string;
  patientId: string;
  patientUserId: string;
  symptoms: string;
  urgencyLevel: string;
  clinicalPresentation?: string;
  status: string;
  assignedDoctor: { id: string; name: string; specialization?: string } | null;
  waitingSince: string;
  transfer: { id: string; status: string; requestingDoctorId: string } | null;
  isOwnRequest?: boolean;
}

function WaitTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) {
        setElapsed(`${hrs}h ${mins % 60}min`);
      } else {
        setElapsed(`${mins}min`);
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Timer className="h-3 w-3" />
      {elapsed}
    </span>
  );
}

export default function WaitingRoom() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { messages } = useWebSocket();

  const isStaff = user?.role === 'doctor' || user?.role === 'admin';
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferReason, setTransferReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<WaitingPatient | null>(null);

  const { data: waitingPatients, isLoading } = useQuery<WaitingPatient[]>({
    queryKey: ["/api/waiting-room"],
    refetchInterval: 15000,
  });

  useEffect(() => {
    const relevantTypes = [
      "waiting_room_update",
      "doctor_transfer_request",
      "doctor_transfer_response",
      "patient_transfer_request",
      "consultation_request",
    ];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && relevantTypes.includes(lastMsg.type)) {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-room"] });
    }
  }, [messages, queryClient]);

  const transferMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      apiRequest("POST", `/api/waiting-room/${requestId}/transfer`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-room"] });
      toast({ title: t("common.success"), description: "Solicitação de transferência enviada" });
      setTransferDialogOpen(false);
      setTransferReason("");
      setSelectedRequest(null);
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/consultation-requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waiting-room"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-requests"] });
      toast({ title: t("common.success"), description: "Consulta aceita" });
    },
    onError: (error) => {
      const errorInfo = formatErrorForToast(error);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: "destructive" });
    },
  });

  const handleTransferClick = (patient: WaitingPatient) => {
    setSelectedRequest(patient);
    setTransferReason("");
    setTransferDialogOpen(true);
  };

  const handleTransferSubmit = () => {
    if (!selectedRequest) return;
    transferMutation.mutate({
      requestId: selectedRequest.id,
      reason: transferReason,
    });
  };

  const sorted = useMemo(() => {
    if (!waitingPatients) return [];
    const priorityMap: Record<string, number> = {
      emergency: 1,
      very_urgent: 2,
      urgent: 3,
      standard: 4,
      non_urgent: 5,
    };
    return [...waitingPatients].sort((a, b) => {
      const pa = priorityMap[a.urgencyLevel] || 5;
      const pb = priorityMap[b.urgencyLevel] || 5;
      if (pa !== pb) return pa - pb;
      return new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime();
    });
  }, [waitingPatients]);

  const getTransferStatusLabel = (transfer: WaitingPatient["transfer"]) => {
    if (!transfer) return null;
    if (transfer.status === "pending_original_doctor") {
      return "Aguardando aprovação do médico";
    }
    if (transfer.status === "pending_patient") {
      return "Aguardando confirmação do paciente";
    }
    return null;
  };

  const stats = useMemo(() => {
    if (!waitingPatients) return { total: 0, emergency: 0, transferring: 0 };
    return {
      total: waitingPatients.length,
      emergency: waitingPatients.filter(
        (p) => p.urgencyLevel === "emergency" || p.urgencyLevel === "very_urgent"
      ).length,
      transferring: waitingPatients.filter((p) => p.transfer !== null).length,
    };
  }, [waitingPatients]);

  const myPosition = useMemo(() => {
    if (!sorted || isStaff) return null;
    const idx = sorted.findIndex((p) => p.isOwnRequest);
    if (idx === -1) return null;
    return { position: idx + 1, total: sorted.length, request: sorted[idx] };
  }, [sorted, isStaff]);

  return (
    <PageWrapper variant="origami" origamiImage={origamiHeroImage}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Sala de Espera
            </h1>
            <p className="text-muted-foreground">
              {isStaff ? 'Pacientes aguardando atendimento em tempo real' : 'Acompanhe sua posição na fila de atendimento'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/waiting-room"] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total aguardando</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.emergency}</p>
                <p className="text-xs text-muted-foreground">Urgentes/Emergência</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.transferring}</p>
                <p className="text-xs text-muted-foreground">Em transferência</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isStaff && myPosition && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-primary">{myPosition.position}º</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Sua posição na fila</h3>
                  <p className="text-sm text-muted-foreground">
                    {myPosition.position === 1 ? 'Você é o próximo a ser atendido!' : `${myPosition.position - 1} paciente(s) antes de você`} 
                    {' '}— Total na fila: {myPosition.total}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <TriageBadge level={myPosition.request.urgencyLevel} size="sm" />
                    <WaitTimer since={myPosition.request.waitingSince} />
                    {myPosition.request.status === 'accepted' && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Aceito pelo médico
                      </Badge>
                    )}
                  </div>
                </div>
                {myPosition.request.status === 'accepted' && (
                  <Button size="sm" onClick={() => setLocation('/my-consultations')}>
                    <Video className="h-4 w-4 mr-1" />
                    Ir para Consulta
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <UserCheck className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                {isStaff ? 'Nenhum paciente na sala de espera' : 'Você não está na fila de espera'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isStaff ? 'Quando pacientes solicitarem consulta, aparecerão aqui.' : 'Solicite uma consulta para entrar na fila de atendimento.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <div className="space-y-3">
              {sorted.map((patient) => {
                const transferStatus = getTransferStatusLabel(patient.transfer);
                const isMyPatient = patient.assignedDoctor?.id === user?.id;
                const hasActiveTransfer = patient.transfer !== null;

                return (
                  <Card
                    key={patient.id}
                    className={`transition-all hover:shadow-md ${
                      patient.urgencyLevel === "emergency"
                        ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/10"
                        : patient.urgencyLevel === "very_urgent"
                        ? "border-orange-500/50 bg-orange-50/20 dark:bg-orange-950/10"
                        : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground truncate">
                                {patient.patientName}
                              </h3>
                              <TriageBadge level={patient.urgencyLevel} size="sm" />
                              <WaitTimer since={patient.waitingSince} />
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                              {patient.symptoms}
                            </p>
                            {patient.clinicalPresentation && (
                              <p className="text-xs text-muted-foreground/80 line-clamp-1">
                                {patient.clinicalPresentation}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {patient.assignedDoctor && (
                                <Badge variant="outline" className="text-xs">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Dr(a). {patient.assignedDoctor.name}
                                  {patient.assignedDoctor.specialization &&
                                    ` - ${patient.assignedDoctor.specialization}`}
                                </Badge>
                              )}
                              {transferStatus && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                >
                                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                                  {transferStatus}
                                </Badge>
                              )}
                              {isMyPatient && (
                                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300">
                                  Meu paciente
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                          {isStaff ? (
                            <>
                              {patient.status === "pending" && (
                                <Button
                                  size="sm"
                                  onClick={() => acceptMutation.mutate(patient.id)}
                                  disabled={acceptMutation.isPending}
                                >
                                  {acceptMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-1" />
                                  )}
                                  Aceitar
                                </Button>
                              )}
                              {!isMyPatient &&
                                patient.assignedDoctor &&
                                !hasActiveTransfer && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTransferClick(patient)}
                                    className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                  >
                                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                                    Transferir para Mim
                                  </Button>
                                )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setLocation(`/patients/${patient.patientId}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Perfil
                              </Button>
                            </>
                          ) : (
                            <>
                              {patient.isOwnRequest && (
                                <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                  Sua solicitação
                                </Badge>
                              )}
                              {patient.isOwnRequest && patient.status === "accepted" && (
                                <Button
                                  size="sm"
                                  onClick={() => setLocation('/my-consultations')}
                                >
                                  <Video className="h-4 w-4 mr-1" />
                                  Ir para Consulta
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-amber-600" />
                Solicitar Transferência
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedRequest && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="font-medium">{selectedRequest.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    Médico atual: Dr(a). {selectedRequest.assignedDoctor?.name || "Não atribuído"}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Motivo da transferência
                </label>
                <Textarea
                  placeholder="Descreva o motivo para solicitar a transferência deste paciente..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setTransferDialogOpen(false);
                  setSelectedRequest(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransferSubmit}
                disabled={transferMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {transferMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                )}
                Solicitar Transferência
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageWrapper>
  );
}
