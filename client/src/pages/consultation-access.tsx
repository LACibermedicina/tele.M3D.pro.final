import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  KeyRound,
  Video,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Stethoscope,
} from "lucide-react";

export default function ConsultationAccess() {
  const [, params] = useRoute("/acesso/:code");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState(params?.code || "");
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");
  const [accessData, setAccessData] = useState<any>(null);

  useEffect(() => {
    if (params?.code) {
      setCode(params.code);
      handleValidate(params.code);
    }
  }, [params?.code]);

  async function handleValidate(accessCode?: string) {
    const codeToValidate = accessCode || code;
    if (!codeToValidate.trim()) {
      setError("Digite o código de acesso");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/consultation-access/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToValidate.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Código inválido");
        setLoading(false);
        return;
      }

      if (data.authToken) {
        document.cookie = `authToken=${data.authToken}; path=/; max-age=21600; SameSite=Lax`;
      }

      setAccessData(data);
      setValidated(true);
      setLoading(false);

      toast({
        title: "Acesso validado!",
        description: `Bem-vindo(a), ${data.patientName}. Você será redirecionado(a) para a consulta.`,
      });
    } catch (err) {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  function handleEnterConsultation() {
    if (accessData?.consultationId) {
      navigate(`/video-consultation/${accessData.consultationId}`);
    } else {
      navigate("/immediate-consultation");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-2">
            <Stethoscope className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Tele&lt;M3D&gt; Pro</h1>
          <p className="text-sm text-muted-foreground">Acesso Direto à Consulta</p>
        </div>

        {!validated ? (
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <CardTitle className="flex items-center justify-center gap-2 text-lg">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                Código de Acesso
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Digite o código enviado pelo seu médico
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="Ex: A3BK7P"
                  className="text-center text-2xl font-mono tracking-[0.3em] h-14 uppercase"
                  maxLength={12}
                  onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button
                onClick={() => handleValidate()}
                disabled={loading || !code.trim()}
                className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Shield className="h-5 w-5 mr-2" />
                )}
                Validar Acesso
              </Button>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Protegido por autenticação dinâmica. Código de uso único.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-0 border-t-4 border-t-green-500">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-lg">Acesso Autorizado</CardTitle>
              <p className="text-sm text-muted-foreground">
                Bem-vindo(a), {accessData?.patientName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Médico</span>
                  <span data-no-translate className="font-medium">{accessData?.doctorName}</span>
                </div>
                {accessData?.scheduledAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Agendamento</span>
                    <span className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(accessData.scheduledAt).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="h-3 w-3" />
                    Autenticado
                  </span>
                </div>
              </div>

              <Button
                onClick={handleEnterConsultation}
                className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Video className="h-5 w-5 mr-2" />
                Entrar na Consulta
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao entrar, seu médico será notificado automaticamente.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Plataforma de telemedicina certificada. Seus dados estão protegidos.
        </p>
      </div>
    </div>
  );
}
