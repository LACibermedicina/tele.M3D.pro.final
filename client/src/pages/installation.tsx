import { useState } from "react";
import { useIsAdmin } from "@/hooks/use-admin";
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
  Mic, Languages, Star, Users, Activity, MessageCircle
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
  const isAdmin = useIsAdmin();
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
                Script de instalação e configuração do Tele{"<"}M3D{">"} Pro v3.5
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" />
              Módulos Incluídos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              {[
                { icon: <Video className="h-3.5 w-3.5" />, label: "Teleconsultas (Agora)" },
                { icon: <Brain className="h-3.5 w-3.5" />, label: isAdmin ? "IA Médica" : "Suporte Médico" },
                { icon: <Activity className="h-3.5 w-3.5" />, label: isAdmin ? "Triagem IA" : "Triagem" },
                { icon: <Pill className="h-3.5 w-3.5" />, label: "Farmácia LGPD" },
                { icon: <FileText className="h-3.5 w-3.5" />, label: "PMD v1.0 (CFM)" },
                { icon: <Shield className="h-3.5 w-3.5" />, label: "Assinatura Digital" },
                { icon: <Globe className="h-3.5 w-3.5" />, label: "FHIR R4 Export" },
                { icon: <CreditCard className="h-3.5 w-3.5" />, label: "PayPal/Stripe/PIX" },
                { icon: <Wallet className="h-3.5 w-3.5" />, label: "Wallet TM3D/NFTs" },
                { icon: <Mic className="h-3.5 w-3.5" />, label: isAdmin ? "IAM3D Voice" : "Assistente de Voz" },
                { icon: <Star className="h-3.5 w-3.5" />, label: "Avaliação Consultas" },
                { icon: <Users className="h-3.5 w-3.5" />, label: "Equipes Médicas" },
                { icon: <MessageCircle className="h-3.5 w-3.5" />, label: isAdmin ? "WhatsApp IA" : "WhatsApp" },
                { icon: <Languages className="h-3.5 w-3.5" />, label: "Multilíngue (8)" },
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
                  O Tele{"<"}M3D{">"} Pro v3.5 é otimizado para rodar no Replit. O schema é aplicado automaticamente com migrações internas. Inclui integração com Stripe (Replit Integration) e módulo de farmácia.
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">1</Badge>
                      Criar Repl
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Importe o repositório ou crie um novo Repl com template Node.js.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">2</Badge>
                      Banco de Dados PostgreSQL
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Adicione o módulo PostgreSQL no painel de ferramentas do Replit. A variável DATABASE_URL será configurada automaticamente. O schema completo será criado automaticamente via migrações internas.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">3</Badge>
                      Variáveis de Ambiente
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Configure as seguintes variáveis no painel Secrets do Replit:
                    </p>
                    <CodeBlock title="Obrigatórias" code={isAdmin
                      ? `DATABASE_URL=postgresql://user:pass@host:5432/dbname\nGEMINI_API_KEY=sua_chave_gemini_api`
                      : `DATABASE_URL=postgresql://user:pass@host:5432/dbname\nMEDICAL_SERVICE_KEY=sua_chave_servico_medico`} />
                    <CodeBlock title="Teleconsultas (Agora)" code={`AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate`} />
                    <CodeBlock title="Pagamentos — PayPal" code={`PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret
PAYPAL_MODE=sandbox`} />
                    <CodeBlock title="Pagamentos — Stripe (via Replit Integration)" code={`# Stripe é configurado automaticamente via Replit Integration
# Se preferir manual:
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...`} />
                    <CodeBlock title="Pagamentos — PagBank (PIX/Boleto)" code={`PAGBANK_TOKEN=seu_pagbank_token
PAGBANK_SANDBOX=true`} />
                    <CodeBlock title="WhatsApp (opcional)" code={`WHATSAPP_ACCESS_TOKEN=seu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_verify_token`} />
                    <CodeBlock title={isAdmin ? "IA Fallback, Sessão e URL" : "Sessão e URL"} code={isAdmin
                      ? `SESSION_SECRET=uma_chave_secreta_longa\nAI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai\nAI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1\nBASE_URL=https://seu-dominio.com`
                      : `SESSION_SECRET=uma_chave_secreta_longa\nFALLBACK_SERVICE_KEY=sua_chave_fallback\nBASE_URL=https://seu-dominio.com`} />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">4</Badge>
                      Instalar e Iniciar
                    </h3>
                    <CodeBlock title="Terminal" code={`npm install
npm run dev`} />
                    <p className="text-sm text-muted-foreground">
                      O servidor inicia na porta 5000. As migrações do banco são aplicadas automaticamente.
                    </p>
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
                    Configurar Variáveis de Ambiente
                  </h3>
                  <CodeBlock title="Criar arquivo .env" code={isAdmin ? `# ── Banco de dados PostgreSQL ──
DATABASE_URL=postgresql://postgres:senha@localhost:5432/telemed3

# ── IA - Google Gemini (obrigatório) ──
GEMINI_API_KEY=sua_chave_gemini_api

# ── Agora.io para teleconsultas (opcional) ──
AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate

# ── PayPal (opcional) ──
PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret
PAYPAL_MODE=sandbox

# ── Stripe (opcional) ──
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── PagBank PIX/Boleto (opcional) ──
PAGBANK_TOKEN=seu_pagbank_token
PAGBANK_SANDBOX=true

# ── OpenAI como fallback de IA (opcional) ──
AI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# ── WhatsApp IA (opcional) ──
WHATSAPP_ACCESS_TOKEN=seu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_verify_token

# ── Sessão e URL ──
SESSION_SECRET=uma_chave_secreta_longa_e_aleatoria
BASE_URL=https://seu-dominio.com` : `# ── Banco de dados PostgreSQL ──
DATABASE_URL=postgresql://postgres:senha@localhost:5432/telemed3

# ── Serviço Médico (obrigatório) ──
MEDICAL_SERVICE_KEY=sua_chave_servico_medico

# ── Agora.io para teleconsultas (opcional) ──
AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate

# ── PayPal (opcional) ──
PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret
PAYPAL_MODE=sandbox

# ── Stripe (opcional) ──
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── PagBank PIX/Boleto (opcional) ──
PAGBANK_TOKEN=seu_pagbank_token
PAGBANK_SANDBOX=true

# ── Serviço Fallback (opcional) ──
FALLBACK_SERVICE_KEY=sua_chave_fallback

# ── WhatsApp (opcional) ──
WHATSAPP_ACCESS_TOKEN=seu_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_webhook_verify_token

# ── Sessão e URL ──
SESSION_SECRET=uma_chave_secreta_longa_e_aleatoria
BASE_URL=https://seu-dominio.com`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Criar Banco de Dados e Iniciar
                  </h3>
                  <CodeBlock title="Terminal" code={`# Criar banco de dados (se necessário)
createdb telemed3

# Iniciar o servidor (migrações são aplicadas automaticamente)
npm run dev

# O servidor estará disponível em http://localhost:5000`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-green-600" />
                  Script de Instalação Automática
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Use este script para verificar e instalar automaticamente em um sistema Linux/macOS:
                </p>
                <CodeBlock title="install-local.sh" language="bash" code={`#!/bin/bash
set -e

echo "============================================"
echo "  Tele<M3D> Pro v3.5 - Script de Instalação"
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

# Verificar variáveis de ambiente
echo ""
if [ -z "$DATABASE_URL" ]; then
    echo "[AVISO] DATABASE_URL não configurada."
    echo "  Configure as variáveis de ambiente antes de iniciar."
    echo "  Exemplo: export DATABASE_URL=postgresql://user:pass@host:5432/db"
else
    echo "[OK] DATABASE_URL configurada"
fi

` + (isAdmin ? `if [ -z "$GEMINI_API_KEY" ]; then
    echo "[AVISO] GEMINI_API_KEY não configurada."
    echo "  A IA médica não funcionará sem esta chave."
    echo "  Obtenha em: https://aistudio.google.com/apikey"
else
    echo "[OK] GEMINI_API_KEY configurada"
fi` : `if [ -z "$MEDICAL_SERVICE_KEY" ]; then
    echo "[AVISO] Chave do serviço médico não configurada."
    echo "  O suporte médico não funcionará sem esta chave."
    echo "  Obtenha a chave no portal do provedor."
else
    echo "[OK] Serviço médico configurado"
fi`) + `

if [ -z "$AGORA_APP_ID" ]; then
    echo "[INFO] AGORA_APP_ID não configurada (opcional)."
    echo "  Necessária para teleconsultas por vídeo."
else
    echo "[OK] AGORA_APP_ID configurada"
fi

# Verificação de pagamentos
for VAR in PAYPAL_CLIENT_ID STRIPE_SECRET_KEY PAGBANK_TOKEN; do
    if [ -z "\${!VAR:-}" ]; then
        echo "[INFO] $VAR não configurada (opcional)."
    else
        echo "[OK] $VAR configurada"
    fi
done

echo ""
echo "============================================"
echo "  Instalação concluída!"
echo "============================================"
echo ""
echo "Para iniciar o servidor:"
echo "  npm run dev"
echo ""
echo "O servidor estará disponível em:"
echo "  http://localhost:5000"
echo ""
echo "Módulos incluídos:"
echo "  - Teleconsultas por vídeo (Agora WebRTC)"
echo "  - ` + (isAdmin ? 'IA Médica (Gemini + OpenAI fallback)' : 'Suporte Médico (com fallback automático)') + `"
echo "  - ` + (isAdmin ? 'Triagem IA (Manchester Protocol / WHO ETAT)' : 'Triagem (Manchester Protocol / WHO ETAT)') + `"
echo "  - Farmácia (prescrições, dispensação, LGPD)"
echo "  - PMD v1.0 (Prontuário Digital CFM/LGPD/RGPD)"
echo "  - Prontuário Unificado (timeline consolidada)"
echo "  - Assinatura Digital (ICP-Brasil A3 / RSA-SHA256)"
echo "  - Exportação FHIR R4 (BR, US, EU, Internacional)"
echo "  - Pagamentos (PayPal, Stripe, PagBank PIX/Boleto)"
echo "  - Wallet Digital (TM3D, NFTs, Broker)"
echo "  - ` + (isAdmin ? 'IAM3D Voice Assistant' : 'Assistente de Voz') + ` (STT/TTS multilíngue)"
echo "  - Avaliação de Consultas (1-5 estrelas)"
echo "  - Equipes Médicas e Inter-Consultas"
echo "  - ` + (isAdmin ? 'WhatsApp IA' : 'WhatsApp') + `"
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
                    <span className="font-bold text-green-800 dark:text-green-200">Instalador Automático (Recomendado)</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Copie e execute o comando abaixo no terminal do seu servidor Ubuntu/Debian como root. O script instala tudo automaticamente: Node.js, PostgreSQL, Nginx, SSL, PM2 e a aplicação completa com todos os módulos.
                  </p>
                  <CodeBlock title="Executar no servidor (como root)" code={`curl -fsSL https://raw.githubusercontent.com/LACibermedicina/tele.M3D.pro/main/install.sh | sudo bash`} />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    O script clona o repositório do GitHub, configura o banco de dados, compila a aplicação e inicia o serviço com PM2. Inclui todos os módulos: farmácia, PMD, assinatura digital, pagamentos (PayPal/Stripe/PIX), ` + (isAdmin ? 'triagem IA, IAM3D' : 'triagem automatizada, assistente de voz') + `, equipes médicas, avaliação de consultas e suporte multilíngue.
                  </p>
                </div>

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
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Deploy com Docker
                  </h3>
                  <CodeBlock title="Dockerfile" language="dockerfile" code={`FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

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
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:senha@db:5432/telemed3
      - ` + (isAdmin ? 'GEMINI_API_KEY=${GEMINI_API_KEY}' : 'MEDICAL_SERVICE_KEY=${MEDICAL_SERVICE_KEY}') + `
      - SESSION_SECRET=\${SESSION_SECRET}
      - AGORA_APP_ID=\${AGORA_APP_ID}
      - AGORA_APP_CERTIFICATE=\${AGORA_APP_CERTIFICATE}
      - PAYPAL_CLIENT_ID=\${PAYPAL_CLIENT_ID}
      - PAYPAL_CLIENT_SECRET=\${PAYPAL_CLIENT_SECRET}
      - PAYPAL_MODE=\${PAYPAL_MODE:-sandbox}
      - STRIPE_SECRET_KEY=\${STRIPE_SECRET_KEY}
      - STRIPE_PUBLISHABLE_KEY=\${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_WEBHOOK_SECRET=\${STRIPE_WEBHOOK_SECRET}
      - PAGBANK_TOKEN=\${PAGBANK_TOKEN}
      - PAGBANK_SANDBOX=\${PAGBANK_SANDBOX:-true}
      - ` + (isAdmin ? 'AI_INTEGRATIONS_OPENAI_API_KEY=${AI_INTEGRATIONS_OPENAI_API_KEY}\n      - AI_INTEGRATIONS_OPENAI_BASE_URL=${AI_INTEGRATIONS_OPENAI_BASE_URL}' : 'FALLBACK_SERVICE_KEY=${FALLBACK_SERVICE_KEY}') + `
      - NODE_ENV=production
    volumes:
      - uploads:/app/client/public/uploads
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: telemed3
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: senha
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
  uploads:`} />
                  <CodeBlock title="Terminal" code={`# Build e iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f app`} />
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
                      "Configurar DATABASE_URL com banco de produção (Neon, Supabase, AWS RDS)",
                      isAdmin ? "Definir GEMINI_API_KEY para IA médica (Google Gemini)" : "Definir chave do serviço médico",
                      "Configurar AGORA_APP_ID e AGORA_APP_CERTIFICATE para teleconsultas",
                      "Configurar PAYPAL_CLIENT_ID/SECRET e PAYPAL_MODE=production",
                      "Configurar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET",
                      "Configurar PAGBANK_TOKEN e PAGBANK_SANDBOX=false",
                      "Definir SESSION_SECRET com chave forte e aleatória",
                      "Definir BASE_URL com o domínio público (ex: https://med.exemplo.com)",
                      "Ativar HTTPS/TLS (obrigatório para WebRTC e pagamentos)",
                      "Configurar backup automático do banco de dados",
                      "Configurar monitoramento e alertas (PM2 logs)",
                      "Revisar permissões de acesso e CORS",
                      "Configurar timeout de inatividade no painel Admin (auto-logout)",
                      "Registrar webhooks do Stripe e PagBank nos painéis dos provedores",
                      "Verificar conformidade FHIR R4 para exportação de dados",
                      "Configurar diretórios de upload com permissões adequadas",
                      "Testar módulo de farmácia (prescrições, dispensação, relatórios)",
                      "Testar assinatura digital de prescrições",
                      "Configurar domínio personalizado e DNS",
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
                  Referência de Variáveis de Ambiente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">Obrigatórias</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "DATABASE_URL", desc: "URL de conexão PostgreSQL" },
                        { key: isAdmin ? "GEMINI_API_KEY" : "MEDICAL_SERVICE_KEY", desc: isAdmin ? "Chave da API Google Gemini para IA médica" : "Chave da API para suporte médico" },
                        { key: "SESSION_SECRET", desc: "Segredo para sessões e JWT" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-green-50 dark:bg-green-900/10">
                          <code className="text-xs font-mono font-medium text-green-800 dark:text-green-300">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1">Teleconsultas</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "AGORA_APP_ID", desc: "ID do app Agora.io" },
                        { key: "AGORA_APP_CERTIFICATE", desc: "Certificado do app Agora.io" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-blue-50 dark:bg-blue-900/10">
                          <code className="text-xs font-mono font-medium text-blue-800 dark:text-blue-300">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-1">Pagamentos</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: "PAYPAL_CLIENT_ID", desc: "Client ID do PayPal" },
                        { key: "PAYPAL_CLIENT_SECRET", desc: "Client Secret do PayPal" },
                        { key: "PAYPAL_MODE", desc: "sandbox ou production" },
                        { key: "STRIPE_SECRET_KEY", desc: "Chave secreta do Stripe" },
                        { key: "STRIPE_PUBLISHABLE_KEY", desc: "Chave pública do Stripe" },
                        { key: "STRIPE_WEBHOOK_SECRET", desc: "Segredo do webhook Stripe" },
                        { key: "PAGBANK_TOKEN", desc: "Token de autenticação PagBank" },
                        { key: "PAGBANK_SANDBOX", desc: "true para sandbox, false para produção" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-purple-50 dark:bg-purple-900/10">
                          <code className="text-xs font-mono font-medium text-purple-800 dark:text-purple-300">{v.key}</code>
                          <span className="text-muted-foreground text-xs">— {v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-1">Outros</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { key: isAdmin ? "AI_INTEGRATIONS_OPENAI_API_KEY" : "FALLBACK_SERVICE_KEY", desc: isAdmin ? "Chave OpenAI (fallback de IA)" : "Chave do serviço de fallback" },
                        ...(isAdmin ? [{ key: "AI_INTEGRATIONS_OPENAI_BASE_URL", desc: "URL base da API OpenAI" }] : []),
                        { key: "WHATSAPP_ACCESS_TOKEN", desc: "Token do WhatsApp Business API" },
                        { key: "WHATSAPP_PHONE_NUMBER_ID", desc: "ID do número WhatsApp" },
                        { key: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", desc: "Token de verificação do webhook WhatsApp" },
                        { key: "BASE_URL", desc: "URL pública do servidor (ex: https://med.exemplo.com)" },
                      ].map((v) => (
                        <div key={v.key} className="flex items-center gap-2 p-1.5 rounded bg-orange-50 dark:bg-orange-900/10">
                          <code className="text-xs font-mono font-medium text-orange-800 dark:text-orange-300">{v.key}</code>
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
                  Estrutura do Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  O schema é gerenciado pelo Drizzle ORM com migrações automáticas. Principais tabelas:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {[
                    { name: "users", desc: "Médicos, admins, pacientes, farmacêuticos" },
                    { name: "patients", desc: "Dados clínicos dos pacientes" },
                    { name: "appointments", desc: "Agendamentos de consultas" },
                    { name: "video_consultations", desc: "Teleconsultas por vídeo" },
                    { name: "consultation_notes", desc: "Notas e transcrições" },
                    { name: "consultation_requests", desc: "Solicitações de consulta" },
                    { name: "consultation_sessions", desc: "Sessões ativas" },
                    { name: "consultation_access_tokens", desc: "QR codes e códigos de acesso" },
                    { name: "inter_consultations", desc: "Inter-consultas médicas" },
                    { name: "medical_records", desc: "Prontuários (PMD v1.0)" },
                    { name: "prescriptions", desc: "Prescrições médicas" },
                    { name: "prescription_items", desc: "Itens das prescrições" },
                    { name: "pharmacy_dispensing", desc: "Registros de dispensação" },
                    { name: "pharmacy_reports", desc: "Relatórios da farmácia (LGPD)" },
                    { name: "digital_signatures", desc: "Assinaturas digitais ICP-Brasil" },
                    { name: "post_consultation_items", desc: isAdmin ? "Itens pós-consulta (IA)" : "Itens pós-consulta (auto-gerados)" },
                    { name: "diagnostic_inferences", desc: "CID-10/11 e DSM-5/TR" },
                    { name: "doctor_notes", desc: "Anotações do médico" },
                    { name: "doctor_schedule", desc: "Horários e plantão" },
                    { name: "medical_teams", desc: "Equipes médicas" },
                    { name: "tmc_credit_packages", desc: "Pacotes de créditos TM3D" },
                    { name: "payment_transactions", desc: "Transações (PayPal/Stripe/PagBank)" },
                    { name: "tmc_transactions", desc: "Histórico de créditos TM3D" },
                    { name: "wallet_audit_log", desc: "Auditoria de carteira" },
                    { name: "dynamic_nfts", desc: "NFTs dinâmicos (LGPD)" },
                    { name: "broker_orders", desc: "Ordens do broker TM3D/NFT" },
                    { name: "broker_trades", desc: "Negociações do broker" },
                    { name: "external_wallets", desc: "Carteiras externas (MetaMask)" },
                    { name: "withdrawal_requests", desc: "Solicitações de saque" },
                    { name: "doctor_patient_blocks", desc: "Bloqueio de pacientes por médico" },
                    { name: "pending_notifications", desc: "Notificações pendentes" },
                    { name: "system_settings", desc: "Configurações do sistema (Admin)" },
                    { name: "whatsapp_messages", desc: isAdmin ? "Mensagens WhatsApp IA" : "Mensagens WhatsApp" },
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
