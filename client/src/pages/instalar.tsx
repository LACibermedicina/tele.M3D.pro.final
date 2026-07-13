import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Lock,
  Database,
  KeyRound,
  Wrench,
  Rocket,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types mirrored from the backend installer API
// ---------------------------------------------------------------------------

type ServiceStatus = "configured" | "not_configured" | "corrupted";

interface ServiceFieldInfo {
  key: string;
  label: string;
  configured: boolean;
  secret: boolean;
  optional?: boolean;
}

interface ServiceDiagnostic {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  message: string;
  core: boolean;
  fields: ServiceFieldInfo[];
}

interface InstallerStatusResponse {
  installed: boolean;
  adminExists: boolean;
  coreHealthy: boolean;
  allHealthy: boolean;
  actionsBlocked: boolean;
  services: ServiceDiagnostic[];
}

type RunPhase = "configuring" | "validating" | "done" | "error";

interface ServiceRunState {
  phase: RunPhase;
  status?: ServiceStatus;
  message?: string;
}

interface StepRunState {
  phase: "running" | "done" | "error";
  message?: string;
  substeps: { name: string; ok: boolean; message?: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<ServiceStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  configured: { label: "Configurado", className: "bg-green-600 hover:bg-green-600 text-white", icon: CheckCircle2 },
  not_configured: { label: "Não configurado", className: "bg-slate-500 hover:bg-slate-500 text-white", icon: XCircle },
  corrupted: { label: "Corrompido", className: "bg-red-600 hover:bg-red-600 text-white", icon: AlertTriangle },
};

const STEP_LABELS: Record<string, string> = {
  parametros: "Aplicação de parâmetros",
  schema: "Esquema do banco de dados",
  inicializacao: "Inicialização das configurações padrão",
  admin: "Conta de administrador",
  validacao: "Revalidação dos serviços",
};

function statusBadge(status: ServiceStatus) {
  const cfg = STATUS_BADGE[status];
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.className} data-testid={`badge-status`}>
      <Icon className="w-3.5 h-3.5 mr-1" />
      {cfg.label}
    </Badge>
  );
}

function runBadge(run: ServiceRunState | undefined) {
  if (!run) return null;
  if (run.phase === "configuring") {
    return (
      <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Instalando…
      </Badge>
    );
  }
  if (run.phase === "validating") {
    return (
      <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">
        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Verificando…
      </Badge>
    );
  }
  if (run.phase === "done") {
    return (
      <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluído
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-600 text-red-700 dark:text-red-400">
      <XCircle className="w-3.5 h-3.5 mr-1" /> Erro
    </Badge>
  );
}

async function fetchInstallerStatus(): Promise<InstallerStatusResponse & { requiresAdmin?: boolean }> {
  const res = await fetch("/api/installer/status", { credentials: "include" });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    return {
      installed: true,
      adminExists: true,
      coreHealthy: true,
      allHealthy: true,
      actionsBlocked: true,
      services: [],
      requiresAdmin: true,
      ...body,
    };
  }
  if (!res.ok) {
    throw new Error(`Falha ao consultar o diagnóstico (HTTP ${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InstalarPage() {
  const { toast } = useToast();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [adminForm, setAdminForm] = useState({ username: "", password: "", name: "", email: "" });
  const [running, setRunning] = useState<null | "configure" | "install">(null);
  const [serviceRuns, setServiceRuns] = useState<Record<string, ServiceRunState>>({});
  const [stepRuns, setStepRuns] = useState<Record<string, StepRunState>>({});
  const [finishMessage, setFinishMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["/api/installer/status"],
    queryFn: fetchInstallerStatus,
    refetchOnWindowFocus: false,
  });

  const data = statusQuery.data;
  const requiresAdmin = (data as any)?.requiresAdmin === true;

  const setValue = (key: string, value: string) =>
    setFormValues((prev) => ({ ...prev, [key]: value }));

  const collectValues = () => {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (v.trim()) values[k] = v.trim();
    }
    return values;
  };

  const processStream = useCallback(async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Fluxo de progresso indisponível.");
    const decoder = new TextDecoder();
    let buffer = "";
    const result: {
      finished: { installed?: boolean; error?: string } | null;
      stepErrors: string[];
    } = { finished: null, stepErrors: [] };

    const handleEvent = (event: any) => {
      if (event.type === "service") {
        setServiceRuns((prev) => ({
          ...prev,
          [event.service]: { phase: event.phase, status: event.status, message: event.message },
        }));
      } else if (event.type === "step") {
        if (event.phase === "error") {
          result.stepErrors.push(event.message || STEP_LABELS[event.step] || event.step);
        }
        setStepRuns((prev) => ({
          ...prev,
          [event.step]: {
            phase: event.phase,
            message: event.message,
            substeps: prev[event.step]?.substeps ?? [],
          },
        }));
      } else if (event.type === "substep") {
        setStepRuns((prev) => {
          const existing = prev[event.step] ?? { phase: "running" as const, substeps: [] };
          return {
            ...prev,
            [event.step]: {
              ...existing,
              substeps: [...existing.substeps, { name: event.name, ok: event.ok, message: event.message }],
            },
          };
        });
      } else if (event.type === "finish") {
        result.finished = { installed: event.installed, error: event.error };
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          handleEvent(JSON.parse(line));
        } catch {
          /* ignore malformed line */
        }
      }
    }
    if (buffer.trim()) {
      try {
        handleEvent(JSON.parse(buffer));
      } catch {
        /* ignore */
      }
    }
    return result;
  }, []);

  const runAction = useCallback(
    async (action: "configure" | "install") => {
      setRunning(action);
      setServiceRuns({});
      setStepRuns({});
      setFinishMessage(null);
      try {
        const payload: any = { values: collectValues() };
        if (action === "install" && adminForm.username.trim()) {
          payload.admin = {
            username: adminForm.username.trim(),
            password: adminForm.password,
            name: adminForm.name.trim(),
            email: adminForm.email.trim(),
          };
        }
        const res = await fetch(`/api/installer/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok && contentType.includes("application/json")) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Falha na operação (HTTP ${res.status}).`);
        }
        if (!res.ok) {
          throw new Error(`Falha na operação (HTTP ${res.status}).`);
        }
        const { finished, stepErrors } = await processStream(res);
        // Any errored step means the run failed, regardless of finish.installed.
        const failure = finished?.error || (stepErrors.length > 0 ? `Etapas com erro: ${stepErrors.join("; ")}` : null);
        if (failure) {
          setFinishMessage(failure);
          toast({
            title: action === "install" ? "Instalação falhou" : "Configuração falhou",
            description: failure,
            variant: "destructive",
          });
        } else {
          const msg =
            action === "install"
              ? finished?.installed
                ? "Instalação concluída — o sistema está pronto para uso."
                : "Instalação executada. Verifique o diagnóstico dos serviços abaixo."
              : "Configuração aplicada e serviços revalidados.";
          setFinishMessage(msg);
          toast({ title: "Operação concluída", description: msg });
        }
        setFormValues({});
        setAdminForm({ username: "", password: "", name: "", email: "" });
      } catch (error: any) {
        const msg = error?.message || "Erro inesperado.";
        setFinishMessage(msg);
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        setRunning(null);
        queryClient.invalidateQueries({ queryKey: ["/api/installer/status"] });
      }
    },
    [adminForm, formValues, processStream, toast],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (statusQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950" data-no-translate>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Executando diagnóstico dos serviços…</span>
        </div>
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" data-no-translate>
        <Alert variant="destructive" className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro no diagnóstico</AlertTitle>
          <AlertDescription>
            {(statusQuery.error as Error)?.message || "Não foi possível consultar o estado do sistema."}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()} data-testid="button-retry">
                <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (requiresAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4" data-no-translate>
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Lock className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </div>
            <CardTitle>Sistema já instalado</CardTitle>
            <CardDescription>
              O diagnóstico e as ações de instalação agora exigem login de administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/login">
              <Button data-testid="button-goto-login">
                <ShieldCheck className="w-4 h-4 mr-2" /> Fazer login como administrador
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const actionsBlocked = data.actionsBlocked;
  const needsAdminAccount = !data.adminExists;
  const unhealthy = data.services.filter((s) => s.status !== "configured");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4" data-no-translate>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-title">
            Instalação e diagnóstico do sistema
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto">
            Verifique o estado de cada serviço, informe os parâmetros que faltam e execute a
            configuração ou a instalação completa. Valores de segredos nunca são exibidos.
          </p>
        </div>

        {/* Global state banner */}
        {actionsBlocked ? (
          <Alert className="border-green-600/40 bg-green-50 dark:bg-green-950/30" data-testid="alert-installed">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-300">Sistema já instalado</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400">
              Todos os serviços estão configurados e saudáveis. As ações de instalação e
              configuração estão bloqueadas.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert data-testid="alert-pending">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {data.installed ? "Serviços com pendências" : "Sistema não instalado completamente"}
            </AlertTitle>
            <AlertDescription>
              {unhealthy.length > 0
                ? `${unhealthy.length} serviço(s) precisam de atenção: ${unhealthy.map((s) => s.name).join(", ")}.`
                : "Verifique os serviços abaixo."}
            </AlertDescription>
          </Alert>
        )}

        {/* Service cards */}
        <div className="space-y-4">
          {data.services.map((svc) => {
            const run = serviceRuns[svc.id];
            const showForm = !actionsBlocked && svc.status !== "configured";
            return (
              <Card key={svc.id} data-testid={`card-service-${svc.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      {svc.id === "database" ? (
                        <Database className="w-5 h-5 text-slate-500" />
                      ) : svc.id === "session" ? (
                        <KeyRound className="w-5 h-5 text-slate-500" />
                      ) : (
                        <Wrench className="w-5 h-5 text-slate-500" />
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {svc.name}
                          {svc.core && (
                            <Badge variant="secondary" className="ml-2 text-[10px] uppercase">essencial</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{svc.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {runBadge(run)}
                      {statusBadge((run?.status as ServiceStatus) || svc.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p
                    className={`text-xs ${
                      (run?.status || svc.status) === "corrupted"
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                    data-testid={`text-message-${svc.id}`}
                  >
                    {run?.message && run.phase !== "validating" && run.phase !== "configuring"
                      ? run.message
                      : svc.message}
                  </p>

                  {showForm && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {svc.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={`input-${field.key}`} className="text-xs">
                            {field.label}
                            {field.configured && (
                              <span className="ml-1 text-green-600 dark:text-green-400">(já definido)</span>
                            )}
                            {field.optional && <span className="ml-1 text-slate-400">(opcional)</span>}
                          </Label>
                          <Input
                            id={`input-${field.key}`}
                            data-testid={`input-${field.key}`}
                            type={field.secret ? "password" : "text"}
                            autoComplete="off"
                            placeholder={field.configured ? "•••••• (manter valor atual)" : "Informe o valor"}
                            value={formValues[field.key] ?? ""}
                            onChange={(e) => setValue(field.key, e.target.value)}
                            disabled={running !== null}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin account (install) */}
        {!actionsBlocked && (
          <Card data-testid="card-admin">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-500" />
                <div>
                  <CardTitle className="text-base">Administrador inicial</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {needsAdminAccount
                      ? "Nenhum administrador encontrado — obrigatório para a instalação completa."
                      : "Já existe um administrador. Preencha apenas se quiser criar outro durante a instalação."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="admin-username" className="text-xs">Usuário (mín. 3 caracteres)</Label>
                <Input
                  id="admin-username"
                  data-testid="input-admin-username"
                  autoComplete="off"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm((p) => ({ ...p, username: e.target.value }))}
                  disabled={running !== null}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-password" className="text-xs">Senha (mín. 8 caracteres)</Label>
                <Input
                  id="admin-password"
                  data-testid="input-admin-password"
                  type="password"
                  autoComplete="new-password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
                  disabled={running !== null}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-name" className="text-xs">Nome completo</Label>
                <Input
                  id="admin-name"
                  data-testid="input-admin-name"
                  autoComplete="off"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))}
                  disabled={running !== null}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="admin-email" className="text-xs">E-mail (opcional)</Label>
                <Input
                  id="admin-email"
                  data-testid="input-admin-email"
                  type="email"
                  autoComplete="off"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))}
                  disabled={running !== null}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Install steps progress */}
        {Object.keys(stepRuns).length > 0 && (
          <Card data-testid="card-progress">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Progresso da instalação</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {Object.entries(stepRuns).map(([step, run]) => (
                <div key={step} className="text-sm">
                  <div className="flex items-center gap-2">
                    {run.phase === "running" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : run.phase === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-medium">{STEP_LABELS[step] || step}</span>
                    {run.message && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">— {run.message}</span>
                    )}
                  </div>
                  {run.substeps.length > 0 && (
                    <ul className="ml-6 mt-1 space-y-0.5">
                      {run.substeps.map((sub, i) => (
                        <li key={i} className="text-xs flex items-center gap-1.5">
                          {sub.ok ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600" />
                          )}
                          <span className="text-slate-600 dark:text-slate-400">
                            {sub.name}
                            {sub.message ? ` — ${sub.message}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {finishMessage && (
          <Alert data-testid="alert-finish">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{finishMessage}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => statusQuery.refetch()}
            disabled={running !== null || statusQuery.isFetching}
            data-testid="button-refresh"
          >
            {statusQuery.isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Reexecutar diagnóstico
          </Button>
          <Button
            onClick={() => runAction("configure")}
            disabled={actionsBlocked || running !== null}
            data-testid="button-configure"
          >
            {running === "configure" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wrench className="w-4 h-4 mr-2" />
            )}
            Configurar
          </Button>
          <Button
            onClick={() => runAction("install")}
            disabled={actionsBlocked || running !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-install"
          >
            {running === "install" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            Instalar
          </Button>
        </div>
      </div>
    </div>
  );
}
