import type { Express, Request, Response } from "express";
import { execFile } from "child_process";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db, pool, reinitializeDatabase, isDatabaseUrlConfigured } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  INSTALLER_MANAGED_KEYS,
  type InstallerManagedKey,
  persistInstallerSecrets,
} from "./installerEnv";
import { resetGeminiClients } from "./services/gemini";
import { resetOpenAIClient } from "./services/openai";
import { whatsAppService } from "./services/whatsapp";
import { generateAgoraToken } from "./agora";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceStatus = "configured" | "not_configured" | "corrupted";

export interface ServiceFieldInfo {
  key: InstallerManagedKey;
  label: string;
  configured: boolean;
  secret: boolean;
  optional?: boolean;
}

export interface ServiceDiagnostic {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  message: string;
  core: boolean;
  fields: ServiceFieldInfo[];
}

export interface InstallerDeps {
  runBootRoutines: (report: (step: string, ok: boolean, message?: string) => void) => Promise<void>;
}

const FETCH_TIMEOUT_MS = 8000;

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

function has(key: string): boolean {
  return !!process.env[key];
}

// ---------------------------------------------------------------------------
// Per-service diagnostics (real connection tests, never expose values)
// ---------------------------------------------------------------------------

async function checkDatabase(): Promise<{ status: ServiceStatus; message: string }> {
  if (!isDatabaseUrlConfigured()) {
    return { status: "not_configured", message: "DATABASE_URL não definida." };
  }
  try {
    await pool.query("SELECT 1");
    return { status: "configured", message: "Conexão com o PostgreSQL OK." };
  } catch (error: any) {
    return {
      status: "corrupted",
      message: `Falha ao conectar ao banco: ${error?.message || "erro desconhecido"}`,
    };
  }
}

async function checkSessionSecret(): Promise<{ status: ServiceStatus; message: string }> {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) {
    return { status: "not_configured", message: "SESSION_SECRET não definido — logins não funcionarão." };
  }
  if (secret.length < 16) {
    return { status: "corrupted", message: "SESSION_SECRET muito curto (mínimo recomendado: 32 caracteres)." };
  }
  return { status: "configured", message: "Segredo de sessão presente." };
}

async function checkGemini(): Promise<{ status: ServiceStatus; message: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { status: "not_configured", message: "GEMINI_API_KEY não definida." };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
      { signal: timeoutSignal() },
    );
    if (res.ok) {
      return { status: "configured", message: "Chave Gemini validada com sucesso." };
    }
    return { status: "corrupted", message: `Chave Gemini rejeitada pela API (HTTP ${res.status}).` };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar chave Gemini: ${error?.message || "erro de rede"}` };
  }
}

async function checkOpenAI(): Promise<{ status: ServiceStatus; message: string }> {
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const directKey = process.env.OPENAI_API_KEY;
  if (!integrationKey && !directKey) {
    return { status: "not_configured", message: "Nenhuma chave OpenAI definida (OPENAI_API_KEY ou integração Replit)." };
  }
  // Prefer validating the direct key; the Replit integration proxy does not
  // expose GET /models, so for it only auth failures (401/403) count as broken.
  if (directKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${directKey}` },
        signal: timeoutSignal(),
      });
      if (res.ok) {
        return { status: "configured", message: "Chave OpenAI validada com sucesso." };
      }
      return { status: "corrupted", message: `Chave OpenAI rejeitada pela API (HTTP ${res.status}).` };
    } catch (error: any) {
      return { status: "corrupted", message: `Falha ao validar chave OpenAI: ${error?.message || "erro de rede"}` };
    }
  }
  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${integrationKey}` },
      signal: timeoutSignal(),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: "corrupted", message: `Integração OpenAI da Replit rejeitou a autenticação (HTTP ${res.status}).` };
    }
    return { status: "configured", message: "OpenAI disponível via integração Replit." };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar integração OpenAI: ${error?.message || "erro de rede"}` };
  }
}

async function checkAgora(): Promise<{ status: ServiceStatus; message: string }> {
  if (!has("AGORA_APP_ID") || !has("AGORA_APP_CERTIFICATE")) {
    return { status: "not_configured", message: "AGORA_APP_ID e/ou AGORA_APP_CERTIFICATE não definidos." };
  }
  try {
    const token = generateAgoraToken({ channelName: "installer-selftest", uid: 1, role: "subscriber", expirationTimeInSeconds: 60 });
    if (token && token.length > 0) {
      return { status: "configured", message: "Credenciais Agora geram tokens RTC válidos." };
    }
    return { status: "corrupted", message: "Geração de token Agora retornou vazio." };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao gerar token Agora: ${error?.message || "erro desconhecido"}` };
  }
}

async function checkStripe(): Promise<{ status: ServiceStatus; message: string }> {
  // Prefer the Replit Stripe connector (used by the app), fall back to env key.
  let secretKey: string | null = null;
  let source = "";
  try {
    const { getStripeSecretKey } = await import("./stripeClient");
    secretKey = await getStripeSecretKey();
    source = "integração Replit";
  } catch {
    secretKey = process.env.STRIPE_SECRET_KEY || null;
    source = "variável STRIPE_SECRET_KEY";
  }
  if (!secretKey) {
    return { status: "not_configured", message: "Stripe não conectado (integração Replit ausente e STRIPE_SECRET_KEY não definida)." };
  }
  try {
    const res = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: timeoutSignal(),
    });
    if (res.ok) {
      return { status: "configured", message: `Stripe validado via ${source}.` };
    }
    return { status: "corrupted", message: `Chave Stripe rejeitada (HTTP ${res.status}) — fonte: ${source}.` };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar Stripe: ${error?.message || "erro de rede"}` };
  }
}

async function checkPayPal(): Promise<{ status: ServiceStatus; message: string }> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { status: "not_configured", message: "PAYPAL_CLIENT_ID e/ou PAYPAL_CLIENT_SECRET não definidos." };
  }
  const isProduction = process.env.PAYPAL_MODE === "production" || process.env.NODE_ENV === "production";
  const base = isProduction ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: timeoutSignal(),
    });
    if (res.ok) {
      return { status: "configured", message: `Credenciais PayPal válidas (${isProduction ? "produção" : "sandbox"}).` };
    }
    return { status: "corrupted", message: `PayPal rejeitou as credenciais (HTTP ${res.status}, ${isProduction ? "produção" : "sandbox"}).` };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar PayPal: ${error?.message || "erro de rede"}` };
  }
}

async function checkPagBank(): Promise<{ status: ServiceStatus; message: string }> {
  const token = process.env.PAGBANK_TOKEN;
  if (!token) {
    return { status: "not_configured", message: "PAGBANK_TOKEN não definido." };
  }
  const base = process.env.PAGBANK_SANDBOX === "true"
    ? "https://sandbox.api.pagseguro.com"
    : "https://api.pagseguro.com";
  try {
    const res = await fetch(`${base}/public-keys/card`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: timeoutSignal(),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: "corrupted", message: `Token PagBank rejeitado (HTTP ${res.status}).` };
    }
    // 200 (key exists) and 404 (no public key yet) both indicate a valid token.
    return { status: "configured", message: "Token PagBank aceito pela API." };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar PagBank: ${error?.message || "erro de rede"}` };
  }
}

async function checkWhatsApp(): Promise<{ status: ServiceStatus; message: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { status: "not_configured", message: "WHATSAPP_ACCESS_TOKEN e/ou WHATSAPP_PHONE_NUMBER_ID não definidos." };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${encodeURIComponent(phoneId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: timeoutSignal(),
    });
    if (res.ok) {
      return { status: "configured", message: "Credenciais WhatsApp validadas na Graph API." };
    }
    return { status: "corrupted", message: `Graph API rejeitou as credenciais WhatsApp (HTTP ${res.status}).` };
  } catch (error: any) {
    return { status: "corrupted", message: `Falha ao validar WhatsApp: ${error?.message || "erro de rede"}` };
  }
}

// ---------------------------------------------------------------------------
// Service registry
// ---------------------------------------------------------------------------

interface ServiceDef {
  id: string;
  name: string;
  description: string;
  core: boolean;
  fields: Omit<ServiceFieldInfo, "configured">[];
  check: () => Promise<{ status: ServiceStatus; message: string }>;
  onApplied?: () => void;
}

const SERVICES: ServiceDef[] = [
  {
    id: "database",
    name: "Banco de dados (PostgreSQL)",
    description: "Armazenamento principal de dados clínicos e administrativos.",
    core: true,
    fields: [{ key: "DATABASE_URL", label: "DATABASE_URL (postgresql://...)", secret: true }],
    check: checkDatabase,
    onApplied: () => reinitializeDatabase(),
  },
  {
    id: "session",
    name: "Segredo de sessão",
    description: "Chave usada para assinar os tokens de login (JWT).",
    core: true,
    fields: [{ key: "SESSION_SECRET", label: "SESSION_SECRET (mín. 32 caracteres)", secret: true }],
    check: checkSessionSecret,
  },
  {
    id: "gemini",
    name: "IA Google Gemini",
    description: "IA principal para triagem, chatbot e relatórios clínicos.",
    core: false,
    fields: [{ key: "GEMINI_API_KEY", label: "GEMINI_API_KEY", secret: true }],
    check: checkGemini,
    onApplied: () => resetGeminiClients(),
  },
  {
    id: "openai",
    name: "IA OpenAI",
    description: "IA de retaguarda e análises de ECG/radiologia.",
    core: false,
    fields: [{ key: "OPENAI_API_KEY", label: "OPENAI_API_KEY", secret: true }],
    check: checkOpenAI,
    onApplied: () => {
      resetOpenAIClient();
      resetGeminiClients();
    },
  },
  {
    id: "agora",
    name: "Vídeo Agora",
    description: "Videoconsultas em tempo real (RTC).",
    core: false,
    fields: [
      { key: "AGORA_APP_ID", label: "AGORA_APP_ID", secret: false },
      { key: "AGORA_APP_CERTIFICATE", label: "AGORA_APP_CERTIFICATE", secret: true },
    ],
    check: checkAgora,
  },
  {
    id: "stripe",
    name: "Pagamentos Stripe",
    description: "Preferencialmente conectado via integração Replit; chave manual é usada como reserva.",
    core: false,
    fields: [{ key: "STRIPE_SECRET_KEY", label: "STRIPE_SECRET_KEY (opcional se a integração Replit estiver ativa)", secret: true, optional: true }],
    check: checkStripe,
  },
  {
    id: "paypal",
    name: "Pagamentos PayPal",
    description: "Checkout e compra de créditos via PayPal.",
    core: false,
    fields: [
      { key: "PAYPAL_CLIENT_ID", label: "PAYPAL_CLIENT_ID", secret: false },
      { key: "PAYPAL_CLIENT_SECRET", label: "PAYPAL_CLIENT_SECRET", secret: true },
      { key: "PAYPAL_MODE", label: "PAYPAL_MODE (sandbox | production)", secret: false, optional: true },
    ],
    check: checkPayPal,
  },
  {
    id: "pagbank",
    name: "Pagamentos PagBank",
    description: "Pagamentos nacionais via PagBank/PagSeguro.",
    core: false,
    fields: [
      { key: "PAGBANK_TOKEN", label: "PAGBANK_TOKEN", secret: true },
      { key: "PAGBANK_EMAIL", label: "PAGBANK_EMAIL", secret: false, optional: true },
      { key: "PAGBANK_SANDBOX", label: "PAGBANK_SANDBOX (true | false)", secret: false, optional: true },
    ],
    check: checkPagBank,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Notificações e mensageria inteligente via WhatsApp.",
    core: false,
    fields: [
      { key: "WHATSAPP_ACCESS_TOKEN", label: "WHATSAPP_ACCESS_TOKEN", secret: true },
      { key: "WHATSAPP_PHONE_NUMBER_ID", label: "WHATSAPP_PHONE_NUMBER_ID", secret: false },
      { key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", label: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", secret: true, optional: true },
    ],
    check: checkWhatsApp,
    onApplied: () => whatsAppService.reloadFromEnv(),
  },
];

const FIELD_TO_SERVICE = new Map<InstallerManagedKey, ServiceDef>();
for (const svc of SERVICES) {
  for (const f of svc.fields) FIELD_TO_SERVICE.set(f.key, svc);
}

// ---------------------------------------------------------------------------
// System-installed detection
// ---------------------------------------------------------------------------

async function adminExists(): Promise<boolean> {
  try {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function isSystemInstalled(): Promise<{ installed: boolean; adminExists: boolean; coreHealthy: boolean }> {
  const [dbCheck, sessionCheck] = await Promise.all([checkDatabase(), checkSessionSecret()]);
  const coreHealthy = dbCheck.status === "configured" && sessionCheck.status === "configured";
  const hasAdmin = coreHealthy ? await adminExists() : false;
  return { installed: coreHealthy && hasAdmin, adminExists: hasAdmin, coreHealthy };
}

async function runFullDiagnostics(): Promise<ServiceDiagnostic[]> {
  const results = await Promise.all(
    SERVICES.map(async (svc) => {
      const { status, message } = await svc.check();
      return {
        id: svc.id,
        name: svc.name,
        description: svc.description,
        status,
        message,
        core: svc.core,
        fields: svc.fields.map((f) => ({ ...f, configured: has(f.key) })),
      } satisfies ServiceDiagnostic;
    }),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Applying configuration values
// ---------------------------------------------------------------------------

const valuesSchema = z.record(z.string(), z.string().max(4096));

function sanitizeValues(raw: unknown): Partial<Record<InstallerManagedKey, string>> {
  const parsed = valuesSchema.parse(raw ?? {});
  const out: Partial<Record<InstallerManagedKey, string>> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!(INSTALLER_MANAGED_KEYS as readonly string[]).includes(key)) continue;
    out[key as InstallerManagedKey] = trimmed;
  }
  return out;
}

function applyValuesToEnv(values: Partial<Record<InstallerManagedKey, string>>): ServiceDef[] {
  const touched = new Set<ServiceDef>();
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
    const svc = FIELD_TO_SERVICE.get(key as InstallerManagedKey);
    if (svc) touched.add(svc);
  }
  persistInstallerSecrets(values);
  const touchedList = Array.from(touched);
  for (const svc of touchedList) {
    try {
      svc.onApplied?.();
    } catch (error) {
      console.error(`Installer: failed to re-initialize service ${svc.id}:`, error);
    }
  }
  return touchedList;
}

// ---------------------------------------------------------------------------
// Schema push (drizzle-kit)
// ---------------------------------------------------------------------------

function runSchemaPush(): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    execFile(
      "npx",
      ["drizzle-kit", "push", "--force"],
      { cwd: process.cwd(), env: { ...process.env }, timeout: 180_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const tail = `${stdout || ""}\n${stderr || ""}`.trim().split("\n").slice(-5).join(" | ");
          resolve({ ok: false, message: `drizzle-kit push falhou: ${tail || error.message}` });
        } else {
          resolve({ ok: true, message: "Esquema do banco aplicado (drizzle-kit push)." });
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const adminAccountSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
});

function isAdmin(req: Request): boolean {
  return (req as any).user?.role === "admin";
}

type StreamWriter = (event: Record<string, unknown>) => void;

function startNdjsonStream(res: Response): StreamWriter {
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("X-Accel-Buffering", "no");
  (res as any).flushHeaders?.();
  return (event) => {
    res.write(JSON.stringify(event) + "\n");
    (res as any).flush?.();
  };
}

export function registerInstallerRoutes(app: Express, deps: InstallerDeps): void {
  // Minimal public state — reveals only whether setup/admin login is needed.
  app.get("/api/installer/state", async (_req: Request, res: Response) => {
    try {
      const state = await isSystemInstalled();
      res.json({ installed: state.installed });
    } catch {
      res.json({ installed: false });
    }
  });

  // Full diagnostics. Public only while the system is NOT installed;
  // afterwards it requires an authenticated admin (page handles login).
  app.get("/api/installer/status", async (req: Request, res: Response) => {
    try {
      const state = await isSystemInstalled();
      if (state.installed && !isAdmin(req)) {
        return res.status(403).json({
          message: "Sistema já instalado. Faça login como administrador para acessar o diagnóstico.",
          installed: true,
          requiresAdmin: true,
        });
      }
      const services = await runFullDiagnostics();
      const allHealthy = services.every((s) => s.status === "configured");
      res.json({
        installed: state.installed,
        adminExists: state.adminExists,
        coreHealthy: state.coreHealthy,
        allHealthy,
        actionsBlocked: state.installed && allHealthy,
        services,
      });
    } catch (error) {
      console.error("Installer status error:", error);
      res.status(500).json({ message: "Falha ao executar o diagnóstico." });
    }
  });

  // "Configurar": apply only the provided parameters and re-validate the
  // affected services. Streams NDJSON progress events.
  app.post("/api/installer/configure", async (req: Request, res: Response) => {
    try {
      const state = await isSystemInstalled();
      if (state.installed && !isAdmin(req)) {
        return res.status(403).json({ message: "Sistema já instalado. Login de administrador obrigatório." });
      }
      const preServices = await runFullDiagnostics();
      if (state.installed && preServices.every((s) => s.status === "configured")) {
        return res.status(409).json({ message: "Sistema já instalado e saudável — nenhuma configuração é necessária." });
      }

      let values: Partial<Record<InstallerManagedKey, string>>;
      try {
        values = sanitizeValues(req.body?.values);
      } catch {
        return res.status(400).json({ message: "Parâmetros inválidos." });
      }
      if (Object.keys(values).length === 0) {
        return res.status(400).json({ message: "Nenhum parâmetro informado." });
      }

      const write = startNdjsonStream(res);
      write({ type: "start", action: "configure" });

      const touched = applyValuesToEnv(values);
      for (const svc of touched) {
        write({ type: "service", service: svc.id, phase: "configuring", message: "Aplicando parâmetros..." });
        write({ type: "service", service: svc.id, phase: "validating", message: "Verificando..." });
        const { status, message } = await svc.check();
        write({
          type: "service",
          service: svc.id,
          phase: status === "configured" ? "done" : "error",
          status,
          message,
        });
      }

      const finalState = await isSystemInstalled();
      write({ type: "finish", installed: finalState.installed });
      res.end();
    } catch (error) {
      console.error("Installer configure error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Falha ao configurar os serviços." });
      } else {
        res.end();
      }
    }
  });

  // "Instalar": full sequence — apply params, push DB schema, run boot
  // initialization routines, create the initial admin, re-validate everything.
  app.post("/api/installer/install", async (req: Request, res: Response) => {
    try {
      const state = await isSystemInstalled();
      if (state.installed && !isAdmin(req)) {
        return res.status(403).json({ message: "Sistema já instalado. Login de administrador obrigatório." });
      }
      const preServices = await runFullDiagnostics();
      if (state.installed && preServices.every((s) => s.status === "configured")) {
        return res.status(409).json({ message: "Sistema já instalado e saudável — a instalação está bloqueada." });
      }

      let values: Partial<Record<InstallerManagedKey, string>>;
      try {
        values = sanitizeValues(req.body?.values);
      } catch {
        return res.status(400).json({ message: "Parâmetros inválidos." });
      }

      let adminAccount: z.infer<typeof adminAccountSchema> | null = null;
      if (req.body?.admin) {
        const parsed = adminAccountSchema.safeParse(req.body.admin);
        if (!parsed.success) {
          return res.status(400).json({ message: "Dados do administrador inválidos (usuário ≥ 3 caracteres, senha ≥ 8)." });
        }
        adminAccount = parsed.data;
      }
      if (!state.adminExists && !adminAccount) {
        return res.status(400).json({ message: "Informe as credenciais do administrador inicial para instalar." });
      }

      const write = startNdjsonStream(res);
      write({ type: "start", action: "install" });

      // Step 1: apply provided parameters
      if (Object.keys(values).length > 0) {
        write({ type: "step", step: "parametros", phase: "running", message: "Aplicando parâmetros informados..." });
        applyValuesToEnv(values);
        write({ type: "step", step: "parametros", phase: "done", message: "Parâmetros aplicados." });
      }

      // Step 2: database connectivity + schema
      write({ type: "step", step: "schema", phase: "running", message: "Verificando banco e aplicando esquema..." });
      const dbCheck = await checkDatabase();
      if (dbCheck.status !== "configured") {
        write({ type: "step", step: "schema", phase: "error", message: dbCheck.message });
        write({ type: "finish", installed: false, error: "Banco de dados indisponível — instalação interrompida." });
        return res.end();
      }
      const push = await runSchemaPush();
      write({ type: "step", step: "schema", phase: push.ok ? "done" : "error", message: push.message });
      if (!push.ok) {
        write({ type: "finish", installed: false, error: "Falha ao aplicar o esquema do banco." });
        return res.end();
      }

      // Step 3: boot initialization routines (default settings, seed data, feature migrations)
      write({ type: "step", step: "inicializacao", phase: "running", message: "Inicializando configurações padrão do sistema..." });
      const initFailures: string[] = [];
      try {
        await deps.runBootRoutines((stepName, ok, message) => {
          if (!ok) initFailures.push(stepName);
          write({ type: "substep", step: "inicializacao", name: stepName, ok, message });
        });
      } catch (error: any) {
        initFailures.push(error?.message || "falha na inicialização");
      }
      if (initFailures.length > 0) {
        write({
          type: "step",
          step: "inicializacao",
          phase: "error",
          message: `Falha em: ${initFailures.join(", ")}.`,
        });
        write({ type: "finish", installed: false, error: "Falha na inicialização das configurações padrão — instalação interrompida." });
        return res.end();
      }
      write({ type: "step", step: "inicializacao", phase: "done", message: "Configurações padrão inicializadas." });

      // Step 4: initial admin account. Any failure here aborts the install
      // with an explicit error — never report success with a broken admin step.
      if (adminAccount) {
        write({ type: "step", step: "admin", phase: "running", message: "Criando conta de administrador..." });
        let adminError: string | null = null;
        try {
          const currentAdmins = await adminExists();
          if (currentAdmins && !isAdmin(req)) {
            adminError = "Já existe um administrador — criação bloqueada sem login de admin.";
          } else {
            const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.username, adminAccount.username)).limit(1);
            if (existingUser.length > 0) {
              adminError = "Nome de usuário já existe — escolha outro.";
            } else {
              const hashed = await bcrypt.hash(adminAccount.password, 12);
              await db.insert(users).values({
                username: adminAccount.username,
                password: hashed,
                role: "admin",
                name: adminAccount.name,
                email: adminAccount.email,
              });
              write({ type: "step", step: "admin", phase: "done", message: `Administrador "${adminAccount.username}" criado.` });
            }
          }
        } catch (error: any) {
          adminError = error?.message || "Falha ao criar administrador.";
        }
        if (adminError) {
          write({ type: "step", step: "admin", phase: "error", message: adminError });
          write({ type: "finish", installed: false, error: `Falha na criação do administrador: ${adminError}` });
          return res.end();
        }
      }

      // Step 5: final re-validation of every service
      write({ type: "step", step: "validacao", phase: "running", message: "Revalidando todos os serviços..." });
      for (const svc of SERVICES) {
        write({ type: "service", service: svc.id, phase: "validating", message: "Verificando..." });
        const { status, message } = await svc.check();
        write({
          type: "service",
          service: svc.id,
          phase: status === "configured" ? "done" : "error",
          status,
          message,
        });
      }
      write({ type: "step", step: "validacao", phase: "done", message: "Diagnóstico final concluído." });

      const finalState = await isSystemInstalled();
      write({ type: "finish", installed: finalState.installed });
      res.end();
    } catch (error) {
      console.error("Installer install error:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Falha ao executar a instalação." });
      } else {
        res.end();
      }
    }
  });
}
