import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Stethoscope,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  UserCheck,
  ArrowLeft,
  Search,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import PageWrapper from "@/components/layout/page-wrapper";

interface DoctorInfo {
  id: string;
  name: string;
  specialization: string | null;
  medicalLicense: string | null;
  profilePicture: string | null;
  isOnline: boolean | null;
  availableForImmediate: boolean | null;
}

interface SpecialtyGroup {
  specialty: string;
  doctors: DoctorInfo[];
}

interface PatientInfo {
  id: string;
  name: string;
}

interface InterConsultation {
  id: string;
  requestingDoctorId: string;
  targetDoctorId: string;
  patientId: string | null;
  specialty: string | null;
  clinicalCase: string;
  urgency: string;
  status: string;
  responseNotes: string | null;
  respondedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  requestingDoctor: { id: string; name: string; specialization: string | null; profilePicture: string | null } | null;
  targetDoctor: { id: string; name: string; specialization: string | null; profilePicture: string | null } | null;
  patient: PatientInfo | null;
}

type Step = "select-specialty" | "select-doctor" | "form" | "success";

export default function InterConsultationRequest() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("select-specialty");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo | null>(null);
  const [clinicalCase, setClinicalCase] = useState("");
  const [urgency, setUrgency] = useState("standard");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  const { data: specialtyGroups, isLoading: loadingDoctors } = useQuery<SpecialtyGroup[]>({
    queryKey: ["/api/doctors/by-specialty"],
  });

  const { data: myPatients } = useQuery<any[]>({
    queryKey: ["/api/patients"],
    enabled: !!user,
  });

  const { data: interConsultations, isLoading: loadingHistory } = useQuery<InterConsultation[]>({
    queryKey: ["/api/inter-consultations"],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      targetDoctorId: string;
      patientId?: string;
      specialty?: string;
      clinicalCase: string;
      urgency: string;
    }) => {
      const res = await apiRequest("POST", "/api/inter-consultations", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Interconsulta Solicitada",
        description: "Sua solicitação foi enviada com sucesso. O médico será notificado.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inter-consultations"] });
      setStep("success");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao solicitar interconsulta",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedDoctor || !clinicalCase.trim()) return;
    createMutation.mutate({
      targetDoctorId: selectedDoctor.id,
      patientId: selectedPatientId || undefined,
      specialty: selectedSpecialty || undefined,
      clinicalCase: clinicalCase.trim(),
      urgency,
    });
  };

  const resetForm = () => {
    setStep("select-specialty");
    setSelectedSpecialty(null);
    setSelectedDoctor(null);
    setClinicalCase("");
    setUrgency("standard");
    setSelectedPatientId("");
    setSearchFilter("");
  };

  const filteredGroups = specialtyGroups?.filter((g) => {
    if (!searchFilter) return true;
    const lower = searchFilter.toLowerCase();
    return (
      g.specialty.toLowerCase().includes(lower) ||
      g.doctors.some((d) => d.name.toLowerCase().includes(lower))
    );
  })?.map(g => ({
    ...g,
    doctors: g.doctors.filter(d => d.id !== user?.id),
  })).filter(g => g.doctors.length > 0);

  const urgencyConfig: Record<string, { label: string; color: string; bg: string }> = {
    emergency: { label: "Emergência", color: "text-red-700", bg: "bg-red-100 border-red-300" },
    urgent: { label: "Urgente", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
    standard: { label: "Padrão", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
    elective: { label: "Eletiva", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    accepted: { label: "Aceita", variant: "default" },
    rejected: { label: "Recusada", variant: "destructive" },
    completed: { label: "Concluída", variant: "outline" },
    cancelled: { label: "Cancelada", variant: "destructive" },
  };

  return (
    <PageWrapper>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(30, 75%, 55%) 0%, hsl(20, 60%, 58%) 100%)" }}>
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Interconsulta</h1>
            <p className="text-muted-foreground text-sm">Solicite parecer de outro especialista</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "new" ? "default" : "outline"}
            onClick={() => setActiveTab("new")}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Nova Solicitação
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            onClick={() => setActiveTab("history")}
            className="gap-2"
          >
            <Clock className="h-4 w-4" />
            Histórico
          </Button>
        </div>

        {activeTab === "new" && (
          <>
            {step === "select-specialty" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Selecione a Especialidade
                  </CardTitle>
                  <CardDescription>Escolha a especialidade do médico que deseja consultar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar especialidade ou médico..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {loadingDoctors ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredGroups?.map((group) => (
                        <button
                          key={group.specialty}
                          className="p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left"
                          onClick={() => {
                            setSelectedSpecialty(group.specialty);
                            setStep("select-doctor");
                          }}
                        >
                          <div className="font-medium">{group.specialty}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {group.doctors.length} médico{group.doctors.length !== 1 ? "s" : ""}
                          </div>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {group.doctors.filter(d => d.isOnline).length > 0 && (
                              <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                                {group.doctors.filter(d => d.isOnline).length} online
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                      {filteredGroups?.length === 0 && (
                        <div className="col-span-full text-center text-muted-foreground py-8">
                          Nenhuma especialidade encontrada
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {step === "select-doctor" && selectedSpecialty && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setStep("select-specialty"); setSelectedSpecialty(null); }}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {selectedSpecialty}
                      </CardTitle>
                      <CardDescription>Selecione o médico para a interconsulta</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {specialtyGroups
                      ?.find((g) => g.specialty === selectedSpecialty)
                      ?.doctors.filter((d) => d.id !== user?.id)
                      .map((doctor) => (
                        <button
                          key={doctor.id}
                          className="w-full p-4 border rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-4 text-left"
                          onClick={() => {
                            setSelectedDoctor(doctor);
                            setStep("form");
                          }}
                        >
                          <div data-no-translate className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                            {doctor.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div data-no-translate className="font-medium">{doctor.name}</div>
                            {doctor.medicalLicense && (
                              <div className="text-xs text-muted-foreground">CRM: {doctor.medicalLicense}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {doctor.isOnline ? (
                              <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Online</Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs">Offline</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "form" && selectedDoctor && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setStep("select-doctor"); setSelectedDoctor(null); }}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Solicitar Interconsulta
                      </CardTitle>
                      <CardDescription data-no-translate>
                        Para: Dr(a). {selectedDoctor.name} — {selectedSpecialty || selectedDoctor.specialization || "Clínico Geral"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label>Urgência</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emergency">🔴 Emergência</SelectItem>
                        <SelectItem value="urgent">🟠 Urgente</SelectItem>
                        <SelectItem value="standard">🔵 Padrão</SelectItem>
                        <SelectItem value="elective">🟢 Eletiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Paciente Referenciado (opcional)</Label>
                    <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecionar paciente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum paciente específico</SelectItem>
                        {myPatients?.map((p: any) => (
                          <SelectItem data-no-translate key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Descrição do Caso Clínico *</Label>
                    <Textarea
                      className="mt-1 min-h-[150px]"
                      placeholder="Descreva o caso clínico, hipóteses diagnósticas, exames realizados, motivo da interconsulta..."
                      value={clinicalCase}
                      onChange={(e) => setClinicalCase(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{clinicalCase.length}/2000 caracteres</p>
                  </div>

                  <div className={`p-3 rounded-lg border ${urgencyConfig[urgency]?.bg || ""}`}>
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-4 w-4 ${urgencyConfig[urgency]?.color || ""}`} />
                      <span className={`text-sm font-medium ${urgencyConfig[urgency]?.color || ""}`}>
                        Nível: {urgencyConfig[urgency]?.label || urgency}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!clinicalCase.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Solicitação
                  </Button>
                </CardContent>
              </Card>
            )}

            {step === "success" && (
              <Card>
                <CardContent className="flex flex-col items-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Solicitação Enviada!</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Sua solicitação de interconsulta foi enviada com sucesso.
                    O Dr(a). <span data-no-translate>{selectedDoctor?.name}</span> será notificado e poderá responder em breve.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={resetForm}>
                      Nova Solicitação
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("history")}>
                      Ver Histórico
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "history" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Interconsultas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : interConsultations && interConsultations.length > 0 ? (
                <div className="space-y-3">
                  {interConsultations.map((ic) => {
                    const isSent = ic.requestingDoctorId === user?.id;
                    const otherDoctor = isSent ? ic.targetDoctor : ic.requestingDoctor;
                    const status = statusConfig[ic.status] || { label: ic.status, variant: "secondary" as const };
                    const urg = urgencyConfig[ic.urgency];
                    return (
                      <div key={ic.id} className="p-4 border rounded-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={isSent ? "outline" : "default"}>
                                {isSent ? "Enviada" : "Recebida"}
                              </Badge>
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {urg && (
                                <span className={`text-xs font-medium ${urg.color}`}>{urg.label}</span>
                              )}
                            </div>
                            <div data-no-translate className="mt-2 font-medium">
                              {isSent ? "Para" : "De"}: Dr(a). {otherDoctor?.name || "—"}
                              {otherDoctor?.specialization && (
                                <span className="text-muted-foreground text-sm"> — {otherDoctor.specialization}</span>
                              )}
                            </div>
                            {ic.patient && (
                              <div data-no-translate className="text-sm text-muted-foreground mt-1">
                                Paciente: {ic.patient.name}
                              </div>
                            )}
                            <p className="text-sm mt-2 line-clamp-2">{ic.clinicalCase}</p>
                            {ic.responseNotes && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <span className="font-medium">Resposta:</span> {ic.responseNotes}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(ic.createdAt).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma interconsulta registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
