#!/usr/bin/env bash
set -euo pipefail

#===============================================================================
#  Tele<M3D> Pro — Instalador para Servidor Externo
#  Repositório: https://github.com/LACibermedicina/tele.M3D.pro
#
#  Uso:
#    curl -fsSL https://raw.githubusercontent.com/LACibermedicina/tele.M3D.pro/main/install.sh | bash
#    ou
#    wget -qO- https://raw.githubusercontent.com/LACibermedicina/tele.M3D.pro/main/install.sh | bash
#
#  Requisitos: Ubuntu 20.04+ / Debian 11+ (ou derivados)
#  Instala: Node.js 20, PostgreSQL 16, Nginx, Certbot, PM2
#===============================================================================

REPO_URL="https://github.com/LACibermedicina/tele.M3D.pro.git"
APP_DIR="/opt/telemed3"
APP_USER="telemed3"
NODE_VERSION="20"
PG_VERSION="16"
ENV_FILE="$APP_DIR/.env"
SERVICE_NAME="telemed3"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════${NC}"; echo -e "${BOLD}  $1${NC}"; echo -e "${BOLD}${CYAN}═══════════════════════════════════════════${NC}\n"; }

check_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Este script deve ser executado como root (sudo)."
    exit 1
  fi
}

detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS_ID="$ID"
    OS_VERSION="$VERSION_ID"
  else
    err "Sistema operacional não suportado."
    exit 1
  fi

  case "$OS_ID" in
    ubuntu|debian|linuxmint|pop) ;;
    centos|rhel|fedora|rocky|alma)
      warn "Sistema baseado em RHEL detectado. Adaptando comandos..."
      ;;
    *)
      warn "Sistema '$OS_ID' não testado. Prosseguindo mesmo assim..."
      ;;
  esac
}

print_banner() {
  echo -e "${CYAN}"
  cat << 'BANNER'
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║     ████████╗███████╗██╗     ███████╗                 ║
  ║        ██╔══╝██╔════╝██║     ██╔════╝                 ║
  ║        ██║   █████╗  ██║     █████╗                   ║
  ║        ██║   ██╔══╝  ██║     ██╔══╝                   ║
  ║        ██║   ███████╗███████╗███████╗                  ║
  ║        ╚═╝   ╚══════╝╚══════╝╚══════╝                 ║
  ║                  < M 3 D >  Pro                       ║
  ║         Telemedicina & Gestão Clínica                 ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
BANNER
  echo -e "${NC}"
  info "Instalador automático para servidor externo"
  info "Repositório: $REPO_URL"
  echo ""
}

install_dependencies_debian() {
  header "1/8 — Instalando Dependências do Sistema"

  apt-get update -qq
  apt-get install -y -qq curl wget git build-essential ca-certificates gnupg lsb-release software-properties-common > /dev/null 2>&1
  log "Dependências base instaladas"

  if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
    info "Instalando Node.js $NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    log "Node.js $(node -v) instalado"
  else
    log "Node.js $(node -v) já instalado"
  fi

  if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    log "PM2 instalado globalmente"
  else
    log "PM2 já instalado"
  fi
}

install_dependencies_rhel() {
  header "1/8 — Instalando Dependências do Sistema (RHEL)"

  yum install -y -q curl wget git gcc-c++ make ca-certificates > /dev/null 2>&1
  log "Dependências base instaladas"

  if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    yum install -y -q nodejs > /dev/null 2>&1
    log "Node.js $(node -v) instalado"
  else
    log "Node.js $(node -v) já instalado"
  fi

  if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    log "PM2 instalado globalmente"
  fi
}

setup_postgresql() {
  header "2/8 — Configurando PostgreSQL"

  if ! command -v psql &> /dev/null; then
    case "$OS_ID" in
      ubuntu|debian|linuxmint|pop)
        sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - > /dev/null 2>&1
        apt-get update -qq
        apt-get install -y -qq postgresql-${PG_VERSION} postgresql-client-${PG_VERSION} > /dev/null 2>&1
        ;;
      centos|rhel|fedora|rocky|alma)
        yum install -y -q https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm > /dev/null 2>&1
        yum install -y -q postgresql${PG_VERSION}-server postgresql${PG_VERSION} > /dev/null 2>&1
        /usr/pgsql-${PG_VERSION}/bin/postgresql-${PG_VERSION}-setup initdb
        ;;
    esac
    log "PostgreSQL $PG_VERSION instalado"
  else
    log "PostgreSQL já instalado ($(psql --version | head -1))"
  fi

  systemctl enable postgresql > /dev/null 2>&1
  systemctl start postgresql > /dev/null 2>&1

  DB_NAME="telemed3_db"
  DB_USER="telemed3_user"
  DB_PASS=$(openssl rand -hex 16)

  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    warn "Usuário PostgreSQL '$DB_USER' já existe. Atualizando senha..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null 2>&1
  else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null 2>&1
    log "Usuário PostgreSQL '$DB_USER' criado"
  fi

  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    warn "Banco de dados '$DB_NAME' já existe"
  else
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null 2>&1
    log "Banco de dados '$DB_NAME' criado"
  fi

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" > /dev/null 2>&1

  DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
  log "PostgreSQL configurado com sucesso"
}

create_app_user() {
  header "3/8 — Criando Usuário do Sistema"

  if id "$APP_USER" &>/dev/null; then
    warn "Usuário '$APP_USER' já existe"
  else
    useradd -r -m -s /bin/bash -d /home/$APP_USER $APP_USER
    log "Usuário '$APP_USER' criado"
  fi
}

clone_repository() {
  header "4/8 — Clonando Repositório"

  if [[ -d "$APP_DIR" ]]; then
    warn "Diretório $APP_DIR já existe."
    read -p "  Deseja atualizar (pull)? [S/n]: " update_choice
    update_choice=${update_choice:-S}
    if [[ "$update_choice" =~ ^[Ss]$ ]]; then
      cd "$APP_DIR"
      sudo -u $APP_USER git pull origin main 2>/dev/null || git pull origin main
      log "Repositório atualizado"
    fi
  else
    git clone "$REPO_URL" "$APP_DIR"
    chown -R $APP_USER:$APP_USER "$APP_DIR"
    log "Repositório clonado em $APP_DIR"
  fi
}

configure_environment() {
  header "5/8 — Configurando Variáveis de Ambiente"

  SESSION_SECRET=$(openssl rand -hex 32)

  if [[ -f "$ENV_FILE" ]]; then
    warn "Arquivo .env já existe. Criando backup..."
    cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  fi

  cat > "$ENV_FILE" << ENVEOF
# ══════════════════════════════════════════
# Tele<M3D> Pro — Variáveis de Ambiente
# Gerado em: $(date '+%Y-%m-%d %H:%M:%S')
# ══════════════════════════════════════════

# ── Servidor ──
NODE_ENV=production
PORT=5000
SESSION_SECRET=$SESSION_SECRET

# ── Banco de Dados ──
DATABASE_URL=$DATABASE_URL

# ── IA / Gemini (obrigatório para funcionalidades de IA) ──
GEMINI_API_KEY=

# ── IA / OpenAI (fallback opcional) ──
OPENAI_API_KEY=

# ── Agora.io (obrigatório para teleconsultas por vídeo) ──
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=

# ── PayPal (opcional — para compra de créditos TMC) ──
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# ── WhatsApp Business API (opcional) ──
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# ── URL base pública (preencher com domínio do servidor) ──
BASE_URL=https://seu-dominio.com
ENVEOF

  chown $APP_USER:$APP_USER "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "Arquivo .env criado em $ENV_FILE"

  echo ""
  warn "IMPORTANTE: Edite o arquivo .env com suas chaves de API:"
  info "  sudo nano $ENV_FILE"
  echo ""
  info "  Chaves obrigatórias:"
  info "    - GEMINI_API_KEY    → https://aistudio.google.com/apikey"
  info "    - AGORA_APP_ID      → https://console.agora.io"
  info "    - AGORA_APP_CERTIFICATE"
  echo ""
  info "  Chaves opcionais:"
  info "    - PAYPAL_CLIENT_ID / SECRET → https://developer.paypal.com"
  info "    - WHATSAPP_ACCESS_TOKEN     → https://developers.facebook.com"
}

install_application() {
  header "6/8 — Instalando Aplicação"

  cd "$APP_DIR"

  info "Instalando dependências npm..."
  sudo -u $APP_USER npm ci --omit=dev 2>/dev/null || sudo -u $APP_USER npm install --omit=dev
  log "Dependências instaladas"

  info "Compilando aplicação (build)..."
  sudo -u $APP_USER npm run build
  log "Build concluído com sucesso"

  info "Aplicando schema do banco de dados..."
  sudo -u $APP_USER npx drizzle-kit push --force 2>/dev/null || {
    warn "drizzle-kit push requer devDependencies. Instalando temporariamente..."
    sudo -u $APP_USER npm install
    sudo -u $APP_USER npx drizzle-kit push --force
    sudo -u $APP_USER npm prune --omit=dev
  }
  log "Schema do banco aplicado"
}

setup_pm2() {
  header "7/8 — Configurando PM2 (Process Manager)"

  cd "$APP_DIR"

  cat > ecosystem.config.cjs << 'PM2EOF'
module.exports = {
  apps: [{
    name: 'telemed3',
    script: 'dist/index.js',
    cwd: '/opt/telemed3',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '/opt/telemed3/.env',
    max_memory_restart: '512M',
    error_file: '/var/log/telemed3/error.log',
    out_file: '/var/log/telemed3/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
  }]
};
PM2EOF

  chown $APP_USER:$APP_USER ecosystem.config.cjs

  mkdir -p /var/log/telemed3
  chown $APP_USER:$APP_USER /var/log/telemed3

  sudo -u $APP_USER pm2 start ecosystem.config.cjs --env production
  sudo -u $APP_USER pm2 save

  env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER > /dev/null 2>&1 || true
  log "PM2 configurado e aplicação iniciada"
}

setup_nginx() {
  header "8/8 — Configurando Nginx (Proxy Reverso)"

  case "$OS_ID" in
    ubuntu|debian|linuxmint|pop)
      apt-get install -y -qq nginx certbot python3-certbot-nginx > /dev/null 2>&1
      ;;
    centos|rhel|fedora|rocky|alma)
      yum install -y -q nginx certbot python3-certbot-nginx > /dev/null 2>&1
      ;;
  esac

  read -p "  Informe o domínio do servidor (ex: med.exemplo.com.br): " DOMAIN
  DOMAIN=${DOMAIN:-localhost}

  cat > /etc/nginx/sites-available/telemed3 << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINXEOF

  mkdir -p /etc/nginx/sites-enabled
  ln -sf /etc/nginx/sites-available/telemed3 /etc/nginx/sites-enabled/telemed3
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  nginx -t > /dev/null 2>&1
  systemctl enable nginx > /dev/null 2>&1
  systemctl restart nginx
  log "Nginx configurado para domínio: $DOMAIN"

  if [[ "$DOMAIN" != "localhost" ]]; then
    read -p "  Deseja configurar SSL com Let's Encrypt? [S/n]: " ssl_choice
    ssl_choice=${ssl_choice:-S}
    if [[ "$ssl_choice" =~ ^[Ss]$ ]]; then
      read -p "  Informe o e-mail para o certificado SSL: " SSL_EMAIL
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || {
        warn "Falha ao obter certificado SSL. Verifique se o DNS aponta para este servidor."
        info "Você pode tentar novamente com: sudo certbot --nginx -d $DOMAIN"
      }
    fi
  fi
}

setup_firewall() {
  if command -v ufw &> /dev/null; then
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw allow 22/tcp > /dev/null 2>&1
    log "Firewall (UFW) configurado: portas 22, 80, 443"
  fi
}

print_summary() {
  echo ""
  echo -e "${CYAN}"
  cat << 'SUMMARY'
  ╔═══════════════════════════════════════════════════════╗
  ║          INSTALAÇÃO CONCLUÍDA COM SUCESSO!           ║
  ╚═══════════════════════════════════════════════════════╝
SUMMARY
  echo -e "${NC}"

  info "Diretório da aplicação: $APP_DIR"
  info "Arquivo de configuração: $ENV_FILE"
  info "Logs: /var/log/telemed3/"
  echo ""
  echo -e "${BOLD}Próximos passos:${NC}"
  echo ""
  echo "  1. Edite as variáveis de ambiente:"
  echo -e "     ${CYAN}sudo nano $ENV_FILE${NC}"
  echo ""
  echo "  2. Reinicie a aplicação:"
  echo -e "     ${CYAN}sudo -u $APP_USER pm2 restart telemed3${NC}"
  echo ""
  echo "  3. Acesse no navegador:"
  if [[ "${DOMAIN:-localhost}" != "localhost" ]]; then
    echo -e "     ${CYAN}https://$DOMAIN${NC}"
  else
    echo -e "     ${CYAN}http://SEU_IP:5000${NC}"
  fi
  echo ""
  echo -e "${BOLD}Comandos úteis:${NC}"
  echo ""
  echo "  Ver status:        sudo -u $APP_USER pm2 status"
  echo "  Ver logs:          sudo -u $APP_USER pm2 logs telemed3"
  echo "  Reiniciar:         sudo -u $APP_USER pm2 restart telemed3"
  echo "  Parar:             sudo -u $APP_USER pm2 stop telemed3"
  echo "  Atualizar código:  cd $APP_DIR && git pull && npm ci --omit=dev && npm run build && pm2 restart telemed3"
  echo ""
  echo -e "${BOLD}Banco de dados:${NC}"
  echo "  Conectar:          sudo -u postgres psql -d $DB_NAME"
  echo "  Aplicar schema:    cd $APP_DIR && npx drizzle-kit push"
  echo ""
  warn "Lembre-se de configurar as chaves de API no arquivo .env antes de usar!"
  echo ""
}

# ══════════════════════════════════════════
# EXECUÇÃO PRINCIPAL
# ══════════════════════════════════════════

main() {
  check_root
  detect_os
  print_banner

  echo -e "${BOLD}Este script irá instalar:${NC}"
  echo "  • Node.js $NODE_VERSION + PM2"
  echo "  • PostgreSQL $PG_VERSION"
  echo "  • Nginx + Certbot (SSL)"
  echo "  • Aplicação Tele<M3D> Pro"
  echo ""
  read -p "Deseja continuar? [S/n]: " proceed
  proceed=${proceed:-S}
  if [[ ! "$proceed" =~ ^[Ss]$ ]]; then
    info "Instalação cancelada."
    exit 0
  fi

  case "$OS_ID" in
    ubuntu|debian|linuxmint|pop)
      install_dependencies_debian
      ;;
    *)
      install_dependencies_rhel
      ;;
  esac

  setup_postgresql
  create_app_user
  clone_repository
  configure_environment
  install_application
  setup_pm2
  setup_nginx
  setup_firewall
  print_summary
}

main "$@"
