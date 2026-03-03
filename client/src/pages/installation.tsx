import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  Terminal, Copy, Check, Server, Database, Key, Globe,
  Package, Settings, Shield, MonitorSmartphone, Rocket,
  FileCode, GitBranch, HardDrive, Cpu, AlertCircle,
  CreditCard, Pill, Video, Brain, Wallet, FileText,
  Mic, Languages, Star, Users, Activity, MessageCircle,
  Building2, Stethoscope, ClipboardList, Lock
} from "lucide-react";

function CodeBlock({ title, code, language = "bash" }: { title?: string; code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
      <pre className="p-4 bg-gray-950 text-gray-100 text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Installation() {
  return (
    <PageWrapper variant="origami">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                Guia de Instalação
              </h1>
              <p className="text-muted-foreground">
                Tele{"<"}M3D{">"} Pro v3.5 — Script de instalação e configuração completa
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" />
              Módulos Incluídos (v3.5 — Março 2026)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              {[
                { icon: <Video className="h-3.5 w-3.5" />, label: "Teleconsultas (Agora WebRTC)" },
                { icon: <Brain className="h-3.5 w-3.5" />, label: "IA Médica (Gemini + OpenAI)" },
                { icon: <Activity className="h-3.5 w-3.5" />, label: "Triagem IA (Manchester/ETAT)" },
                { icon: <Pill className="h-3.5 w-3.5" />, label: "Farmácia LGPD" },
                { icon: <FileText className="h-3.5 w-3.5" />, label: "PMD v1.0 (CFM/LGPD)" },
                { icon: <Shield className="h-3.5 w-3.5" />, label: "Assinatura Digital ICP-Brasil" },
                { icon: <Globe className="h-3.5 w-3.5" />, label: "FHIR R4 Export" },
                { icon: <CreditCard className="h-3.5 w-3.5" />, label: "Stripe Card/Link/Apple Pay" },
                { icon: <CreditCard className="h-3.5 w-3.5" />, label: "PayPal + PagBank PIX/Boleto" },
                { icon: <Wallet className="h-3.5 w-3.5" />, label: "Wallet TM3D / NFTs / Broker" },
                { icon: <Mic className="h-3.5 w-3.5" />, label: "IAM3D Voice (STT/TTS)" },
                { icon: <Star className="h-3.5 w-3.5" />, label: "Avaliação de Consultas" },
                { icon: <Users className="h-3.5 w-3.5" />, label: "Equipes Médicas" },
                { icon: <Stethoscope className="h-3.5 w-3.5" />, label: "Inter-Consultas" },
                { icon: <MessageCircle className="h-3.5 w-3.5" />, label: "WhatsApp IA" },
                { icon: <Languages className="h-3.5 w-3.5" />, label: "Multilíngue (8 idiomas)" },
                { icon: <ClipboardList className="h-3.5 w-3.5" />, label: "Pós-Consulta IA" },
                { icon: <Building2 className="h-3.5 w-3.5" />, label: "Gestão de Clínicas" },
                { icon: <Lock className="h-3.5 w-3.5" />, label: "Detecção de Inatividade" },
                { icon: <FileText className="h-3.5 w-3.5" />, label: "Relatórios Epidemiológicos" },
              ].map((mod, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-muted-foreground">
                  {mod.icon}
                  <span>{mod.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="replit" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="replit" className="flex items-center gap-1.5">
              <Rocket className="h-4 w-4" />
              Replit
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-1.5">
              <MonitorSmartphone className="h-4 w-4" />
              Local
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-1.5">
              <Globe className="h-4 w-4" />
              Produção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="replit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-blue-600" />
                  Instalação no Replit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  O Tele{"<"}M3D{">"} Pro v3.5 é otimizado para rodar no Replit. O schema é aplicado automaticamente com migrações internas. Inclui integração com Stripe (Replit Integration) e todos os módulos: farmácia, PMD, assinatura digital, equipes médicas, clínicas, broker NFT, wallet TM3D e suporte multilíngue.
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">1</Badge>
                      Criar Repl
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Importe o repositório ou crie um novo Repl com template Node.js. O projeto usa Express.js + React (Vite) + PostgreSQL com Drizzle ORM.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">2</Badge>
                      Banco de Dados PostgreSQL
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Adicione o módulo PostgreSQL no painel de ferramentas do Replit. A variável DATABASE_URL será configurada automaticamente. O schema completo (70+ tabelas) será criado automaticamente via migrações internas ao iniciar.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">3</Badge>
                      Stripe (Replit Integration)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Adicione a integração Stripe no painel do Replit. O sistema usa <code className="text-xs bg-muted px-1 py-0.5 rounded">stripe-replit-sync</code> para sincronizar chaves automaticamente. Suporta Card, Apple Pay, Google Pay e Stripe Link via PaymentElement com <code className="text-xs bg-muted px-1 py-0.5 rounded">automatic_payment_methods</code>.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">4</Badge>
                      Variáveis de Ambiente (Secrets)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Configure as seguintes variáveis no painel Secrets do Replit:
                    </p>
                    <CodeBlock title="Obrigatórias" code={`DATABASE_URL=postgresql://user:pass@host:5432/dbname
GEMINI_API_KEY=sua_chave_gemini_api
SESSION_SECRET=uma_chave_secreta_longa_e_aleatoria`} />
                    <CodeBlock title="Teleconsultas — Agora.io" code={`AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate`} />
                    <CodeBlock title="Pagamentos — PayPal" code={`PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret
PAYPAL_MODE=sandbox`} />
                    <CodeBlock title="Pagamentos — Stripe (via Replit Integration)" code={`# Stripe é configurado automaticamente via Replit Integration
# Suporta: Cartão, Apple Pay, Google Pay, Stripe Link
# O checkout usa PaymentElement com automatic_payment_methods
# Se preferir configuração manual:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...`} />
                    <CodeBlock title="Pagamentos — PagBank (PIX/Boleto)" code={`PAGBANK_TOKEN=seu_pagbank_token
PAGBANK_SANDBOX=true`} />
                    <CodeBlock title="WhatsApp IA (opcional)" code={`WHATSAPP_ACCESS_TOKEN=seu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_verify_token`} />
                    <CodeBlock title="IA Fallback e URL" code={`AI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
BASE_URL=https://seu-dominio.replit.app`} />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">5</Badge>
                      Instalar e Iniciar
                    </h3>
                    <CodeBlock title="Terminal" code={`npm install
npm run dev`} />
                    <p className="text-sm text-muted-foreground">
                      O servidor inicia na porta 5000. As migrações do banco (70+ tabelas) são aplicadas automaticamente. Os diretórios de upload são criados na inicialização. Usuários padrão (admin, doctor) são criados via seed.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">6</Badge>
                      Verificação
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Após iniciar, verifique os módulos acessando:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {[
                        { url: "/api/health", desc: "Health check do servidor" },
                        { url: "/api/system-settings", desc: "Configurações do sistema" },
                        { url: "/api/stripe/config", desc: "Status do Stripe" },
                        { url: "/login", desc: "Página de login" },
                      ].map((ep) => (
                        <div key={ep.url} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                          <code className="text-xs font-mono">{ep.url}</code>
                          <span className="text-xs text-muted-foreground">— {ep.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="local" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5 text-purple-600" />
                  Instalação Local
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-sm text-amber-800 dark:text-amber-200">Pré-requisitos</span>
                  </div>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>Node.js 20+ instalado</li>
                    <li>PostgreSQL 14+ rodando localmente ou remoto</li>
                    <li>Git instalado</li>
                    <li>npm 9+ (incluído com Node.js 20)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    Clonar e Instalar
                  </h3>
                  <CodeBlock title="Terminal" code={`git clone https://github.com/LACibermedicina/tele.M3D.pro.git
cd tele.M3D.pro

npm install`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Criar Banco de Dados
                  </h3>
                  <CodeBlock title="Terminal" code={`# Criar banco de dados PostgreSQL
sudo -u postgres createdb telemed3

# Ou com usuário e senha específicos:
sudo -u postgres psql -c "CREATE USER telemed WITH PASSWORD 'senha_forte';"
sudo -u postgres psql -c "CREATE DATABASE telemed3 OWNER telemed;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE telemed3 TO telemed;"`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Configurar Variáveis de Ambiente
                  </h3>
                  <CodeBlock title="Criar arquivo .env" code={`# ══════════════════════════════════════════════
# Tele<M3D> Pro v3.5 — Variáveis de Ambiente
# ══════════════════════════════════════════════

# ── Obrigatórias ──
DATABASE_URL=postgresql://telemed:senha_forte@localhost:5432/telemed3
GEMINI_API_KEY=sua_chave_gemini_api
SESSION_SECRET=uma_chave_secreta_longa_e_aleatoria

# ── Agora.io — Teleconsultas por vídeo (opcional) ──
AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate

# ── PayPal (opcional) ──
PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret
PAYPAL_MODE=sandbox

# ── Stripe — Card, Apple Pay, Google Pay, Link (opcional) ──
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── PagBank — PIX e Boleto (opcional) ──
PAGBANK_TOKEN=seu_pagbank_token
PAGBANK_SANDBOX=true

# ── OpenAI como fallback de IA (opcional) ──
AI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# ── WhatsApp IA (opcional) ──
WHATSAPP_ACCESS_TOKEN=seu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_verify_token

# ── URL pública do servidor ──
BASE_URL=http://localhost:5000`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    Iniciar o Servidor
                  </h3>
                  <CodeBlock title="Terminal" code={`# Iniciar em modo desenvolvimento (migrações automáticas)
npm run dev

# O servidor estará disponível em http://localhost:5000
# Login padrão: admin / admin123`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-green-600" />
                  Script de Instalação Automática (Local)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Use este script para verificar pré-requisitos e instalar automaticamente em Linux/macOS:
                </p>
                <CodeBlock title="install-local.sh" language="bash" code={`#!/bin/bash
set -e

echo "============================================"
echo "  Tele<M3D> Pro v3.5 - Instalação Local"
echo "============================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[ERRO] Node.js não encontrado. Instale o Node.js 20+."
    echo "  https://nodejs.org/en/download/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "[ERRO] Node.js 20+ é necessário. Versão atual: $(node -v)"
    exit 1
fi
echo "[OK] Node.js $(node -v) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "[ERRO] npm não encontrado."
    exit 1
fi
echo "[OK] npm $(npm -v) encontrado"

# Instalar dependências
echo ""
echo "[INFO] Instalando dependências..."
npm install

# Criar diretórios de upload
mkdir -p client/public/uploads/profiles
mkdir -p client/public/uploads/references
mkdir -p client/public/uploads/clinical-assets
echo "[OK] Diretórios de upload criados"

# Verificar variáveis de ambiente obrigatórias
echo ""
echo "── Verificando variáveis de ambiente ──"

if [ -z "$DATABASE_URL" ]; then
    echo "[AVISO] DATABASE_URL não configurada."
    echo "  Configure: export DATABASE_URL=postgresql://user:pass@host:5432/db"
else
    echo "[OK] DATABASE_URL configurada"
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "[AVISO] GEMINI_API_KEY não configurada."
    echo "  A IA médica não funcionará sem esta chave."
    echo "  Obtenha em: https://aistudio.google.com/apikey"
else
    echo "[OK] GEMINI_API_KEY configurada"
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "[AVISO] SESSION_SECRET não configurada."
    echo "  Gerando uma chave aleatória..."
    export SESSION_SECRET=$(openssl rand -hex 32)
    echo "  SESSION_SECRET=$SESSION_SECRET"
else
    echo "[OK] SESSION_SECRET configurada"
fi

# Verificar módulos opcionais
echo ""
echo "── Módulos opcionais ──"

declare -A OPTIONAL_VARS
OPTIONAL_VARS=(
    ["AGORA_APP_ID"]="Teleconsultas por vídeo"
    ["PAYPAL_CLIENT_ID"]="Pagamentos PayPal"
    ["STRIPE_SECRET_KEY"]="Pagamentos Stripe (Card/Link/Apple Pay)"
    ["PAGBANK_TOKEN"]="Pagamentos PagBank (PIX/Boleto)"
    ["WHATSAPP_ACCESS_TOKEN"]="WhatsApp IA"
    ["AI_INTEGRATIONS_OPENAI_API_KEY"]="OpenAI (fallback IA)"
)

for VAR in "\${!OPTIONAL_VARS[@]}"; do
    if [ -z "\${!VAR:-}" ]; then
        echo "[INFO] $VAR não configurada — \${OPTIONAL_VARS[$VAR]}"
    else
        echo "[OK] $VAR configurada — \${OPTIONAL_VARS[$VAR]}"
    fi
done

echo ""
echo "============================================"
echo "  Instalação local concluída!"
echo "============================================"
echo ""
echo "Para iniciar o servidor:"
echo "  npm run dev"
echo ""
echo "O servidor estará disponível em:"
echo "  http://localhost:5000"
echo ""
echo "Login padrão: admin / admin123"
echo ""
echo "Módulos (20+):"
echo "  - Teleconsultas (Agora WebRTC)"
echo "  - IA Médica (Gemini + OpenAI fallback)"
echo "  - Triagem IA (Manchester / WHO ETAT)"
echo "  - Farmácia (prescrições, dispensação, LGPD)"
echo "  - PMD v1.0 (Prontuário Digital CFM/LGPD/RGPD)"
echo "  - Assinatura Digital (ICP-Brasil A3 / RSA-SHA256)"
echo "  - FHIR R4 Export (BR, US, EU, Internacional)"
echo "  - Pagamentos (PayPal, Stripe Card/Link/Apple Pay, PagBank PIX/Boleto)"
echo "  - Wallet Digital (TM3D, NFTs, Broker)"
echo "  - IAM3D Voice Assistant (STT/TTS multilíngue)"
echo "  - Avaliação de Consultas (1-5 estrelas)"
echo "  - Equipes Médicas e Inter-Consultas"
echo "  - Gestão de Clínicas"
echo "  - WhatsApp IA"
echo "  - Pós-Consulta IA (prescrições, exames, referências)"
echo "  - Classificação Diagnóstica (CID-10/11, DSM-5/TR)"
echo "  - Relatórios Epidemiológicos"
echo "  - Detecção de Inatividade (auto-logout)"
echo "  - Multilíngue (PT, EN, ES, FR, DE, IT, ZH, GN)"
echo "============================================"`} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-600" />
                  Deploy em Produção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="h-4 w-4 text-green-600" />
                    <span className="font-bold text-green-800 dark:text-green-200">install.sh v4.0 — Instalador Automático (Recomendado)</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Copie e execute o comando abaixo no terminal do seu servidor Ubuntu/Debian como root. O script instala tudo automaticamente: Node.js 20, PostgreSQL 16, Nginx (reverse proxy + SSL via Certbot), PM2 (process manager), cria banco, compila o app e inicia o serviço.
                  </p>
                  <CodeBlock title="Executar no servidor (como root)" code={`curl -fsSL https://raw.githubusercontent.com/LACibermedicina/tele.M3D.pro/main/install.sh | sudo bash`} />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Inclui todos os módulos: farmácia, PMD, assinatura digital, pagamentos (PayPal/Stripe/PIX), triagem IA, IAM3D, equipes médicas, clínicas, avaliação de consultas, wallet/NFT/broker, pós-consulta IA e suporte multilíngue (8 idiomas).
                  </p>
                </div>

                <CodeBlock title="install.sh v4.0 — Script Completo" language="bash" code={`#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Tele<M3D> Pro v3.5 — install.sh v4.0
# Auto-deployment script for Ubuntu 22.04+ / Debian 12+
# ══════════════════════════════════════════════════════════════
set -euo pipefail
trap 'echo "[ERRO] Falha na linha $LINENO. Abortando."; exit 1' ERR

# ── Configuration ──
APP_NAME="telemed3"
APP_DIR="/opt/telemed3"
APP_USER="telemed"
DB_NAME="telemed3"
DB_USER="telemed"
DB_PASS=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)
NODE_VERSION="20"
REPO_URL="https://github.com/LACibermedicina/tele.M3D.pro.git"
BRANCH="main"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Tele<M3D> Pro v3.5 — Instalador Automático v4.0"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Servidor: $(hostname)"
echo "  OS:       $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "  Data:     $(date)"
echo ""

# ── 1. System Update ──
echo "[1/12] Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget gnupg2 lsb-release ca-certificates \\
  software-properties-common git build-essential

# ── 2. Install Node.js 20+ ──
echo "[2/12] Instalando Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt "$NODE_VERSION" ]; then
    curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
    apt-get install -y -qq nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm:     $(npm -v)"

# ── 3. Install PostgreSQL 16 ──
echo "[3/12] Instalando PostgreSQL 16..."
if ! command -v psql &>/dev/null; then
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    apt-get update -qq
    apt-get install -y -qq postgresql-16 postgresql-client-16
fi
systemctl enable postgresql
systemctl start postgresql
echo "  PostgreSQL: $(psql --version | head -1)"

# ── 4. Create Database and User ──
echo "[4/12] Configurando banco de dados..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \\
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \\
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo "  Banco: $DB_NAME (usuário: $DB_USER)"

# ── 5. Create App User ──
echo "[5/12] Criando usuário do sistema..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
fi

# ── 6. Clone Repository ──
echo "[6/12] Clonando repositório..."
if [ -d "$APP_DIR" ]; then
    echo "  Diretório existe. Fazendo pull..."
    cd "$APP_DIR"
    git pull origin $BRANCH
else
    git clone -b $BRANCH "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi
chown -R $APP_USER:$APP_USER "$APP_DIR"

# ── 7. Install Dependencies and Build ──
echo "[7/12] Instalando dependências e compilando..."
cd "$APP_DIR"
sudo -u $APP_USER npm ci --production=false
sudo -u $APP_USER npm run build

# ── 8. Create Upload Directories ──
echo "[8/12] Criando diretórios de upload..."
mkdir -p "$APP_DIR/client/public/uploads/profiles"
mkdir -p "$APP_DIR/client/public/uploads/references"
mkdir -p "$APP_DIR/client/public/uploads/clinical-assets"
chown -R $APP_USER:$APP_USER "$APP_DIR/client/public/uploads"
chmod -R 755 "$APP_DIR/client/public/uploads"

# ── 9. Generate .env File ──
echo "[9/12] Gerando arquivo .env..."
DOMAIN=\${DOMAIN:-$(hostname -f)}

cat > "$APP_DIR/.env" << ENVEOF
# ══════════════════════════════════════════════════════════════
# Tele<M3D> Pro v3.5 — Variáveis de Ambiente (Produção)
# Gerado automaticamente em $(date)
# ══════════════════════════════════════════════════════════════

# ── OBRIGATÓRIAS ──
DATABASE_URL=$DATABASE_URL
GEMINI_API_KEY=\${GEMINI_API_KEY:-CONFIGURE_AQUI}
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
BASE_URL=https://$DOMAIN

# ── TELECONSULTAS — Agora.io ──
AGORA_APP_ID=\${AGORA_APP_ID:-}
AGORA_APP_CERTIFICATE=\${AGORA_APP_CERTIFICATE:-}

# ── PAGAMENTOS — PayPal ──
PAYPAL_CLIENT_ID=\${PAYPAL_CLIENT_ID:-}
PAYPAL_CLIENT_SECRET=\${PAYPAL_CLIENT_SECRET:-}
PAYPAL_MODE=production

# ── PAGAMENTOS — Stripe (Card, Apple Pay, Google Pay, Link) ──
STRIPE_SECRET_KEY=\${STRIPE_SECRET_KEY:-}
STRIPE_PUBLISHABLE_KEY=\${STRIPE_PUBLISHABLE_KEY:-}
STRIPE_WEBHOOK_SECRET=\${STRIPE_WEBHOOK_SECRET:-}

# ── PAGAMENTOS — PagBank (PIX / Boleto) ──
PAGBANK_TOKEN=\${PAGBANK_TOKEN:-}
PAGBANK_SANDBOX=false

# ── IA — OpenAI Fallback ──
AI_INTEGRATIONS_OPENAI_API_KEY=\${AI_INTEGRATIONS_OPENAI_API_KEY:-}
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# ── WHATSAPP IA ──
WHATSAPP_ACCESS_TOKEN=\${WHATSAPP_ACCESS_TOKEN:-}
WHATSAPP_PHONE_NUMBER_ID=\${WHATSAPP_PHONE_NUMBER_ID:-}
WHATSAPP_WEBHOOK_VERIFY_TOKEN=\${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}

# ── i18n — Idioma padrão ──
DEFAULT_LANGUAGE=pt
ENVEOF

chown $APP_USER:$APP_USER "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# ── 10. Configure PM2 ──
echo "[10/12] Configurando PM2..."
npm install -g pm2

cat > "$APP_DIR/ecosystem.config.cjs" << 'PM2EOF'
module.exports = {
  apps: [{
    name: 'telemed3',
    script: 'dist/index.js',
    cwd: '/opt/telemed3',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/telemed3/error.log',
    out_file: '/var/log/telemed3/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
PM2EOF

mkdir -p /var/log/telemed3
chown -R $APP_USER:$APP_USER /var/log/telemed3

# Start with PM2
cd "$APP_DIR"
sudo -u $APP_USER pm2 start ecosystem.config.cjs
sudo -u $APP_USER pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

# ── 11. Install and Configure Nginx ──
echo "[11/12] Configurando Nginx + SSL..."
apt-get install -y -qq nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/telemed3 << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirect HTTP to HTTPS
    location / {
        return 301 https://\\$server_name\\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL will be configured by Certbot
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Max upload size (for PDFs, images)
    client_max_body_size 25M;

    # Main application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # WebSocket proxy (real-time updates, video signaling)
    location /ws {
        proxy_pass http://127.0.0.1:5000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Static uploads
    location /uploads/ {
        alias /opt/telemed3/client/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Stripe webhook (no body limit)
    location /api/stripe/webhook {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        client_max_body_size 10M;
    }

    # WhatsApp webhook
    location /api/whatsapp/webhook {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/telemed3 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL via Certbot (if domain resolves)
if host "$DOMAIN" &>/dev/null; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || \\
        echo "[AVISO] Certbot falhou. Configure SSL manualmente depois."
else
    echo "[INFO] Domínio $DOMAIN não resolve. Configure DNS e execute:"
    echo "  sudo certbot --nginx -d $DOMAIN"
fi

# ── 12. Create systemd service (backup for PM2) ──
echo "[12/12] Criando serviço systemd..."
cat > /etc/systemd/system/telemed3.service << SVCEOF
[Unit]
Description=Tele<M3D> Pro v3.5
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/telemed3/out.log
StandardError=append:/var/log/telemed3/error.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable telemed3

# ── Health Check ──
echo ""
echo "[INFO] Aguardando servidor iniciar..."
sleep 5

HEALTH_OK=false
for i in {1..10}; do
    if curl -sf http://localhost:5000/api/health &>/dev/null; then
        HEALTH_OK=true
        break
    fi
    sleep 2
done

# ── Stripe Webhook URL ──
STRIPE_WEBHOOK_URL="https://$DOMAIN/api/stripe/webhook"
PAGBANK_WEBHOOK_URL="https://$DOMAIN/api/pagbank/webhook"
WHATSAPP_WEBHOOK_URL="https://$DOMAIN/api/whatsapp/webhook"

# ── Summary ──
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  INSTALAÇÃO CONCLUÍDA — Tele<M3D> Pro v3.5"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  URL:        https://$DOMAIN"
echo "  App Dir:    $APP_DIR"
echo "  DB:         $DB_NAME (user: $DB_USER)"
echo "  PM2:        pm2 status | pm2 logs telemed3"
echo "  Nginx:      /etc/nginx/sites-available/telemed3"
echo "  Logs:       /var/log/telemed3/"
echo "  .env:       $APP_DIR/.env"
echo ""

if [ "$HEALTH_OK" = true ]; then
    echo "  [OK] Health check passou — servidor online!"
else
    echo "  [AVISO] Health check falhou. Verifique: pm2 logs telemed3"
fi

echo ""
echo "  ── Módulos ──"
echo "  [✓] Express.js backend + React frontend (Vite)"
echo "  [✓] PostgreSQL 16 + Drizzle ORM (70+ tabelas)"
echo "  [✓] JWT Auth + bcrypt + sessions"
echo "  [✓] Teleconsultas (Agora WebRTC)"
echo "  [✓] IA Médica (Google Gemini + OpenAI fallback)"
echo "  [✓] Triagem IA (Manchester Protocol / WHO ETAT)"
echo "  [✓] Farmácia (prescrições, dispensação, LGPD)"
echo "  [✓] PMD v1.0 (Prontuário Digital CFM/LGPD/RGPD)"
echo "  [✓] Assinatura Digital (ICP-Brasil A3 / RSA-SHA256)"
echo "  [✓] FHIR R4 Export (BR, US, EU, Internacional)"
echo "  [✓] PayPal, Stripe (Card/Link/Apple Pay/Google Pay)"
echo "  [✓] PagBank (PIX / Boleto)"
echo "  [✓] Wallet Digital (TM3D, NFTs, Broker)"
echo "  [✓] IAM3D Voice Assistant (STT/TTS)"
echo "  [✓] Avaliação de Consultas (1-5 estrelas)"
echo "  [✓] Equipes Médicas e Inter-Consultas"
echo "  [✓] Gestão de Clínicas"
echo "  [✓] WhatsApp IA"
echo "  [✓] Pós-Consulta IA (prescrições, exames, referências)"
echo "  [✓] Classificação Diagnóstica (CID-10/11, DSM-5/TR)"
echo "  [✓] Relatórios Epidemiológicos"
echo "  [✓] Detecção de Inatividade"
echo "  [✓] Multilíngue (PT, EN, ES, FR, DE, IT, ZH, GN)"
echo ""
echo "  ── Webhooks ──"
echo "  Stripe:   $STRIPE_WEBHOOK_URL"
echo "  PagBank:  $PAGBANK_WEBHOOK_URL"
echo "  WhatsApp: $WHATSAPP_WEBHOOK_URL"
echo ""
echo "  ── Próximos passos ──"
echo "  1. Edite $APP_DIR/.env com suas chaves de API"
echo "  2. Reinicie: pm2 restart telemed3"
echo "  3. Configure webhooks nos painéis de pagamento"
echo "  4. Acesse: https://$DOMAIN"
echo ""
echo "══════════════════════════════════════════════════════════"`} />

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">1</Badge>
                    Deploy no Replit
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    A forma mais rápida de publicar é usando o Replit Deployments:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li>Clique em "Deploy" no painel do Replit</li>
                    <li>Selecione "Autoscale" ou "Reserved VM"</li>
                    <li>Configure o domínio personalizado (opcional)</li>
                    <li>O Replit cuida de TLS, health checks e escalabilidade</li>
                    <li>Stripe Integration é sincronizada automaticamente no deploy</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Deploy com Docker Compose
                  </h3>
                  <CodeBlock title="Dockerfile" language="dockerfile" code={`FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN mkdir -p client/public/uploads/profiles \\
    client/public/uploads/references \\
    client/public/uploads/clinical-assets

EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]`} />
                  <CodeBlock title="docker-compose.yml" language="yaml" code={`version: '3.8'

services:
  app:
    build: .
    container_name: telemed3-app
    ports:
      - "5000:5000"
    environment:
      # ── Obrigatórias ──
      - DATABASE_URL=postgresql://postgres:senha_forte@db:5432/telemed3
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - SESSION_SECRET=\${SESSION_SECRET}
      - NODE_ENV=production
      - BASE_URL=\${BASE_URL:-https://localhost}
      # ── Teleconsultas ──
      - AGORA_APP_ID=\${AGORA_APP_ID}
      - AGORA_APP_CERTIFICATE=\${AGORA_APP_CERTIFICATE}
      # ── PayPal ──
      - PAYPAL_CLIENT_ID=\${PAYPAL_CLIENT_ID}
      - PAYPAL_CLIENT_SECRET=\${PAYPAL_CLIENT_SECRET}
      - PAYPAL_MODE=\${PAYPAL_MODE:-sandbox}
      # ── Stripe (Card, Apple Pay, Google Pay, Link) ──
      - STRIPE_SECRET_KEY=\${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=\${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_WEBHOOK_SECRET=\${STRIPE_WEBHOOK_SECRET}
      # ── PagBank (PIX / Boleto) ──
      - PAGBANK_TOKEN=\${PAGBANK_TOKEN}
      - PAGBANK_SANDBOX=\${PAGBANK_SANDBOX:-false}
      # ── IA Fallback ──
      - AI_INTEGRATIONS_OPENAI_API_KEY=\${AI_INTEGRATIONS_OPENAI_API_KEY}
      - AI_INTEGRATIONS_OPENAI_BASE_URL=\${AI_INTEGRATIONS_OPENAI_BASE_URL:-https://api.openai.com/v1}
      # ── WhatsApp IA ──
      - WHATSAPP_ACCESS_TOKEN=\${WHATSAPP_ACCESS_TOKEN}
      - WHATSAPP_PHONE_NUMBER_ID=\${WHATSAPP_PHONE_NUMBER_ID}
      - WHATSAPP_WEBHOOK_VERIFY_TOKEN=\${WHATSAPP_WEBHOOK_VERIFY_TOKEN}
      # ── i18n ──
      - DEFAULT_LANGUAGE=\${DEFAULT_LANGUAGE:-pt}
    volumes:
      - uploads:/app/client/public/uploads
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  db:
    image: postgres:16-alpine
    container_name: telemed3-db
    environment:
      POSTGRES_DB: telemed3
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: senha_forte
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: telemed3-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt
    depends_on:
      - app
    restart: unless-stopped

volumes:
  pgdata:
  uploads:
  certbot-etc:
  certbot-var:`} />
                  <CodeBlock title="Terminal" code={`# Criar arquivo .env com suas chaves
cp .env.example .env
nano .env

# Build e iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Verificar saúde
curl http://localhost:5000/api/health`} />
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Webhooks de Pagamento
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Configure os URLs de webhook nos painéis dos provedores de pagamento:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Stripe:</span>{" "}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://seu-dominio.com/api/stripe/webhook</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <CreditCard className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div>
                        <span className="font-medium">PagBank:</span>{" "}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://seu-dominio.com/api/pagbank/webhook</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <MessageCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="font-medium">WhatsApp:</span>{" "}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://seu-dominio.com/api/whatsapp/webhook</code>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    Checklist de Produção
                  </h3>
                  <div className="space-y-2 text-sm">
                    {[
                      "Configurar DATABASE_URL com banco de produção (Neon, Supabase, AWS RDS, ou local)",
                      "Definir GEMINI_API_KEY para IA médica (Google Gemini — obrigatória)",
                      "Definir SESSION_SECRET com chave forte e aleatória (mín. 32 caracteres)",
                      "Configurar AGORA_APP_ID e AGORA_APP_CERTIFICATE para teleconsultas por vídeo",
                      "Configurar PAYPAL_CLIENT_ID/SECRET e PAYPAL_MODE=production",
                      "Configurar Stripe (Replit Integration ou STRIPE_SECRET_KEY) — suporta Card/Link/Apple Pay/Google Pay",
                      "Registrar webhook Stripe: https://dominio/api/stripe/webhook",
                      "Configurar PAGBANK_TOKEN e PAGBANK_SANDBOX=false para PIX/Boleto",
                      "Registrar webhook PagBank: https://dominio/api/pagbank/webhook",
                      "Definir BASE_URL com o domínio público (ex: https://med.exemplo.com)",
                      "Ativar HTTPS/TLS (obrigatório para WebRTC, pagamentos e cookies seguros)",
                      "Configurar Nginx como reverse proxy com WebSocket support (/ws)",
                      "Configurar certificado SSL via Certbot (Let's Encrypt)",
                      "Configurar backup automático do banco de dados (pg_dump + cron)",
                      "Configurar PM2 para auto-restart e monitoramento",
                      "Configurar monitoramento e alertas (PM2 plus, UptimeRobot, etc.)",
                      "Revisar permissões de CORS e Content Security Policy",
                      "Configurar timeout de inatividade no painel Admin (auto-logout)",
                      "Verificar conformidade FHIR R4 para exportação de dados",
                      "Configurar diretórios de upload com permissões adequadas (755)",
                      "Testar módulo de farmácia (prescrições, dispensação, relatórios LGPD)",
                      "Testar assinatura digital de prescrições (ICP-Brasil / RSA-SHA256)",
                      "Testar fluxo de pagamento completo (Stripe, PayPal, PagBank)",
                      "Testar teleconsulta por vídeo end-to-end (WebRTC + Agora)",
                      "Configurar WhatsApp Business API e webhook",
                      "Testar wallet TM3D, NFTs e broker",
                      "Verificar módulo de equipes médicas e inter-consultas",
                      "Configurar domínio personalizado e DNS (A record)",
                      "Testar pós-consulta IA (auto-geração de prescrições e exames)",
                      "Testar classificação diagnóstica (CID-10/11, DSM-5/TR)",
                      "Verificar suporte multilíngue (8 idiomas: PT, EN, ES, FR, DE, IT, ZH, GN)",
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-5 h-5 rounded border border-border flex items-center justify-center flex-shrink-0">
                          <span className="text-xs">{idx + 1}</span>
                        </div>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-amber-600" />
                  Referência Completa de Variáveis de Ambiente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">Obrigatórias</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "DATABASE_URL", desc: "URL de conexão PostgreSQL (postgresql://user:pass@host:5432/db)" },
                        { key: "GEMINI_API_KEY", desc: "Chave da API Google Gemini para IA médica e triagem" },
                        { key: "SESSION_SECRET", desc: "Segredo para JWT, sessões e cookies (mín. 32 chars)" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-green-50 dark:bg-green-900/10">
                          <code className="text-xs font-mono font-medium text-green-800 dark:text-green-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Teleconsultas (Agora.io)</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "AGORA_APP_ID", desc: "ID do app Agora.io para WebRTC" },
                        { key: "AGORA_APP_CERTIFICATE", desc: "Certificado do app Agora.io para token generation" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-blue-50 dark:bg-blue-900/10">
                          <code className="text-xs font-mono font-medium text-blue-800 dark:text-blue-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-1">Pagamentos</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "PAYPAL_CLIENT_ID", desc: "Client ID do PayPal (sandbox ou production)" },
                        { key: "PAYPAL_CLIENT_SECRET", desc: "Client Secret do PayPal" },
                        { key: "PAYPAL_MODE", desc: "sandbox ou production" },
                        { key: "STRIPE_SECRET_KEY", desc: "Chave secreta do Stripe (sk_test_ ou sk_live_)" },
                        { key: "STRIPE_PUBLISHABLE_KEY", desc: "Chave pública do Stripe (pk_test_ ou pk_live_)" },
                        { key: "STRIPE_WEBHOOK_SECRET", desc: "Segredo do webhook Stripe (whsec_)" },
                        { key: "PAGBANK_TOKEN", desc: "Token de autenticação PagBank (PIX/Boleto)" },
                        { key: "PAGBANK_SANDBOX", desc: "true para sandbox, false para produção" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-purple-50 dark:bg-purple-900/10">
                          <code className="text-xs font-mono font-medium text-purple-800 dark:text-purple-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-1">IA (Fallback)</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "AI_INTEGRATIONS_OPENAI_API_KEY", desc: "Chave OpenAI (fallback quando Gemini falha)" },
                        { key: "AI_INTEGRATIONS_OPENAI_BASE_URL", desc: "URL base da API OpenAI (default: https://api.openai.com/v1)" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-indigo-50 dark:bg-indigo-900/10">
                          <code className="text-xs font-mono font-medium text-indigo-800 dark:text-indigo-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">WhatsApp IA</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "WHATSAPP_ACCESS_TOKEN", desc: "Token do WhatsApp Business API (Meta)" },
                        { key: "WHATSAPP_PHONE_NUMBER_ID", desc: "ID do número WhatsApp Business" },
                        { key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", desc: "Token de verificação do webhook WhatsApp" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-emerald-50 dark:bg-emerald-900/10">
                          <code className="text-xs font-mono font-medium text-emerald-800 dark:text-emerald-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-1">Servidor e i18n</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "BASE_URL", desc: "URL pública do servidor (ex: https://med.exemplo.com)" },
                        { key: "NODE_ENV", desc: "production ou development (default: development)" },
                        { key: "PORT", desc: "Porta do servidor (default: 5000)" },
                        { key: "DEFAULT_LANGUAGE", desc: "Idioma padrão: pt, en, es, fr, de, it, zh, gn" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-orange-50 dark:bg-orange-900/10">
                          <code className="text-xs font-mono font-medium text-orange-800 dark:text-orange-300 whitespace-nowrap">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Estrutura do Banco de Dados (70+ tabelas)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  O schema é gerenciado pelo Drizzle ORM com migrações automáticas. O banco é criado automaticamente ao iniciar o servidor. Tabelas completas:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {[
                    { name: "users", desc: "Médicos, admins, pacientes, farmacêuticos, pesquisadores" },
                    { name: "patients", desc: "Dados clínicos dos pacientes" },
                    { name: "appointments", desc: "Agendamentos e consultas (com avaliação 1-5)" },
                    { name: "medical_records", desc: "Prontuários (PMD v1.0, LGPD/RGPD)" },
                    { name: "video_consultations", desc: "Teleconsultas por vídeo (Agora WebRTC)" },
                    { name: "consultation_notes", desc: "Notas, chat e transcrições de consulta" },
                    { name: "consultation_recordings", desc: "Gravações de vídeo segmentadas" },
                    { name: "consultation_requests", desc: "Solicitações de consulta (triagem IA)" },
                    { name: "consultation_sessions", desc: "Sessões ativas de teleconsulta" },
                    { name: "consultation_access_tokens", desc: "QR codes e códigos de acesso temporário" },
                    { name: "inter_consultations", desc: "Inter-consultas entre médicos" },
                    { name: "post_consultation_items", desc: "Itens pós-consulta gerados por IA" },
                    { name: "diagnostic_inferences", desc: "Classificação IA (CID-10/11, DSM-5/TR)" },
                    { name: "prescriptions", desc: "Prescrições médicas completas" },
                    { name: "prescription_items", desc: "Itens individuais das prescrições" },
                    { name: "prescription_shares", desc: "Compartilhamento com farmácias" },
                    { name: "prescription_templates", desc: "Templates reutilizáveis de prescrições" },
                    { name: "medications", desc: "Cadastro de medicamentos" },
                    { name: "drug_interactions", desc: "Interações medicamentosas" },
                    { name: "pharmacy_dispensing", desc: "Registros de dispensação (LGPD)" },
                    { name: "pharmacy_reports", desc: "Relatórios da farmácia" },
                    { name: "digital_signatures", desc: "Assinaturas digitais (ICP-Brasil)" },
                    { name: "digital_keys", desc: "Chaves criptográficas (RSA-SHA256)" },
                    { name: "signature_verifications", desc: "Verificações de assinaturas" },
                    { name: "doctor_schedule", desc: "Horários e plantão médico" },
                    { name: "doctor_notes", desc: "Anotações pessoais do médico" },
                    { name: "doctor_patient_blocks", desc: "Bloqueio de pacientes por médico" },
                    { name: "patient_notes", desc: "Notas sobre pacientes" },
                    { name: "patient_chat_threads", desc: "Threads de chat com pacientes" },
                    { name: "clinical_interviews", desc: "Entrevistas clínicas IA" },
                    { name: "clinical_assets", desc: "Exames e imagens clínicas" },
                    { name: "exam_results", desc: "Resultados de exames (analisados por IA)" },
                    { name: "medical_teams", desc: "Equipes médicas multidisciplinares" },
                    { name: "medical_team_members", desc: "Membros das equipes médicas" },
                    { name: "team_notes", desc: "Notas compartilhadas de equipe" },
                    { name: "collaborators", desc: "Farmácias, laboratórios, hospitais" },
                    { name: "collaborator_integrations", desc: "Logs de integração com colaboradores" },
                    { name: "collaborator_api_keys", desc: "Chaves API de colaboradores" },
                    { name: "lab_orders", desc: "Pedidos de exames laboratoriais" },
                    { name: "lab_templates", desc: "Templates de exames" },
                    { name: "hospital_referrals", desc: "Encaminhamentos hospitalares" },
                    { name: "tmc_transactions", desc: "Histórico de créditos TM3D" },
                    { name: "tmc_config", desc: "Configuração de custos TM3D" },
                    { name: "tmc_credit_packages", desc: "Pacotes de créditos para compra" },
                    { name: "cashbox", desc: "Caixa do sistema (admin)" },
                    { name: "cashbox_transactions", desc: "Transações do caixa" },
                    { name: "payment_transactions", desc: "Pagamentos (PayPal/Stripe/PagBank)" },
                    { name: "paypal_orders", desc: "Ordens de pagamento PayPal" },
                    { name: "wallet_audit_log", desc: "Auditoria de carteira digital" },
                    { name: "dynamic_nfts", desc: "NFTs dinâmicos (LGPD)" },
                    { name: "nft_ownership", desc: "Propriedade de NFTs" },
                    { name: "broker_orders", desc: "Ordens do broker TM3D/NFT" },
                    { name: "broker_trades", desc: "Negociações do broker" },
                    { name: "tm3d_supply", desc: "Suprimento de tokens TM3D" },
                    { name: "external_wallets", desc: "Carteiras externas (MetaMask)" },
                    { name: "withdrawal_requests", desc: "Solicitações de saque" },
                    { name: "whatsapp_messages", desc: "Mensagens WhatsApp IA" },
                    { name: "chatbot_references", desc: "Base de conhecimento do chatbot" },
                    { name: "chatbot_conversations", desc: "Histórico de conversas do chatbot" },
                    { name: "pending_notifications", desc: "Notificações pendentes" },
                    { name: "system_settings", desc: "Configurações do sistema (Admin)" },
                    { name: "support_config", desc: "Configuração de suporte" },
                    { name: "layout_settings", desc: "Preferências de layout por usuário" },
                    { name: "error_logs", desc: "Logs de erros do sistema" },
                    { name: "clinics", desc: "Gestão de clínicas" },
                    { name: "clinic_members", desc: "Membros das clínicas" },
                    { name: "clinic_patient_bindings", desc: "Vínculos paciente-clínica" },
                    { name: "clinic_consultation_logs", desc: "Logs de consultas por clínica" },
                  ].map((table) => (
                    <div key={table.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <Database className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <div>
                        <code className="text-xs font-mono font-medium">{table.name}</code>
                        <span className="text-xs text-muted-foreground ml-1.5">— {table.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
