import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageWrapper from "@/components/layout/page-wrapper";
import {
  Terminal, Copy, Check, Server, Database, Key, Globe,
  Package, Settings, Shield, MonitorSmartphone, Rocket,
  FileCode, GitBranch, HardDrive, Cpu, AlertCircle
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
                Script de instalação e configuração do Tele{"<"}M3D{">"} Pro v3.0
              </p>
            </div>
          </div>
        </div>

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
                  O Tele{"<"}M3D{">"} Pro v3.0 é otimizado para rodar no Replit. O sistema possui 61 tabelas no banco de dados e a maior parte da configuração é automática.
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
                      Adicione o módulo PostgreSQL no painel de ferramentas do Replit. A variável DATABASE_URL será configurada automaticamente. O schema completo com 61 tabelas será criado automaticamente.
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
                    <CodeBlock title="Variáveis obrigatórias" code={`DATABASE_URL=postgresql://user:pass@host:5432/dbname
GEMINI_API_KEY=sua_chave_gemini_api`} />
                    <CodeBlock title="Variáveis opcionais (Agora para vídeo)" code={`AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate`} />
                    <CodeBlock title="Variáveis opcionais (PayPal para créditos)" code={`PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret`} />
                    <CodeBlock title="Variáveis opcionais (OpenAI fallback e sessão)" code={`SESSION_SECRET=uma_chave_secreta_longa
AI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1`} />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline">4</Badge>
                      Instalar Dependências e Iniciar
                    </h3>
                    <CodeBlock title="Terminal" code={`npm install
npm run db:push
npm run dev`} />
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
                  <CodeBlock title="Terminal" code={`# Clonar o repositório
git clone https://github.com/LACibermedicina/tele.M3D.pro.git
cd tele.M3D.pro

# Instalar dependências
npm install`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">2</Badge>
                    Configurar Variáveis de Ambiente
                  </h3>
                  <CodeBlock title="Criar arquivo .env" code={`# Banco de dados PostgreSQL
DATABASE_URL=postgresql://postgres:senha@localhost:5432/telemed3

# Variáveis individuais (alternativa)
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=sua_senha
PGDATABASE=telemed3

# IA - Google Gemini (obrigatório)
GEMINI_API_KEY=sua_chave_gemini_api

# Agora.io para teleconsultas (opcional)
AGORA_APP_ID=seu_agora_app_id
AGORA_APP_CERTIFICATE=seu_agora_certificate

# PayPal para compra de créditos TMC (opcional)
PAYPAL_CLIENT_ID=seu_paypal_client_id
PAYPAL_CLIENT_SECRET=seu_paypal_client_secret

# OpenAI como fallback de IA (opcional)
AI_INTEGRATIONS_OPENAI_API_KEY=sua_chave_openai
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Sessão
SESSION_SECRET=uma_chave_secreta_longa_e_aleatoria`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Criar Banco de Dados e Migrar Schema
                  </h3>
                  <CodeBlock title="Terminal" code={`# Criar banco de dados (se necessário)
createdb telemed3

# Aplicar schema do Drizzle (61 tabelas)
npm run db:push`} />
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">4</Badge>
                    Iniciar o Servidor
                  </h3>
                  <CodeBlock title="Terminal" code={`# Modo desenvolvimento (hot-reload)
npm run dev

# O servidor inicia na porta 5000
# Acesse: http://localhost:5000`} />
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
                  Use este script para instalar automaticamente em um sistema Linux/macOS:
                </p>
                <CodeBlock title="install.sh" language="bash" code={`#!/bin/bash
set -e

echo "============================================"
echo "  Tele<M3D> Pro v3.0 - Script de Instalação"
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

# Verificar variáveis de ambiente
echo ""
if [ -z "$DATABASE_URL" ]; then
    echo "[AVISO] DATABASE_URL não configurada."
    echo "  Configure as variáveis de ambiente antes de iniciar."
    echo "  Exemplo: export DATABASE_URL=postgresql://user:pass@host:5432/db"
else
    echo "[OK] DATABASE_URL configurada"
    
    # Aplicar schema (61 tabelas)
    echo "[INFO] Aplicando schema do banco de dados (61 tabelas)..."
    npm run db:push
    echo "[OK] Schema aplicado com sucesso"
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "[AVISO] GEMINI_API_KEY não configurada."
    echo "  A IA médica não funcionará sem esta chave."
    echo "  Obtenha em: https://makersuite.google.com/app/apikey"
else
    echo "[OK] GEMINI_API_KEY configurada"
fi

if [ -z "$AGORA_APP_ID" ]; then
    echo "[INFO] AGORA_APP_ID não configurada (opcional)."
    echo "  Necessária para teleconsultas por vídeo."
else
    echo "[OK] AGORA_APP_ID configurada"
fi

if [ -z "$PAYPAL_CLIENT_ID" ]; then
    echo "[INFO] PAYPAL_CLIENT_ID não configurada (opcional)."
    echo "  Necessária para compra de créditos TMC via PayPal."
else
    echo "[OK] PAYPAL_CLIENT_ID configurada"
fi

if [ -z "$PAYPAL_CLIENT_SECRET" ]; then
    echo "[INFO] PAYPAL_CLIENT_SECRET não configurada (opcional)."
    echo "  Necessária para processamento de pagamentos PayPal."
else
    echo "[OK] PAYPAL_CLIENT_SECRET configurada"
fi

if [ -z "$SESSION_SECRET" ]; then
    echo "[INFO] SESSION_SECRET não configurada (opcional)."
    echo "  Recomendada para segurança de sessões em produção."
else
    echo "[OK] SESSION_SECRET configurada"
fi

if [ -z "$AI_INTEGRATIONS_OPENAI_API_KEY" ]; then
    echo "[INFO] AI_INTEGRATIONS_OPENAI_API_KEY não configurada (opcional)."
    echo "  Fallback de IA caso o Gemini não esteja disponível."
else
    echo "[OK] AI_INTEGRATIONS_OPENAI_API_KEY configurada"
fi

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
echo "Usuário padrão (médico):"
echo "  E-mail: doctor@telemed.com"
echo "  Senha: doctor123"
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
                    Copie e execute o comando abaixo no terminal do seu servidor Ubuntu/Debian como root. O script instala tudo automaticamente: Node.js, PostgreSQL, Nginx, SSL, PM2 e a aplicação.
                  </p>
                  <CodeBlock title="Executar no servidor (como root)" code={`curl -fsSL https://raw.githubusercontent.com/LACibermedicina/tele.M3D.pro/main/install.sh | sudo bash`} />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    O script clona o repositório do GitHub, configura o banco de dados (61 tabelas), compila a aplicação e inicia o serviço com PM2.
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
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
      - SESSION_SECRET=\${SESSION_SECRET}
      - AGORA_APP_ID=\${AGORA_APP_ID}
      - AGORA_APP_CERTIFICATE=\${AGORA_APP_CERTIFICATE}
      - PAYPAL_CLIENT_ID=\${PAYPAL_CLIENT_ID}
      - PAYPAL_CLIENT_SECRET=\${PAYPAL_CLIENT_SECRET}
      - AI_INTEGRATIONS_OPENAI_API_KEY=\${AI_INTEGRATIONS_OPENAI_API_KEY}
      - AI_INTEGRATIONS_OPENAI_BASE_URL=\${AI_INTEGRATIONS_OPENAI_BASE_URL}
      - NODE_ENV=production
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
  pgdata:`} />
                  <CodeBlock title="Terminal" code={`# Build e iniciar
docker-compose up -d

# Aplicar migrações (61 tabelas)
docker-compose exec app npm run db:push

# Ver logs
docker-compose logs -f app`} />
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="outline">3</Badge>
                    Checklist de Produção
                  </h3>
                  <div className="space-y-2 text-sm">
                    {[
                      "Configurar DATABASE_URL com banco de produção (Neon, Supabase, AWS RDS)",
                      "Definir GEMINI_API_KEY para IA médica (Google Gemini)",
                      "Configurar AGORA_APP_ID e AGORA_APP_CERTIFICATE para teleconsultas",
                      "Configurar PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET para compra de créditos TMC",
                      "Definir SESSION_SECRET com chave forte e aleatória",
                      "Ativar HTTPS/TLS (obrigatório para WebRTC)",
                      "Configurar backup automático do banco de dados (61 tabelas)",
                      "Configurar monitoramento e alertas",
                      "Revisar permissões de acesso e CORS",
                      "Configurar timeout de inatividade no painel Admin (auto-logout)",
                      "Configurar e-mail de destinatário PayPal nas configurações do Admin",
                      "Verificar conformidade FHIR R4 para exportação de dados de pacientes",
                      "Testar todas as funcionalidades críticas",
                      "Configurar domínio personalizado e DNS"
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
                  <Database className="h-5 w-5 text-blue-600" />
                  Estrutura do Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  O schema possui 61 tabelas gerenciadas pelo Drizzle ORM. Principais tabelas:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {[
                    { name: "users", desc: "Médicos, admins, pacientes" },
                    { name: "patients", desc: "Dados clínicos dos pacientes" },
                    { name: "appointments", desc: "Agendamentos de consultas" },
                    { name: "video_consultations", desc: "Teleconsultas por vídeo" },
                    { name: "consultation_notes", desc: "Notas das teleconsultas" },
                    { name: "consultation_requests", desc: "Solicitações de consulta" },
                    { name: "consultation_sessions", desc: "Sessões de consulta ativas" },
                    { name: "consultation_access_tokens", desc: "Tokens QR/código de acesso" },
                    { name: "inter_consultations", desc: "Inter-consultas médicas" },
                    { name: "medical_records", desc: "Prontuários eletrônicos" },
                    { name: "prescriptions", desc: "Prescrições médicas" },
                    { name: "post_consultation_items", desc: "Itens pós-consulta (IA)" },
                    { name: "diagnostic_inferences", desc: "Classificação diagnóstica (CID/DSM)" },
                    { name: "whatsapp_messages", desc: "Mensagens do WhatsApp IA" },
                    { name: "doctor_notes", desc: "Anotações do médico" },
                    { name: "doctor_schedule", desc: "Horários dos médicos" },
                    { name: "medical_teams", desc: "Equipes médicas" },
                    { name: "tmc_credit_packages", desc: "Pacotes de créditos TMC" },
                    { name: "paypal_orders", desc: "Pedidos PayPal" },
                    { name: "tmc_transactions", desc: "Transações de créditos TMC" },
                    { name: "wallet_audit_log", desc: "Auditoria de carteira" },
                    { name: "dynamic_nfts", desc: "NFTs dinâmicos (LGPD)" },
                    { name: "nft_ownership", desc: "Propriedade de NFTs" },
                    { name: "broker_orders", desc: "Ordens do broker TM3D/NFT" },
                    { name: "broker_trades", desc: "Negociações do broker" },
                    { name: "tm3d_supply", desc: "Oferta de tokens TM3D" },
                    { name: "external_wallets", desc: "Carteiras externas (MetaMask)" },
                    { name: "withdrawal_requests", desc: "Solicitações de saque" },
                    { name: "chatbot_references", desc: "Referências clínicas da IA" },
                    { name: "pending_notifications", desc: "Notificações pendentes" },
                  ].map((table) => (
                    <div key={table.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{table.name}</code>
                      <span className="text-muted-foreground text-xs">{table.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-amber-600" />
                  Variáveis de Ambiente Completas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {[
                    { name: "DATABASE_URL", required: true, desc: "URL de conexão PostgreSQL" },
                    { name: "PGHOST", required: false, desc: "Host do PostgreSQL (alternativa)" },
                    { name: "PGPORT", required: false, desc: "Porta do PostgreSQL (padrão: 5432)" },
                    { name: "PGUSER", required: false, desc: "Usuário do PostgreSQL" },
                    { name: "PGPASSWORD", required: false, desc: "Senha do PostgreSQL" },
                    { name: "PGDATABASE", required: false, desc: "Nome do banco" },
                    { name: "GEMINI_API_KEY", required: true, desc: "Chave da API Google Gemini" },
                    { name: "AGORA_APP_ID", required: false, desc: "App ID do Agora.io (teleconsultas)" },
                    { name: "AGORA_APP_CERTIFICATE", required: false, desc: "Certificado do Agora.io" },
                    { name: "SESSION_SECRET", required: false, desc: "Chave secreta para sessões" },
                    { name: "AI_INTEGRATIONS_OPENAI_API_KEY", required: false, desc: "Chave OpenAI (fallback IA)" },
                    { name: "AI_INTEGRATIONS_OPENAI_BASE_URL", required: false, desc: "URL base OpenAI (fallback)" },
                    { name: "PAYPAL_CLIENT_ID", required: false, desc: "Client ID do PayPal (compra de créditos TMC)" },
                    { name: "PAYPAL_CLIENT_SECRET", required: false, desc: "Client Secret do PayPal (processamento de pagamentos)" },
                  ].map((env) => (
                    <div key={env.name} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                      <code className="text-xs font-mono font-semibold">{env.name}</code>
                      <Badge variant={env.required ? "destructive" : "secondary"} className="text-[10px]">
                        {env.required ? "obrigatório" : "opcional"}
                      </Badge>
                      <span className="text-muted-foreground text-xs flex-1">{env.desc}</span>
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
